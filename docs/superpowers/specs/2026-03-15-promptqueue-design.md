# PromptQueue Design

## Status

Approved by user on 2026-03-15.
Repository initialized on 2026-03-15 for PromptQueue development.

## Summary

`PromptQueue` is a VS Code extension for storing and using ordered prompt snippets from the sidebar. It is designed for a workflow where the user prepares many prompts in advance, then later copies them one by one into an agent session, often from a phone-controlled remote session.

The extension uses a native sidebar `TreeView`, stores data per workspace, supports one-click copy, marks copied items as used, and allows bulk import from plain text using a custom `-*-` separator format.

## Goals

- Keep prompts scoped to the current workspace.
- Make prompt usage fast from the VS Code sidebar.
- Preserve strict user-defined order.
- Support both single-item editing and large bulk imports.
- Keep the implementation native to VS Code UI primitives where practical.

## Non-Goals

- Cross-workspace sharing
- Cloud sync
- Tagging or grouping
- Full custom webview UI
- Rich background-color row rendering in the sidebar

## Storage

Workspace data lives under:

`WorkSpace/PromptQueue/`

Primary data file:

`WorkSpace/PromptQueue/prompts.json`

The extension will create the directory if it does not exist.

## Data Model

Each prompt item stores:

- `id`: stable internal unique identifier
- `title`: optional string
- `content`: required prompt body
- `used`: boolean
- `createdAt`: ISO timestamp
- `updatedAt`: ISO timestamp

Display numbering is derived from current list order and is not stored separately.

## Sidebar UX

The extension contributes a native `TreeView` in the VS Code side bar.

Each item shows:

- Label: `01. <title>` if a title exists
- Fallback label: `01. <content preview>` if no title exists
- Description: `已使用` or `未使用`
- Icon:
  - unused: neutral icon
  - used: checked or success-style icon
- Tooltip: full title, full content, and used state

The list order is user-controlled and never re-sorted automatically.

## Core Actions

View-level actions:

- Add item
- Bulk import
- Reset all items to unused

Item-level actions:

- Copy
- Toggle used state
- Move up
- Move down
- Drag to reorder
- Edit
- Delete

Command palette equivalents should exist for the same actions where practical.

## Copy and Used-State Rules

- Copying an item writes its `content` to the clipboard.
- A successful copy automatically marks the item as `used = true`.
- The user can manually toggle the used state afterward.
- If clipboard write fails, the item must not be auto-marked as used.

## Ordering Rules

- The list supports drag-and-drop reordering.
- The list also supports explicit `Move Up` and `Move Down` actions.
- After any reorder, display numbering updates immediately.

## Single Item Editing

Long prompt content should not be edited through a small input box.

Editing flow:

1. User triggers `Add` or `Edit`.
2. Extension opens a regular text editor buffer with a fixed template.
3. User edits the buffer.
4. User runs `PromptQueue: Save Item`.
5. Extension parses the buffer and writes the item back to storage.

Editor template:

```text
Title: optional title here

---
prompt body here
supports multiple lines
```

Parsing rules:

- `Title:` may be empty
- everything below `---` is `content`
- empty `content` is invalid and should show an error

## Bulk Import

Bulk import is a core workflow for pasting many prompts at once.

Supported input sources:

- current editor selection
- current editor document
- system clipboard

Supported import modes:

- append to existing items
- replace all existing items

### Separator Format

The separator line is `-*-`.

Rules:

- A line that is exactly `-*-` starts a new item with no title.
- A line that starts with `-*- ` starts a new item and assigns the rest of that line as the title of the next item.
- The separator line belongs to the next item, not the previous one.
- Text between separators becomes the item `content`.
- Leading and trailing blank space in each content block is trimmed.
- Empty content blocks are ignored.

Example:

```text
first prompt body
-*- Analysis
second prompt body
-*-
third prompt body
```

Produces:

1. item with no title and content `first prompt body`
2. item with title `Analysis` and content `second prompt body`
3. item with no title and content `third prompt body`

## Error Handling

- No open workspace: show an explanatory empty state and disable persistence actions.
- Missing storage directory: create it automatically.
- Empty import input: show `没有可导入内容`.
- Import parses to zero items: show an error and a minimal format example.
- Save failure: keep in-memory state unchanged and show an error.
- Copy failure: show an error and do not mark the item used.
- Invalid edit buffer: show parse error and keep the editor open.

## Implementation Structure

Suggested modules:

- `PromptTreeProvider`
  - owns item presentation, refresh, drag-and-drop integration
- `PromptStore`
  - reads and writes `WorkSpace/PromptQueue/prompts.json`
  - uses safe write semantics
- `PromptCommands`
  - registers and coordinates all extension commands
- `ImportParser`
  - parses bulk text into prompt items

## Persistence Rules

Writes should be done safely:

1. serialize JSON
2. write `prompts.json.tmp`
3. replace `prompts.json`

This reduces the chance of corrupting the data file on interrupted writes.

## Testing Strategy

High-value coverage only:

- parser unit tests
  - `-*-`
  - `-*- title`
  - repeated separators
  - whitespace trimming
  - empty blocks
- store tests
  - first-run file creation
  - load existing data
  - safe write behavior
- command tests
  - copy marks used on success
  - copy failure does not mark used
  - toggle used
  - move up/down
  - delete and renumber display
- minimal extension integration test
  - tree loads and refreshes from stored data

## MVP Scope

Included in MVP:

- native sidebar list
- per-workspace persistence
- add, edit, delete
- copy
- auto-mark used on copy
- manual used toggle
- drag reorder
- move up/down
- bulk import with `-*-` and `-*- title`
- reset all to unused

Excluded from MVP:

- search
- tags
- grouping
- export formats
- sync
- custom colored row backgrounds

## Open Constraints

- Native `TreeView` does not support arbitrary row background styling like a custom webview. Used-state emphasis therefore relies on iconography and description text rather than full-row color fill.
- The desired workspace path uses `WorkSpace/PromptQueue/`, which is intentionally separate from `.vscode/`.
