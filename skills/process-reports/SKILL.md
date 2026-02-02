---
name: process-reports
description: Process context reports and create implementation plans for bugs or features
---

# Process Reports Skill

This skill enables processing context reports from the `reports/` directory AND the browser console, then creating implementation plans to address the captured issues.

## Overview

Context reports capture UI state, component hierarchy, and user descriptions of bugs or feature requests. This skill guides the workflow of:

1. Checking browser console for context reports (via claude-in-chrome MCP)
2. Reading available reports from the reports directory
3. Presenting reports from both sources to the user for selection
4. Creating a detailed implementation plan

## Report Structure

Reports are markdown files in `reports/` with this structure:

| Section | Purpose |
|---------|---------|
| User Description | What the user wants (bug fix or feature) |
| Selected Element | The UI element involved |
| Component Path | React component hierarchy to the element |
| Component Props & State | Current state at each level |
| Application State | Zustand/global state snapshot |
| Suggested Files | Starting points for investigation |

## Workflow Steps

### 1. Get Browser Context

First, check for an active browser session:

```
Use mcp__claude-in-chrome__tabs_context_mcp to get available tabs
```

### 2. Check Browser Console

If a browser tab is available, read the console for context reports:

```
Use mcp__claude-in-chrome__read_console_messages with:
- tabId: {the active tab ID}
- pattern: "Context Report|ContextReporter"
- limit: 50
```

The ContextReporter component may log structured data to the console that hasn't been saved to a file yet.

### 3. Scan Reports Directory

```bash
# Find all context report files (not screenshots)
ls reports/*.md
```

Reports follow the naming pattern: `context-{YYYY-MM-DD}-{HHMMSS}-{slug}.md`

### 4. Parse Report Metadata

For each report (from console or file), extract:
- **Source** - "Console" or "File"
- **Timestamp** from filename or console timestamp
- **User Description** from the `## User Description` section
- **Component** from the `## Component Path` section (the leaf component)
- **Element** from the `## Selected Element` section

### 5. Present Selection

Use `AskUserQuestion` to show available reports, indicating source:

```
Option format: "[{source}] {timestamp} - {component} - {description preview}"
Example: "[Console] Jan 28 11:15 - EpicsSection - Add a button to refresh..."
Example: "[File] Jan 28 10:43 - EpicsSection - This is the bug Item..."
```

### 6. Create Implementation Plan

After selection, enter plan mode and create a plan that:

1. **Reads the full report** for complete context
2. **Locates source files** using the component path
3. **Explores related code** (hooks, state, types)
4. **Designs the solution** following project patterns
5. **Documents the plan** in `.claude/plans/{feature-name}.md`

## Plan File Structure

Save plans to `.claude/plans/{slug}.md` using this template:

```markdown
# {Feature/Bug Title}

## Context

**Source Report**: `reports/{report-filename}.md`
**Captured**: {timestamp}
**Component**: {component path}

## Problem Statement

{User description from report}

## Current State Analysis

{Summary of relevant state from report}

## Proposed Solution

### Approach
{High-level approach}

### Files to Modify
| File | Changes |
|------|---------|
| {path} | {what changes} |

### Files to Create
| File | Purpose |
|------|---------|
| {path} | {why needed} |

## Implementation Tasks

### Phase 1: {Phase Name}
- [ ] Task 1
- [ ] Task 2

### Phase 2: {Phase Name}
- [ ] Task 3
- [ ] Task 4

## Success Criteria

- [ ] Criterion 1
- [ ] Criterion 2
```

## Best Practices

### Understanding the Report

1. **Component Path tells you WHERE**: Follow the hierarchy to find the source file
2. **Props & State tell you WHAT**: Understand current data flow
3. **User Description tells you WHY**: Know the user's actual goal

### Creating Good Plans

1. **Start with exploration** - Don't assume, verify file locations
2. **Follow existing patterns** - Check project conventions
3. **Keep scope focused** - Address the specific issue, avoid scope creep
4. **Include success criteria** - How will we know it's done?

## Error Handling

| Situation | Response |
|-----------|----------|
| No reports found | Inform user to capture one with ContextReporter |
| Report can't be parsed | Show error, offer to view raw file |
| Component path doesn't match files | Use Explore agent to search codebase |

## Customization

You should customize this skill for your project by adding:

1. **Component to file mappings** - How your component names map to file paths
2. **Hooks to check** - Common data fetching hooks in your project
3. **Architecture patterns** - Links to your project's architecture docs

Example customization:

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
- `useApi.ts` for API calls
```

## Example Session

```
User: /process-reports

Agent: Let me check for context reports...

Found 2 reports:

1. [File] Jan 28 10:43 - UserProfile - "The save button doesn't work..."
2. [Console] Jan 28 11:15 - Navigation - "Add a logout button to..."

Which report would you like to implement?

User: 1

Agent: Reading report context-2026-01-28-104344-the.md...

This report describes a bug:
- Save button in UserProfile not triggering save action
- Component: UserProfile in ProfilePage
- Current state shows form data is populated

Entering plan mode to design the fix...

[Explores codebase, creates plan]

Plan saved to: .claude/plans/fix-user-profile-save.md
```
