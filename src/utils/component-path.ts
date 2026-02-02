import type { ComponentPathItem, SourceLocation } from '../types';

/**
 * React Fiber node structure (simplified)
 */
interface FiberNode {
  tag: number;
  type: {
    name?: string;
    displayName?: string;
  } | string | null;
  return: FiberNode | null;
  stateNode: unknown;
  memoizedProps?: Record<string, unknown>;
  memoizedState?: FiberState | null;
  _debugSource?: {
    fileName: string;
    lineNumber: number;
    columnNumber?: number;
  };
  _debugOwner?: FiberNode;
}

/**
 * React useState/useReducer linked list structure
 */
interface FiberState {
  memoizedState: unknown;
  next: FiberState | null;
}

// React Fiber tag constants
const FUNCTION_COMPONENT = 0;
const CLASS_COMPONENT = 1;
const FORWARD_REF = 11;
const MEMO_COMPONENT = 14;
const SIMPLE_MEMO_COMPONENT = 15;

const COMPONENT_TAGS = new Set([
  FUNCTION_COMPONENT,
  CLASS_COMPONENT,
  FORWARD_REF,
  MEMO_COMPONENT,
  SIMPLE_MEMO_COMPONENT,
]);

/**
 * Framework/library components to filter out (noise)
 */
const FRAMEWORK_COMPONENT_PATTERNS = [
  // Next.js internals
  /^(Server)?Root$/,
  /^AppRouter$/,
  /^Router$/,
  /^HotReload$/,
  /^DevRootHTTPAccessFallbackBoundary$/,
  /^__next_.*__$/,
  /^OuterLayoutRouter$/,
  /^InnerLayoutRouter$/,
  /^SegmentStateProvider$/,
  /^SegmentViewNode$/,
  /^RenderFromTemplateContext$/,
  /^ScrollAndFocusHandler$/,
  /^InnerScrollAndFocusHandler$/,
  /^HTTPAccessFallbackBoundary$/,
  /^HTTPAccessFallbackErrorBoundary$/,
  /^RedirectBoundary$/,
  /^RedirectErrorBoundary$/,
  /^LoadingBoundary$/,
  /^ClientPageRoot$/,
  /^AppDevOverlayErrorBoundary$/,
  // React internals
  /^Suspense$/,
  /^Fragment$/,
  /^StrictMode$/,
  /^Profiler$/,
  // Common library wrappers
  /^Provider$/,
  /^QueryClientProvider$/,
  /^ThemeProvider$/,
  /^ErrorBoundary$/,
  /^(Root)?ErrorBoundary(Handler)?$/,
  /Context$/,
];

/**
 * Props to exclude from capture (sensitive, too large, or Next.js async props)
 */
const EXCLUDED_PROPS = new Set([
  'children',
  'key',
  'ref',
  '__self',
  '__source',
  'password',
  'token',
  'apiKey',
  'secret',
  'credentials',
  // Next.js 15 async props that are Promises
  'params',
  'searchParams',
]);

/**
 * Check if a component name is a framework/library internal
 */
function isFrameworkComponent(name: string): boolean {
  return FRAMEWORK_COMPONENT_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Get the React Fiber node from a DOM element
 */
function getFiberFromElement(element: HTMLElement): FiberNode | null {
  const keys = Object.keys(element);
  const fiberKey = keys.find(
    (key) =>
      key.startsWith('__reactFiber$') ||
      key.startsWith('__reactInternalInstance$')
  );

  if (fiberKey) {
    return (element as unknown as Record<string, FiberNode>)[fiberKey];
  }

  return null;
}

/**
 * Get component name from a fiber node
 */
function getComponentName(fiber: FiberNode): string | null {
  if (!fiber.type) return null;

  if (typeof fiber.type === 'string') {
    return null; // DOM element, not a component
  }

  if (fiber.type.displayName) {
    return fiber.type.displayName;
  }

  if (fiber.type.name) {
    return fiber.type.name;
  }

  return null;
}

/**
 * Check if a fiber node represents a React component
 */
function isComponentFiber(fiber: FiberNode): boolean {
  return COMPONENT_TAGS.has(fiber.tag);
}

/**
 * Extract source location from fiber debug info
 */
function extractSourceLocation(fiber: FiberNode): SourceLocation | undefined {
  if (fiber._debugSource) {
    // Clean up the file path - remove webpack/vite prefixes
    let fileName = fiber._debugSource.fileName;

    // Remove common prefixes
    fileName = fileName
      .replace(/^webpack:\/\/[^/]*\//, '')
      .replace(/^\/_next\//, '')
      .replace(/^\.\//, '');

    return {
      fileName,
      lineNumber: fiber._debugSource.lineNumber,
      columnNumber: fiber._debugSource.columnNumber,
    };
  }

  return undefined;
}

/**
 * Check if a value is a meaningful state value (not React internals)
 */
function isMeaningfulStateValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;

  // Skip React internal structures
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;

    // Skip effect hooks (have destroy/create)
    if ('destroy' in obj || 'create' in obj) return false;

    // Skip ref objects
    if ('current' in obj && Object.keys(obj).length === 1) return false;

    // Skip internal persist structures
    if ('persist' in obj && Object.keys(obj).length === 1) return false;

    // Skip arrays that are just [null, [...]]
    if (Array.isArray(value) && value.length === 2 && value[0] === null) return false;
  }

  return true;
}

/**
 * Check if an object is a React Query internal structure (not useful to show)
 */
function isReactQueryInternal(obj: Record<string, unknown>): boolean {
  // Internal observer/query objects have listeners and options
  if ('listeners' in obj && 'options' in obj) return true;
  // Internal state with just _defaulted
  if ('_defaulted' in obj && Object.keys(obj).length <= 2) return true;
  return false;
}

/**
 * Check if an object is React Query mutation state in idle state (not useful)
 */
function isIdleMutationState(obj: Record<string, unknown>): boolean {
  // Mutation state has isIdle and submittedAt
  if ('isIdle' in obj && 'submittedAt' in obj) {
    // If idle with no meaningful data, skip it
    if (obj.isIdle === true && obj.status === 'idle') return true;
  }
  return false;
}

/**
 * Check if an object is empty or only contains empty/null values
 */
function isEmptyObject(obj: Record<string, unknown>): boolean {
  const keys = Object.keys(obj);
  if (keys.length === 0) return true;
  // Check if all values are null, undefined, or empty
  return keys.every(k => {
    const v = obj[k];
    if (v === null || v === undefined) return true;
    if (typeof v === 'object' && Object.keys(v as object).length === 0) return true;
    return false;
  });
}

/**
 * Clean up React Query state to only show useful fields
 */
function cleanReactQueryState(state: Record<string, unknown>): Record<string, unknown> | null {
  // Skip React Query internal structures
  if (isReactQueryInternal(state)) return null;

  // Check if this looks like React Query state (has status or fetchStatus)
  if (!('status' in state) && !('fetchStatus' in state)) return null;

  const cleaned: Record<string, unknown> = { _type: 'ReactQuery' };

  // Always include status
  if ('status' in state) {
    cleaned.status = state.status;
  }

  // Include data if present
  if ('data' in state && state.data !== null && state.data !== undefined) {
    const dataStr = JSON.stringify(state.data);
    if (dataStr.length > 1000) {
      cleaned.data = '[Large data object - truncated]';
    } else {
      cleaned.data = state.data;
    }
  }

  // Include error if present
  if ('error' in state && state.error) {
    cleaned.error = state.error;
  }

  // Only include boolean flags that are TRUE (skip all the false ones)
  const boolFields = ['isLoading', 'isError', 'isPending', 'isFetching'];
  for (const field of boolFields) {
    if (state[field] === true) {
      cleaned[field] = true;
    }
  }

  // Only return if we have more than just _type and status
  const hasUsefulData = 'data' in cleaned || 'error' in cleaned ||
    boolFields.some(f => cleaned[f] === true);

  return hasUsefulData || cleaned.status !== 'idle' ? cleaned : null;
}

/**
 * Check if a value is a Promise
 */
function isPromise(value: unknown): boolean {
  return value !== null &&
    typeof value === 'object' &&
    typeof (value as { then?: unknown }).then === 'function';
}

/**
 * Sanitize and extract props from fiber
 */
function extractProps(fiber: FiberNode): Record<string, unknown> | undefined {
  if (!fiber.memoizedProps) return undefined;

  const props: Record<string, unknown> = {};
  let hasProps = false;

  // Use Object.keys + direct access to avoid triggering Promise enumeration
  const memoizedProps = fiber.memoizedProps as Record<string, unknown>;
  const keys = Object.keys(memoizedProps);

  for (const key of keys) {
    if (EXCLUDED_PROPS.has(key)) continue;

    let value: unknown;
    try {
      value = memoizedProps[key];
    } catch {
      // Skip if accessing the property throws
      continue;
    }

    // Skip Promises (Next.js 15 async props)
    if (isPromise(value)) continue;

    if (typeof value === 'function') {
      // Skip event handlers - they're not useful
      if (key.startsWith('on')) continue;
      props[key] = '[Function]';
      hasProps = true;
      continue;
    }

    if (value && typeof value === 'object' && '$$typeof' in (value as object)) {
      continue; // Skip React elements entirely
    }

    if (typeof value === 'string' && value.length > 100) {
      props[key] = value.slice(0, 100) + '...';
      hasProps = true;
      continue;
    }

    if (Array.isArray(value) && value.length > 10) {
      props[key] = `[Array(${value.length})]`;
      hasProps = true;
      continue;
    }

    // Skip empty objects/arrays
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value) && value.length === 0) continue;
      try {
        if (Object.keys(value).length === 0) continue;
      } catch {
        // Skip if Object.keys throws (e.g., on a Proxy)
        continue;
      }
    }

    try {
      JSON.stringify(value);
      props[key] = value;
      hasProps = true;
    } catch {
      // Skip unserializable
    }
  }

  return hasProps ? props : undefined;
}

/**
 * Extract local state from fiber (useState/useReducer values)
 */
function extractLocalState(fiber: FiberNode): unknown[] | undefined {
  if (fiber.tag !== FUNCTION_COMPONENT) return undefined;

  const states: unknown[] = [];
  let state = fiber.memoizedState as FiberState | null;

  let count = 0;
  while (state && count < 10) {
    const value = state.memoizedState;

    // Skip non-meaningful values
    if (!isMeaningfulStateValue(value)) {
      state = state.next;
      count++;
      continue;
    }

    try {
      if (typeof value === 'function') {
        // Skip - likely a dispatch function
      } else if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>;

        // Skip React Query internal structures
        if (isReactQueryInternal(obj)) {
          state = state.next;
          count++;
          continue;
        }

        // Skip idle mutation state
        if (isIdleMutationState(obj)) {
          state = state.next;
          count++;
          continue;
        }

        // Skip empty objects
        if (isEmptyObject(obj)) {
          state = state.next;
          count++;
          continue;
        }

        // Check if it's React Query state
        const cleaned = cleanReactQueryState(obj);
        if (cleaned) {
          states.push(cleaned);
        } else if (!('$$typeof' in value)) {
          // Regular object - include if not too large
          const str = JSON.stringify(value);
          if (str.length < 500) {
            states.push(value);
          } else {
            states.push('[Large object]');
          }
        }
      } else {
        // Primitive value
        states.push(value);
      }
    } catch {
      // Skip unserializable
    }

    state = state?.next ?? null;
    count++;
  }

  // Filter out arrays with only simple primitives (not very informative)
  const meaningfulStates = states.filter(s => {
    // Keep objects (including React Query state)
    if (s && typeof s === 'object') return true;
    // Keep strings that aren't empty
    if (typeof s === 'string' && s.length > 0) return true;
    // Keep numbers
    if (typeof s === 'number') return true;
    // Skip booleans and nullish values
    return false;
  });

  return meaningfulStates.length > 0 ? meaningfulStates : undefined;
}

/**
 * Extract the component path from a DOM element up to the root
 */
export function extractComponentPath(element: HTMLElement): ComponentPathItem[] {
  const allComponents: ComponentPathItem[] = [];
  const seen = new Set<string>();

  let fiber = getFiberFromElement(element);

  while (fiber) {
    if (isComponentFiber(fiber)) {
      const name = getComponentName(fiber);
      if (name && !seen.has(name)) {
        seen.add(name);

        const item: ComponentPathItem = {
          name,
          source:
            fiber.type && typeof fiber.type !== 'string' && fiber.type.displayName
              ? 'displayName'
              : 'fiber',
        };

        const sourceLocation = extractSourceLocation(fiber);
        if (sourceLocation) {
          item.sourceLocation = sourceLocation;
        }

        // Only extract props/state for non-framework components
        if (!isFrameworkComponent(name)) {
          const props = extractProps(fiber);
          if (props) {
            item.props = props;
          }

          const localState = extractLocalState(fiber);
          if (localState) {
            item.state = localState;
          }
        }

        allComponents.unshift(item);
      }
    }
    fiber = fiber.return;
  }

  // Check for data-component attributes
  let current: HTMLElement | null = element;
  while (current) {
    const componentAttr = current.getAttribute('data-component');
    if (componentAttr && !seen.has(componentAttr)) {
      seen.add(componentAttr);
      allComponents.push({ name: componentAttr, source: 'attribute' });
    }
    current = current.parentElement;
  }

  // Filter out framework components for cleaner output
  const appComponents = allComponents.filter((c) => !isFrameworkComponent(c.name));

  // If filtering removed everything, return at least the last few components
  if (appComponents.length === 0 && allComponents.length > 0) {
    return allComponents.slice(-5);
  }

  return appComponents;
}

/**
 * Format component path as a tree string
 */
export function formatComponentPath(path: ComponentPathItem[]): string {
  if (path.length === 0) return 'Unknown';

  return path
    .map((item, index) => {
      const indent = '  '.repeat(index);
      const prefix = index === 0 ? '' : '└── ';
      const suffix = index === path.length - 1 ? '  ← selected' : '';
      const source = item.sourceLocation
        ? ` (${item.sourceLocation.fileName}:${item.sourceLocation.lineNumber})`
        : '';
      return `${indent}${prefix}${item.name}${source}${suffix}`;
    })
    .join('\n');
}
