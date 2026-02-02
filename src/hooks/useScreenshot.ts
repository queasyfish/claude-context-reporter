import { useState, useCallback } from 'react';
import html2canvas from 'html2canvas';

export interface UseScreenshotReturn {
  capture: (element?: HTMLElement) => Promise<string | null>;
  isCapturing: boolean;
  error: Error | null;
}

/**
 * Modern CSS color functions not supported by html2canvas
 */
const UNSUPPORTED_COLOR_REGEX = /\b(lab|lch|oklch|oklab|color-mix|color)\s*\([^)]*\)/gi;

/**
 * Sanitize CSS to replace unsupported color functions with fallbacks
 */
function sanitizeStyles(clonedDoc: Document): void {
  // Process all stylesheets
  const styleSheets = clonedDoc.styleSheets;
  for (let i = 0; i < styleSheets.length; i++) {
    try {
      const sheet = styleSheets[i];
      const rules = sheet.cssRules || sheet.rules;
      if (!rules) continue;

      for (let j = 0; j < rules.length; j++) {
        const rule = rules[j] as CSSStyleRule;
        if (rule.style) {
          // Check each style property
          for (let k = 0; k < rule.style.length; k++) {
            const prop = rule.style[k];
            const value = rule.style.getPropertyValue(prop);
            if (UNSUPPORTED_COLOR_REGEX.test(value)) {
              // Replace with transparent or a fallback
              rule.style.setProperty(prop, 'transparent', rule.style.getPropertyPriority(prop));
            }
          }
        }
      }
    } catch {
      // Cross-origin stylesheets will throw, ignore them
    }
  }

  // Also process inline styles
  const elementsWithStyle = clonedDoc.querySelectorAll('[style]');
  elementsWithStyle.forEach((el) => {
    const style = (el as HTMLElement).style;
    for (let i = 0; i < style.length; i++) {
      const prop = style[i];
      const value = style.getPropertyValue(prop);
      if (UNSUPPORTED_COLOR_REGEX.test(value)) {
        style.setProperty(prop, 'transparent', style.getPropertyPriority(prop));
      }
    }
  });
}

/**
 * Hook for capturing screenshots using html2canvas
 */
export function useScreenshot(): UseScreenshotReturn {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const capture = useCallback(async (element?: HTMLElement): Promise<string | null> => {
    setIsCapturing(true);
    setError(null);

    try {
      const targetElement = element || document.body;

      // Configure html2canvas options
      const canvas = await html2canvas(targetElement, {
        // Use higher scale for better quality
        scale: window.devicePixelRatio || 1,
        // Capture entire scrollable area or just viewport
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        // Don't capture scrolled content
        scrollX: 0,
        scrollY: 0,
        // Disable logging to reduce console noise
        logging: false,
        // Handle cross-origin images
        useCORS: true,
        allowTaint: true,
        // Ignore elements with this attribute
        ignoreElements: (el) => {
          return el.hasAttribute('data-context-reporter');
        },
        // Sanitize the cloned document to handle unsupported CSS
        onclone: (clonedDoc) => {
          try {
            sanitizeStyles(clonedDoc);
          } catch (e) {
            // Don't fail the whole capture if sanitization fails
            console.warn('[ContextReporter] Style sanitization warning:', e);
          }
        },
      });

      // Convert to base64 data URL
      const dataUrl = canvas.toDataURL('image/png');

      setIsCapturing(false);
      return dataUrl;
    } catch (err) {
      // Don't treat html2canvas errors as fatal - report without screenshot
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.warn('[ContextReporter] Screenshot capture failed, continuing without screenshot:', message);
      setError(err instanceof Error ? err : new Error('Screenshot capture failed'));
      setIsCapturing(false);
      // Return null but don't throw - allow report to proceed without screenshot
      return null;
    }
  }, []);

  return {
    capture,
    isCapturing,
    error,
  };
}
