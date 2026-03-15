# PromptQueue Native Tree Refinement Design

## Status

Approved by user on 2026-03-16.

This document refines the original PromptQueue sidebar design for a denser native `TreeView` UX without switching to `WebviewView`.

## Scope

This refinement only changes the native sidebar interaction model and visible labels. It does not change:

- workspace storage location
- prompt data format
- `-*-` / `-*- title` import parsing rules
- one-click copy semantics
- drag-and-drop or move up/down ordering support

## Goals

- Reduce visual clutter in the activity bar and view title area.
- Make `used` state toggling happen from the leading control instead of a separate command button.
- Keep left-click on a prompt row dedicated to copying.
- Move destructive or secondary actions into the right-click context menu.
- Add a bulk delete action with explicit confirmation.

## Activity Bar and View Labels

- Activity bar container title changes from `提示词队列` to `队列`.
- The view title inside the container also uses a shorter label to avoid crowding.
- Title bar actions use shorter labels:
  - `新增`
  - `批量导入`
  - `全部删除`

## Item Interaction Model

Each prompt row keeps native `TreeView` rendering but changes interaction responsibilities:

- Leading checkbox:
  - unchecked = `未使用`
  - checked = `已使用`
  - clicking the checkbox only toggles used state
- Left-clicking the row body:
  - always executes copy
  - successful copy still auto-marks the item as used
- Right-click context menu:
  - `编辑`
  - `删除`

The previous standalone UI action for `切换已使用状态` is removed from menus because checkbox interaction replaces it.

## Bulk Delete

A new title-bar action `全部删除` clears every prompt item, but only after confirmation.

Expected confirmation flow:

1. User clicks `全部删除`
2. Extension shows a warning confirmation dialog
3. Only an explicit confirm choice clears the list
4. Cancel leaves data unchanged

Recommended confirmation copy:

- message: `确认删除全部提示词吗？`
- detail: `此操作不可撤销。`
- confirm button: `全部删除`

## Menu Layout

Title bar:

- `新增`
- `批量导入`
- `全部删除`

Inline row actions:

- none beyond the native checkbox and row click behavior

Right-click row actions:

- `编辑`
- `删除`
- optional ordering actions can remain if space is not an issue, but they are secondary to this refinement

## Native Tree Requirements

This refinement stays on native `TreeView` and relies on native checkbox support rather than `WebviewView`.

Implementation expectations:

- `TreeItem.checkboxState` reflects prompt `used`
- `TreeView.onDidChangeCheckboxState` updates the underlying prompt state and refreshes the view
- row click command remains bound to copy

## Error Handling

- If bulk delete fails during persistence, show an error and keep the prior in-memory list consistent with stored data.
- If checkbox toggling fails, do not leave the UI in a misleading state; refresh from persisted state.

## Testing Impact

Required test coverage updates:

- manifest tests for shorter titles and the new `全部删除` action
- tree item tests for checkbox state and preserved copy command binding
- command tests for:
  - bulk delete confirmation
  - checkbox-driven used-state toggling
  - edit/delete remaining in context menu only
- integration smoke test confirming command registration still succeeds after menu changes
