import { createServer } from 'http';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var DEFAULT_PORT = 9847;
var REPORTS_DIR = "./reports";
var SCREENSHOTS_DIR = "./reports/screenshots";
function suggestRelatedFiles(componentPath) {
  const files = [];
  const appComponents = componentPath.filter(
    (c) => !c.name.includes("Router") && !c.name.includes("Provider") && !c.name.includes("Boundary") && !c.name.includes("Root") && !c.name.includes("Handler") && !c.name.includes("HotReload") && !c.name.includes("Suspense")
  );
  const targetComponent = appComponents[appComponents.length - 1];
  const parentComponent = appComponents[appComponents.length - 2];
  if (targetComponent) {
    if (targetComponent.sourceLocation) {
      files.push({
        suggestedPath: targetComponent.sourceLocation.fileName,
        type: "component",
        reason: "Selected component (from debug source)"
      });
    } else {
      files.push({
        suggestedPath: `src/components/${targetComponent.name}.tsx`,
        type: "component",
        reason: "Selected component (guessed path)"
      });
    }
    const hookName = targetComponent.name.replace(/Section|Page|Panel|Modal|Wizard/, "");
    files.push({
      suggestedPath: `src/hooks/use${hookName}.ts`,
      type: "hook",
      reason: "Potential data hook for this component"
    });
  }
  if (parentComponent?.sourceLocation) {
    files.push({
      suggestedPath: parentComponent.sourceLocation.fileName,
      type: "component",
      reason: "Parent component (from debug source)"
    });
  }
  return files;
}
function generateFilename(report) {
  const date = new Date(report.timestamp);
  const dateStr = date.toISOString().split("T")[0];
  const timeStr = date.toTimeString().split(" ")[0].replace(/:/g, "");
  let slug = report.selectedElement.id || report.description?.split(" ")[0] || report.selectedElement.tagName.toLowerCase();
  slug = slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 20);
  return `context-${dateStr}-${timeStr}-${slug}`;
}
function formatComponentPath(path) {
  if (path.length === 0) return "Unknown";
  return path.map((item, index) => {
    const indent = "  ".repeat(index);
    const prefix = index === 0 ? "" : "\u2514\u2500\u2500 ";
    const suffix = index === path.length - 1 ? "  \u2190 selected" : "";
    const source = item.sourceLocation ? ` (${item.sourceLocation.fileName}:${item.sourceLocation.lineNumber})` : "";
    return `${indent}${prefix}${item.name}${source}${suffix}`;
  }).join("\n");
}
function generateMarkdown(report, screenshotFilename) {
  const el = report.selectedElement;
  const title = report.description || `${el.tagName}${el.id ? "#" + el.id : ""}${el.className ? "." + el.className.split(" ")[0] : ""}`;
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
${report.description || "No description provided"}

## Selected Element

### Basic Info
| Property | Value |
|----------|-------|
| Tag | \`${el.tagName}\` |
| ID | \`${el.id || "(none)"}\` |
| Classes | \`${el.className || "(none)"}\` |
| Selector | \`${el.selector}\` |
| Position | x: ${el.boundingRect.x}, y: ${el.boundingRect.y} |
| Size | ${el.boundingRect.width}x${el.boundingRect.height} |

### Text Content
\`\`\`
${el.textContent.slice(0, 300)}${el.textContent.length > 300 ? "..." : ""}
\`\`\`

### Attributes
\`\`\`json
${JSON.stringify(el.attributes, null, 2)}
\`\`\`

### Accessibility
| Attribute | Value |
|-----------|-------|
| role | ${el.accessibility.role || "(none)"} |
| aria-label | ${el.accessibility.ariaLabel || "(none)"} |
| aria-describedby | ${el.accessibility.ariaDescribedBy || "(none)"} |
| aria-disabled | ${el.accessibility.ariaDisabled || "(none)"} |
| tabindex | ${el.accessibility.tabIndex || "(none)"} |

### Computed Styles
\`\`\`json
${JSON.stringify(el.computedStyles, null, 2)}
\`\`\`

### DOM Context

**Parent Elements:**
${el.domContext.parents.map((p, i) => `${i + 1}. \`<${p.tagName.toLowerCase()}${p.id ? "#" + p.id : ""}${p.className ? "." + p.className.split(" ")[0] : ""}>\``).join("\n") || "(none)"}

**Siblings:**
- Previous: ${el.domContext.previousSibling || "(none)"}
- Next: ${el.domContext.nextSibling || "(none)"}

**Children:** ${el.domContext.childCount} element(s)

**Inner HTML Preview:**
\`\`\`html
${el.domContext.innerHTML.slice(0, 500)}${el.domContext.innerHTML.length > 500 ? "..." : ""}
\`\`\`

## Component Path
\`\`\`
${formatComponentPath(report.componentPath)}
\`\`\`

`;
  const filesWithSource = report.componentPath.filter((c) => c.sourceLocation);
  if (filesWithSource.length > 0) {
    md += `### Source Files
| Component | File | Line |
|-----------|------|------|
${filesWithSource.map((c) => `| ${c.name} | \`${c.sourceLocation.fileName}\` | ${c.sourceLocation.lineNumber} |`).join("\n")}

`;
  }
  const componentsWithProps = report.componentPath.filter((c) => {
    const hasProps = c.props && Object.keys(c.props).length > 0;
    const hasState = c.state && c.state.length > 0 && !c.state.every((s) => s === null || s === "[Unserializable]" || Array.isArray(s) && s[0] === null);
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
      const meaningfulState = comp.state?.filter(
        (s) => s !== null && s !== "[Unserializable]" && !(Array.isArray(s) && s[0] === null)
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
  const suggestedFiles = suggestRelatedFiles(report.componentPath);
  if (suggestedFiles.length > 0) {
    md += `### Suggested Files to Investigate
| File | Type | Reason |
|------|------|--------|
${suggestedFiles.map((f) => `| \`${f.suggestedPath}\` | ${f.type} | ${f.reason} |`).join("\n")}

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
  if (report.consoleErrors && report.consoleErrors.length > 0) {
    md += `
## Console Errors & Warnings
${report.consoleErrors.map((e) => `
### ${e.level.toUpperCase()} (${new Date(e.timestamp).toLocaleTimeString()})
\`\`\`
${e.message}
\`\`\`
`).join("\n")}
`;
  }
  md += `
## Environment
- **React**: ${report.environment.react || "Unknown"}
- **User Agent**: ${report.environment.userAgent}
`;
  return md;
}
async function ensureDirectories() {
  if (!existsSync(REPORTS_DIR)) {
    await mkdir(REPORTS_DIR, { recursive: true });
  }
  if (!existsSync(SCREENSHOTS_DIR)) {
    await mkdir(SCREENSHOTS_DIR, { recursive: true });
  }
}
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}
function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(data));
}
var pendingReports = /* @__PURE__ */ new Map();
async function handleRequest(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }
  const url = req.url || "/";
  if (req.method === "GET" && url === "/health") {
    sendJson(res, 200, { status: "ok", version: "0.1.0" });
    return;
  }
  if (req.method === "POST" && url === "/report") {
    try {
      await ensureDirectories();
      const report = await parseBody(req);
      const filename = generateFilename(report);
      pendingReports.set(report.id, { report, filename });
      setTimeout(async () => {
        const pending = pendingReports.get(report.id);
        if (pending) {
          pendingReports.delete(report.id);
          const markdown = generateMarkdown(pending.report);
          const filepath = join(REPORTS_DIR, `${pending.filename}.md`);
          await writeFile(filepath, markdown, "utf-8");
          console.log(`[ContextReporter] Saved report: ${filepath}`);
        }
      }, 2e3);
      sendJson(res, 200, {
        success: true,
        id: report.id,
        filename: `${filename}.md`
      });
    } catch (err) {
      console.error("[ContextReporter] Error saving report:", err);
      sendJson(res, 500, { error: "Failed to save report" });
    }
    return;
  }
  if (req.method === "POST" && url === "/screenshot") {
    try {
      await ensureDirectories();
      const screenshot = await parseBody(req);
      const pending = pendingReports.get(screenshot.reportId);
      const base64Data = screenshot.data.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      let filename;
      if (pending) {
        filename = pending.filename;
        pendingReports.delete(screenshot.reportId);
        const screenshotPath = join(SCREENSHOTS_DIR, `${filename}.png`);
        await writeFile(screenshotPath, buffer);
        console.log(`[ContextReporter] Saved screenshot: ${screenshotPath}`);
        const markdown = generateMarkdown(pending.report, `${filename}.png`);
        const reportPath = join(REPORTS_DIR, `${filename}.md`);
        await writeFile(reportPath, markdown, "utf-8");
        console.log(`[ContextReporter] Saved report: ${reportPath}`);
      } else {
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
      console.error("[ContextReporter] Error saving screenshot:", err);
      sendJson(res, 500, { error: "Failed to save screenshot" });
    }
    return;
  }
  if (req.method === "GET" && url === "/reports") {
    try {
      const { readdir, stat } = await import('fs/promises');
      if (!existsSync(REPORTS_DIR)) {
        sendJson(res, 200, { reports: [] });
        return;
      }
      const files = await readdir(REPORTS_DIR);
      const reports = [];
      for (const file of files) {
        if (file.endsWith(".md")) {
          const filepath = join(REPORTS_DIR, file);
          const stats = await stat(filepath);
          reports.push({
            filename: file,
            created: stats.mtime.toISOString(),
            size: stats.size
          });
        }
      }
      reports.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
      sendJson(res, 200, { reports });
    } catch (err) {
      console.error("[ContextReporter] Error listing reports:", err);
      sendJson(res, 500, { error: "Failed to list reports" });
    }
    return;
  }
  sendJson(res, 404, { error: "Not found" });
}
function startServer(port = DEFAULT_PORT) {
  const server = createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error("[ContextReporter] Request error:", err);
      sendJson(res, 500, { error: "Internal server error" });
    });
  });
  server.listen(port, () => {
    console.log(`
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502  Claude Context Reporter Server                         \u2502
\u2502                                                         \u2502
\u2502  Listening on: http://localhost:${port}                  \u2502
\u2502  Reports saved to: ${REPORTS_DIR}/                            \u2502
\u2502                                                         \u2502
\u2502  Endpoints:                                             \u2502
\u2502    GET  /health     - Health check                      \u2502
\u2502    POST /report     - Submit context report             \u2502
\u2502    POST /screenshot - Submit screenshot                 \u2502
\u2502    GET  /reports    - List saved reports                \u2502
\u2502                                                         \u2502
\u2502  Press Ctrl+C to stop                                   \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
`);
  });
  process.on("SIGINT", () => {
    console.log("\n[ContextReporter] Shutting down...");
    server.close(() => {
      process.exit(0);
    });
  });
}
if (__require.main === module || process.argv[1]?.includes("context-reporter-server")) {
  const port = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
  startServer(port);
}

export { startServer };
//# sourceMappingURL=server.mjs.map
//# sourceMappingURL=server.mjs.map