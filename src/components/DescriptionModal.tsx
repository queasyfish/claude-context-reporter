import React, { useState, useRef, useEffect } from 'react';

export interface DescriptionModalProps {
  isOpen: boolean;
  onSubmit: (description: string) => void;
  onCancel: () => void;
  zIndex: number;
}

/**
 * Modal for adding an optional description to the context report
 */
export function DescriptionModal({
  isOpen,
  onSubmit,
  onCancel,
  zIndex,
}: DescriptionModalProps): React.ReactElement | null {
  const [description, setDescription] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        onSubmit(description);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, description, onSubmit, onCancel]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      data-context-reporter="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
      }}
      onClick={onCancel}
    >
      <div
        data-context-reporter="modal"
        style={{
          backgroundColor: 'white',
          borderRadius: 12,
          padding: 24,
          width: '100%',
          maxWidth: 480,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            margin: '0 0 16px 0',
            fontSize: 18,
            fontWeight: 600,
            color: '#111827',
          }}
        >
          Add Description (Optional)
        </h2>

        <p
          style={{
            margin: '0 0 16px 0',
            fontSize: 14,
            color: '#6b7280',
          }}
        >
          Describe what&apos;s wrong or what you&apos;d like to fix. This helps Claude understand
          the issue.
        </p>

        <textarea
          ref={textareaRef}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., 'Button doesn't respond to clicks' or 'Styling looks broken on mobile'"
          style={{
            width: '100%',
            minHeight: 100,
            padding: 12,
            borderRadius: 8,
            border: '1px solid #d1d5db',
            fontSize: 14,
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#6366f1';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#d1d5db';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
            marginTop: 16,
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              backgroundColor: 'white',
              color: '#374151',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Skip
          </button>

          <button
            onClick={() => onSubmit(description)}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: '#6366f1',
              color: 'white',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Capture
            <span style={{ opacity: 0.7, marginLeft: 8, fontSize: 12 }}>
              {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
