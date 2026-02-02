import type { StateAdapter } from '../types';

/**
 * Jotai atom with debug label
 */
interface JotaiAtom {
  debugLabel?: string;
  toString: () => string;
}

/**
 * Jotai store reference type
 */
interface JotaiStore {
  get: <T>(atom: JotaiAtom) => T;
}

/**
 * Jotai devtools store type
 */
interface JotaiDevToolsState {
  values: Map<JotaiAtom, unknown>;
  atoms: Set<JotaiAtom>;
}

/**
 * Find Jotai store and atoms
 */
function findJotaiState(): Record<string, unknown> | null {
  const win = window as unknown as Record<string, unknown>;

  // Check for Jotai DevTools
  const devToolsState = win.__JOTAI_DEVTOOLS_STATE__ as JotaiDevToolsState | undefined;
  if (devToolsState && devToolsState.values instanceof Map) {
    const state: Record<string, unknown> = {};

    devToolsState.values.forEach((value, atom) => {
      const label = atom.debugLabel || atom.toString();
      state[label] = value;
    });

    return Object.keys(state).length > 0 ? state : null;
  }

  // Check for exposed store
  const exposedStore = win.__JOTAI_STORE__ as JotaiStore | undefined;
  const exposedAtoms = win.__JOTAI_ATOMS__ as JotaiAtom[] | undefined;

  if (exposedStore && typeof exposedStore.get === 'function' && Array.isArray(exposedAtoms)) {
    const state: Record<string, unknown> = {};

    for (const atom of exposedAtoms) {
      try {
        const label = atom.debugLabel || atom.toString();
        state[label] = exposedStore.get(atom);
      } catch {
        // Atom might not be initialized
      }
    }

    return Object.keys(state).length > 0 ? state : null;
  }

  return null;
}

/**
 * Jotai state adapter
 */
export const jotaiAdapter: StateAdapter = {
  name: 'jotai',

  isAvailable(): boolean {
    return findJotaiState() !== null;
  },

  getState(): Record<string, unknown> | null {
    return findJotaiState();
  },
};

/**
 * Helper to expose Jotai store for the context reporter
 * Add this to your app: exposeJotaiStore(store, [atom1, atom2, ...])
 */
export function exposeJotaiStore(store: JotaiStore, atoms: JotaiAtom[]): void {
  const win = window as unknown as Record<string, unknown>;
  win.__JOTAI_STORE__ = store;
  win.__JOTAI_ATOMS__ = atoms;
}
