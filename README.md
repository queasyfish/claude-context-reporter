# claude-context-reporter

Capture UI context from React apps and feed it to Claude Code agents for debugging and development.

## Installation

```bash
npm install claude-context-reporter
# or
yarn add claude-context-reporter
# or
pnpm add claude-context-reporter
```

## Quick Start

Add the `ContextReporter` component to your app layout (development only):

```tsx
// app/layout.tsx or App.tsx
import { ContextReporter } from 'claude-context-reporter';

export default function Layout({ children }) {
  return (
    <>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ContextReporter position="bottom-right" />
      )}
    </>
  );
}
```

That's it! A floating button will appear in the corner of your app during development.

## How It Works

1. **Capture**: Click the floating button or press `Ctrl+Shift+.`
2. **Select**: Hover over elements and click to select one
3. **Describe**: Optionally add a description of the issue
4. **Save**: Report is saved to `./reports/` (or console if server not running)
5. **Claude Code**: Run `/process-reports` to select a report and create an implementation plan

## Report Output Options

### Option 1: Local Server (Recommended)

Start the context reporter server in your project directory:

```bash
npx claude-context-reporter-server
```

Reports will be saved directly to `./reports/` with screenshots. This is the recommended approach as it:
- Saves reports immediately to disk
- Works without browser console access
- Doesn't require the Chrome MCP extension for retrieval

### Option 2: Browser Console (Fallback)

If the server isn't running, reports are logged to the browser console. Use the `/context-reports` skill with the Chrome MCP extension to retrieve them.

## What Gets Captured

- **Element Info**: Tag, ID, classes, attributes, text content
- **Component Path**: React component hierarchy (via fiber traversal)
- **App State**: Zustand, Redux, or Jotai state (auto-detected)
- **Screenshot**: Full-page screenshot
- **Environment**: React version, URL, viewport size

## Configuration

```tsx
<ContextReporter
  // Button position
  position="bottom-right" // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

  // Keyboard shortcut
  hotkey="ctrl+shift+." // Default

  // Custom state to include
  getCustomState={() => ({
    myCustomData: getMyData(),
  })}

  // Keys to redact from captured state
  excludeStateKeys={['password', 'apiKey', 'token']}

  // Callback when capture completes
  onCapture={(report) => {
    console.log('Captured:', report.id);
  }}

  // z-index for overlay elements
  zIndex={9999}

  // Reporter configuration
  reporter={{
    serverUrl: 'http://localhost:9847', // Default
    serverTimeout: 1000, // ms
    forceConsole: false, // Always use console, never server
  }}
/>
```

## Server Configuration

The server runs on port 9847 by default. Configure via environment variable:

```bash
PORT=9999 npx claude-context-reporter-server
```

### Server Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/report` | POST | Submit context report |
| `/screenshot` | POST | Submit screenshot |
| `/reports` | GET | List saved reports |

### Report Storage

```
./reports/
├── context-2026-01-28-143022-save-btn.md
├── context-2026-01-28-142815-email.md
└── screenshots/
    ├── context-2026-01-28-143022-save-btn.png
    └── context-2026-01-28-142815-email.png
```

## Exposing State Managers

For automatic state capture, ensure your state manager is accessible:

### Zustand

```tsx
import { exposeZustandStore } from 'claude-context-reporter';
import { useStore } from './store';

// In your app initialization
if (process.env.NODE_ENV === 'development') {
  exposeZustandStore(useStore);
}
```

### Redux

```tsx
import { exposeReduxStore } from 'claude-context-reporter';
import { store } from './store';

if (process.env.NODE_ENV === 'development') {
  exposeReduxStore(store);
}
```

### Jotai

```tsx
import { exposeJotaiStore } from 'claude-context-reporter';
import { getDefaultStore } from 'jotai';
import { userAtom, settingsAtom } from './atoms';

if (process.env.NODE_ENV === 'development') {
  exposeJotaiStore(getDefaultStore(), [userAtom, settingsAtom]);
}
```

## Claude Code Integration

### Installing the Skill

Copy the skill to your project's `.claude/skills/` directory:

```bash
# From your project root
mkdir -p .claude/skills/process-reports
cp node_modules/claude-context-reporter/skills/process-reports/SKILL.md .claude/skills/process-reports/
```

Or manually create `.claude/skills/process-reports/SKILL.md` and copy the contents from [skills/process-reports/SKILL.md](./skills/process-reports/SKILL.md).

### Customizing the Skill

Edit the skill file to add your project-specific mappings:

```markdown
### Mapping Components to Files

| Component Path | Likely File Location |
|----------------|---------------------|
| `HomePage` | `src/pages/Home.tsx` |
| `UserProfile` | `src/components/UserProfile/index.tsx` |
| `*Modal` | `src/components/modals/{name}Modal.tsx` |

### Hooks to Check

For any component, check for related hooks:
- `useUser.ts` for user data
- `useAuth.ts` for authentication
```

### Using the Skill

After capturing context in your app, use the `/process-reports` skill in Claude Code:

```
/process-reports
```

This will:
1. Check for reports in `./reports/` first
2. Fall back to reading from browser console if needed (requires `claude-in-chrome` MCP)
3. Let you select which report to work on
4. Enter plan mode to design and implement the fix

## Advanced Usage

### Check Server Availability

```tsx
import { isServerAvailable, clearServerCache } from 'claude-context-reporter';

// Check if server is running
const available = await isServerAvailable();

// Clear cached server status (e.g., after starting server)
clearServerCache();
```

### Custom Element Selection

```tsx
import { useElementPicker, useContextCapture } from 'claude-context-reporter';

function CustomCapture() {
  const { captureContext } = useContextCapture();
  const { startPicking, state, highlightPosition } = useElementPicker(
    async (element) => {
      const report = await captureContext(element, 'Custom capture');
      console.log('Captured:', report);
    }
  );

  return (
    <button onClick={startPicking}>
      Start Custom Capture
    </button>
  );
}
```

### Programmatic Capture

```tsx
import { useContextCapture } from 'claude-context-reporter';

function MyComponent() {
  const { captureContext, lastReportMethod } = useContextCapture();
  const ref = useRef<HTMLDivElement>(null);

  const handleError = async (error: Error) => {
    if (ref.current) {
      const report = await captureContext(ref.current, `Error: ${error.message}`);
      console.log(`Report sent via ${lastReportMethod}`); // 'server' or 'console'
    }
  };

  return <div ref={ref}>...</div>;
}
```

## Requirements

- React 17+ or 18+
- For server mode: Node.js 18+
- For console mode: Browser with DevTools + Claude Code with `claude-in-chrome` MCP server

## License

MIT
