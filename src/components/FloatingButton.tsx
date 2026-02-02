import React from 'react';
import type { ButtonPosition } from '../types';

export interface FloatingButtonProps {
  position: ButtonPosition;
  onClick: () => void;
  isActive: boolean;
  zIndex: number;
}

const positionStyles: Record<ButtonPosition, React.CSSProperties> = {
  'bottom-right': { bottom: 20, right: 20 },
  'bottom-left': { bottom: 20, left: 20 },
  'top-right': { top: 20, right: 20 },
  'top-left': { top: 20, left: 20 },
};

/**
 * Floating button to trigger context capture
 */
export function FloatingButton({
  position,
  onClick,
  isActive,
  zIndex,
}: FloatingButtonProps): React.ReactElement {
  return (
    <button
      data-context-reporter="button"
      onClick={onClick}
      style={{
        position: 'fixed',
        ...positionStyles[position],
        zIndex,
        width: 48,
        height: 48,
        borderRadius: '50%',
        border: 'none',
        backgroundColor: isActive ? '#ef4444' : '#6366f1',
        color: 'white',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        transition: 'all 0.2s ease',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
      title={isActive ? 'Cancel capture (Esc)' : 'Capture context for Claude'}
      aria-label={isActive ? 'Cancel capture' : 'Capture context'}
    >
      {isActive ? (
        // X icon when active
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      ) : (
        // Crosshair/target icon when inactive
        <svg
          width="24"
          height="24"
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
      )}
    </button>
  );
}
