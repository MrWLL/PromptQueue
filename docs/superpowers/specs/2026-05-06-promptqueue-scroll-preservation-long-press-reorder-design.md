# PromptQueue Scroll Preservation And Long-Press Reorder

## Status

Approved in conversation on 2026-05-06.

## Scope

This change fixes two webview interaction problems in the PromptQueue sidebar:

- the prompt list jumps back to the top after lightweight UI interactions
- the expected long-press then drag reorder gesture is not implemented

The scope is intentionally limited to the webview interaction layer.

The scope includes:

- preserving prompt-list scroll position across normal rerenders
- changing long press from an item-menu gesture into a reorder gesture
- keeping item menus available from the `...` trigger and right click
- keeping the existing reorder message contract with the extension host

The scope does not include provider-side reorder changes, drawer redesign, settings changes, or replacing the current webview renderer with a new framework.

## Root Cause Summary

### Scroll Jump

The webview currently rerenders by replacing `root.innerHTML` for many state changes. That rebuilds `.pq-list`, so its `scrollTop` is lost.

This is not limited to the item `...` menu. It also affects any interaction that causes a normal rerender, including:

- opening or closing the item menu
- single-click copy
- toast appearance and auto-dismiss
- used-state toggles
- drawer open or close
- ordinary state refreshes

### Reorder Gesture Gap

The current implementation has two mismatches with the intended interaction:

- long press opens the item menu instead of starting reorder
- cards are directly `draggable`, so reorder is immediate drag, not gated behind a long press

## Goals

- Keep the list visually fixed in place during normal UI interactions.
- Allow the list to move only when a render is explicitly meant to auto-scroll.
- Make long press the only pointer gesture that arms drag reorder.
- Let users long-press a card and, without releasing, continue dragging to reorder.
- Preserve `...` and right click as the only menu-entry paths.
- Keep the existing click-to-copy behavior for ordinary short clicks.

## Non-Goals

- Do not redesign prompt cards.
- Do not add a drag handle.
- Do not add a new setting for long-press timing.
- Do not change the `reorderPrompts` message shape.
- Do not migrate away from the current string-based rerender approach in this task.

## Recommended Approach

Use a focused webview-only fix with two coordinated changes:

1. Add scroll-state preservation around rerenders.
2. Replace long-press-to-menu with long-press-to-reorder while keeping the existing drag/drop reorder pipeline.

This keeps the change local to the webview, preserves the existing host protocol, and addresses both reported problems without broad refactoring.

## Interaction Design

### Scroll Preservation Rules

The prompt list should preserve its scroll offset across every normal rerender.

Behavior:

1. Capture `.pq-list.scrollTop` immediately before rerender.
2. Rebuild the UI.
3. Restore the saved `scrollTop` onto the new `.pq-list`.

This restoration is the default behavior.

### Explicit Auto-Scroll Exceptions

Only explicitly approved auto-scroll cases may override the saved scroll position:

1. the first state received by the webview
2. a visibility-recovery refresh that intentionally repositions the queue
3. any future deliberately introduced target-focus behavior that explicitly opts out of restoration

If a rerender does not explicitly declare itself an auto-scroll case, the list must stay where it was.

### Interactions That Must Not Move The List

These interactions must preserve the current list position:

- clicking the item `...` button
- closing the item menu
- single-click copy
- toast show
- toast auto-dismiss
- toast manual dismiss
- toggle-used actions
- opening the add drawer
- opening the settings drawer
- closing drawers
- ordinary provider state refreshes

### Menu Entry Rules

Per-item menus remain available only from:

1. the trailing `...` button
2. right click / context menu

Long press no longer opens a menu.

## Long-Press Reorder Design

### Trigger Model

The reorder gesture starts only after a successful long press on a prompt card.

Rules:

- use a fixed long-press threshold of `520ms`
- use a fixed pointer-move tolerance of `6px` before the threshold
- if the pointer moves beyond tolerance before the threshold, cancel the long-press timer
- if the pointer is released before the threshold, treat the interaction as a normal click path

### Armed Reorder State

When the long-press threshold is reached:

- do not open a menu
- mark the pressed card as the active drag source
- visually indicate that reorder is armed
- allow reorder drag to start from that card only

At any moment, only one card may be armed as the drag source.

### Drag Without Releasing

After the long press succeeds, the user keeps holding the pointer down and continues moving.

Expected behavior:

- dragging over another card highlights that card as the reorder target
- releasing over a different card sends `reorderPrompts(sourceId, targetId)`
- releasing without a valid target clears reorder state and performs no reorder

### Click Preservation

Short click behavior remains intact:

- clicking a card still copies the prompt
- the copied mode still follows `includeTemplateOnClick`
- clicking the `...` button must not trigger copy
- clicking controls inside the card must not trigger reorder

### Reorder Menu Items

The existing menu actions `Move Up` and `Move Down` remain available.

They continue to serve as an alternate reorder path for keyboard-like or precise adjustments.

## Implementation Boundaries

### `media/promptqueue-view.js`

Main responsibilities:

- capture and restore `.pq-list` scroll position around rerenders
- let explicit auto-scroll flows opt out of restoration
- remove long-press menu opening
- gate drag arming behind long press
- preserve the existing copy, context-menu, and reorder message flows
- clear long-press and drag state on `pointerup`, `pointerleave`, `pointercancel`, drag end, and invalid drops

### `media/promptqueue-view.css`

Main responsibilities:

- add a visible armed-reorder state
- keep existing drag-over target styling compatible with the new gesture
- avoid layout side effects while new armed-state styling is shown

### `src/test/suite/promptWebviewAssets.test.ts`

Regression coverage should lock the intended front-end behavior at the asset level.

## Testing Impact

Follow test-first discipline for each changed behavior.

Coverage should include:

- the script preserves list scroll position across rerenders
- only explicit auto-scroll flows opt out of scroll restoration
- long press no longer opens the item menu
- item menus remain reachable from `open-item-menu` and `contextmenu`
- long press arms reorder instead of copy
- pointer release and cancel paths clear armed reorder state
- reorder still posts `type: 'reorderPrompts'`
- ordinary click copy paths still exist for templated and raw copy modes

## Acceptance Criteria

The change is complete when:

- the list no longer jumps to the top during normal UI interactions
- clicking `...` leaves the list exactly where it was
- single-click copy leaves the list exactly where it was
- toast lifecycle events leave the list exactly where it was
- long press no longer opens the item menu
- long-pressing a card and continuing to drag without releasing can reorder prompts
- releasing after a long press without a valid drop target does not reorder
- `...` and right click remain the only menu-entry gestures
- provider-side reorder handling remains unchanged
