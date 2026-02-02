import React from 'react';

/**
 * Position options for the floating button
 */
type ButtonPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
/**
 * Reporter configuration for server/console output
 */
interface ReporterConfig {
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
interface ContextReporterProps {
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
/**
 * DOM context - parent chain and siblings
 */
interface DOMContext {
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
interface ElementInfo {
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
interface SourceLocation {
    fileName: string;
    lineNumber: number;
    columnNumber?: number;
}
/**
 * A component in the React component tree path
 */
interface ComponentPathItem {
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
interface CapturedAppState {
    zustand?: Record<string, unknown>;
    redux?: Record<string, unknown>;
    jotai?: Record<string, unknown>;
    custom?: unknown;
}
/**
 * Environment information
 */
interface EnvironmentInfo {
    react?: string;
    userAgent: string;
    timestamp: string;
    url: string;
}
/**
 * Viewport dimensions
 */
interface ViewportInfo {
    width: number;
    height: number;
}
/**
 * Console error/warning captured near the time of report
 */
interface ConsoleEntry {
    level: 'error' | 'warn';
    message: string;
    timestamp: number;
}
/**
 * Complete context report structure
 */
interface ContextReport {
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
interface ContextScreenshot {
    reportId: string;
    data: string;
}
/**
 * Internal state for the element picker
 */
interface PickerState {
    isActive: boolean;
    hoveredElement: HTMLElement | null;
    selectedElement: HTMLElement | null;
}
/**
 * State adapter interface for extracting state from different state managers
 */
interface StateAdapter {
    name: string;
    isAvailable: () => boolean;
    getState: () => Record<string, unknown> | null;
}
/**
 * Console log tags for structured output
 */
declare const CONSOLE_TAGS: {
    readonly REPORT: "[CLAUDE_CONTEXT_REPORT]";
    readonly SCREENSHOT: "[CLAUDE_CONTEXT_SCREENSHOT]";
};

/**
 * Main context reporter component
 *
 * Add to your app layout in development mode:
 * ```tsx
 * {process.env.NODE_ENV === 'development' && <ContextReporter />}
 * ```
 *
 * The component will automatically try to send reports to a local server
 * (http://localhost:9847 by default). If the server is not running,
 * it falls back to logging reports to the browser console.
 *
 * To start the server, run: npx claude-context-reporter-server
 */
declare function ContextReporter({ position, hotkey, getCustomState, excludeStateKeys, onCapture, zIndex, reporter, }: ContextReporterProps): React.ReactElement;

interface FloatingButtonProps {
    position: ButtonPosition;
    onClick: () => void;
    isActive: boolean;
    zIndex: number;
}
/**
 * Floating button to trigger context capture
 */
declare function FloatingButton({ position, onClick, isActive, zIndex, }: FloatingButtonProps): React.ReactElement;

interface ElementPickerProps {
    isActive: boolean;
    highlightPosition: {
        top: number;
        left: number;
        width: number;
        height: number;
    } | null;
    zIndex: number;
}
/**
 * Overlay that shows element highlighting during selection
 */
declare function ElementPicker({ isActive, highlightPosition, zIndex, }: ElementPickerProps): React.ReactElement | null;

interface DescriptionModalProps {
    isOpen: boolean;
    onSubmit: (description: string) => void;
    onCancel: () => void;
    zIndex: number;
}
/**
 * Modal for adding an optional description to the context report
 */
declare function DescriptionModal({ isOpen, onSubmit, onCancel, zIndex, }: DescriptionModalProps): React.ReactElement | null;

interface CaptureToastProps {
    isVisible: boolean;
    onHide: () => void;
    reportId: string;
    /** Whether the report was sent to server or console */
    method?: 'server' | 'console';
    zIndex: number;
}
/**
 * Toast notification shown after successful capture
 */
declare function CaptureToast({ isVisible, onHide, reportId, method, zIndex, }: CaptureToastProps): React.ReactElement | null;

interface UseElementPickerReturn {
    state: PickerState;
    startPicking: () => void;
    stopPicking: () => void;
    highlightPosition: {
        top: number;
        left: number;
        width: number;
        height: number;
    } | null;
}
/**
 * Hook for element selection functionality
 */
declare function useElementPicker(onSelect: (element: HTMLElement) => void): UseElementPickerReturn;

interface UseScreenshotReturn {
    capture: (element?: HTMLElement) => Promise<string | null>;
    isCapturing: boolean;
    error: Error | null;
}
/**
 * Hook for capturing screenshots using html2canvas
 */
declare function useScreenshot(): UseScreenshotReturn;

interface UseContextCaptureOptions {
    getCustomState?: () => unknown;
    excludeStateKeys?: string[];
    onCapture?: (report: ContextReport) => void;
    /** Reporter configuration */
    reporter?: ReporterConfig;
}
interface UseContextCaptureReturn {
    captureContext: (element: HTMLElement, description?: string) => Promise<ContextReport | null>;
    isCapturing: boolean;
    lastReport: ContextReport | null;
    /** Whether the last report was sent to server or console */
    lastReportMethod: 'server' | 'console' | null;
    error: Error | null;
}
/**
 * Hook for orchestrating the full context capture process
 */
declare function useContextCapture(options?: UseContextCaptureOptions): UseContextCaptureReturn;

/**
 * Zustand store reference type
 */
interface ZustandStore {
    getState: () => Record<string, unknown>;
}
/**
 * Helper to expose a zustand store for the context reporter
 * Add this to your app: exposeZustandStore(useStore)
 */
declare function exposeZustandStore(store: ZustandStore, name?: string): void;

/**
 * Redux store reference type
 */
interface ReduxStore {
    getState: () => Record<string, unknown>;
}
/**
 * Helper to expose a Redux store for the context reporter
 * Add this to your app: exposeReduxStore(store)
 */
declare function exposeReduxStore(store: ReduxStore): void;

/**
 * Jotai atom with debug label
 */
interface JotaiAtom {
    debugLabel?: string;
    toString: () => string;
}
/**
 * Jotai store reference type
 */
interface JotaiStore {
    get: <T>(atom: JotaiAtom) => T;
}
/**
 * Helper to expose Jotai store for the context reporter
 * Add this to your app: exposeJotaiStore(store, [atom1, atom2, ...])
 */
declare function exposeJotaiStore(store: JotaiStore, atoms: JotaiAtom[]): void;

/**
 * Get all reports from localStorage
 */
declare function getStoredReports(): ContextReport[];
/**
 * Clear all reports from localStorage
 */
declare function clearStoredReports(): void;
/**
 * Check if server is currently available (for UI feedback)
 */
declare function isServerAvailable(serverUrl?: string, timeout?: number): Promise<boolean>;
/**
 * Clear the server availability cache (useful after starting server)
 */
declare function clearServerCache(): void;

export { type ButtonPosition, CONSOLE_TAGS, CaptureToast, type CapturedAppState, type ComponentPathItem, type ContextReport, ContextReporter, type ContextReporterProps, type ContextScreenshot, DescriptionModal, type ElementInfo, ElementPicker, type EnvironmentInfo, FloatingButton, type PickerState, type ReporterConfig, type StateAdapter, type ViewportInfo, clearServerCache, clearStoredReports, exposeJotaiStore, exposeReduxStore, exposeZustandStore, getStoredReports, isServerAvailable, useContextCapture, useElementPicker, useScreenshot };
