import React, { useState, useCallback, useEffect } from 'react';
import type { ContextReporterProps } from '../types';
import { useElementPicker } from '../hooks/useElementPicker';
import { useContextCapture } from '../hooks/useContextCapture';
import { FloatingButton } from './FloatingButton';
import { ElementPicker } from './ElementPicker';
import { DescriptionModal } from './DescriptionModal';
import { CaptureToast } from './CaptureToast';

type CaptureState = 'idle' | 'picking' | 'describing' | 'capturing';

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
export function ContextReporter({
  position = 'bottom-right',
  hotkey = 'ctrl+shift+.',
  getCustomState,
  excludeStateKeys,
  onCapture,
  zIndex = 9999,
  reporter,
}: ContextReporterProps): React.ReactElement {
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [lastReportId, setLastReportId] = useState('');
  const [toastMethod, setToastMethod] = useState<'server' | 'console'>('console');

  const { captureContext, isCapturing, lastReportMethod } = useContextCapture({
    getCustomState,
    excludeStateKeys,
    onCapture,
    reporter,
  });

  const handleElementSelected = useCallback((element: HTMLElement) => {
    setSelectedElement(element);
    setCaptureState('describing');
  }, []);

  const { state: pickerState, startPicking, stopPicking, highlightPosition } =
    useElementPicker(handleElementSelected);

  // Handle button click
  const handleButtonClick = useCallback(() => {
    if (captureState === 'picking') {
      stopPicking();
      setCaptureState('idle');
    } else {
      startPicking();
      setCaptureState('picking');
    }
  }, [captureState, startPicking, stopPicking]);

  // Handle description submit
  const handleDescriptionSubmit = useCallback(
    async (description: string) => {
      if (!selectedElement) return;

      setCaptureState('capturing');

      const report = await captureContext(selectedElement, description || undefined);

      if (report) {
        setLastReportId(report.id);
        setToastMethod(lastReportMethod || 'console');
        setShowToast(true);
      }

      setCaptureState('idle');
      setSelectedElement(null);
    },
    [selectedElement, captureContext, lastReportMethod]
  );

  // Handle description cancel
  const handleDescriptionCancel = useCallback(() => {
    setCaptureState('idle');
    setSelectedElement(null);
  }, []);

  // Handle hotkey
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const parts = hotkey.toLowerCase().split('+');
      const key = parts[parts.length - 1];
      const needsCtrl = parts.includes('ctrl');
      const needsShift = parts.includes('shift');
      const needsMeta = parts.includes('meta') || parts.includes('cmd');
      const needsAlt = parts.includes('alt');

      const keyMatches = e.key.toLowerCase() === key || e.key === key;
      const ctrlMatches = !needsCtrl || e.ctrlKey;
      const shiftMatches = !needsShift || e.shiftKey;
      const metaMatches = !needsMeta || e.metaKey;
      const altMatches = !needsAlt || e.altKey;

      if (keyMatches && ctrlMatches && shiftMatches && metaMatches && altMatches) {
        e.preventDefault();
        handleButtonClick();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hotkey, handleButtonClick]);

  // Sync picker state
  useEffect(() => {
    if (!pickerState.isActive && captureState === 'picking') {
      setCaptureState('idle');
    }
  }, [pickerState.isActive, captureState]);

  return (
    <div data-context-reporter="root">
      <FloatingButton
        position={position}
        onClick={handleButtonClick}
        isActive={captureState === 'picking'}
        zIndex={zIndex}
      />

      <ElementPicker
        isActive={captureState === 'picking'}
        highlightPosition={highlightPosition}
        zIndex={zIndex}
      />

      <DescriptionModal
        isOpen={captureState === 'describing'}
        onSubmit={handleDescriptionSubmit}
        onCancel={handleDescriptionCancel}
        zIndex={zIndex + 1}
      />

      <CaptureToast
        isVisible={showToast}
        onHide={() => setShowToast(false)}
        reportId={lastReportId}
        method={toastMethod}
        zIndex={zIndex}
      />

      {/* Loading overlay during capture */}
      {isCapturing && (
        <div
          data-context-reporter="loading"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: zIndex + 2,
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '20px 32px',
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 500,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            }}
          >
            Capturing context...
          </div>
        </div>
      )}
    </div>
  );
}
