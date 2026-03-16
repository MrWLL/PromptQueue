# PromptQueue Copy Template Design

## Status

Approved by user on 2026-03-16.

## Scope

This change adds workspace-level copy templates for PromptQueue without changing the native `TreeView` foundation, item ordering, import format, or storage root directory.

## Goals

- Let users define a workspace-shared `前提示词` and `后提示词`.
- Keep left-click copy as the primary action, but make it copy `前提示词 + 当前条目内容 + 后提示词`.
- Omit empty sections automatically so copied text has no extra blank blocks.
- Add a context-menu action to copy only the current item content while still marking the item as used.
- Keep the new entry point compact by placing `设置` in the view title actions.

## Data Model

Prompt items remain in `WorkSpace/PromptQueue/prompts.json`.

Copy template settings live in a separate workspace-local file:

`WorkSpace/PromptQueue/settings.json`

```json
{
  "prefix": "",
  "suffix": ""
}
```

Reasons for a separate file:

- no migration of existing prompt item data
- low risk to current prompt loading logic
- clear separation between queue data and workspace copy preferences

If `settings.json` is missing, PromptQueue behaves as if both fields are empty.

## Copy Behavior

Default left-click copy flow:

1. Load the selected prompt item
2. Read current workspace copy template settings
3. Build copy text from non-empty sections only:
   - `prefix`
   - current item `content`
   - `suffix`
4. Join remaining sections with a single newline
5. Write the final text to the clipboard
6. Mark the item as used

Examples:

- prefix + content + suffix all present => three lines/blocks in order
- empty prefix => copy `content + suffix`
- empty suffix => copy `prefix + content`
- both empty => copy only current item content

The alternate context-menu action `仅复制正文` skips prefix and suffix entirely but still marks the item as used after a successful clipboard write.

## UI Changes

View title actions:

- `新增`
- `批量导入`
- `全部删除`
- `设置`

Item right-click actions:

- `仅复制正文`
- `编辑`
- `删除`
- existing move actions may remain

Settings open in a lightweight panel with two multiline fields:

- `前提示词`
- `后提示词`

Saving applies immediately to future copy actions.

## Error Handling

- If settings persistence fails, show the error and leave prior settings unchanged in memory.
- If copying fails, do not mark the item as used.
- If the workspace is unavailable, reuse existing missing-workspace behavior.

## Testing Impact

Required coverage:

- settings store load/save with missing-file fallback
- copy text composition with empty-section omission
- default copy using prefix/suffix while still marking the item as used
- raw-content copy bypassing prefix/suffix while still marking the item as used
- manifest coverage for `设置` and `仅复制正文`
