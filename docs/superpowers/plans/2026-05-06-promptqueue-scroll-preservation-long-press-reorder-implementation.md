# PromptQueue Scroll Preservation And Long-Press Reorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the PromptQueue list from jumping back to the top during normal sidebar interactions, and make long press start drag reordering without requiring the user to release first.

**Architecture:** Keep the fix inside the existing webview asset layer. Preserve `.pq-list.scrollTop` around normal rerenders, then replace the current long-press-to-menu plus native `draggable` flow with a pointer-driven long-press reorder flow that still posts the existing `reorderPrompts` host message.

**Tech Stack:** plain browser JavaScript, CSS, TypeScript, Vitest, VS Code extension webview

---

## Preflight

- [ ] **Step 1: Create a dedicated worktree for this change if you are still on the shared `main` workspace**

Run:

```bash
git worktree add .worktrees/promptqueue-scroll-reorder -b feature/promptqueue-scroll-reorder HEAD
```

Expected:
- a new worktree is created at `.worktrees/promptqueue-scroll-reorder`

- [ ] **Step 2: Switch all remaining commands in this plan to the new worktree root**

Run:

```bash
git -C .worktrees/promptqueue-scroll-reorder rev-parse --show-toplevel
```

Expected:
- the printed path ends with `.worktrees/promptqueue-scroll-reorder`

- [ ] **Step 3: Confirm the pre-existing untracked plan file is not part of this task**

Run:

```bash
git -C .worktrees/promptqueue-scroll-reorder status --short
```

Expected:
- the worktree starts clean for tracked files
- do not create, stage, or commit `docs/superpowers/plans/2026-05-06-promptqueue-pinned-header-settings-footer-implementation.md` as part of this work

## File Structure

- Modify `media/promptqueue-view.js` to:
  - preserve `.pq-list.scrollTop` across non-auto-scroll rerenders
  - remove long-press-to-menu behavior
  - implement pointer-driven long-press reorder
  - keep short-click copy and existing `reorderPrompts` messages
- Modify `media/promptqueue-view.css` to:
  - add a visible armed-reorder state for the source card
  - keep reorder target highlighting clear during pointer-driven reorder
- Modify `src/test/suite/promptWebviewAssets.test.ts` to:
  - lock in scroll-preservation helpers and render behavior
  - lock in pointer-driven long-press reorder behavior
  - lock in the new reorder styling hooks

## Chunk 1: Preserve List Scroll Across Normal Rerenders

### Task 1: Add regression coverage for scroll preservation, then implement it in the webview renderer

**Files:**
- Modify: `src/test/suite/promptWebviewAssets.test.ts`
- Modify: `media/promptqueue-view.js:6-19`
- Modify: `media/promptqueue-view.js:401-446`
- Modify: `media/promptqueue-view.js:908-931`

- [ ] **Step 1: Write the failing asset tests for scroll capture and restoration**

Add these cases to `src/test/suite/promptWebviewAssets.test.ts` near the existing auto-scroll coverage:

```ts
  it('preserves the prompt list scroll position across ordinary rerenders', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('function getListElement()');
    expect(script).toContain('function captureListScrollTop()');
    expect(script).toContain('function restoreListScrollTop(scrollTop)');
    expect(script).toContain('const preservedScrollTop = captureListScrollTop();');
    expect(script).toContain('restoreListScrollTop(preservedScrollTop);');
  });

  it('lets explicit auto-scroll flows opt out of scroll restoration', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('if (ui.pendingAutoScroll)');
    expect(script).toContain("scrollIntoView({ block: 'center' })");
    expect(script).toContain("scrollIntoView({ block: 'end' })");
  });
```

- [ ] **Step 2: Run the focused asset test and verify RED**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptWebviewAssets.test.ts
```

Expected:
- FAIL because `getListElement`, `captureListScrollTop`, and `restoreListScrollTop` do not exist yet
- FAIL because `render()` does not currently preserve `.pq-list.scrollTop`

- [ ] **Step 3: Write the minimal scroll-preservation implementation**

Add list-scroll helpers to `media/promptqueue-view.js` before `queueAutoScroll()`:

```js
  function getListElement() {
    const list = root.querySelector('.pq-list');
    return list instanceof HTMLElement ? list : null;
  }

  function captureListScrollTop() {
    const list = getListElement();
    return list ? list.scrollTop : 0;
  }

  function restoreListScrollTop(scrollTop) {
    if (ui.pendingAutoScroll) {
      return;
    }

    const list = getListElement();

    if (list) {
      list.scrollTop = scrollTop;
    }
  }
```

Update `render()` so the old list position is sampled before `root.innerHTML` is replaced and restored immediately afterward:

```js
  function render() {
    const preservedScrollTop = captureListScrollTop();

    if (ui.skipDraftSyncOnce) {
      ui.skipDraftSyncOnce = false;
    } else {
      syncPanelDraftFromDom();
      capturePanelFocusBeforeRender();
    }

    root.innerHTML =
      '<div class="pq-shell">' +
      renderHeader() +
      '<section class="pq-list">' +
      renderCards() +
      '</section>' +
      renderFooter() +
      '</div>' +
      renderDrawer() +
      renderMenu() +
      renderToasts();

    restorePanelFocus();
    restoreListScrollTop(preservedScrollTop);
    adjustMenuPosition();
    flushAutoScroll();
  }
```

Do not change `flushAutoScroll()` behavior in this task beyond letting `ui.pendingAutoScroll` remain the single opt-out flag for restoration.

- [ ] **Step 4: Re-run the focused asset test and verify GREEN**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptWebviewAssets.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit the scroll-preservation slice**

Run:

```bash
git add src/test/suite/promptWebviewAssets.test.ts media/promptqueue-view.js
git commit -m "fix: preserve promptqueue list scroll on rerender"
```

Expected:
- commit succeeds with only the asset test and webview script staged

## Chunk 2: Replace Long Press Menu Opening With Long-Press Reorder

### Task 2: Lock the intended gesture in tests, then replace native card dragging with pointer-driven reorder

**Files:**
- Modify: `src/test/suite/promptWebviewAssets.test.ts`
- Modify: `media/promptqueue-view.js:6-19`
- Modify: `media/promptqueue-view.js:281-311`
- Modify: `media/promptqueue-view.js:584-607`
- Modify: `media/promptqueue-view.js:1022-1122`
- Modify: `media/promptqueue-view.js:1283-1407`

- [ ] **Step 1: Write the failing asset tests for long-press reorder and menu entry separation**

Add these cases to `src/test/suite/promptWebviewAssets.test.ts` after the prompt-item structure assertions:

```ts
  it('uses long press to arm reorder instead of opening the item menu', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('const LONG_PRESS_DURATION_MS = 520;');
    expect(script).toContain('const LONG_PRESS_MOVE_TOLERANCE_PX = 6;');
    expect(script).toContain('function armPointerReorder(cardId)');
    expect(script).toContain("root.addEventListener('pointermove'");
    expect(script).toContain("root.addEventListener('pointercancel'");
    expect(script).toContain('suppressNextClick');
    expect(script).not.toContain('longPressTriggered');
  });

  it('keeps item menus reachable from the trailing button and context menu', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('data-action="open-item-menu"');
    expect(script).toContain("root.addEventListener('contextmenu'");
    expect(script).toContain('openAnchoredMenu(actionTarget, {');
  });

  it('posts reorder messages from the pointer-driven long-press flow', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('function commitPointerReorder()');
    expect(script).toContain("type: 'reorderPrompts'");
    expect(script).toContain('updatePointerReorderTarget(event.clientX, event.clientY);');
  });
```

- [ ] **Step 2: Run the focused asset test and verify RED**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptWebviewAssets.test.ts
```

Expected:
- FAIL because the script still contains `longPressTriggered`
- FAIL because there is no pointer-driven reorder helper set
- FAIL because cards are still rendered with `draggable="true"`

- [ ] **Step 3: Write the minimal pointer-driven reorder implementation**

Add long-press constants and replace the old boolean with pointer-specific state in `media/promptqueue-view.js`:

```js
  const COPY_AGE_REFRESH_INTERVAL_MS = 60 * 1000;
  const LONG_PRESS_DURATION_MS = 520;
  const LONG_PRESS_MOVE_TOLERANCE_PX = 6;

  const ui = {
    dragSourceId: null,
    longPressOrigin: null,
    longPressPointerId: null,
    longPressTargetId: null,
    longPressTimer: null,
    menu: null,
    pendingAutoScroll: false,
    pendingFocus: null,
    panel: null,
    panelDraft: null,
    receivedState: false,
    reorderHoverId: null,
    skipDraftSyncOnce: false,
    state: createEmptyState(),
    suppressNextClick: false,
    toasts: [],
  };
```

Replace `clearDragState()` and add pointer-reorder helpers:

```js
  function clearReorderMarkers() {
    root
      .querySelectorAll('.pq-card-drag-over, .pq-card-reorder-armed')
      .forEach(function (card) {
        card.classList.remove('pq-card-drag-over');
        card.classList.remove('pq-card-reorder-armed');
      });
  }

  function clearDragState() {
    ui.dragSourceId = null;
    ui.reorderHoverId = null;
    clearReorderMarkers();
  }

  function clearLongPressTimer() {
    clearTimeout(ui.longPressTimer);
    ui.longPressTimer = null;
  }

  function clearPointerPressState() {
    clearLongPressTimer();
    ui.longPressOrigin = null;
    ui.longPressPointerId = null;
    ui.longPressTargetId = null;
  }

  function clearPointerReorderState() {
    clearPointerPressState();
    clearDragState();
  }

  function armPointerReorder(cardId) {
    if (!cardId) {
      return;
    }

    ui.dragSourceId = cardId;
    ui.suppressNextClick = true;

    const card = root.querySelector('[data-card-id="' + cardId + '"]');

    if (card instanceof HTMLElement) {
      card.classList.add('pq-card-reorder-armed');
    }
  }

  function hasMovedBeyondLongPressTolerance(event) {
    if (!ui.longPressOrigin) {
      return false;
    }

    return (
      Math.abs(event.clientX - ui.longPressOrigin.x) > LONG_PRESS_MOVE_TOLERANCE_PX ||
      Math.abs(event.clientY - ui.longPressOrigin.y) > LONG_PRESS_MOVE_TOLERANCE_PX
    );
  }

  function updatePointerReorderTarget(clientX, clientY) {
    clearReorderMarkers();
    ui.reorderHoverId = null;

    if (!ui.dragSourceId) {
      return;
    }

    const hovered = document.elementFromPoint(clientX, clientY);
    const card =
      hovered instanceof HTMLElement ? hovered.closest('[data-card-id]') : null;

    if (!(card instanceof HTMLElement)) {
      return;
    }

    const targetId = card.getAttribute('data-card-id');

    if (!targetId || targetId === ui.dragSourceId) {
      const sourceCard = root.querySelector(
        '[data-card-id="' + ui.dragSourceId + '"]',
      );

      if (sourceCard instanceof HTMLElement) {
        sourceCard.classList.add('pq-card-reorder-armed');
      }

      return;
    }

    ui.reorderHoverId = targetId;
    card.classList.add('pq-card-drag-over');

    const sourceCard = root.querySelector(
      '[data-card-id="' + ui.dragSourceId + '"]',
    );

    if (sourceCard instanceof HTMLElement) {
      sourceCard.classList.add('pq-card-reorder-armed');
    }
  }

  function commitPointerReorder() {
    const sourceId = ui.dragSourceId;
    const targetId = ui.reorderHoverId;

    clearPointerReorderState();

    if (!sourceId || !targetId || sourceId === targetId) {
      return;
    }

    postMessage({
      type: 'reorderPrompts',
      sourceId: sourceId,
      targetId: targetId,
    });
  }
```

Remove `draggable="true"` from `renderCards()` so cards are ordinary click targets until a long press arms reorder:

```js
          '<article class="pq-card ' +
          (item.used ? 'pq-card-used ' : '') +
          '" data-card-id="' +
          escapeHtml(item.id) +
          '">'
```

Update the click handler so the post-long-press click is consumed instead of copying:

```js
    if (ui.suppressNextClick) {
      ui.suppressNextClick = false;
      return;
    }

    postMessage({
      type:
        ui.state.copySettings.includeTemplateOnClick !== false
          ? 'copyPrompt'
          : 'copyPromptRaw',
      promptId: card.getAttribute('data-card-id'),
    });
```

Replace the old long-press menu and native drag listeners with pointer-driven reorder listeners:

```js
  root.addEventListener('pointerdown', function (event) {
    const target = event.target;

    if (!(target instanceof HTMLElement) || event.button !== 0) {
      return;
    }

    if (target.closest('[data-action]') || target.closest('.pq-drawer')) {
      return;
    }

    const card = target.closest('[data-card-id]');

    if (!(card instanceof HTMLElement)) {
      return;
    }

    clearPointerReorderState();
    ui.longPressOrigin = { x: event.clientX, y: event.clientY };
    ui.longPressPointerId = event.pointerId;
    ui.longPressTargetId = card.getAttribute('data-card-id');
    ui.longPressTimer = window.setTimeout(function () {
      armPointerReorder(ui.longPressTargetId);
    }, LONG_PRESS_DURATION_MS);
  });

  root.addEventListener('pointermove', function (event) {
    if (ui.dragSourceId && ui.longPressPointerId === event.pointerId) {
      event.preventDefault();
      updatePointerReorderTarget(event.clientX, event.clientY);
      return;
    }

    if (ui.longPressPointerId !== event.pointerId) {
      return;
    }

    if (hasMovedBeyondLongPressTolerance(event)) {
      clearPointerPressState();
    }
  });

  root.addEventListener('pointerup', function (event) {
    if (ui.dragSourceId && ui.longPressPointerId === event.pointerId) {
      event.preventDefault();
      commitPointerReorder();
      return;
    }

    if (ui.longPressPointerId === event.pointerId) {
      clearPointerPressState();
    }
  });

  root.addEventListener('pointerleave', function (event) {
    if (!ui.dragSourceId && ui.longPressPointerId === event.pointerId) {
      clearPointerPressState();
    }
  });

  root.addEventListener('pointercancel', function () {
    clearPointerReorderState();
  });
```

Keep `root.addEventListener('contextmenu'...)` and the `open-item-menu` button path unchanged so menus remain available from the intended entry points.

- [ ] **Step 4: Re-run the focused asset test and verify GREEN**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptWebviewAssets.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit the long-press reorder slice**

Run:

```bash
git add src/test/suite/promptWebviewAssets.test.ts media/promptqueue-view.js
git commit -m "feat: add promptqueue long-press reorder"
```

Expected:
- commit succeeds with only the asset test and webview script staged

## Chunk 3: Style The Armed Reorder State And Run Full Verification

### Task 3: Add the armed-reorder styling hook, then run the regression suite and manual smoke check

**Files:**
- Modify: `src/test/suite/promptWebviewAssets.test.ts`
- Modify: `media/promptqueue-view.css:277-347`
- Modify: `media/promptqueue-view.css:300-301`

- [ ] **Step 1: Write the failing asset test for the armed reorder state**

Add this case to `src/test/suite/promptWebviewAssets.test.ts` near the drag-state assertions:

```ts
  it('styles the long-press reorder source separately from the drop target', async () => {
    const css = await readAsset('media/promptqueue-view.css');

    expect(css).toContain('.pq-card-reorder-armed');
    expect(css).toContain('cursor: grabbing');
    expect(css).toContain('.pq-card-reorder-armed .pq-card-menu-trigger');
    expect(css).toContain('.pq-card-drag-over');
  });
```

- [ ] **Step 2: Run the focused asset test and verify RED**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptWebviewAssets.test.ts
```

Expected:
- FAIL because `.pq-card-reorder-armed` does not exist in the stylesheet yet

- [ ] **Step 3: Write the minimal reorder styling**

Add this CSS to `media/promptqueue-view.css` immediately after `.pq-card-drag-over`:

```css
.pq-card-reorder-armed {
  border-color: var(--pq-accent);
  background: var(--pq-surface-elevated);
  box-shadow: 0 0 0 1px var(--pq-accent-soft);
  cursor: grabbing;
}

.pq-card-reorder-armed .pq-card-menu-trigger {
  opacity: 0;
  pointer-events: none;
}
```

Do not remove the existing `.pq-card-drag-over` rule. The source card and target card need distinct visual states.

- [ ] **Step 4: Run the full regression pass**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptWebviewAssets.test.ts
npm run test:unit
npm run compile
```

Expected:
- all commands PASS

If no other VS Code window is running, also run:

```bash
npm test
```

Expected:
- PASS

If `npm test` is blocked because VS Code integration tests cannot launch while another instance is running, record that block in the handoff and treat `npm run test:unit` plus `npm run compile` as the verified baseline.

- [ ] **Step 5: Do one manual sidebar smoke test**

Run:

```bash
code --extensionDevelopmentPath="." "."
```

Expected manual checks:
- clicking `...` does not move the list
- single-click copy does not move the list
- toast show and dismiss do not move the list
- right click still opens the item menu
- long press does not open the item menu
- long press, keep holding, and drag over another item reorders successfully on release
- releasing after long press without a target does not reorder

- [ ] **Step 6: Commit the styling slice**

Run:

```bash
git add src/test/suite/promptWebviewAssets.test.ts media/promptqueue-view.css
git commit -m "style: polish promptqueue reorder state"
```

Expected:
- commit succeeds with only the CSS and asset-test changes staged

## Final Handoff

- [ ] **Step 1: Inspect final worktree state**

Run:

```bash
git status --short
git log --oneline -3
```

Expected:
- the worktree is clean after the three task commits
- the last three commits are:
  - `style: polish promptqueue reorder state`
  - `feat: add promptqueue long-press reorder`
  - `fix: preserve promptqueue list scroll on rerender`

- [ ] **Step 2: Prepare the user-facing verification summary**

Report:

```text
Verified:
- npx vitest run --config vitest.config.ts src/test/suite/promptWebviewAssets.test.ts
- npm run test:unit
- npm run compile

Manual checks:
- list no longer jumps to the top on menu open, copy, or toast lifecycle
- long press now arms reorder instead of opening the item menu
- trailing ... and right click still open the item menu

If integration was skipped:
- npm test integration skipped because another VS Code instance was running
```
