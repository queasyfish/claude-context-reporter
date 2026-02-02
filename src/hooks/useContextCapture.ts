import { useState, useCallback, useEffect } from 'react';
import type { ContextReport, ContextScreenshot, ReporterConfig } from '../types';
import { extractElementInfo } from '../utils/dom-utils';
import { extractComponentPath } from '../utils/component-path';
import {
  generateReportId,
  createContextReport,
  logContextReport,
  logContextScreenshot,
} from '../utils/reporter';
import {
  startConsoleCapture,
  getRecentConsoleEntries,
} from '../utils/console-capture';
import { captureAppState } from '../state-adapters';
import { useScreenshot } from './useScreenshot';

export interface UseContextCaptureOptions {
  getCustomState?: () => unknown;
  excludeStateKeys?: string[];
  onCapture?: (report: ContextReport) => void;
  /** Reporter configuration */
  reporter?: ReporterConfig;
}

export interface UseContextCaptureReturn {
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
export function useContextCapture(
  options: UseContextCaptureOptions = {}
): UseContextCaptureReturn {
  const { getCustomState, excludeStateKeys, onCapture, reporter } = options;

  const [isCapturing, setIsCapturing] = useState(false);
  const [lastReport, setLastReport] = useState<ContextReport | null>(null);
  const [lastReportMethod, setLastReportMethod] = useState<'server' | 'console' | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const { capture: captureScreenshot, isCapturing: isCapturingScreenshot } = useScreenshot();

  // Start console capture on mount
  useEffect(() => {
    startConsoleCapture();
  }, []);

  const captureContext = useCallback(
    async (element: HTMLElement, description?: string): Promise<ContextReport | null> => {
      setIsCapturing(true);
      setError(null);

      try {
        // Generate unique report ID
        const reportId = generateReportId();

        // Extract element information
        const elementInfo = extractElementInfo(element);

        // Extract component path
        const componentPath = extractComponentPath(element);

        // Capture application state
        const appState = captureAppState(getCustomState, excludeStateKeys);

        // Get recent console errors
        const consoleErrors = getRecentConsoleEntries(30000); // Last 30 seconds

        // Create the report
        const report = createContextReport({
          id: reportId,
          selectedElement: elementInfo,
          componentPath,
          appState,
          description,
          consoleErrors: consoleErrors.length > 0 ? consoleErrors : undefined,
        });

        // Log the report FIRST (tries server first, falls back to console)
        // This ensures report is saved even if screenshot fails
        const reportResult = await logContextReport(report, reporter);
        setLastReportMethod(reportResult.method);

        // Update state
        setLastReport(report);

        // Call onCapture callback if provided
        if (onCapture) {
          onCapture(report);
        }

        // Now try to capture screenshot (non-blocking, errors won't affect report)
        try {
          const screenshotData = await captureScreenshot();
          if (screenshotData) {
            const screenshot: ContextScreenshot = {
              reportId,
              data: screenshotData,
            };
            await logContextScreenshot(screenshot, reporter);
          }
        } catch (screenshotErr) {
          // Screenshot failed but report was already saved - just log warning
          console.warn('[ContextReporter] Screenshot capture failed:', screenshotErr);
        }

        setIsCapturing(false);
        return report;
      } catch (err) {
        const captureError = err instanceof Error ? err : new Error('Context capture failed');
        setError(captureError);
        setIsCapturing(false);
        console.error('[ContextReporter] Context capture failed:', err);
        return null;
      }
    },
    [getCustomState, excludeStateKeys, onCapture, reporter, captureScreenshot]
  );

  return {
    captureContext,
    isCapturing: isCapturing || isCapturingScreenshot,
    lastReport,
    lastReportMethod,
    error,
  };
}
