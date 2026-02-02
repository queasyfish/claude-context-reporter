import type { CapturedAppState, StateAdapter } from '../types';
import { zustandAdapter, exposeZustandStore } from './zustand';
import { reduxAdapter, exposeReduxStore } from './redux';
import { jotaiAdapter, exposeJotaiStore } from './jotai';

// All available state adapters
const adapters: StateAdapter[] = [zustandAdapter, reduxAdapter, jotaiAdapter];

/**
 * Capture state from all available state managers
 */
export function captureAppState(
  customStateGetter?: () => unknown,
  excludeKeys?: string[]
): CapturedAppState {
  const state: CapturedAppState = {};

  for (const adapter of adapters) {
    if (adapter.isAvailable()) {
      const adapterState = adapter.getState();
      if (adapterState) {
        // Filter out excluded keys
        let filteredState = excludeKeys
          ? filterState(adapterState, excludeKeys)
          : adapterState;

        // Clean out null/empty values and noise
        filteredState = cleanState(filteredState) as Record<string, unknown>;

        if (filteredState && Object.keys(filteredState).length > 0) {
          state[adapter.name as keyof CapturedAppState] = filteredState;
        }
      }
    }
  }

  // Add custom state if provided
  if (customStateGetter) {
    try {
      const customState = cleanState(customStateGetter());
      if (isMeaningfulValue(customState)) {
        state.custom = customState;
      }
    } catch (error) {
      console.warn('[ContextReporter] Error capturing custom state:', error);
    }
  }

  return state;
}

/**
 * Keys that are noise in state captures
 */
const NOISE_KEYS = new Set([
  'persist',
  'listeners',
  '_hasHydrated',
  '_persist',
  'rehydrated',
]);

/**
 * Check if a value is meaningful (not null, undefined, empty, false, or noise)
 */
function isMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (value === '') return false;
  if (value === false) return false; // Skip false booleans (default state)
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof value === 'object' && Object.keys(value).length === 0) return false;
  return true;
}

/**
 * Clean state by removing null/empty values and noise
 */
function cleanState(state: unknown): unknown {
  if (state === null || state === undefined) return undefined;

  if (Array.isArray(state)) {
    const cleaned = state
      .map(cleanState)
      .filter(isMeaningfulValue);
    return cleaned.length > 0 ? cleaned : undefined;
  }

  if (typeof state === 'object') {
    const obj = state as Record<string, unknown>;
    const cleaned: Record<string, unknown> = {};
    let hasValue = false;

    for (const [key, value] of Object.entries(obj)) {
      // Skip noise keys
      if (NOISE_KEYS.has(key)) continue;

      // Skip React internals
      if (key.startsWith('$$') || key.startsWith('_')) continue;

      const cleanedValue = cleanState(value);
      if (isMeaningfulValue(cleanedValue)) {
        cleaned[key] = cleanedValue;
        hasValue = true;
      }
    }

    return hasValue ? cleaned : undefined;
  }

  return state;
}

/**
 * Filter out sensitive or excluded keys from state
 */
function filterState(
  state: Record<string, unknown>,
  excludeKeys: string[]
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(state)) {
    if (excludeKeys.includes(key)) {
      filtered[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      filtered[key] = filterState(value as Record<string, unknown>, excludeKeys);
    } else {
      filtered[key] = value;
    }
  }

  return filtered;
}

/**
 * Check if any state manager is available
 */
export function hasAvailableStateManager(): boolean {
  return adapters.some((adapter) => adapter.isAvailable());
}

/**
 * Get list of available state managers
 */
export function getAvailableStateManagers(): string[] {
  return adapters.filter((adapter) => adapter.isAvailable()).map((adapter) => adapter.name);
}

// Re-export helpers for apps to expose their stores
export { exposeZustandStore, exposeReduxStore, exposeJotaiStore };
