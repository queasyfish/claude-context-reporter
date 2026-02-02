import type { StateAdapter } from '../types';

/**
 * Zustand store reference type
 */
interface ZustandStore {
  getState: () => Record<string, unknown>;
}

/**
 * Find Zustand stores exposed on the window or through devtools
 */
function findZustandStores(): Record<string, ZustandStore> | null {
  const win = window as unknown as Record<string, unknown>;

  // Check for stores exposed via zustand/middleware devtools
  const devtools = win.__ZUSTAND_DEVTOOLS_STORES__ as Map<string, ZustandStore> | undefined;
  if (devtools instanceof Map && devtools.size > 0) {
    const stores: Record<string, ZustandStore> = {};
    devtools.forEach((store, name) => {
      stores[name] = store;
    });
    return stores;
  }

  // Check for explicitly exposed stores (common pattern)
  const exposedStore = win.__ZUSTAND_STORE__ as ZustandStore | undefined;
  if (exposedStore && typeof exposedStore.getState === 'function') {
    return { default: exposedStore };
  }

  // Look for any property that looks like a zustand store
  const potentialStores: Record<string, ZustandStore> = {};
  for (const key of Object.keys(win)) {
    if (key.toLowerCase().includes('store') || key.toLowerCase().includes('zustand')) {
      const value = win[key] as ZustandStore | undefined;
      if (value && typeof value.getState === 'function') {
        potentialStores[key] = value;
      }
    }
  }

  if (Object.keys(potentialStores).length > 0) {
    return potentialStores;
  }

  return null;
}

/**
 * Zustand state adapter
 */
export const zustandAdapter: StateAdapter = {
  name: 'zustand',

  isAvailable(): boolean {
    return findZustandStores() !== null;
  },

  getState(): Record<string, unknown> | null {
    const stores = findZustandStores();
    if (!stores) return null;

    const combinedState: Record<string, unknown> = {};

    for (const [name, store] of Object.entries(stores)) {
      try {
        const state = store.getState();
        if (name === 'default') {
          Object.assign(combinedState, state);
        } else {
          combinedState[name] = state;
        }
      } catch {
        // Store might be in a bad state, skip it
      }
    }

    return Object.keys(combinedState).length > 0 ? combinedState : null;
  },
};

/**
 * Helper to expose a zustand store for the context reporter
 * Add this to your app: exposeZustandStore(useStore)
 */
export function exposeZustandStore(store: ZustandStore, name = 'default'): void {
  const win = window as unknown as Record<string, unknown>;

  if (!win.__ZUSTAND_DEVTOOLS_STORES__) {
    win.__ZUSTAND_DEVTOOLS_STORES__ = new Map<string, ZustandStore>();
  }

  (win.__ZUSTAND_DEVTOOLS_STORES__ as Map<string, ZustandStore>).set(name, store);
}
