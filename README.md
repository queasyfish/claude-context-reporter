# AI Context Reporter

Browser extensions for capturing element context to share with AI coding agents. Works with any AI assistant that accepts markdown input.

## Features

- **Element Picker**: Visual selection of any DOM element
- **Context Capture**: CSS selector, XPath, computed styles, text content, attributes
- **Project Organization**: Route reports to project-specific folders based on URL patterns
- **Export Options**: Auto-save to `~/Downloads/ai-agent-reports/`, copy as markdown, drag-and-drop
- **Cross-Browser**: Available for Chrome and Safari

## Installation

### Chrome Extension

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `chrome-extension/.output/chrome-mv3` directory

To build from source:
```bash
cd chrome-extension
npm install
npm run build
```

### Safari Extension

1. Open the Xcode project:
   ```bash
   open "safari-extension/Claude Context Reporter/Claude Context Reporter.xcodeproj"
   ```
2. Build and run (Cmd+R)
3. Open Safari → Settings → Extensions
4. Enable "AI Context Reporter"

## Usage

### Capturing Elements

**Chrome (DevTools):**
1. Open DevTools (F12)
2. Go to the "Context Report" panel
3. Select an element in the Elements panel
4. Add a comment and click "Save Report"

**Safari (Context Menu):**
1. Right-click any element
2. Select "Capture for AI Context"
3. Click the highlighted element
4. Add a comment and save

### Report Output

Reports are saved as markdown files to:
```
~/Downloads/ai-agent-reports/{domain-or-project}/
```

Example structure:
```
ai-agent-reports/
├── localhost-3000/
│   └── 2024-01-28-143022-localhost-3000-button.md
├── github-com/
│   └── 2024-01-28-142815-github-com-div.md
└── my-react-app/          # Custom project folder
    └── 2024-01-28-144500-localhost-3000-input.md
```

### Project Mappings

Configure project-specific folders in the Settings tab:

| Field | Example |
|-------|---------|
| Project Name | My React App |
| URL Patterns | `localhost:3000`, `*.myapp.com` |
| Folder | `my-react-app` |

**Pattern Syntax:**
- Exact match: `localhost:3000`, `staging.myapp.com`
- Wildcard prefix: `*.myapp.com` (matches `app.myapp.com`, `api.myapp.com`)
- Port wildcard: `localhost:*` (matches any localhost port)

### Report Format

Reports are markdown files containing:

```markdown
# Element Context Report

**Project:** My React App
**Page URL:** http://localhost:3000/dashboard
**Captured:** 1/28/2024, 2:30:22 PM

## Comment

Button doesn't respond to clicks after form validation error

## Element

- **Tag:** `<button>`
- **ID:** `submit-btn`
- **CSS Selector:** `form > button#submit-btn`
- **XPath:** `/html/body/div[1]/form/button[1]`

## Text Content

\`\`\`
Submit Form
\`\`\`

## Computed Styles

\`\`\`css
display: inline-flex;
background-color: rgb(37, 99, 235);
...
\`\`\`
```

## Using with AI Agents

1. **Direct Path**: Point your AI agent to `~/Downloads/ai-agent-reports/`
2. **Copy/Paste**: Use the "Copy" button to copy markdown to clipboard
3. **Drag and Drop**: Drag report cards directly into your IDE or terminal

## Development

### Chrome Extension

```bash
cd chrome-extension
npm install
npm run dev      # Watch mode
npm run build    # Production build
```

### Safari Extension

Open in Xcode and build. The extension is in `safari-extension/Claude Context Reporter/`.

Note: The Xcode project directories still use "Claude Context Reporter" naming. The user-facing name has been updated to "AI Context Reporter" in the manifest.

## License

MIT
