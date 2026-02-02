import type { ElementInfo, ComputedStyles, DOMContext } from '../types';

/**
 * Default CSS values to filter out (not useful)
 */
const DEFAULT_STYLES: Partial<ComputedStyles> = {
  display: 'block',
  position: 'static',
  visibility: 'visible',
  opacity: '1',
  cursor: 'auto',
  pointerEvents: 'auto',
  overflow: 'visible',
  zIndex: 'auto',
};

/**
 * Key CSS properties to capture
 */
const STYLE_PROPERTIES: (keyof ComputedStyles)[] = [
  'display',
  'position',
  'visibility',
  'opacity',
  'width',
  'height',
  'padding',
  'margin',
  'border',
  'backgroundColor',
  'color',
  'fontSize',
  'fontWeight',
  'cursor',
  'pointerEvents',
  'overflow',
  'zIndex',
];

/**
 * Extract computed styles for an element, filtering out defaults
 */
function extractComputedStyles(element: HTMLElement): ComputedStyles {
  const computed = window.getComputedStyle(element);
  const styles: Partial<ComputedStyles> = {};

  for (const prop of STYLE_PROPERTIES) {
    const kebabProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
    const value = computed.getPropertyValue(kebabProp);

    // Skip default values
    const defaultValue = DEFAULT_STYLES[prop];
    if (defaultValue && value === defaultValue) continue;

    // Skip "none" borders
    if (prop === 'border' && value.includes('none')) continue;

    // Skip transparent backgrounds
    if (prop === 'backgroundColor' && (value === 'transparent' || value === 'rgba(0, 0, 0, 0)')) continue;

    // Skip 0px padding/margin
    if ((prop === 'padding' || prop === 'margin') && value === '0px') continue;

    styles[prop] = value;
  }

  return styles as ComputedStyles;
}

/**
 * Generate a unique CSS selector for an element - simplified
 */
function generateUniqueSelector(element: HTMLElement): string {
  // Priority 1: data-testid
  const testId = element.getAttribute('data-testid');
  if (testId) {
    return `[data-testid="${testId}"]`;
  }

  // Priority 2: unique ID
  if (element.id) {
    return `#${element.id}`;
  }

  // Priority 3: data-component
  const componentAttr = element.getAttribute('data-component');
  if (componentAttr) {
    return `[data-component="${componentAttr}"]`;
  }

  // Priority 4: Simple class-based selector with parent context
  const tag = element.tagName.toLowerCase();
  let selector = tag;

  // Add meaningful classes (not Tailwind utilities)
  if (element.className && typeof element.className === 'string') {
    const meaningfulClasses = element.className
      .split(' ')
      .filter((c) => {
        if (!c) return false;
        // Skip Tailwind-like utility classes
        if (/^(flex|grid|block|inline|hidden|p-|m-|w-|h-|text-|bg-|border-|rounded|items-|justify-|gap-|space-)/.test(c)) return false;
        // Skip very short classes
        if (c.length < 3) return false;
        // Skip classes starting with underscore (CSS modules)
        if (c.startsWith('_')) return false;
        return true;
      })
      .slice(0, 2);

    if (meaningfulClasses.length > 0) {
      selector += `.${meaningfulClasses.join('.')}`;
    }
  }

  // Add nth-child if element has siblings of same type
  const parent = element.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(
      (child) => child.tagName === element.tagName
    );
    if (siblings.length > 1) {
      const index = siblings.indexOf(element) + 1;
      selector += `:nth-of-type(${index})`;
    }

    // Add parent hint for context (just one level)
    const parentHint = parent.id
      ? `#${parent.id} > `
      : parent.getAttribute('data-testid')
        ? `[data-testid="${parent.getAttribute('data-testid')}"] > `
        : '';

    if (parentHint) {
      selector = parentHint + selector;
    }
  }

  return selector;
}

/**
 * Get a summary string for an element (for siblings) - simplified
 */
function getElementSummary(element: Element | null): string | null {
  if (!element || !(element instanceof HTMLElement)) return null;

  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const testId = element.getAttribute('data-testid');
  const testIdStr = testId ? `[data-testid="${testId}"]` : '';

  // Get first meaningful class
  let classStr = '';
  if (!id && !testIdStr && element.className && typeof element.className === 'string') {
    const firstClass = element.className.split(' ').find((c) => c && c.length > 2 && !c.startsWith('_'));
    if (firstClass) classStr = `.${firstClass}`;
  }

  // Get short text content
  const text = element.textContent?.trim().slice(0, 20) || '';

  return `<${tag}${id}${testIdStr}${classStr}>${text ? ` "${text}${text.length >= 20 ? '...' : ''}"` : ''}`;
}

/**
 * Get truncated HTML preview - just the opening tag
 */
function getHtmlPreview(element: HTMLElement): string {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? ` id="${element.id}"` : '';

  // Get key attributes
  const testId = element.getAttribute('data-testid');
  const testIdAttr = testId ? ` data-testid="${testId}"` : '';

  // Get first few meaningful classes
  let classAttr = '';
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.split(' ').filter(Boolean).slice(0, 3).join(' ');
    if (classes) classAttr = ` class="${classes}${element.className.split(' ').length > 3 ? ' ...' : ''}"`;
  }

  return `<${tag}${id}${testIdAttr}${classAttr}>`;
}

/**
 * Extract DOM context (parents, siblings, children) - simplified
 */
function extractDOMContext(element: HTMLElement): DOMContext {
  // Get parent chain (up to 3 levels)
  const parents: DOMContext['parents'] = [];
  let parent = element.parentElement;
  let depth = 0;

  while (parent && parent !== document.body && depth < 3) {
    parents.push({
      tagName: parent.tagName,
      id: parent.id || '',
      className: typeof parent.className === 'string' ? parent.className.split(' ').slice(0, 3).join(' ') : '',
      htmlPreview: getHtmlPreview(parent),
    });
    parent = parent.parentElement;
    depth++;
  }

  // Get siblings (simplified)
  const previousSibling = getElementSummary(element.previousElementSibling);
  const nextSibling = getElementSummary(element.nextElementSibling);

  // Get child info
  const childCount = element.children.length;

  // Get inner HTML (truncated more aggressively)
  let innerHTML = element.innerHTML.trim();
  if (innerHTML.length > 300) {
    innerHTML = innerHTML.slice(0, 300) + '...';
  }

  return {
    parents,
    previousSibling,
    nextSibling,
    childCount,
    innerHTML,
  };
}

/**
 * Extract accessibility attributes - only non-null values
 */
function extractAccessibility(element: HTMLElement): ElementInfo['accessibility'] {
  return {
    role: element.getAttribute('role'),
    ariaLabel: element.getAttribute('aria-label'),
    ariaDescribedBy: element.getAttribute('aria-describedby'),
    ariaDisabled: element.getAttribute('aria-disabled'),
    tabIndex: element.getAttribute('tabindex'),
  };
}

/**
 * Extract relevant information from a DOM element
 */
export function extractElementInfo(element: HTMLElement): ElementInfo {
  const rect = element.getBoundingClientRect();

  // Get all attributes as a plain object (filter out class which we capture separately)
  const attributes: Record<string, string> = {};
  for (const attr of Array.from(element.attributes)) {
    if (!['id', 'class', 'style'].includes(attr.name)) {
      // Skip very long attribute values
      if (attr.value.length > 200) {
        attributes[attr.name] = attr.value.slice(0, 200) + '...';
      } else {
        attributes[attr.name] = attr.value;
      }
    }
  }

  // Get text content, truncated if too long
  let textContent = element.textContent?.trim() || '';
  if (textContent.length > 150) {
    textContent = textContent.substring(0, 150) + '...';
  }

  return {
    tagName: element.tagName,
    id: element.id || '',
    className: typeof element.className === 'string' ? element.className : '',
    textContent,
    attributes,
    boundingRect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    selector: generateUniqueSelector(element),
    computedStyles: extractComputedStyles(element),
    domContext: extractDOMContext(element),
    accessibility: extractAccessibility(element),
  };
}

/**
 * Check if an element is part of the context reporter UI
 */
export function isReporterElement(element: HTMLElement): boolean {
  return element.closest('[data-context-reporter]') !== null;
}

/**
 * Get a unique selector for an element
 */
export function getElementSelector(element: HTMLElement): string {
  return generateUniqueSelector(element);
}

/**
 * Create a highlight overlay for an element
 */
export function createHighlightOverlay(element: HTMLElement): {
  top: number;
  left: number;
  width: number;
  height: number;
} {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX,
    width: rect.width,
    height: rect.height,
  };
}
