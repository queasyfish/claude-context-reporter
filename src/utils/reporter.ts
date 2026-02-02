import { CONSOLE_TAGS, type ContextReport, type ContextScreenshot, type ConsoleEntry } from '../types';

const DEFAULT_SERVER_URL = 'http://localhost:9847';
const LOCAL_STORAGE_KEY = 'contextReports';

/**
 * Reporter configuration
 */
export interface ReporterConfig {
  /** Server URL for direct file writing (default: http://localhost:9847) */
  serverUrl?: string;
  /** Timeout for server requests in ms (default: 1000) */
  serverTimeout?: number;
  /** Always use console even if server is available */
  forceConsole?: boolean;
}

let cachedServerAvailable: boolean | null = null;
let lastServerCheck = 0;
const SERVER_CHECK_INTERVAL = 5000; // Re-check every 5 seconds

/**
 * Check if the local server is available
 */
async function checkServerAvailable(serverUrl: string, timeout: number): Promise<boolean> {
  const now = Date.now();

  // Use cached result if recent
  if (cachedServerAvailable !== null && now - lastServerCheck < SERVER_CHECK_INTERVAL) {
    return cachedServerAvailable;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${serverUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    cachedServerAvailable = response.ok;
    lastServerCheck = now;
    return cachedServerAvailable;
  } catch {
    cachedServerAvailable = false;
    lastServerCheck = now;
    return false;
  }
}

/**
 * Send report to server
 */
async function sendToServer(
  endpoint: string,
  data: ContextReport | ContextScreenshot,
  serverUrl: string,
  timeout: number
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${serverUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Generate a unique report ID
 */
export function generateReportId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `report-${timestamp}-${random}`;
}

/**
 * Save report to localStorage for retrieval by Claude Code MCP
 * Reports are stored as an array to preserve multiple captures
 */
function saveToLocalStorage(report: ContextReport): void {
  try {
    const existing = localStorage.getItem(LOCAL_STORAGE_KEY);
    const reports: ContextReport[] = existing ? JSON.parse(existing) : [];

    // Add new report (most recent first)
    reports.unshift(report);

    // Keep only the last 20 reports to prevent storage overflow
    const trimmed = reports.slice(0, 20);

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('[ContextReporter] Failed to save to localStorage:', err);
  }
}

/**
 * Get all reports from localStorage
 */
export function getStoredReports(): ContextReport[] {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Clear all reports from localStorage
 */
export function clearStoredReports(): void {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch (err) {
    console.warn('[ContextReporter] Failed to clear localStorage:', err);
  }
}

/**
 * Output a context report - tries server first, falls back to console
 * Always saves to localStorage for retrieval via Claude Code MCP
 */
export async function logContextReport(
  report: ContextReport,
  config: ReporterConfig = {}
): Promise<{ method: 'server' | 'console'; success: boolean }> {
  const {
    serverUrl = DEFAULT_SERVER_URL,
    serverTimeout = 1000,
    forceConsole = false,
  } = config;

  // Always save to localStorage for MCP retrieval
  saveToLocalStorage(report);

  // Try server first (unless forced to console)
  if (!forceConsole) {
    const serverAvailable = await checkServerAvailable(serverUrl, serverTimeout);

    if (serverAvailable) {
      const sent = await sendToServer('/report', report, serverUrl, serverTimeout);
      if (sent) {
        // Also log a brief console message for visibility
        console.log(`[ContextReporter] Report sent to server: ${report.id}`);
        return { method: 'server', success: true };
      }
    }
  }

  // Fall back to console logging
  console.log(CONSOLE_TAGS.REPORT, JSON.stringify(report));

  // Also log a human-readable summary
  console.group(`Context Report: ${report.id}`);
  console.log('URL:', report.url);
  console.log('Element:', `${report.selectedElement.tagName}#${report.selectedElement.id || '(no id)'}`);
  console.log('Component Path:', report.componentPath.map((c) => c.name).join(' > '));
  if (report.description) {
    console.log('Description:', report.description);
  }
  console.log('Note: Run /process-reports in Claude Code to retrieve this report');
  console.groupEnd();

  return { method: 'console', success: true };
}

/**
 * Output a screenshot - tries server first, falls back to console
 */
export async function logContextScreenshot(
  screenshot: ContextScreenshot,
  config: ReporterConfig = {}
): Promise<{ method: 'server' | 'console'; success: boolean }> {
  const {
    serverUrl = DEFAULT_SERVER_URL,
    serverTimeout = 2000, // Longer timeout for screenshots (larger payload)
    forceConsole = false,
  } = config;

  // Try server first (unless forced to console)
  if (!forceConsole) {
    const serverAvailable = await checkServerAvailable(serverUrl, serverTimeout);

    if (serverAvailable) {
      const sent = await sendToServer('/screenshot', screenshot, serverUrl, serverTimeout);
      if (sent) {
        console.log(`[ContextReporter] Screenshot sent to server: ${screenshot.reportId}`);
        return { method: 'server', success: true };
      }
    }
  }

  // Fall back to console logging
  console.log(CONSOLE_TAGS.SCREENSHOT, JSON.stringify(screenshot));
  console.log(`[ContextReporter] Screenshot captured for report: ${screenshot.reportId}`);

  return { method: 'console', success: true };
}

/**
 * Create a full context report object
 */
export function createContextReport(params: {
  id: string;
  selectedElement: ContextReport['selectedElement'];
  componentPath: ContextReport['componentPath'];
  appState: ContextReport['appState'];
  description?: string;
  consoleErrors?: ConsoleEntry[];
}): ContextReport {
  return {
    id: params.id,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    description: params.description,
    selectedElement: params.selectedElement,
    componentPath: params.componentPath,
    appState: params.appState,
    environment: {
      react: detectReactVersion(),
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    },
    consoleErrors: params.consoleErrors,
  };
}

/**
 * Detect React version if available
 */
function detectReactVersion(): string | undefined {
  const win = window as unknown as Record<string, unknown>;

  // Check for React DevTools hook
  const devTools = win.__REACT_DEVTOOLS_GLOBAL_HOOK__ as
    | { renderers?: Map<number, { version?: string }> }
    | undefined;
  if (devTools?.renderers) {
    for (const renderer of devTools.renderers.values()) {
      if (renderer.version) {
        return renderer.version;
      }
    }
  }

  // Check for exposed React global
  const react = win.React as { version?: string } | undefined;
  if (react?.version) {
    return react.version;
  }

  return undefined;
}

/**
 * Check if server is currently available (for UI feedback)
 */
export async function isServerAvailable(
  serverUrl: string = DEFAULT_SERVER_URL,
  timeout: number = 1000
): Promise<boolean> {
  return checkServerAvailable(serverUrl, timeout);
}

/**
 * Clear the server availability cache (useful after starting server)
 */
export function clearServerCache(): void {
  cachedServerAvailable = null;
  lastServerCheck = 0;
}
