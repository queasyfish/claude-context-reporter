import { useState, useCallback, useEffect, useRef } from 'react';
import type { PickerState } from '../types';
import { isReporterElement } from '../utils/dom-utils';

export interface UseElementPickerReturn {
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
export function useElementPicker(
  onSelect: (element: HTMLElement) => void
): UseElementPickerReturn {
  const [state, setState] = useState<PickerState>({
    isActive: false,
    hoveredElement: null,
    selectedElement: null,
  });

  const [highlightPosition, setHighlightPosition] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const lastHoveredRef = useRef<HTMLElement | null>(null);

  const updateHighlight = useCallback((element: HTMLElement | null) => {
    if (!element) {
      setHighlightPosition(null);
      return;
    }

    const rect = element.getBoundingClientRect();
    setHighlightPosition({
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height,
    });
  }, []);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Ignore reporter UI elements
      if (isReporterElement(target)) {
        return;
      }

      // Only update if element changed
      if (target !== lastHoveredRef.current) {
        lastHoveredRef.current = target;
        setState((prev) => ({ ...prev, hoveredElement: target }));
        updateHighlight(target);
      }
    },
    [updateHighlight]
  );

  const handleClick = useCallback(
    (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Ignore reporter UI elements
      if (isReporterElement(target)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      setState((prev) => ({
        ...prev,
        isActive: false,
        selectedElement: target,
        hoveredElement: null,
      }));

      setHighlightPosition(null);
      onSelect(target);
    },
    [onSelect]
  );

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setState((prev) => ({
        ...prev,
        isActive: false,
        hoveredElement: null,
      }));
      setHighlightPosition(null);
    }
  }, []);

  const startPicking = useCallback(() => {
    setState({
      isActive: true,
      hoveredElement: null,
      selectedElement: null,
    });
  }, []);

  const stopPicking = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isActive: false,
      hoveredElement: null,
    }));
    setHighlightPosition(null);
  }, []);

  // Attach/detach event listeners based on active state
  useEffect(() => {
    if (state.isActive) {
      document.addEventListener('mousemove', handleMouseMove, true);
      document.addEventListener('click', handleClick, true);
      document.addEventListener('keydown', handleKeyDown, true);

      // Change cursor to crosshair
      document.body.style.cursor = 'crosshair';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove, true);
        document.removeEventListener('click', handleClick, true);
        document.removeEventListener('keydown', handleKeyDown, true);
        document.body.style.cursor = '';
      };
    }
  }, [state.isActive, handleMouseMove, handleClick, handleKeyDown]);

  return {
    state,
    startPicking,
    stopPicking,
    highlightPosition,
  };
}
