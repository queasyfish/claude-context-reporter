import { useState, useRef, useCallback, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';

// src/components/ContextReporter.tsx

// src/utils/dom-utils.ts
var DEFAULT_STYLES = {
  display: "block",
  position: "static",
  visibility: "visible",
  opacity: "1",
  cursor: "auto",
  pointerEvents: "auto",
  overflow: "visible",
  zIndex: "auto"
};
var STYLE_PROPERTIES = [
  "display",
  "position",
  "visibility",
  "opacity",
  "width",
  "height",
  "padding",
  "margin",
  "border",
  "backgroundColor",
  "color",
  "fontSize",
  "fontWeight",
  "cursor",
  "pointerEvents",
  "overflow",
  "zIndex"
];
function extractComputedStyles(element) {
  const computed = window.getComputedStyle(element);
  const styles = {};
  for (const prop of STYLE_PROPERTIES) {
    const kebabProp = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
    const value = computed.getPropertyValue(kebabProp);
    const defaultValue = DEFAULT_STYLES[prop];
    if (defaultValue && value === defaultValue) continue;
    if (prop === "border" && value.includes("none")) continue;
    if (prop === "backgroundColor" && (value === "transparent" || value === "rgba(0, 0, 0, 0)")) continue;
    if ((prop === "padding" || prop === "margin") && value === "0px") continue;
    styles[prop] = value;
  }
  return styles;
}
function generateUniqueSelector(element) {
  const testId = element.getAttribute("data-testid");
  if (testId) {
    return `[data-testid="${testId}"]`;
  }
  if (element.id) {
    return `#${element.id}`;
  }
  const componentAttr = element.getAttribute("data-component");
  if (componentAttr) {
    return `[data-component="${componentAttr}"]`;
  }
  const tag = element.tagName.toLowerCase();
  let selector = tag;
  if (element.className && typeof element.className === "string") {
    const meaningfulClasses = element.className.split(" ").filter((c) => {
      if (!c) return false;
      if (/^(flex|grid|block|inline|hidden|p-|m-|w-|h-|text-|bg-|border-|rounded|items-|justify-|gap-|space-)/.test(c)) return false;
      if (c.length < 3) return false;
      if (c.startsWith("_")) return false;
      return true;
    }).slice(0, 2);
    if (meaningfulClasses.length > 0) {
      selector += `.${meaningfulClasses.join(".")}`;
    }
  }
  const parent = element.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(
      (child) => child.tagName === element.tagName
    );
    if (siblings.length > 1) {
      const index = siblings.indexOf(element) + 1;
      selector += `:nth-of-type(${index})`;
    }
    const parentHint = parent.id ? `#${parent.id} > ` : parent.getAttribute("data-testid") ? `[data-testid="${parent.getAttribute("data-testid")}"] > ` : "";
    if (parentHint) {
      selector = parentHint + selector;
    }
  }
  return selector;
}
function getElementSummary(element) {
  if (!element || !(element instanceof HTMLElement)) return null;
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : "";
  const testId = element.getAttribute("data-testid");
  const testIdStr = testId ? `[data-testid="${testId}"]` : "";
  let classStr = "";
  if (!id && !testIdStr && element.className && typeof element.className === "string") {
    const firstClass = element.className.split(" ").find((c) => c && c.length > 2 && !c.startsWith("_"));
    if (firstClass) classStr = `.${firstClass}`;
  }
  const text = element.textContent?.trim().slice(0, 20) || "";
  return `<${tag}${id}${testIdStr}${classStr}>${text ? ` "${text}${text.length >= 20 ? "..." : ""}"` : ""}`;
}
function getHtmlPreview(element) {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? ` id="${element.id}"` : "";
  const testId = element.getAttribute("data-testid");
  const testIdAttr = testId ? ` data-testid="${testId}"` : "";
  let classAttr = "";
  if (element.className && typeof element.className === "string") {
    const classes = element.className.split(" ").filter(Boolean).slice(0, 3).join(" ");
    if (classes) classAttr = ` class="${classes}${element.className.split(" ").length > 3 ? " ..." : ""}"`;
  }
  return `<${tag}${id}${testIdAttr}${classAttr}>`;
}
function extractDOMContext(element) {
  const parents = [];
  let parent = element.parentElement;
  let depth = 0;
  while (parent && parent !== document.body && depth < 3) {
    parents.push({
      tagName: parent.tagName,
      id: parent.id || "",
      className: typeof parent.className === "string" ? parent.className.split(" ").slice(0, 3).join(" ") : "",
      htmlPreview: getHtmlPreview(parent)
    });
    parent = parent.parentElement;
    depth++;
  }
  const previousSibling = getElementSummary(element.previousElementSibling);
  const nextSibling = getElementSummary(element.nextElementSibling);
  const childCount = element.children.length;
  let innerHTML = element.innerHTML.trim();
  if (innerHTML.length > 300) {
    innerHTML = innerHTML.slice(0, 300) + "...";
  }
  return {
    parents,
    previousSibling,
    nextSibling,
    childCount,
    innerHTML
  };
}
function extractAccessibility(element) {
  return {
    role: element.getAttribute("role"),
    ariaLabel: element.getAttribute("aria-label"),
    ariaDescribedBy: element.getAttribute("aria-describedby"),
    ariaDisabled: element.getAttribute("aria-disabled"),
    tabIndex: element.getAttribute("tabindex")
  };
}
function extractElementInfo(element) {
  const rect = element.getBoundingClientRect();
  const attributes = {};
  for (const attr of Array.from(element.attributes)) {
    if (!["id", "class", "style"].includes(attr.name)) {
      if (attr.value.length > 200) {
        attributes[attr.name] = attr.value.slice(0, 200) + "...";
      } else {
        attributes[attr.name] = attr.value;
      }
    }
  }
  let textContent = element.textContent?.trim() || "";
  if (textContent.length > 150) {
    textContent = textContent.substring(0, 150) + "...";
  }
  return {
    tagName: element.tagName,
    id: element.id || "",
    className: typeof element.className === "string" ? element.className : "",
    textContent,
    attributes,
    boundingRect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    },
    selector: generateUniqueSelector(element),
    computedStyles: extractComputedStyles(element),
    domContext: extractDOMContext(element),
    accessibility: extractAccessibility(element)
  };
}
function isReporterElement(element) {
  return element.closest("[data-context-reporter]") !== null;
}

// src/hooks/useElementPicker.ts
function useElementPicker(onSelect) {
  const [state, setState] = useState({
    isActive: false,
    hoveredElement: null,
    selectedElement: null
  });
  const [highlightPosition, setHighlightPosition] = useState(null);
  const lastHoveredRef = useRef(null);
  const updateHighlight = useCallback((element) => {
    if (!element) {
      setHighlightPosition(null);
      return;
    }
    const rect = element.getBoundingClientRect();
    setHighlightPosition({
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height
    });
  }, []);
  const handleMouseMove = useCallback(
    (event) => {
      const target = event.target;
      if (isReporterElement(target)) {
        return;
      }
      if (target !== lastHoveredRef.current) {
        lastHoveredRef.current = target;
        setState((prev) => ({ ...prev, hoveredElement: target }));
        updateHighlight(target);
      }
    },
    [updateHighlight]
  );
  const handleClick = useCallback(
    (event) => {
      const target = event.target;
      if (isReporterElement(target)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setState((prev) => ({
        ...prev,
        isActive: false,
        selectedElement: target,
        hoveredElement: null
      }));
      setHighlightPosition(null);
      onSelect(target);
    },
    [onSelect]
  );
  const handleKeyDown = useCallback((event) => {
    if (event.key === "Escape") {
      setState((prev) => ({
        ...prev,
        isActive: false,
        hoveredElement: null
      }));
      setHighlightPosition(null);
    }
  }, []);
  const startPicking = useCallback(() => {
    setState({
      isActive: true,
      hoveredElement: null,
      selectedElement: null
    });
  }, []);
  const stopPicking = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isActive: false,
      hoveredElement: null
    }));
    setHighlightPosition(null);
  }, []);
  useEffect(() => {
    if (state.isActive) {
      document.addEventListener("mousemove", handleMouseMove, true);
      document.addEventListener("click", handleClick, true);
      document.addEventListener("keydown", handleKeyDown, true);
      document.body.style.cursor = "crosshair";
      return () => {
        document.removeEventListener("mousemove", handleMouseMove, true);
        document.removeEventListener("click", handleClick, true);
        document.removeEventListener("keydown", handleKeyDown, true);
        document.body.style.cursor = "";
      };
    }
  }, [state.isActive, handleMouseMove, handleClick, handleKeyDown]);
  return {
    state,
    startPicking,
    stopPicking,
    highlightPosition
  };
}

// src/utils/component-path.ts
var FUNCTION_COMPONENT = 0;
var CLASS_COMPONENT = 1;
var FORWARD_REF = 11;
var MEMO_COMPONENT = 14;
var SIMPLE_MEMO_COMPONENT = 15;
var COMPONENT_TAGS = /* @__PURE__ */ new Set([
  FUNCTION_COMPONENT,
  CLASS_COMPONENT,
  FORWARD_REF,
  MEMO_COMPONENT,
  SIMPLE_MEMO_COMPONENT
]);
var FRAMEWORK_COMPONENT_PATTERNS = [
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
  /Context$/
];
var EXCLUDED_PROPS = /* @__PURE__ */ new Set([
  "children",
  "key",
  "ref",
  "__self",
  "__source",
  "password",
  "token",
  "apiKey",
  "secret",
  "credentials",
  // Next.js 15 async props that are Promises
  "params",
  "searchParams"
]);
function isFrameworkComponent(name) {
  return FRAMEWORK_COMPONENT_PATTERNS.some((pattern) => pattern.test(name));
}
function getFiberFromElement(element) {
  const keys = Object.keys(element);
  const fiberKey = keys.find(
    (key) => key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")
  );
  if (fiberKey) {
    return element[fiberKey];
  }
  return null;
}
function getComponentName(fiber) {
  if (!fiber.type) return null;
  if (typeof fiber.type === "string") {
    return null;
  }
  if (fiber.type.displayName) {
    return fiber.type.displayName;
  }
  if (fiber.type.name) {
    return fiber.type.name;
  }
  return null;
}
function isComponentFiber(fiber) {
  return COMPONENT_TAGS.has(fiber.tag);
}
function extractSourceLocation(fiber) {
  if (fiber._debugSource) {
    let fileName = fiber._debugSource.fileName;
    fileName = fileName.replace(/^webpack:\/\/[^/]*\//, "").replace(/^\/_next\//, "").replace(/^\.\//, "");
    return {
      fileName,
      lineNumber: fiber._debugSource.lineNumber,
      columnNumber: fiber._debugSource.columnNumber
    };
  }
  return void 0;
}
function isMeaningfulStateValue(value) {
  if (value === null || value === void 0) return false;
  if (typeof value === "object" && value !== null) {
    const obj = value;
    if ("destroy" in obj || "create" in obj) return false;
    if ("current" in obj && Object.keys(obj).length === 1) return false;
    if ("persist" in obj && Object.keys(obj).length === 1) return false;
    if (Array.isArray(value) && value.length === 2 && value[0] === null) return false;
  }
  return true;
}
function isReactQueryInternal(obj) {
  if ("listeners" in obj && "options" in obj) return true;
  if ("_defaulted" in obj && Object.keys(obj).length <= 2) return true;
  return false;
}
function isIdleMutationState(obj) {
  if ("isIdle" in obj && "submittedAt" in obj) {
    if (obj.isIdle === true && obj.status === "idle") return true;
  }
  return false;
}
function isEmptyObject(obj) {
  const keys = Object.keys(obj);
  if (keys.length === 0) return true;
  return keys.every((k) => {
    const v = obj[k];
    if (v === null || v === void 0) return true;
    if (typeof v === "object" && Object.keys(v).length === 0) return true;
    return false;
  });
}
function cleanReactQueryState(state) {
  if (isReactQueryInternal(state)) return null;
  if (!("status" in state) && !("fetchStatus" in state)) return null;
  const cleaned = { _type: "ReactQuery" };
  if ("status" in state) {
    cleaned.status = state.status;
  }
  if ("data" in state && state.data !== null && state.data !== void 0) {
    const dataStr = JSON.stringify(state.data);
    if (dataStr.length > 1e3) {
      cleaned.data = "[Large data object - truncated]";
    } else {
      cleaned.data = state.data;
    }
  }
  if ("error" in state && state.error) {
    cleaned.error = state.error;
  }
  const boolFields = ["isLoading", "isError", "isPending", "isFetching"];
  for (const field of boolFields) {
    if (state[field] === true) {
      cleaned[field] = true;
    }
  }
  const hasUsefulData = "data" in cleaned || "error" in cleaned || boolFields.some((f) => cleaned[f] === true);
  return hasUsefulData || cleaned.status !== "idle" ? cleaned : null;
}
function isPromise(value) {
  return value !== null && typeof value === "object" && typeof value.then === "function";
}
function extractProps(fiber) {
  if (!fiber.memoizedProps) return void 0;
  const props = {};
  let hasProps = false;
  const memoizedProps = fiber.memoizedProps;
  const keys = Object.keys(memoizedProps);
  for (const key of keys) {
    if (EXCLUDED_PROPS.has(key)) continue;
    let value;
    try {
      value = memoizedProps[key];
    } catch {
      continue;
    }
    if (isPromise(value)) continue;
    if (typeof value === "function") {
      if (key.startsWith("on")) continue;
      props[key] = "[Function]";
      hasProps = true;
      continue;
    }
    if (value && typeof value === "object" && "$$typeof" in value) {
      continue;
    }
    if (typeof value === "string" && value.length > 100) {
      props[key] = value.slice(0, 100) + "...";
      hasProps = true;
      continue;
    }
    if (Array.isArray(value) && value.length > 10) {
      props[key] = `[Array(${value.length})]`;
      hasProps = true;
      continue;
    }
    if (typeof value === "object" && value !== null) {
      if (Array.isArray(value) && value.length === 0) continue;
      try {
        if (Object.keys(value).length === 0) continue;
      } catch {
        continue;
      }
    }
    try {
      JSON.stringify(value);
      props[key] = value;
      hasProps = true;
    } catch {
    }
  }
  return hasProps ? props : void 0;
}
function extractLocalState(fiber) {
  if (fiber.tag !== FUNCTION_COMPONENT) return void 0;
  const states = [];
  let state = fiber.memoizedState;
  let count = 0;
  while (state && count < 10) {
    const value = state.memoizedState;
    if (!isMeaningfulStateValue(value)) {
      state = state.next;
      count++;
      continue;
    }
    try {
      if (typeof value === "function") {
      } else if (value && typeof value === "object") {
        const obj = value;
        if (isReactQueryInternal(obj)) {
          state = state.next;
          count++;
          continue;
        }
        if (isIdleMutationState(obj)) {
          state = state.next;
          count++;
          continue;
        }
        if (isEmptyObject(obj)) {
          state = state.next;
          count++;
          continue;
        }
        const cleaned = cleanReactQueryState(obj);
        if (cleaned) {
          states.push(cleaned);
        } else if (!("$$typeof" in value)) {
          const str = JSON.stringify(value);
          if (str.length < 500) {
            states.push(value);
          } else {
            states.push("[Large object]");
          }
        }
      } else {
        states.push(value);
      }
    } catch {
    }
    state = state?.next ?? null;
    count++;
  }
  const meaningfulStates = states.filter((s) => {
    if (s && typeof s === "object") return true;
    if (typeof s === "string" && s.length > 0) return true;
    if (typeof s === "number") return true;
    return false;
  });
  return meaningfulStates.length > 0 ? meaningfulStates : void 0;
}
function extractComponentPath(element) {
  const allComponents = [];
  const seen = /* @__PURE__ */ new Set();
  let fiber = getFiberFromElement(element);
  while (fiber) {
    if (isComponentFiber(fiber)) {
      const name = getComponentName(fiber);
      if (name && !seen.has(name)) {
        seen.add(name);
        const item = {
          name,
          source: fiber.type && typeof fiber.type !== "string" && fiber.type.displayName ? "displayName" : "fiber"
        };
        const sourceLocation = extractSourceLocation(fiber);
        if (sourceLocation) {
          item.sourceLocation = sourceLocation;
        }
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
  let current = element;
  while (current) {
    const componentAttr = current.getAttribute("data-component");
    if (componentAttr && !seen.has(componentAttr)) {
      seen.add(componentAttr);
      allComponents.push({ name: componentAttr, source: "attribute" });
    }
    current = current.parentElement;
  }
  const appComponents = allComponents.filter((c) => !isFrameworkComponent(c.name));
  if (appComponents.length === 0 && allComponents.length > 0) {
    return allComponents.slice(-5);
  }
  return appComponents;
}

// src/types.ts
var CONSOLE_TAGS = {
  REPORT: "[CLAUDE_CONTEXT_REPORT]",
  SCREENSHOT: "[CLAUDE_CONTEXT_SCREENSHOT]"
};

// src/utils/reporter.ts
var DEFAULT_SERVER_URL = "http://localhost:9847";
var LOCAL_STORAGE_KEY = "contextReports";
var cachedServerAvailable = null;
var lastServerCheck = 0;
var SERVER_CHECK_INTERVAL = 5e3;
async function checkServerAvailable(serverUrl, timeout) {
  const now = Date.now();
  if (cachedServerAvailable !== null && now - lastServerCheck < SERVER_CHECK_INTERVAL) {
    return cachedServerAvailable;
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(`${serverUrl}/health`, {
      method: "GET",
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    cachedServerAvailable = response.ok;
    lastServerCheck = now;
    return cachedServerAvailable;
  } catch {
    cachedServerAvailable = false;
    lastServerCheck = now;
    return false;
  }
}
async function sendToServer(endpoint, data, serverUrl, timeout) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(`${serverUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}
function generateReportId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `report-${timestamp}-${random}`;
}
function saveToLocalStorage(report) {
  try {
    const existing = localStorage.getItem(LOCAL_STORAGE_KEY);
    const reports = existing ? JSON.parse(existing) : [];
    reports.unshift(report);
    const trimmed = reports.slice(0, 20);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn("[ContextReporter] Failed to save to localStorage:", err);
  }
}
function getStoredReports() {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}
function clearStoredReports() {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch (err) {
    console.warn("[ContextReporter] Failed to clear localStorage:", err);
  }
}
async function logContextReport(report, config = {}) {
  const {
    serverUrl = DEFAULT_SERVER_URL,
    serverTimeout = 1e3,
    forceConsole = false
  } = config;
  saveToLocalStorage(report);
  if (!forceConsole) {
    const serverAvailable = await checkServerAvailable(serverUrl, serverTimeout);
    if (serverAvailable) {
      const sent = await sendToServer("/report", report, serverUrl, serverTimeout);
      if (sent) {
        console.log(`[ContextReporter] Report sent to server: ${report.id}`);
        return { method: "server", success: true };
      }
    }
  }
  console.log(CONSOLE_TAGS.REPORT, JSON.stringify(report));
  console.group(`Context Report: ${report.id}`);
  console.log("URL:", report.url);
  console.log("Element:", `${report.selectedElement.tagName}#${report.selectedElement.id || "(no id)"}`);
  console.log("Component Path:", report.componentPath.map((c) => c.name).join(" > "));
  if (report.description) {
    console.log("Description:", report.description);
  }
  console.log("Note: Run /process-reports in Claude Code to retrieve this report");
  console.groupEnd();
  return { method: "console", success: true };
}
async function logContextScreenshot(screenshot, config = {}) {
  const {
    serverUrl = DEFAULT_SERVER_URL,
    serverTimeout = 2e3,
    // Longer timeout for screenshots (larger payload)
    forceConsole = false
  } = config;
  if (!forceConsole) {
    const serverAvailable = await checkServerAvailable(serverUrl, serverTimeout);
    if (serverAvailable) {
      const sent = await sendToServer("/screenshot", screenshot, serverUrl, serverTimeout);
      if (sent) {
        console.log(`[ContextReporter] Screenshot sent to server: ${screenshot.reportId}`);
        return { method: "server", success: true };
      }
    }
  }
  console.log(CONSOLE_TAGS.SCREENSHOT, JSON.stringify(screenshot));
  console.log(`[ContextReporter] Screenshot captured for report: ${screenshot.reportId}`);
  return { method: "console", success: true };
}
function createContextReport(params) {
  return {
    id: params.id,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    url: window.location.href,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    description: params.description,
    selectedElement: params.selectedElement,
    componentPath: params.componentPath,
    appState: params.appState,
    environment: {
      react: detectReactVersion(),
      userAgent: navigator.userAgent,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      url: window.location.href
    },
    consoleErrors: params.consoleErrors
  };
}
function detectReactVersion() {
  const win = window;
  const devTools = win.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (devTools?.renderers) {
    for (const renderer of devTools.renderers.values()) {
      if (renderer.version) {
        return renderer.version;
      }
    }
  }
  const react = win.React;
  if (react?.version) {
    return react.version;
  }
  return void 0;
}
async function isServerAvailable(serverUrl = DEFAULT_SERVER_URL, timeout = 1e3) {
  return checkServerAvailable(serverUrl, timeout);
}
function clearServerCache() {
  cachedServerAvailable = null;
  lastServerCheck = 0;
}

// src/utils/console-capture.ts
var consoleBuffer = [];
var MAX_BUFFER_SIZE = 50;
var MAX_AGE_MS = 6e4;
var isIntercepting = false;
var originalError = null;
var originalWarn = null;
function startConsoleCapture() {
  if (isIntercepting) return;
  originalError = console.error;
  originalWarn = console.warn;
  console.error = (...args) => {
    addToBuffer("error", args);
    originalError?.apply(console, args);
  };
  console.warn = (...args) => {
    addToBuffer("warn", args);
    originalWarn?.apply(console, args);
  };
  isIntercepting = true;
}
function addToBuffer(level, args) {
  const message = args.map((arg) => {
    if (arg instanceof Error) {
      return `${arg.name}: ${arg.message}
${arg.stack || ""}`;
    }
    if (typeof arg === "object") {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(" ");
  if (message.includes("[ContextReporter]")) return;
  consoleBuffer.push({
    level,
    message: message.slice(0, 1e3),
    // Truncate long messages
    timestamp: Date.now()
  });
  while (consoleBuffer.length > MAX_BUFFER_SIZE) {
    consoleBuffer.shift();
  }
}
function getRecentConsoleEntries(maxAge = MAX_AGE_MS) {
  const cutoff = Date.now() - maxAge;
  return consoleBuffer.filter((entry) => entry.timestamp > cutoff).map((entry) => ({ ...entry }));
}

// src/state-adapters/zustand.ts
function findZustandStores() {
  const win = window;
  const devtools = win.__ZUSTAND_DEVTOOLS_STORES__;
  if (devtools instanceof Map && devtools.size > 0) {
    const stores = {};
    devtools.forEach((store, name) => {
      stores[name] = store;
    });
    return stores;
  }
  const exposedStore = win.__ZUSTAND_STORE__;
  if (exposedStore && typeof exposedStore.getState === "function") {
    return { default: exposedStore };
  }
  const potentialStores = {};
  for (const key of Object.keys(win)) {
    if (key.toLowerCase().includes("store") || key.toLowerCase().includes("zustand")) {
      const value = win[key];
      if (value && typeof value.getState === "function") {
        potentialStores[key] = value;
      }
    }
  }
  if (Object.keys(potentialStores).length > 0) {
    return potentialStores;
  }
  return null;
}
var zustandAdapter = {
  name: "zustand",
  isAvailable() {
    return findZustandStores() !== null;
  },
  getState() {
    const stores = findZustandStores();
    if (!stores) return null;
    const combinedState = {};
    for (const [name, store] of Object.entries(stores)) {
      try {
        const state = store.getState();
        if (name === "default") {
          Object.assign(combinedState, state);
        } else {
          combinedState[name] = state;
        }
      } catch {
      }
    }
    return Object.keys(combinedState).length > 0 ? combinedState : null;
  }
};
function exposeZustandStore(store, name = "default") {
  const win = window;
  if (!win.__ZUSTAND_DEVTOOLS_STORES__) {
    win.__ZUSTAND_DEVTOOLS_STORES__ = /* @__PURE__ */ new Map();
  }
  win.__ZUSTAND_DEVTOOLS_STORES__.set(name, store);
}

// src/state-adapters/redux.ts
function findReduxStore() {
  const win = window;
  const devTools = win.__REDUX_DEVTOOLS_EXTENSION__;
  const devToolsStore = win.__REDUX_DEVTOOLS_STORE__;
  if (devToolsStore && typeof devToolsStore.getState === "function") {
    return devToolsStore;
  }
  const exposedStore = win.__REDUX_STORE__;
  if (exposedStore && typeof exposedStore.getState === "function") {
    return exposedStore;
  }
  const store = win.store;
  if (store && typeof store.getState === "function") {
    const maybeRedux = store;
    if (typeof maybeRedux.subscribe === "function" && typeof maybeRedux.dispatch === "function") {
      return store;
    }
  }
  if (devTools) {
    console.debug("[ContextReporter] Redux DevTools detected but store not accessible");
  }
  return null;
}
var reduxAdapter = {
  name: "redux",
  isAvailable() {
    return findReduxStore() !== null;
  },
  getState() {
    const store = findReduxStore();
    if (!store) return null;
    try {
      return store.getState();
    } catch {
      return null;
    }
  }
};
function exposeReduxStore(store) {
  const win = window;
  win.__REDUX_DEVTOOLS_STORE__ = store;
}

// src/state-adapters/jotai.ts
function findJotaiState() {
  const win = window;
  const devToolsState = win.__JOTAI_DEVTOOLS_STATE__;
  if (devToolsState && devToolsState.values instanceof Map) {
    const state = {};
    devToolsState.values.forEach((value, atom) => {
      const label = atom.debugLabel || atom.toString();
      state[label] = value;
    });
    return Object.keys(state).length > 0 ? state : null;
  }
  const exposedStore = win.__JOTAI_STORE__;
  const exposedAtoms = win.__JOTAI_ATOMS__;
  if (exposedStore && typeof exposedStore.get === "function" && Array.isArray(exposedAtoms)) {
    const state = {};
    for (const atom of exposedAtoms) {
      try {
        const label = atom.debugLabel || atom.toString();
        state[label] = exposedStore.get(atom);
      } catch {
      }
    }
    return Object.keys(state).length > 0 ? state : null;
  }
  return null;
}
var jotaiAdapter = {
  name: "jotai",
  isAvailable() {
    return findJotaiState() !== null;
  },
  getState() {
    return findJotaiState();
  }
};
function exposeJotaiStore(store, atoms) {
  const win = window;
  win.__JOTAI_STORE__ = store;
  win.__JOTAI_ATOMS__ = atoms;
}

// src/state-adapters/index.ts
var adapters = [zustandAdapter, reduxAdapter, jotaiAdapter];
function captureAppState(customStateGetter, excludeKeys) {
  const state = {};
  for (const adapter of adapters) {
    if (adapter.isAvailable()) {
      const adapterState = adapter.getState();
      if (adapterState) {
        let filteredState = excludeKeys ? filterState(adapterState, excludeKeys) : adapterState;
        filteredState = cleanState(filteredState);
        if (filteredState && Object.keys(filteredState).length > 0) {
          state[adapter.name] = filteredState;
        }
      }
    }
  }
  if (customStateGetter) {
    try {
      const customState = cleanState(customStateGetter());
      if (isMeaningfulValue(customState)) {
        state.custom = customState;
      }
    } catch (error) {
      console.warn("[ContextReporter] Error capturing custom state:", error);
    }
  }
  return state;
}
var NOISE_KEYS = /* @__PURE__ */ new Set([
  "persist",
  "listeners",
  "_hasHydrated",
  "_persist",
  "rehydrated"
]);
function isMeaningfulValue(value) {
  if (value === null || value === void 0) return false;
  if (value === "") return false;
  if (value === false) return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof value === "object" && Object.keys(value).length === 0) return false;
  return true;
}
function cleanState(state) {
  if (state === null || state === void 0) return void 0;
  if (Array.isArray(state)) {
    const cleaned = state.map(cleanState).filter(isMeaningfulValue);
    return cleaned.length > 0 ? cleaned : void 0;
  }
  if (typeof state === "object") {
    const obj = state;
    const cleaned = {};
    let hasValue = false;
    for (const [key, value] of Object.entries(obj)) {
      if (NOISE_KEYS.has(key)) continue;
      if (key.startsWith("$$") || key.startsWith("_")) continue;
      const cleanedValue = cleanState(value);
      if (isMeaningfulValue(cleanedValue)) {
        cleaned[key] = cleanedValue;
        hasValue = true;
      }
    }
    return hasValue ? cleaned : void 0;
  }
  return state;
}
function filterState(state, excludeKeys) {
  const filtered = {};
  for (const [key, value] of Object.entries(state)) {
    if (excludeKeys.includes(key)) {
      filtered[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      filtered[key] = filterState(value, excludeKeys);
    } else {
      filtered[key] = value;
    }
  }
  return filtered;
}
var UNSUPPORTED_COLOR_REGEX = /\b(lab|lch|oklch|oklab|color-mix|color)\s*\([^)]*\)/gi;
function sanitizeStyles(clonedDoc) {
  const styleSheets = clonedDoc.styleSheets;
  for (let i = 0; i < styleSheets.length; i++) {
    try {
      const sheet = styleSheets[i];
      const rules = sheet.cssRules || sheet.rules;
      if (!rules) continue;
      for (let j = 0; j < rules.length; j++) {
        const rule = rules[j];
        if (rule.style) {
          for (let k = 0; k < rule.style.length; k++) {
            const prop = rule.style[k];
            const value = rule.style.getPropertyValue(prop);
            if (UNSUPPORTED_COLOR_REGEX.test(value)) {
              rule.style.setProperty(prop, "transparent", rule.style.getPropertyPriority(prop));
            }
          }
        }
      }
    } catch {
    }
  }
  const elementsWithStyle = clonedDoc.querySelectorAll("[style]");
  elementsWithStyle.forEach((el) => {
    const style = el.style;
    for (let i = 0; i < style.length; i++) {
      const prop = style[i];
      const value = style.getPropertyValue(prop);
      if (UNSUPPORTED_COLOR_REGEX.test(value)) {
        style.setProperty(prop, "transparent", style.getPropertyPriority(prop));
      }
    }
  });
}
function useScreenshot() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState(null);
  const capture = useCallback(async (element) => {
    setIsCapturing(true);
    setError(null);
    try {
      const targetElement = element || document.body;
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
          return el.hasAttribute("data-context-reporter");
        },
        // Sanitize the cloned document to handle unsupported CSS
        onclone: (clonedDoc) => {
          try {
            sanitizeStyles(clonedDoc);
          } catch (e) {
            console.warn("[ContextReporter] Style sanitization warning:", e);
          }
        }
      });
      const dataUrl = canvas.toDataURL("image/png");
      setIsCapturing(false);
      return dataUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.warn("[ContextReporter] Screenshot capture failed, continuing without screenshot:", message);
      setError(err instanceof Error ? err : new Error("Screenshot capture failed"));
      setIsCapturing(false);
      return null;
    }
  }, []);
  return {
    capture,
    isCapturing,
    error
  };
}

// src/hooks/useContextCapture.ts
function useContextCapture(options = {}) {
  const { getCustomState, excludeStateKeys, onCapture, reporter } = options;
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastReport, setLastReport] = useState(null);
  const [lastReportMethod, setLastReportMethod] = useState(null);
  const [error, setError] = useState(null);
  const { capture: captureScreenshot, isCapturing: isCapturingScreenshot } = useScreenshot();
  useEffect(() => {
    startConsoleCapture();
  }, []);
  const captureContext = useCallback(
    async (element, description) => {
      setIsCapturing(true);
      setError(null);
      try {
        const reportId = generateReportId();
        const elementInfo = extractElementInfo(element);
        const componentPath = extractComponentPath(element);
        const appState = captureAppState(getCustomState, excludeStateKeys);
        const consoleErrors = getRecentConsoleEntries(3e4);
        const report = createContextReport({
          id: reportId,
          selectedElement: elementInfo,
          componentPath,
          appState,
          description,
          consoleErrors: consoleErrors.length > 0 ? consoleErrors : void 0
        });
        const reportResult = await logContextReport(report, reporter);
        setLastReportMethod(reportResult.method);
        setLastReport(report);
        if (onCapture) {
          onCapture(report);
        }
        try {
          const screenshotData = await captureScreenshot();
          if (screenshotData) {
            const screenshot = {
              reportId,
              data: screenshotData
            };
            await logContextScreenshot(screenshot, reporter);
          }
        } catch (screenshotErr) {
          console.warn("[ContextReporter] Screenshot capture failed:", screenshotErr);
        }
        setIsCapturing(false);
        return report;
      } catch (err) {
        const captureError = err instanceof Error ? err : new Error("Context capture failed");
        setError(captureError);
        setIsCapturing(false);
        console.error("[ContextReporter] Context capture failed:", err);
        return null;
      }
    },
    [getCustomState, excludeStateKeys, onCapture, reporter, captureScreenshot]
  );
  return {
    captureContext,
    isCapturing: isCapturing || isCapturingScreenshot,
    lastReport,
    lastReportMethod,
    error
  };
}
var positionStyles = {
  "bottom-right": { bottom: 20, right: 20 },
  "bottom-left": { bottom: 20, left: 20 },
  "top-right": { top: 20, right: 20 },
  "top-left": { top: 20, left: 20 }
};
function FloatingButton({
  position,
  onClick,
  isActive,
  zIndex
}) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      "data-context-reporter": "button",
      onClick,
      style: {
        position: "fixed",
        ...positionStyles[position],
        zIndex,
        width: 48,
        height: 48,
        borderRadius: "50%",
        border: "none",
        backgroundColor: isActive ? "#ef4444" : "#6366f1",
        color: "white",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        transition: "all 0.2s ease",
        outline: "none"
      },
      onMouseEnter: (e) => {
        e.currentTarget.style.transform = "scale(1.1)";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.transform = "scale(1)";
      },
      title: isActive ? "Cancel capture (Esc)" : "Capture context for Claude",
      "aria-label": isActive ? "Cancel capture" : "Capture context",
      children: isActive ? (
        // X icon when active
        /* @__PURE__ */ jsxs(
          "svg",
          {
            width: "24",
            height: "24",
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "2",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            children: [
              /* @__PURE__ */ jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
              /* @__PURE__ */ jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
            ]
          }
        )
      ) : (
        // Crosshair/target icon when inactive
        /* @__PURE__ */ jsxs(
          "svg",
          {
            width: "24",
            height: "24",
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "2",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            children: [
              /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "10" }),
              /* @__PURE__ */ jsx("line", { x1: "22", y1: "12", x2: "18", y2: "12" }),
              /* @__PURE__ */ jsx("line", { x1: "6", y1: "12", x2: "2", y2: "12" }),
              /* @__PURE__ */ jsx("line", { x1: "12", y1: "6", x2: "12", y2: "2" }),
              /* @__PURE__ */ jsx("line", { x1: "12", y1: "22", x2: "12", y2: "18" })
            ]
          }
        )
      )
    }
  );
}
function ElementPicker({
  isActive,
  highlightPosition,
  zIndex
}) {
  if (!isActive) {
    return null;
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      "div",
      {
        "data-context-reporter": "overlay",
        style: {
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: zIndex - 1,
          pointerEvents: "none"
        }
      }
    ),
    highlightPosition && /* @__PURE__ */ jsx(
      "div",
      {
        "data-context-reporter": "highlight",
        style: {
          position: "absolute",
          top: highlightPosition.top,
          left: highlightPosition.left,
          width: highlightPosition.width,
          height: highlightPosition.height,
          border: "2px solid #6366f1",
          backgroundColor: "rgba(99, 102, 241, 0.1)",
          pointerEvents: "none",
          zIndex,
          transition: "all 0.05s ease-out",
          borderRadius: 2
        },
        children: /* @__PURE__ */ jsx(
          "div",
          {
            style: {
              position: "absolute",
              top: -28,
              left: 0,
              backgroundColor: "#6366f1",
              color: "white",
              padding: "4px 8px",
              borderRadius: 4,
              fontSize: 12,
              fontFamily: "monospace",
              whiteSpace: "nowrap",
              pointerEvents: "none"
            },
            children: "Click to select"
          }
        )
      }
    ),
    /* @__PURE__ */ jsxs(
      "div",
      {
        "data-context-reporter": "banner",
        style: {
          position: "fixed",
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "#1f2937",
          color: "white",
          padding: "12px 24px",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
          zIndex,
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
          display: "flex",
          alignItems: "center",
          gap: 12
        },
        children: [
          /* @__PURE__ */ jsxs(
            "svg",
            {
              width: "20",
              height: "20",
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "2",
              strokeLinecap: "round",
              strokeLinejoin: "round",
              children: [
                /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "10" }),
                /* @__PURE__ */ jsx("line", { x1: "22", y1: "12", x2: "18", y2: "12" }),
                /* @__PURE__ */ jsx("line", { x1: "6", y1: "12", x2: "2", y2: "12" }),
                /* @__PURE__ */ jsx("line", { x1: "12", y1: "6", x2: "12", y2: "2" }),
                /* @__PURE__ */ jsx("line", { x1: "12", y1: "22", x2: "12", y2: "18" })
              ]
            }
          ),
          /* @__PURE__ */ jsx("span", { children: "Click on an element to capture context" }),
          /* @__PURE__ */ jsx("span", { style: { opacity: 0.7, marginLeft: 8 }, children: "Press Esc to cancel" })
        ]
      }
    )
  ] });
}
function DescriptionModal({
  isOpen,
  onSubmit,
  onCancel,
  zIndex
}) {
  const [description, setDescription] = useState("");
  const textareaRef = useRef(null);
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onCancel();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        onSubmit(description);
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, description, onSubmit, onCancel]);
  if (!isOpen) {
    return null;
  }
  return /* @__PURE__ */ jsx(
    "div",
    {
      "data-context-reporter": "modal-overlay",
      style: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex
      },
      onClick: onCancel,
      children: /* @__PURE__ */ jsxs(
        "div",
        {
          "data-context-reporter": "modal",
          style: {
            backgroundColor: "white",
            borderRadius: 12,
            padding: 24,
            width: "100%",
            maxWidth: 480,
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)"
          },
          onClick: (e) => e.stopPropagation(),
          children: [
            /* @__PURE__ */ jsx(
              "h2",
              {
                style: {
                  margin: "0 0 16px 0",
                  fontSize: 18,
                  fontWeight: 600,
                  color: "#111827"
                },
                children: "Add Description (Optional)"
              }
            ),
            /* @__PURE__ */ jsx(
              "p",
              {
                style: {
                  margin: "0 0 16px 0",
                  fontSize: 14,
                  color: "#6b7280"
                },
                children: "Describe what's wrong or what you'd like to fix. This helps Claude understand the issue."
              }
            ),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                ref: textareaRef,
                value: description,
                onChange: (e) => setDescription(e.target.value),
                placeholder: "e.g., 'Button doesn't respond to clicks' or 'Styling looks broken on mobile'",
                style: {
                  width: "100%",
                  minHeight: 100,
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  fontSize: 14,
                  resize: "vertical",
                  outline: "none",
                  fontFamily: "inherit",
                  boxSizing: "border-box"
                },
                onFocus: (e) => {
                  e.currentTarget.style.borderColor = "#6366f1";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.1)";
                },
                onBlur: (e) => {
                  e.currentTarget.style.borderColor = "#d1d5db";
                  e.currentTarget.style.boxShadow = "none";
                }
              }
            ),
            /* @__PURE__ */ jsxs(
              "div",
              {
                style: {
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 12,
                  marginTop: 16
                },
                children: [
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      onClick: onCancel,
                      style: {
                        padding: "10px 20px",
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        backgroundColor: "white",
                        color: "#374151",
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: "pointer"
                      },
                      children: "Skip"
                    }
                  ),
                  /* @__PURE__ */ jsxs(
                    "button",
                    {
                      onClick: () => onSubmit(description),
                      style: {
                        padding: "10px 20px",
                        borderRadius: 8,
                        border: "none",
                        backgroundColor: "#6366f1",
                        color: "white",
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: "pointer"
                      },
                      children: [
                        "Capture",
                        /* @__PURE__ */ jsxs("span", { style: { opacity: 0.7, marginLeft: 8, fontSize: 12 }, children: [
                          navigator.platform.includes("Mac") ? "\u2318" : "Ctrl",
                          "+Enter"
                        ] })
                      ]
                    }
                  )
                ]
              }
            )
          ]
        }
      )
    }
  );
}
function CaptureToast({
  isVisible,
  onHide,
  reportId,
  method = "console",
  zIndex
}) {
  const [isAnimating, setIsAnimating] = useState(false);
  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setTimeout(onHide, 200);
      }, 3e3);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onHide]);
  if (!isVisible && !isAnimating) {
    return null;
  }
  const isServer = method === "server";
  return /* @__PURE__ */ jsxs(
    "div",
    {
      "data-context-reporter": "toast",
      style: {
        position: "fixed",
        bottom: 80,
        right: 20,
        backgroundColor: isServer ? "#059669" : "#6366f1",
        color: "white",
        padding: "12px 20px",
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 500,
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        zIndex,
        display: "flex",
        alignItems: "center",
        gap: 12,
        transform: isAnimating ? "translateX(0)" : "translateX(120%)",
        opacity: isAnimating ? 1 : 0,
        transition: "all 0.2s ease-out"
      },
      children: [
        /* @__PURE__ */ jsx(
          "svg",
          {
            width: "20",
            height: "20",
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "2",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            children: /* @__PURE__ */ jsx("polyline", { points: "20 6 9 17 4 12" })
          }
        ),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("div", { children: "Context captured!" }),
          /* @__PURE__ */ jsx("div", { style: { fontSize: 12, opacity: 0.8, marginTop: 2 }, children: isServer ? /* @__PURE__ */ jsxs(Fragment, { children: [
            "Saved to ",
            /* @__PURE__ */ jsx("code", { style: { fontFamily: "monospace" }, children: "./reports/" })
          ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
            "Run ",
            /* @__PURE__ */ jsx("code", { style: { fontFamily: "monospace" }, children: "/context-reports" }),
            " in Claude Code"
          ] }) })
        ] })
      ]
    }
  );
}
function ContextReporter({
  position = "bottom-right",
  hotkey = "ctrl+shift+.",
  getCustomState,
  excludeStateKeys,
  onCapture,
  zIndex = 9999,
  reporter
}) {
  const [captureState, setCaptureState] = useState("idle");
  const [selectedElement, setSelectedElement] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [lastReportId, setLastReportId] = useState("");
  const [toastMethod, setToastMethod] = useState("console");
  const { captureContext, isCapturing, lastReportMethod } = useContextCapture({
    getCustomState,
    excludeStateKeys,
    onCapture,
    reporter
  });
  const handleElementSelected = useCallback((element) => {
    setSelectedElement(element);
    setCaptureState("describing");
  }, []);
  const { state: pickerState, startPicking, stopPicking, highlightPosition } = useElementPicker(handleElementSelected);
  const handleButtonClick = useCallback(() => {
    if (captureState === "picking") {
      stopPicking();
      setCaptureState("idle");
    } else {
      startPicking();
      setCaptureState("picking");
    }
  }, [captureState, startPicking, stopPicking]);
  const handleDescriptionSubmit = useCallback(
    async (description) => {
      if (!selectedElement) return;
      setCaptureState("capturing");
      const report = await captureContext(selectedElement, description || void 0);
      if (report) {
        setLastReportId(report.id);
        setToastMethod(lastReportMethod || "console");
        setShowToast(true);
      }
      setCaptureState("idle");
      setSelectedElement(null);
    },
    [selectedElement, captureContext, lastReportMethod]
  );
  const handleDescriptionCancel = useCallback(() => {
    setCaptureState("idle");
    setSelectedElement(null);
  }, []);
  useEffect(() => {
    const handleKeyDown = (e) => {
      const parts = hotkey.toLowerCase().split("+");
      const key = parts[parts.length - 1];
      const needsCtrl = parts.includes("ctrl");
      const needsShift = parts.includes("shift");
      const needsMeta = parts.includes("meta") || parts.includes("cmd");
      const needsAlt = parts.includes("alt");
      const keyMatches = e.key.toLowerCase() === key || e.key === key;
      const ctrlMatches = !needsCtrl || e.ctrlKey;
      const shiftMatches = !needsShift || e.shiftKey;
      const metaMatches = !needsMeta || e.metaKey;
      const altMatches = !needsAlt || e.altKey;
      if (keyMatches && ctrlMatches && shiftMatches && metaMatches && altMatches) {
        e.preventDefault();
        handleButtonClick();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [hotkey, handleButtonClick]);
  useEffect(() => {
    if (!pickerState.isActive && captureState === "picking") {
      setCaptureState("idle");
    }
  }, [pickerState.isActive, captureState]);
  return /* @__PURE__ */ jsxs("div", { "data-context-reporter": "root", children: [
    /* @__PURE__ */ jsx(
      FloatingButton,
      {
        position,
        onClick: handleButtonClick,
        isActive: captureState === "picking",
        zIndex
      }
    ),
    /* @__PURE__ */ jsx(
      ElementPicker,
      {
        isActive: captureState === "picking",
        highlightPosition,
        zIndex
      }
    ),
    /* @__PURE__ */ jsx(
      DescriptionModal,
      {
        isOpen: captureState === "describing",
        onSubmit: handleDescriptionSubmit,
        onCancel: handleDescriptionCancel,
        zIndex: zIndex + 1
      }
    ),
    /* @__PURE__ */ jsx(
      CaptureToast,
      {
        isVisible: showToast,
        onHide: () => setShowToast(false),
        reportId: lastReportId,
        method: toastMethod,
        zIndex
      }
    ),
    isCapturing && /* @__PURE__ */ jsx(
      "div",
      {
        "data-context-reporter": "loading",
        style: {
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: zIndex + 2
        },
        children: /* @__PURE__ */ jsx(
          "div",
          {
            style: {
              backgroundColor: "white",
              padding: "20px 32px",
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 500,
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)"
            },
            children: "Capturing context..."
          }
        )
      }
    )
  ] });
}

export { CONSOLE_TAGS, CaptureToast, ContextReporter, DescriptionModal, ElementPicker, FloatingButton, clearServerCache, clearStoredReports, exposeJotaiStore, exposeReduxStore, exposeZustandStore, getStoredReports, isServerAvailable, useContextCapture, useElementPicker, useScreenshot };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map