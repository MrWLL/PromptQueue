# PromptQueue Mobile-Style Reorder Refinement

## Status

Approved in conversation on 2026-05-07 for implementation planning.

## Why This Spec Exists

The existing `260dd9284bce5f47f58484e1718445bf7f480943` change moved PromptQueue from native drag/drop to a pointer-driven reorder session, but it still falls short of the intended feel.

The desired outcome is not merely "less abrupt drag sorting". The desired outcome is a mobile-style reorder interaction, closer to rearranging home-screen icons:

- the dragged item visually detaches and tracks the pointer directly
- the list opens a real gap for the dragged item
- surrounding items shift as a group to make room
- auto-scroll stays stable while dragging through a long list
- releasing feels like confirming an already-visible final order

## Audit Findings

### Keep

These changes are directionally correct and should remain:

- explicit sort mode as the only reorder entry point
- pointer-driven reorder instead of native HTML drag/drop
- exact `targetIndex` persistence contract
- provider/manager/playground alignment around `targetIndex`

### Fix

These problems still prevent the interaction from feeling native:

1. The dragged card still lives in the normal list flow and is only visually offset with `transform`.
2. The current placeholder/displacement model is still card-in-list oriented rather than true gap-oriented.
3. Geometry is recalculated from live DOM on every update, which is fragile under auto-scroll.
4. Tests over-index on asset-string assertions and did not catch earlier semantic bugs.

### Split Out

These changes are not inherently wrong, but they do not belong inside the reorder feature commit:

- `src/test/runTest.ts`
- `src/test/suite/runTestHarness.test.ts`

They should be separated into their own harness-focused change unless the implementation work proves they are strictly required for reorder verification.

## Scope

This refinement includes:

- replacing the current in-flow dragged-card model with an overlay-based drag layer
- introducing a real gap/slot model for live reorder
- making neighbor movement feel like a coordinated slot shift
- tightening auto-scroll behavior for long lists
- upgrading tests so reorder semantics are validated behaviorally, not only by source-text presence
- separating unrelated harness changes from reorder-specific work

This refinement does not include:

- long-press reorder
- a redesign of PromptQueue cards outside sorting behavior
- virtualization
- changing storage format
- broader host-side refactors outside reorder and its direct tests

## Recommended Approach

### Option 1: Polish The Current Structure

Continue improving the existing pointer session and transform logic.

Pros:

- smallest diff
- lower short-term code churn

Cons:

- still constrained by the dragged card remaining in the list flow
- harder to make the motion resemble mobile icon sorting
- more likely to keep accumulating edge-case fixes

This is not recommended.

### Option 2: Overlay Drag Layer With True Gap Slot

Promote the dragged card into a temporary floating layer and leave a measured gap in the list. All reorder calculations operate in "post-removal slot space".

Pros:

- best match for the target interaction
- cleaner mental model
- easier to reason about no-op, upward, downward, and end-of-list placement

Cons:

- moderate rewrite inside the webview asset
- needs stronger tests

This is recommended.

### Option 3: Full Renderer Rewrite

Move the webview to a component framework or a larger sortable abstraction.

Pros:

- highest long-term flexibility

Cons:

- unjustified scope increase
- unrelated to the immediate quality target

This is not recommended.

## Interaction Design

### Drag Start

When sort mode is active and the user presses a card:

- measure all sortable cards once
- capture the source item index and pointer offset within the card
- create a floating drag overlay that visually matches the original card
- leave the original card position behind as a real gap slot with fixed height

The dragged item should feel lifted, not merely highlighted.

### Drag Motion

During drag:

- the floating item follows the pointer directly with one `requestAnimationFrame` loop
- the gap index changes only when the dragged center crosses cached midlines
- non-dragged items animate toward their shifted slot positions

The list should look like one slot is traveling through it, not like individual cards are being patched in place.

### Neighbor Motion

Only the contiguous affected range should move.

Rules:

- moving downward shifts the crossed cards upward by exactly one slot
- moving upward shifts the crossed cards downward by exactly one slot
- unaffected cards do not move
- motion timing stays short and consistent

Recommended motion:

- `140ms` to `180ms`
- `cubic-bezier(0.2, 0.0, 0.2, 1)` or similar non-bouncy easing

### Auto-Scroll

Near the top or bottom edge of the scrollable list:

- scroll speed should scale with edge proximity
- speed should reverse immediately if the pointer crosses to the opposite edge
- drag overlay position and target-slot calculations must remain scroll-aware

### Drop And Cancel

On release:

- if the gap index equals the source item's post-removal index, treat it as no-op
- otherwise post exactly one `reorderPrompts` message with `sourceId + targetIndex`
- animate cleanup should be brief and deterministic

On cancel, blur, or external state replacement:

- clear overlay
- clear gap state
- clear inline transforms/classes
- restore a clean non-dragging DOM

## Architecture

### Webview State

The reorder session in `media/promptqueue-view.js` should own:

- `sourceId`
- `sourceIndex`
- `gapIndex`
- `pointerId`
- `pointerOffsetY`
- cached card measurements
- current list scroll baseline
- auto-scroll timer and direction
- overlay node reference or render state

The reorder session should be the only source of truth during drag.

### Render Strategy

Normal `render()` remains the baseline renderer, but active dragging should not depend on rerendering the full list.

Recommended model:

1. normal render produces the resting DOM
2. drag start measures DOM and creates the overlay session
3. drag updates mutate only classes/transforms/overlay position
4. drop or cancel clears the session
5. provider state refresh redraws the normal list

### Index Semantics

All live calculations should use post-removal slot indexing.

That means:

- if item `1` is dragged but not moved, final `targetIndex` is `1`
- if it is dragged to the visual end of a four-item list, final `targetIndex` is `3`
- the live gap index should always match the eventual persistence contract

No UI-only index translation should be deferred until commit.

## Test Strategy

### Required Test Upgrades

Keep asset tests, but stop treating them as sufficient proof.

Add or extract logic that can be tested directly for:

- source-index to gap-index no-op behavior
- downward and upward slot progression
- end-of-list placement
- auto-scroll direction changes
- cleanup after cancel

### Contract Tests

Preserve and extend tests for:

- `PromptManager.reorder(sourceId, targetIndex)`
- webview provider forwarding exact `targetIndex`
- tree provider translating tree drop position into `targetIndex`
- playground host consuming `targetIndex`

### Manual Verification Goal

In the playground, the drag should resemble mobile icon sorting:

- the dragged card floats above the list
- a visible gap opens and moves
- nearby cards slide as a block
- the final order matches the visible gap

## Implementation Boundaries

### Files That Belong To This Change

- `media/promptqueue-view.js`
- `media/promptqueue-view.css`
- `src/prompt/promptWebviewProtocol.ts`
- `src/prompt/promptWebviewViewProvider.ts`
- `src/prompt/promptManager.ts`
- `src/prompt/promptTreeProvider.ts`
- `playground/promptqueue-playground.js`
- reorder-related tests

### Files To Split Or Leave Out

- `src/test/runTest.ts`
- `src/test/suite/runTestHarness.test.ts`

If they remain needed, they should land as a separate, explicitly named harness change.

## Acceptance Criteria

This work is complete when:

- PromptQueue reorder feels like moving a floating item through a slot-based list
- surrounding items shift like a coordinated lane move, not isolated patch-up transforms
- no-op release leaves order unchanged
- end-of-list reorder remains precise
- long-list dragging stays stable under auto-scroll
- unrelated harness changes are not bundled into the reorder feature work
- tests cover reorder semantics beyond asset string matching
