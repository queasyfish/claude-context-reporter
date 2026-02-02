// Main component export
export { ContextReporter } from './components/ContextReporter';

// Component exports for advanced usage
export {
  FloatingButton,
  ElementPicker,
  DescriptionModal,
  CaptureToast,
} from './components';

// Hook exports for custom implementations
export {
  useElementPicker,
  useScreenshot,
  useContextCapture,
} from './hooks';

// State adapter helpers
export {
  exposeZustandStore,
  exposeReduxStore,
  exposeJotaiStore,
} from './state-adapters';

// Reporter utilities
export {
  isServerAvailable,
  clearServerCache,
  getStoredReports,
  clearStoredReports,
} from './utils/reporter';

// Type exports
export type {
  ContextReporterProps,
  ReporterConfig,
  ButtonPosition,
  ElementInfo,
  ComponentPathItem,
  CapturedAppState,
  EnvironmentInfo,
  ViewportInfo,
  ContextReport,
  ContextScreenshot,
  PickerState,
  StateAdapter,
} from './types';

// Console tag constants for parsing
export { CONSOLE_TAGS } from './types';
