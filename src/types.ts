/**
 * Position options for the floating button
 */
export type ButtonPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

/**
 * Reporter configuration for server/console output
 */
export interface ReporterConfig {
  /** Server URL for direct file writing (default: http://localhost:9847) */
  serverUrl?: string;
  /** Timeout for server requests in ms (default: 1000) */
  serverTimeout?: number;
  /** Always use console even if server is available */
  forceConsole?: boolean;
}

/**
 * Configuration props for the ContextReporter component
 */
export interface ContextReporterProps {
  /** Position of the floating button */
  position?: ButtonPosition;
  /** Keyboard shortcut to trigger capture (default: 'ctrl+shift+.') */
  hotkey?: string;
  /** Custom function to capture additional state */
  getCustomState?: () => unknown;
  /** Keys to exclude from captured state */
  excludeStateKeys?: string[];
  /** Callback when a report is captured */
  onCapture?: (report: ContextReport) => void;
  /** z-index for the overlay (default: 9999) */
  zIndex?: number;
  /** Reporter configuration (server URL, timeout, etc.) */
  reporter?: ReporterConfig;
}

/**
 * Computed CSS styles (key properties only)
 */
export interface ComputedStyles {
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

/**
 * DOM context - parent chain and siblings
 */
export interface DOMContext {
  /** Parent elements (up to 3 levels) */
  parents: Array<{
    tagName: string;
    id: string;
    className: string;
    /** Truncated outer HTML */
    htmlPreview: string;
  }>;
  /** Previous sibling summary */
  previousSibling: string | null;
  /** Next sibling summary */
  nextSibling: string | null;
  /** Number of child elements */
  childCount: number;
  /** Inner HTML (truncated) */
  innerHTML: string;
}

/**
 * Information about a DOM element
 */
export interface ElementInfo {
  tagName: string;
  id: string;
  className: string;
  textContent: string;
  attributes: Record<string, string>;
  boundingRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Unique CSS selector to find this element */
  selector: string;
  /** Key computed CSS styles */
  computedStyles: ComputedStyles;
  /** DOM context (parents, siblings, children) */
  domContext: DOMContext;
  /** Accessibility attributes */
  accessibility: {
    role: string | null;
    ariaLabel: string | null;
    ariaDescribedBy: string | null;
    ariaDisabled: string | null;
    tabIndex: string | null;
  };
}

/**
 * Source file location from React DevTools
 */
export interface SourceLocation {
  fileName: string;
  lineNumber: number;
  columnNumber?: number;
}

/**
 * A component in the React component tree path
 */
export interface ComponentPathItem {
  name: string;
  source: 'fiber' | 'attribute' | 'displayName';
  /** Source file location if available */
  sourceLocation?: SourceLocation;
  /** Props passed to component (sanitized) */
  props?: Record<string, unknown>;
  /** Local state values (from useState/useReducer) */
  state?: unknown[];
}

/**
 * Captured application state from various state managers
 */
export interface CapturedAppState {
  zustand?: Record<string, unknown>;
  redux?: Record<string, unknown>;
  jotai?: Record<string, unknown>;
  custom?: unknown;
}

/**
 * Environment information
 */
export interface EnvironmentInfo {
  react?: string;
  userAgent: string;
  timestamp: string;
  url: string;
}

/**
 * Viewport dimensions
 */
export interface ViewportInfo {
  width: number;
  height: number;
}

/**
 * Console error/warning captured near the time of report
 */
export interface ConsoleEntry {
  level: 'error' | 'warn';
  message: string;
  timestamp: number;
}

/**
 * Complete context report structure
 */
export interface ContextReport {
  id: string;
  timestamp: string;
  url: string;
  viewport: ViewportInfo;
  description?: string;
  selectedElement: ElementInfo;
  componentPath: ComponentPathItem[];
  appState: CapturedAppState;
  environment: EnvironmentInfo;
  /** Recent console errors/warnings */
  consoleErrors?: ConsoleEntry[];
}

/**
 * Screenshot data linked to a report by ID
 */
export interface ContextScreenshot {
  reportId: string;
  data: string; // base64 data URL
}

/**
 * Internal state for the element picker
 */
export interface PickerState {
  isActive: boolean;
  hoveredElement: HTMLElement | null;
  selectedElement: HTMLElement | null;
}

/**
 * State adapter interface for extracting state from different state managers
 */
export interface StateAdapter {
  name: string;
  isAvailable: () => boolean;
  getState: () => Record<string, unknown> | null;
}

/**
 * Console log tags for structured output
 */
export const CONSOLE_TAGS = {
  REPORT: '[CLAUDE_CONTEXT_REPORT]',
  SCREENSHOT: '[CLAUDE_CONTEXT_SCREENSHOT]',
} as const;
