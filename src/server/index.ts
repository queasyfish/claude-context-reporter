/**
 * Simple HTTP server for receiving context reports
 * Run with: npx claude-context-reporter-server
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const DEFAULT_PORT = 9847;
const REPORTS_DIR = './reports';
const SCREENSHOTS_DIR = './reports/screenshots';

/**
 * Suggest related files based on component path
 */
function suggestRelatedFiles(componentPath: ComponentPathItem[]): Array<{
  suggestedPath: string;
  type: string;
  reason: string;
}> {
  const files: Array<{ suggestedPath: string; type: string; reason: string }> = [];

  // Find app components (filter out framework)
  const appComponents = componentPath.filter(
    (c) =>
      !c.name.includes('Router') &&
      !c.name.includes('Provider') &&
      !c.name.includes('Boundary') &&
      !c.name.includes('Root') &&
      !c.name.includes('Handler') &&
      !c.name.includes('HotReload') &&
      !c.name.includes('Suspense')
  );

  const targetComponent = appComponents[appComponents.length - 1];
  const parentComponent = appComponents[appComponents.length - 2];

  if (targetComponent) {
    // If we have source location, use it
    if (targetComponent.sourceLocation) {
      files.push({
        suggestedPath: targetComponent.sourceLocation.fileName,
        type: 'component',
        reason: 'Selected component (from debug source)',
      });
    } else {
      files.push({
        suggestedPath: `src/components/${targetComponent.name}.tsx`,
        type: 'component',
        reason: 'Selected component (guessed path)',
      });
    }

    // Suggest related hook
    const hookName = targetComponent.name.replace(/Section|Page|Panel|Modal|Wizard/, '');
    files.push({
      suggestedPath: `src/hooks/use${hookName}.ts`,
      type: 'hook',
      reason: 'Potential data hook for this component',
    });
  }

  if (parentComponent?.sourceLocation) {
    files.push({
      suggestedPath: parentComponent.sourceLocation.fileName,
      type: 'component',
      reason: 'Parent component (from debug source)',
    });
  }

  return files;
}

interface SourceLocation {
  fileName: string;
  lineNumber: number;
  columnNumber?: number;
}

interface ComponentPathItem {
  name: string;
  source: string;
  sourceLocation?: SourceLocation;
  props?: Record<string, unknown>;
  state?: unknown[];
}

interface ComputedStyles {
  display: string;
  position: string;
  visibility: string;
  opacity: string;
  width: string;
  height: string;
  padding: string;
  margin: string;
  border: string;
  backgroundColor: string;
  color: string;
  fontSize: string;
  fontWeight: string;
  cursor: string;
  pointerEvents: string;
  overflow: string;
  zIndex: string;
}

interface DOMContext {
  parents: Array<{
    tagName: string;
    id: string;
    className: string;
    htmlPreview: string;
  }>;
  previousSibling: string | null;
  nextSibling: string | null;
  childCount: number;
  innerHTML: string;
}

interface ConsoleEntry {
  level: 'error' | 'warn';
  message: string;
  timestamp: number;
}

interface ContextReport {
  id: string;
  timestamp: string;
  url: string;
  viewport: { width: number; height: number };
  description?: string;
  selectedElement: {
    tagName: string;
    id: string;
    className: string;
    textContent: string;
    attributes: Record<string, string>;
    boundingRect: { x: number; y: number; width: number; height: number };
    selector: string;
    computedStyles: ComputedStyles;
    domContext: DOMContext;
    accessibility: {
      role: string | null;
      ariaLabel: string | null;
      ariaDescribedBy: string | null;
      ariaDisabled: string | null;
      tabIndex: string | null;
    };
  };
  componentPath: ComponentPathItem[];
  appState: Record<string, unknown>;
  environment: {
    react?: string;
    userAgent: string;
    timestamp: string;
    url: string;
  };
  consoleErrors?: ConsoleEntry[];
}

interface ContextScreenshot {
  reportId: string;
  data: string;
}

/**
 * Generate a filename from the report
 */
function generateFilename(report: ContextReport): string {
  const date = new Date(report.timestamp);
  const dateStr = date.toISOString().split('T')[0];
  const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '');

  let slug = report.selectedElement.id ||
    report.description?.split(' ')[0] ||
    report.selectedElement.tagName.toLowerCase();
  slug = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20);

  return `context-${dateStr}-${timeStr}-${slug}`;
}

/**
 * Format component path as a tree with source info
 */
function formatComponentPath(path: ComponentPathItem[]): string {
  if (path.length === 0) return 'Unknown';

  return path
    .map((item, index) => {
      const indent = '  '.repeat(index);
      const prefix = index === 0 ? '' : '└── ';
      const suffix = index === path.length - 1 ? '  ← selected' : '';
      const source = item.sourceLocation
        ? ` (${item.sourceLocation.fileName}:${item.sourceLocation.lineNumber})`
        : '';
      return `${indent}${prefix}${item.name}${source}${suffix}`;
    })
    .join('\n');
}

/**
 * Generate markdown content for a report
 */
function generateMarkdown(report: ContextReport, screenshotFilename?: string): string {
  const el = report.selectedElement;
  const title = report.description ||
    `${el.tagName}${el.id ? '#' + el.id : ''}${el.className ? '.' + el.className.split(' ')[0] : ''}`;

  let md = `# Context Report: ${title}

**Captured**: ${new Date(report.timestamp).toLocaleString()}
**URL**: ${report.url}
**Viewport**: ${report.viewport.width}x${report.viewport.height}

`;

  if (screenshotFilename) {
    md += `## Screenshot
![Screenshot](./screenshots/${screenshotFilename})

`;
  }

  md += `## User Description
${report.description || 'No description provided'}

## Selected Element

### Basic Info
| Property | Value |
|----------|-------|
| Tag | \`${el.tagName}\` |
| ID | \`${el.id || '(none)'}\` |
| Classes | \`${el.className || '(none)'}\` |
| Selector | \`${el.selector}\` |
| Position | x: ${el.boundingRect.x}, y: ${el.boundingRect.y} |
| Size | ${el.boundingRect.width}x${el.boundingRect.height} |

### Text Content
\`\`\`
${el.textContent.slice(0, 300)}${el.textContent.length > 300 ? '...' : ''}
\`\`\`

### Attributes
\`\`\`json
${JSON.stringify(el.attributes, null, 2)}
\`\`\`

### Accessibility
| Attribute | Value |
|-----------|-------|
| role | ${el.accessibility.role || '(none)'} |
| aria-label | ${el.accessibility.ariaLabel || '(none)'} |
| aria-describedby | ${el.accessibility.ariaDescribedBy || '(none)'} |
| aria-disabled | ${el.accessibility.ariaDisabled || '(none)'} |
| tabindex | ${el.accessibility.tabIndex || '(none)'} |

### Computed Styles
\`\`\`json
${JSON.stringify(el.computedStyles, null, 2)}
\`\`\`

### DOM Context

**Parent Elements:**
${el.domContext.parents.map((p, i) => `${i + 1}. \`<${p.tagName.toLowerCase()}${p.id ? '#' + p.id : ''}${p.className ? '.' + p.className.split(' ')[0] : ''}>\``).join('\n') || '(none)'}

**Siblings:**
- Previous: ${el.domContext.previousSibling || '(none)'}
- Next: ${el.domContext.nextSibling || '(none)'}

**Children:** ${el.domContext.childCount} element(s)

**Inner HTML Preview:**
\`\`\`html
${el.domContext.innerHTML.slice(0, 500)}${el.domContext.innerHTML.length > 500 ? '...' : ''}
\`\`\`

## Component Path
\`\`\`
${formatComponentPath(report.componentPath)}
\`\`\`

`;

  // Add source files section
  const filesWithSource = report.componentPath.filter(c => c.sourceLocation);
  if (filesWithSource.length > 0) {
    md += `### Source Files
| Component | File | Line |
|-----------|------|------|
${filesWithSource.map(c => `| ${c.name} | \`${c.sourceLocation!.fileName}\` | ${c.sourceLocation!.lineNumber} |`).join('\n')}

`;
  }

  // Add props and state for components that have them (filter out empty)
  const componentsWithProps = report.componentPath.filter(c => {
    const hasProps = c.props && Object.keys(c.props).length > 0;
    const hasState = c.state && c.state.length > 0 &&
      !c.state.every(s => s === null || s === '[Unserializable]' ||
        (Array.isArray(s) && s[0] === null));
    return hasProps || hasState;
  });

  if (componentsWithProps.length > 0) {
    md += `### Component Props & State

`;
    for (const comp of componentsWithProps) {
      md += `#### ${comp.name}
`;
      if (comp.props && Object.keys(comp.props).length > 0) {
        md += `**Props:**
\`\`\`json
${JSON.stringify(comp.props, null, 2)}
\`\`\`

`;
      }
      // Filter out noise from state display
      const meaningfulState = comp.state?.filter(s =>
        s !== null && s !== '[Unserializable]' &&
        !(Array.isArray(s) && s[0] === null)
      );
      if (meaningfulState && meaningfulState.length > 0) {
        md += `**Local State (useState values):**
\`\`\`json
${JSON.stringify(meaningfulState, null, 2)}
\`\`\`

`;
      }
    }
  }

  // Add suggested files section
  const suggestedFiles = suggestRelatedFiles(report.componentPath);
  if (suggestedFiles.length > 0) {
    md += `### Suggested Files to Investigate
| File | Type | Reason |
|------|------|--------|
${suggestedFiles.map(f => `| \`${f.suggestedPath}\` | ${f.type} | ${f.reason} |`).join('\n')}

`;
  }

  md += `## Application State
`;

  for (const [manager, state] of Object.entries(report.appState)) {
    if (state) {
      md += `
### ${manager.charAt(0).toUpperCase() + manager.slice(1)}
\`\`\`json
${JSON.stringify(state, null, 2)}
\`\`\`
`;
    }
  }

  // Add console errors if present
  if (report.consoleErrors && report.consoleErrors.length > 0) {
    md += `
## Console Errors & Warnings
${report.consoleErrors.map(e => `
### ${e.level.toUpperCase()} (${new Date(e.timestamp).toLocaleTimeString()})
\`\`\`
${e.message}
\`\`\`
`).join('\n')}
`;
  }

  md += `
## Environment
- **React**: ${report.environment.react || 'Unknown'}
- **User Agent**: ${report.environment.userAgent}
`;

  return md;
}

/**
 * Ensure directories exist
 */
async function ensureDirectories(): Promise<void> {
  if (!existsSync(REPORTS_DIR)) {
    await mkdir(REPORTS_DIR, { recursive: true });
  }
  if (!existsSync(SCREENSHOTS_DIR)) {
    await mkdir(SCREENSHOTS_DIR, { recursive: true });
  }
}

/**
 * Parse JSON body from request
 */
async function parseBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

/**
 * Store for pending reports (waiting for screenshots)
 */
const pendingReports = new Map<string, { report: ContextReport; filename: string }>();

/**
 * Handle incoming requests
 */
async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const url = req.url || '/';

  // Health check endpoint
  if (req.method === 'GET' && url === '/health') {
    sendJson(res, 200, { status: 'ok', version: '0.1.0' });
    return;
  }

  // Report endpoint
  if (req.method === 'POST' && url === '/report') {
    try {
      await ensureDirectories();
      const report = await parseBody<ContextReport>(req);
      const filename = generateFilename(report);

      // Store report, waiting for potential screenshot
      pendingReports.set(report.id, { report, filename });

      // Set timeout to write report even if no screenshot arrives
      setTimeout(async () => {
        const pending = pendingReports.get(report.id);
        if (pending) {
          pendingReports.delete(report.id);
          const markdown = generateMarkdown(pending.report);
          const filepath = join(REPORTS_DIR, `${pending.filename}.md`);
          await writeFile(filepath, markdown, 'utf-8');
          console.log(`[ContextReporter] Saved report: ${filepath}`);
        }
      }, 2000);

      sendJson(res, 200, {
        success: true,
        id: report.id,
        filename: `${filename}.md`
      });
    } catch (err) {
      console.error('[ContextReporter] Error saving report:', err);
      sendJson(res, 500, { error: 'Failed to save report' });
    }
    return;
  }

  // Screenshot endpoint
  if (req.method === 'POST' && url === '/screenshot') {
    try {
      await ensureDirectories();
      const screenshot = await parseBody<ContextScreenshot>(req);

      // Check if we have a pending report for this screenshot
      const pending = pendingReports.get(screenshot.reportId);

      // Extract base64 data
      const base64Data = screenshot.data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      let filename: string;
      if (pending) {
        filename = pending.filename;
        pendingReports.delete(screenshot.reportId);

        // Write screenshot
        const screenshotPath = join(SCREENSHOTS_DIR, `${filename}.png`);
        await writeFile(screenshotPath, buffer);
        console.log(`[ContextReporter] Saved screenshot: ${screenshotPath}`);

        // Write report with screenshot reference
        const markdown = generateMarkdown(pending.report, `${filename}.png`);
        const reportPath = join(REPORTS_DIR, `${filename}.md`);
        await writeFile(reportPath, markdown, 'utf-8');
        console.log(`[ContextReporter] Saved report: ${reportPath}`);
      } else {
        // No pending report, save screenshot with timestamp
        filename = `screenshot-${Date.now()}`;
        const screenshotPath = join(SCREENSHOTS_DIR, `${filename}.png`);
        await writeFile(screenshotPath, buffer);
        console.log(`[ContextReporter] Saved orphan screenshot: ${screenshotPath}`);
      }

      sendJson(res, 200, {
        success: true,
        filename: `${filename}.png`
      });
    } catch (err) {
      console.error('[ContextReporter] Error saving screenshot:', err);
      sendJson(res, 500, { error: 'Failed to save screenshot' });
    }
    return;
  }

  // List reports endpoint
  if (req.method === 'GET' && url === '/reports') {
    try {
      const { readdir, stat } = await import('fs/promises');

      if (!existsSync(REPORTS_DIR)) {
        sendJson(res, 200, { reports: [] });
        return;
      }

      const files = await readdir(REPORTS_DIR);
      const reports = [];

      for (const file of files) {
        if (file.endsWith('.md')) {
          const filepath = join(REPORTS_DIR, file);
          const stats = await stat(filepath);
          reports.push({
            filename: file,
            created: stats.mtime.toISOString(),
            size: stats.size,
          });
        }
      }

      // Sort by creation time, newest first
      reports.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

      sendJson(res, 200, { reports });
    } catch (err) {
      console.error('[ContextReporter] Error listing reports:', err);
      sendJson(res, 500, { error: 'Failed to list reports' });
    }
    return;
  }

  // 404 for unknown routes
  sendJson(res, 404, { error: 'Not found' });
}

/**
 * Start the server
 */
export function startServer(port: number = DEFAULT_PORT): void {
  const server = createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error('[ContextReporter] Request error:', err);
      sendJson(res, 500, { error: 'Internal server error' });
    });
  });

  server.listen(port, () => {
    console.log(`
┌─────────────────────────────────────────────────────────┐
│  Claude Context Reporter Server                         │
│                                                         │
│  Listening on: http://localhost:${port}                  │
│  Reports saved to: ${REPORTS_DIR}/                            │
│                                                         │
│  Endpoints:                                             │
│    GET  /health     - Health check                      │
│    POST /report     - Submit context report             │
│    POST /screenshot - Submit screenshot                 │
│    GET  /reports    - List saved reports                │
│                                                         │
│  Press Ctrl+C to stop                                   │
└─────────────────────────────────────────────────────────┘
`);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[ContextReporter] Shutting down...');
    server.close(() => {
      process.exit(0);
    });
  });
}

// CLI entry point
if (require.main === module || process.argv[1]?.includes('context-reporter-server')) {
  const port = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
  startServer(port);
}
