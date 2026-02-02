import type { ConsoleEntry } from '../types';

/**
 * Buffer to store recent console errors and warnings
 */
const consoleBuffer: ConsoleEntry[] = [];
const MAX_BUFFER_SIZE = 50;
const MAX_AGE_MS = 60000; // Keep entries for 1 minute

let isIntercepting = false;
let originalError: typeof console.error | null = null;
let originalWarn: typeof console.warn | null = null;

/**
 * Start intercepting console.error and console.warn
 */
export function startConsoleCapture(): void {
  if (isIntercepting) return;

  originalError = console.error;
  originalWarn = console.warn;

  console.error = (...args: unknown[]) => {
    addToBuffer('error', args);
    originalError?.apply(console, args);
  };

  console.warn = (...args: unknown[]) => {
    addToBuffer('warn', args);
    originalWarn?.apply(console, args);
  };

  isIntercepting = true;
}

/**
 * Stop intercepting console
 */
export function stopConsoleCapture(): void {
  if (!isIntercepting) return;

  if (originalError) {
    console.error = originalError;
  }
  if (originalWarn) {
    console.warn = originalWarn;
  }

  isIntercepting = false;
}

/**
 * Add an entry to the buffer
 */
function addToBuffer(level: 'error' | 'warn', args: unknown[]): void {
  const message = args
    .map((arg) => {
      if (arg instanceof Error) {
        return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
      }
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(' ');

  // Don't capture our own logs
  if (message.includes('[ContextReporter]')) return;

  consoleBuffer.push({
    level,
    message: message.slice(0, 1000), // Truncate long messages
    timestamp: Date.now(),
  });

  // Trim buffer if too large
  while (consoleBuffer.length > MAX_BUFFER_SIZE) {
    consoleBuffer.shift();
  }
}

/**
 * Get recent console errors and warnings
 */
export function getRecentConsoleEntries(maxAge: number = MAX_AGE_MS): ConsoleEntry[] {
  const cutoff = Date.now() - maxAge;

  // Filter out old entries and return a copy
  return consoleBuffer
    .filter((entry) => entry.timestamp > cutoff)
    .map((entry) => ({ ...entry }));
}

/**
 * Clear the console buffer
 */
export function clearConsoleBuffer(): void {
  consoleBuffer.length = 0;
}
