import React from 'react';

export interface ElementPickerProps {
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
export function ElementPicker({
  isActive,
  highlightPosition,
  zIndex,
}: ElementPickerProps): React.ReactElement | null {
  if (!isActive) {
    return null;
  }

  return (
    <>
      {/* Full-screen overlay to capture all clicks */}
      <div
        data-context-reporter="overlay"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: zIndex - 1,
          pointerEvents: 'none',
        }}
      />

      {/* Highlight box */}
      {highlightPosition && (
        <div
          data-context-reporter="highlight"
          style={{
            position: 'absolute',
            top: highlightPosition.top,
            left: highlightPosition.left,
            width: highlightPosition.width,
            height: highlightPosition.height,
            border: '2px solid #6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            pointerEvents: 'none',
            zIndex,
            transition: 'all 0.05s ease-out',
            borderRadius: 2,
          }}
        >
          {/* Element info tooltip */}
          <div
            style={{
              position: 'absolute',
              top: -28,
              left: 0,
              backgroundColor: '#6366f1',
              color: 'white',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 12,
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            Click to select
          </div>
        </div>
      )}

      {/* Instructions banner */}
      <div
        data-context-reporter="banner"
        style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#1f2937',
          color: 'white',
          padding: '12px 24px',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
          zIndex,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
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
          <circle cx="12" cy="12" r="10" />
          <line x1="22" y1="12" x2="18" y2="12" />
          <line x1="6" y1="12" x2="2" y2="12" />
          <line x1="12" y1="6" x2="12" y2="2" />
          <line x1="12" y1="22" x2="12" y2="18" />
        </svg>
        <span>Click on an element to capture context</span>
        <span style={{ opacity: 0.7, marginLeft: 8 }}>Press Esc to cancel</span>
      </div>
    </>
  );
}
