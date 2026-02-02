import React, { useEffect, useState } from 'react';

export interface CaptureToastProps {
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
export function CaptureToast({
  isVisible,
  onHide,
  reportId,
  method = 'console',
  zIndex,
}: CaptureToastProps): React.ReactElement | null {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setTimeout(onHide, 200); // Wait for exit animation
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isVisible, onHide]);

  if (!isVisible && !isAnimating) {
    return null;
  }

  const isServer = method === 'server';

  return (
    <div
      data-context-reporter="toast"
      style={{
        position: 'fixed',
        bottom: 80,
        right: 20,
        backgroundColor: isServer ? '#059669' : '#6366f1',
        color: 'white',
        padding: '12px 20px',
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 500,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transform: isAnimating ? 'translateX(0)' : 'translateX(120%)',
        opacity: isAnimating ? 1 : 0,
        transition: 'all 0.2s ease-out',
      }}
    >
      {/* Checkmark icon */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>

      <div>
        <div>Context captured!</div>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
          {isServer ? (
            <>Saved to <code style={{ fontFamily: 'monospace' }}>./reports/</code></>
          ) : (
            <>Run <code style={{ fontFamily: 'monospace' }}>/context-reports</code> in Claude Code</>
          )}
        </div>
      </div>
    </div>
  );
}
