# PromptQueue Separator Highlight and Outline Design

## Status

Approved by user on 2026-03-17.

## Scope

This change adds editor-side support for PromptQueue-style `-*-` separators in all open `txt` and `md` documents. It does not change PromptQueue prompt storage, webview queue UI, import format, or copy behavior.

## Goals

- Highlight any line that starts with `-*-` in open plaintext and Markdown documents.
- Expose `-*-` sections as navigable entries in VS Code's built-in Outline view.
- Keep highlight and Outline as two independent settings in the VS Code Settings UI.
- Support both explicit titles and title fallback derived from the following non-empty content line.
- Reuse one parsing model for both highlight and Outline so behavior stays consistent.

## Non-Goals

- No custom Outline tree inside the PromptQueue sidebar.
- No file mutations, code actions, or automatic rewrites in edited documents.
- No restriction to PromptQueue data files; the feature applies to all open `txt` and `md` editors.
- No nested section hierarchy beyond the flat list shown in Outline.

## Editor Targets

The feature applies to documents whose language id is:

- `plaintext`
- `markdown`

This includes saved files and unsaved editors if VS Code has assigned one of those language modes.

## Parsing Model

A shared parser scans the full document text line by line.

### Separator Detection

Any line whose first three characters are `-*-` is treated as a separator line.

Accepted examples:

- `-*-`
- `-*- Title`
- `-*-Title`

Rejected examples:

- `  -*- Title` because the line does not start with `-*-`
- `text -*- Title` because `-*-` is not at the beginning

### Title Extraction

For a separator line:

- If non-whitespace text exists after `-*-`, trim it and use it as the section title.
- If nothing but whitespace exists after `-*-`, treat the section as having no explicit title.

Examples:

- `-*-new` => title `new`
- `-*- new` => title `new`
- `-*-    ` => no explicit title

### Fallback Title

If a separator has no explicit title:

1. Search downward until the next separator line or end of file.
2. Ignore blank lines.
3. Use a short leading snippet of the first non-empty line as the Outline title.
4. If no non-empty line is found, fall back to:
   - `<无标题>` for `zh-CN`
   - `<Untitled>` for `en`

The fallback snippet should be trimmed and truncated to a fixed length so Outline rows stay compact.

## Section Ranges

Each separator defines one section block:

- Section start: the separator line
- Section end: the line before the next separator, or end of file

Outline navigation jumps to the separator line, not the first content line. This keeps the visible divider aligned with the selected Outline item.

## Highlight Behavior

Highlighting uses a VS Code `TextEditorDecorationType` applied only to currently visible editors.

Presentation requirements:

- highlight the whole separator line
- use a subtle solid background rather than multicolor overlays
- add a slim left accent so separators remain easy to spot
- avoid error-like or warning-like visuals

Highlight updates on:

- visible editor changes
- active editor changes
- text document changes
- relevant setting changes

If the highlight setting is turned off, all PromptQueue separator decorations are removed immediately.

## Outline Behavior

Outline entries are provided through a `DocumentSymbolProvider`.

Behavior rules:

- only active when the Outline setting is enabled
- only returns symbols for `plaintext` and `markdown`
- returns a flat list of symbols, one per separator section
- coexists with Markdown's native heading outline rather than replacing it

Each symbol uses:

- name: explicit title or fallback title
- range: full section range
- selection range: separator line range

## Settings

Add two independent VS Code settings:

- `promptQueue.separatorHighlight.enabled`
- `promptQueue.separatorOutline.enabled`

Recommended defaults:

- both `true`

These settings belong in the VS Code Settings UI, not in the PromptQueue webview settings panel.

## Architecture

Add one focused editor module set separate from the existing PromptQueue queue/webview code:

- `promptSeparatorParser`
  - pure parsing logic
  - returns separator sections, titles, and ranges
- `promptSeparatorHighlighter`
  - owns the decoration type
  - applies and clears editor decorations
- `promptSeparatorOutlineProvider`
  - converts parsed sections into `DocumentSymbol[]`
- activation wiring in `src/extension.ts`
  - register provider
  - subscribe to editor/document/configuration events

The parser is the single source of truth. Highlighting and Outline must never duplicate separator parsing rules independently.

## Error Handling

- Parsing is tolerant and never throws on malformed content.
- Consecutive separator lines are allowed.
- A separator with no following content still produces an Outline entry using the untitled fallback.
- If a document type is unsupported, the feature does nothing.

## Performance

- Cache parse results by `document.uri` plus `document.version`.
- Reuse cached parse results for both highlighting and Outline requests.
- Limit decoration work to visible editors only.
- Keep parsing linear in document length with no regex-heavy backtracking logic.

## Testing Impact

Required coverage:

- parser tests for explicit titles, no-space titles, blank titles, blank-line skipping, and untitled fallback
- parser tests for section range boundaries across multiple separators
- Outline provider tests for symbol names, range mapping, and disabled-state behavior
- highlighter tests for decoration range selection and disabled-state clearing behavior
- manifest/config tests for the two new settings

## Open Decisions Resolved

- Outline target: VS Code built-in Outline
- feature scope: all open `txt` and `md` documents
- setting shape: two independent toggles
- untitled fallback lookup: skip blank lines and use the next non-empty line snippet
- settings surface: VS Code Settings page only
