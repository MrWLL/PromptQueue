# PromptQueue Webview Design

## Status

Approved by user on 2026-03-16.

## Scope

This change replaces the current native `TreeView` sidebar UI with a full `WebviewView` implementation while preserving the PromptQueue data model, workspace-local storage behavior, clipboard actions, and left activity bar entry.

The migration includes:

- full sidebar UI migration into a single webview
- prompt card presentation with larger hit targets
- in-webview create, edit, import, settings, delete-all, restore-last-delete, copy, and reorder flows
- workspace settings for storage path and UI language
- local backup and restore for the most recent delete-all action

The migration does not include:

- multi-backup history
- cloud sync
- changing the prompt import format

## Goals

- Make PromptQueue usable from both desktop and mobile remote-control scenarios.
- Present each prompt as a rounded card with larger text and larger click targets.
- Keep left-click on a card as the primary copy action.
- Support both desktop right-click and touch long-press for secondary actions.
- Preserve workspace-local data files, but allow the storage directory to be configured.
- Allow the webview UI to switch between Simplified Chinese and English.
- Keep prompt business logic in the extension host instead of duplicating rules in frontend code.

## Architecture

PromptQueue will move to a single `WebviewViewProvider` registered for the existing sidebar view id. The activity bar container remains unchanged, so the user still opens PromptQueue from the same left-side icon.

The implementation splits into three layers:

1. Host layer
   - owns persistence, clipboard access, VS Code configuration, and command registration
   - validates and executes all mutations
   - sends normalized state snapshots to the webview
2. Shared application layer
   - continues to use `PromptManager`, import parsing, and JSON stores
   - expands to cover last-delete backup and configurable storage roots
3. Webview layer
   - renders cards, drawers, menus, and toasts
   - sends typed UI intents to the host
   - does not write files or derive business rules directly

The webview and host communicate through message passing:

- webview -> host: user actions and requests
- host -> webview: initial state, refreshed state, success events, and error events

## Data and Settings

Prompt business data remains workspace-local and file-based. The default directory stays:

`WorkSpace/PromptQueue`

The resolved storage directory becomes configurable through the workspace setting:

`promptQueue.storagePath`

Rules:

- default value is `WorkSpace/PromptQueue`
- relative values resolve against the first workspace folder
- absolute values are used directly
- invalid or unwritable paths surface a clear UI error and block writes

The storage directory contains:

- `prompts.json`
  - current prompt queue
- `settings.json`
  - workspace-level copy template settings
- `last-deleted.json`
  - the most recent full backup created by delete-all

`settings.json` keeps the existing copy-template schema:

```json
{
  "prefix": "",
  "suffix": ""
}
```

The workspace setting:

`promptQueue.uiLanguage`

controls UI language for all webview-visible text. Supported values:

- `zh-CN`
- `en`

The webview receives already-selected language resources from the host so the frontend does not need to read VS Code configuration directly.

## Delete-All Backup and Restore

Delete-all behavior changes from destructive-only to destructive-with-last-backup:

1. Read the current prompt list
2. Save the full list into `last-deleted.json`
3. Clear `prompts.json`
4. Refresh the webview state

Restore behavior:

- only restores the single most recent delete-all backup
- replaces the current prompt list instead of merging
- asks for confirmation if the current list is not empty
- leaves `last-deleted.json` in place after a successful restore until the next delete-all overwrites it

If no backup exists, the UI shows a non-blocking error message and no mutation occurs.

## Copy Behavior

Primary copy remains the default left-click action for each card.

When the user left-clicks a card, the host copies:

1. `prefix`
2. current item content
3. `suffix`

Empty sections are removed before joining, so no extra blank sections are introduced. Joining uses a single newline between non-empty sections.

Secondary action `仅复制正文` or `Copy Content Only` copies only the current item content.

Both copy modes:

- write to the VS Code clipboard
- automatically mark the item as used on success
- do not change item state if clipboard writing fails

## Webview UI

The sidebar becomes a single-page application inside the webview.

### Top Bar

The top bar is fixed within the webview and includes:

- `新增` / `Add`
- `批量导入` / `Bulk Import`
- `全部删除` / `Delete All`
- `恢复上次删除` / `Restore Last Delete`
- `设置` / `Settings`

Below the actions, the UI shows a compact status row:

- total prompt count
- used prompt count
- shortened storage location label

### Prompt Cards

Each prompt renders as a rounded card with:

- title when available
- body preview when available
- a left-side or top-left status dot
- stronger emphasis for unused items
- lower emphasis for used items

The used state is represented only by the dot and card styling. The UI no longer shows explicit used/unused text labels.

Interactions:

- left-click card => templated copy
- click status dot => toggle used state
- desktop right-click card => open context menu
- touch long-press card => open the same context menu

Context menu items:

- copy content only
- edit
- delete
- move up
- move down

### Editing Surfaces

The webview uses an internal drawer or panel for secondary flows instead of separate VS Code input webviews:

- add drawer
- edit drawer
- bulk import drawer
- copy-settings drawer

The user stays inside the sidebar while editing, which reduces context switching and works better for repeated mobile-driven actions.

### Reordering

The webview supports two reorder paths:

- drag-and-drop card reordering on desktop
- explicit move up / move down actions for all platforms

This keeps mobile usability without sacrificing desktop convenience.

## Localization

All webview text comes from host-provided localized strings.

This includes:

- labels
- button text
- menu items
- drawer titles
- helper text
- confirmation messages
- success and error toasts

The extension host selects the active locale from `promptQueue.uiLanguage` and sends one language bundle with each webview state payload.

## Error Handling

Preferred error model:

- show lightweight toasts or inline banners for recoverable failures
- use explicit confirmation only for destructive or replacing actions
- avoid noisy VS Code modal dialogs except where the platform already requires them

Required cases:

- delete-all confirmation
- restore confirmation when replacing a non-empty list
- storage-path resolution failure
- file read/write failure
- clipboard failure
- invalid bulk import content

If storage becomes unavailable, the webview remains visible and shows the problem instead of silently failing.

## Testing Impact

Required verification areas:

- storage-path resolution for relative and absolute configured paths
- last-delete backup save/load/overwrite behavior
- restore-last-delete replacement behavior
- copy template and raw copy behavior remain correct
- language selection and host-provided strings
- webview message handling for add/edit/import/settings/delete/restore/reorder/toggle/copy
- manifest contribution changes from tree-based UI to webview-based UI
- extension activation still exposes the PromptQueue sidebar entry

## Migration Strategy

The migration should be incremental under the hood even though the user-visible result is a full replacement.

Recommended sequence:

1. add host-side configuration and backup support
2. add the webview provider and message protocol
3. render the new sidebar UI and wire existing prompt operations through it
4. remove obsolete native tree/panel activation once the webview path is covered by tests

This preserves the existing business logic while allowing future UI growth without being constrained by native tree styling limits.
