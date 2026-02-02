import type { StateAdapter } from '../types';

/**
 * Redux store reference type
 */
interface ReduxStore {
  getState: () => Record<string, unknown>;
}

/**
 * Find Redux store exposed via Redux DevTools or window
 */
function findReduxStore(): ReduxStore | null {
  const win = window as unknown as Record<string, unknown>;

  // Check for Redux DevTools extension
  const devTools = win.__REDUX_DEVTOOLS_EXTENSION__ as
    | { connect?: () => { init?: (state: unknown) => void } }
    | undefined;

  // Check for store exposed through Redux DevTools
  const devToolsStore = win.__REDUX_DEVTOOLS_STORE__ as ReduxStore | undefined;
  if (devToolsStore && typeof devToolsStore.getState === 'function') {
    return devToolsStore;
  }

  // Check for explicitly exposed store (common pattern)
  const exposedStore = win.__REDUX_STORE__ as ReduxStore | undefined;
  if (exposedStore && typeof exposedStore.getState === 'function') {
    return exposedStore;
  }

  // Check for store property (some apps expose it directly)
  const store = win.store as ReduxStore | undefined;
  if (store && typeof store.getState === 'function') {
    // Verify it looks like a Redux store (has subscribe, dispatch)
    const maybeRedux = store as unknown as Record<string, unknown>;
    if (typeof maybeRedux.subscribe === 'function' && typeof maybeRedux.dispatch === 'function') {
      return store;
    }
  }

  // Check if devtools extension is available but store isn't exposed
  if (devTools) {
    // Store exists but isn't directly accessible - we can't get state
    console.debug('[ContextReporter] Redux DevTools detected but store not accessible');
  }

  return null;
}

/**
 * Redux state adapter
 */
export const reduxAdapter: StateAdapter = {
  name: 'redux',

  isAvailable(): boolean {
    return findReduxStore() !== null;
  },

  getState(): Record<string, unknown> | null {
    const store = findReduxStore();
    if (!store) return null;

    try {
      return store.getState();
    } catch {
      return null;
    }
  },
};

/**
 * Helper to expose a Redux store for the context reporter
 * Add this to your app: exposeReduxStore(store)
 */
export function exposeReduxStore(store: ReduxStore): void {
  const win = window as unknown as Record<string, unknown>;
  win.__REDUX_DEVTOOLS_STORE__ = store;
}
