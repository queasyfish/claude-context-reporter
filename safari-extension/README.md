# Claude Context Reporter - Safari Extension

A native Safari Web Extension that captures HTML element data for AI context.

## Features

- **Right-click capture**: Right-click any element → "Capture for AI Context"
- **Element picker UI**: Highlights hovered elements with a blue border
- **Capture modal**: Add comments about the selected element
- **Element data extraction**: CSS selector, XPath, computed styles, text content
- **Local storage**: Reports stored locally in browser storage
- **Markdown export**: Copy reports as Markdown for AI tools

## Requirements

- macOS 13.0 or later
- Safari 16 or later
- Xcode 15.0 or later (for building)

## Installation

### From Xcode

1. Open the Xcode project:
   ```bash
   open "Claude Context Reporter/Claude Context Reporter.xcodeproj"
   ```

2. Build the project (⌘B)

3. Run the app (⌘R)

4. Enable the extension:
   - Open Safari → Settings (⌘,)
   - Go to Extensions tab
   - Enable "Claude Context Reporter"

### From the App

The native app provides a simple UI with instructions on how to enable the extension.

## Usage

1. **Capture an element**:
   - Right-click any element on a webpage
   - Select "Capture for AI Context"
   - (Alternative: Click and the picker will activate automatically)

2. **Element picker mode**:
   - Hover over elements to highlight them (blue border)
   - A tooltip shows the element's tag, ID, and classes
   - Click to select the element
   - Press ESC to cancel

3. **Add a comment**:
   - After selecting an element, a modal appears
   - Enter your comment about the element
   - Press Cmd+Enter or click "Save Report"

4. **View reports**:
   - Click the extension icon in Safari's toolbar
   - See all captured reports

5. **Copy as Markdown**:
   - Click "Copy Markdown" on any report
   - Paste into your AI tool (Claude, ChatGPT, etc.)

6. **Manage reports**:
   - Delete individual reports
   - Clear all reports
   - Export all as JSON

## Project Structure

```
Claude Context Reporter/
├── Claude Context Reporter.xcodeproj
├── Claude Context Reporter/           # Native macOS app
│   ├── AppDelegate.swift
│   ├── ViewController.swift
│   ├── Main.storyboard
│   ├── Assets.xcassets/
│   └── Info.plist
└── Claude Context Reporter Extension/ # Safari extension
    ├── SafariWebExtensionHandler.swift
    ├── Info.plist
    └── Resources/
        ├── manifest.json
        ├── background.js
        ├── content.js
        ├── popup.html
        ├── popup.js
        ├── popup.css
        └── images/
            ├── icon-48.png
            ├── icon-96.png
            └── icon-128.png
```

## Extracted Data

For each captured element, the extension extracts:

- **Identification**: CSS selector, XPath, tag name, ID, classes
- **Content**: Text content (truncated), inner HTML
- **Attributes**: All HTML attributes except `style`
- **Computed Styles**: 30+ CSS properties (layout, typography, colors, etc.)
- **Bounding Box**: Position and size
- **Page Context**: URL and title

## Markdown Report Format

```markdown
## Element Context Report

**Page:** Example Page Title
**URL:** https://example.com/page
**Captured:** 2/16/2024, 10:30:00 AM

### Comment
Your description of the issue or context...

### Element
- **Tag:** `<button>`
- **ID:** `submit-btn`
- **Class:** `btn btn-primary`
- **CSS Selector:** `body > main > form > button:nth-of-type(1)`
- **XPath:** `/html[1]/body[1]/main[1]/form[1]/button[1]`

### Text Content
\`\`\`
Submit Form
\`\`\`

### Attributes
- `type`: submit
- `data-action`: submit-form

### Computed Styles
\`\`\`css
display: flex;
background-color: rgb(37, 99, 235);
color: rgb(255, 255, 255);
...
\`\`\`

### Bounding Box
- Position: (120, 450)
- Size: 200×48px
```

## Development

### Building

```bash
cd "Claude Context Reporter"
xcodebuild -project "Claude Context Reporter.xcodeproj" \
           -scheme "Claude Context Reporter" \
           -configuration Debug build
```

### Debugging

1. Enable "Develop" menu in Safari → Settings → Advanced
2. Go to Develop → Web Extension Background Content
3. Select "Claude Context Reporter Extension" to inspect

## License

MIT License
