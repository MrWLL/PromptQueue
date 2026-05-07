# PromptQueue Mobile-Style Reorder Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild PromptQueue sorting so it feels like mobile icon reordering, with a floating dragged card, a real in-list gap, exact `targetIndex` persistence, and cleaner scope boundaries.

**Architecture:** Keep the host-side reorder contract (`sourceId + targetIndex`) and explicit sort mode, but replace the current in-flow drag illusion with an overlay-based drag session inside the webview. Extract pure reorder math into a small browser-side helper that both the webview and unit tests can use, then let the main webview script own DOM measurement, overlay lifecycle, gap transforms, and auto-scroll.

**Tech Stack:** plain browser JavaScript, CSS, TypeScript, Vitest, Node `vm`, VS Code webview host, local playground

---

## File Structure

- Create: `media/promptqueue-reorder-math.js`
  - pure slot/gap math for midpoint crossing, displaced indexes, and edge auto-scroll speed
- Modify: `media/promptqueue-view.js`
  - pointer session, drag overlay lifecycle, cached measurements, live gap transforms, cleanup
- Modify: `media/promptqueue-view.css`
  - drag overlay, gap slot, neighbor motion, and list-sorting states
- Modify: `src/prompt/promptWebviewHtml.ts`
  - load the pure reorder helper before the main webview script
- Modify: `playground/promptqueue-playground.html`
  - load the pure reorder helper before the main webview script
- Modify: `playground/promptqueue-playground.js`
  - keep consuming exact `targetIndex` and support manual verification
- Modify: `src/prompt/promptWebviewProtocol.ts`
  - keep only the exact `targetIndex` reorder payload
- Modify: `src/prompt/promptWebviewViewProvider.ts`
  - remove legacy `targetId` fallback and forward exact `targetIndex`
- Modify: `src/prompt/promptManager.ts`
  - preserve exact post-removal index persistence behavior
- Modify: `src/prompt/promptTreeProvider.ts`
  - preserve tree drag/drop translation into `targetIndex`
- Create: `src/test/suite/promptReorderMath.test.ts`
  - direct behavioral tests for the pure reorder math helper
- Modify: `src/test/suite/promptWebviewAssets.test.ts`
  - asset coverage for overlay session, gap slot, and cleanup semantics
- Modify: `src/test/suite/promptWebviewViewProvider.test.ts`
  - remove legacy reorder compatibility coverage and assert exact `targetIndex` forwarding
- Modify: `src/test/suite/promptManager.test.ts`
  - keep exact-index reorder regression coverage
- Modify: `src/test/suite/promptTreeProvider.test.ts`
  - keep tree-drop exact-index regression coverage
- Modify: `src/test/suite/promptPlaygroundAssets.test.ts`
  - assert helper script loading and `targetIndex` host handling

Files intentionally left out of this implementation:

- `src/test/runTest.ts`
- `src/test/suite/runTestHarness.test.ts`

Do not modify those files in this plan. If commit hygiene cleanup is needed later, do it as a separate harness-only change.

## Task 1: Extract Pure Reorder Math And Lock It With Direct Tests

**Files:**
- Create: `src/test/suite/promptReorderMath.test.ts`
- Create: `media/promptqueue-reorder-math.js`
- Modify: `src/prompt/promptWebviewHtml.ts:25-49`
- Modify: `playground/promptqueue-playground.html:191-192`
- Modify: `src/test/suite/promptPlaygroundAssets.test.ts`

- [ ] **Step 1: Write the failing direct behavior tests for slot math**

Add `src/test/suite/promptReorderMath.test.ts`:

```ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vm from 'node:vm';

import { describe, expect, it } from 'vitest';

type ReorderMath = {
  buildSlotMidpoints(
    rects: Array<{ top: number; height: number }>,
    sourceIndex: number,
  ): number[];
  resolveGapIndex(midpoints: number[], pointerCenterY: number): number;
  getDisplacedIndexes(
    sourceIndex: number,
    gapIndex: number,
    itemCount: number,
  ): number[];
  getAutoScrollDelta(
    pointerY: number,
    listRect: { top: number; bottom: number },
    threshold: number,
    maxStep: number,
  ): number;
};

async function loadReorderMath(): Promise<ReorderMath> {
  const script = await fs.readFile(
    path.resolve(__dirname, '../../../media/promptqueue-reorder-math.js'),
    'utf8',
  );
  const context = { globalThis: {} as { PromptQueueReorderMath?: ReorderMath } };
  context.globalThis.globalThis = context.globalThis;
  vm.runInNewContext(script, context);
  return context.globalThis.PromptQueueReorderMath as ReorderMath;
}

describe('PromptQueue reorder math', () => {
  it('keeps an unchanged drag on the same post-removal slot index', async () => {
    const reorderMath = await loadReorderMath();
    const midpoints = reorderMath.buildSlotMidpoints(
      [
        { top: 0, height: 72 },
        { top: 80, height: 72 },
        { top: 160, height: 72 },
        { top: 240, height: 72 },
      ],
      1,
    );

    expect(reorderMath.resolveGapIndex(midpoints, 116)).toBe(1);
  });

  it('advances downward after crossing later slot midpoints', async () => {
    const reorderMath = await loadReorderMath();
    const midpoints = reorderMath.buildSlotMidpoints(
      [
        { top: 0, height: 72 },
        { top: 80, height: 72 },
        { top: 160, height: 72 },
        { top: 240, height: 72 },
      ],
      0,
    );

    expect(reorderMath.resolveGapIndex(midpoints, 220)).toBe(2);
  });

  it('resolves dragging to the visual end of the list as the final post-removal slot', async () => {
    const reorderMath = await loadReorderMath();
    const midpoints = reorderMath.buildSlotMidpoints(
      [
        { top: 0, height: 72 },
        { top: 80, height: 72 },
        { top: 160, height: 72 },
        { top: 240, height: 72 },
      ],
      1,
    );

    expect(reorderMath.resolveGapIndex(midpoints, 400)).toBe(3);
  });

  it('returns only the contiguous displaced indexes for downward and upward movement', async () => {
    const reorderMath = await loadReorderMath();

    expect(reorderMath.getDisplacedIndexes(1, 3, 4)).toEqual([2, 3]);
    expect(reorderMath.getDisplacedIndexes(3, 1, 4)).toEqual([1, 2]);
  });

  it('scales auto-scroll delta by edge proximity and direction', async () => {
    const reorderMath = await loadReorderMath();

    expect(
      reorderMath.getAutoScrollDelta(12, { top: 0, bottom: 400 }, 48, 18),
    ).toBeLessThan(0);
    expect(
      reorderMath.getAutoScrollDelta(388, { top: 0, bottom: 400 }, 48, 18),
    ).toBeGreaterThan(0);
    expect(
      reorderMath.getAutoScrollDelta(200, { top: 0, bottom: 400 }, 48, 18),
    ).toBe(0);
  });
});
```

- [ ] **Step 2: Run the new test file to verify RED**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptReorderMath.test.ts
```

Expected:

- FAIL because `media/promptqueue-reorder-math.js` does not exist yet

- [ ] **Step 3: Add the pure reorder math helper and load it before the main webview script**

Create `media/promptqueue-reorder-math.js`:

```js
(function (global) {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function buildSlotMidpoints(rects, sourceIndex) {
    return rects
      .filter(function (_rect, index) {
        return index !== sourceIndex;
      })
      .map(function (rect) {
        return rect.top + rect.height / 2;
      });
  }

  function resolveGapIndex(midpoints, pointerCenterY) {
    for (let index = 0; index < midpoints.length; index += 1) {
      if (pointerCenterY < midpoints[index]) {
        return index;
      }
    }

    return midpoints.length;
  }

  function getDisplacedIndexes(sourceIndex, gapIndex, itemCount) {
    const displaced = [];

    if (gapIndex > sourceIndex) {
      for (let index = sourceIndex + 1; index <= Math.min(gapIndex, itemCount - 1); index += 1) {
        displaced.push(index);
      }
      return displaced;
    }

    if (gapIndex < sourceIndex) {
      for (let index = gapIndex; index < sourceIndex; index += 1) {
        displaced.push(index);
      }
    }

    return displaced;
  }

  function getAutoScrollDelta(pointerY, listRect, threshold, maxStep) {
    const topDistance = pointerY - listRect.top;
    const bottomDistance = listRect.bottom - pointerY;

    if (topDistance < threshold) {
      const intensity = clamp((threshold - Math.max(topDistance, 0)) / threshold, 0, 1);
      return -Math.ceil(intensity * maxStep);
    }

    if (bottomDistance < threshold) {
      const intensity = clamp((threshold - Math.max(bottomDistance, 0)) / threshold, 0, 1);
      return Math.ceil(intensity * maxStep);
    }

    return 0;
  }

  global.PromptQueueReorderMath = {
    buildSlotMidpoints: buildSlotMidpoints,
    resolveGapIndex: resolveGapIndex,
    getDisplacedIndexes: getDisplacedIndexes,
    getAutoScrollDelta: getAutoScrollDelta,
  };
})(typeof window !== 'undefined' ? window : globalThis);
```

Update `src/prompt/promptWebviewHtml.ts`:

```ts
  const reorderMathUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'promptqueue-reorder-math.js'),
  );
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'promptqueue-view.js'),
  );
```

```html
    <script nonce="${nonce}" src="${reorderMathUri}"></script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
```

Update `playground/promptqueue-playground.html`:

```html
    <script src="./promptqueue-playground.js"></script>
    <script src="../media/promptqueue-reorder-math.js"></script>
    <script src="../media/promptqueue-view.js"></script>
```

Update `src/test/suite/promptPlaygroundAssets.test.ts`:

```ts
  it('loads the reorder math helper before the current webview script', async () => {
    const html = await readRepoFile('playground/promptqueue-playground.html');

    expect(html).toContain('../media/promptqueue-reorder-math.js');
    expect(html).toContain('../media/promptqueue-view.js');
  });
```

- [ ] **Step 4: Run the math and playground-focused tests to verify GREEN**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptReorderMath.test.ts src/test/suite/promptPlaygroundAssets.test.ts
```

Expected:

- PASS

- [ ] **Step 5: Commit the pure math slice**

Run:

```bash
git add media/promptqueue-reorder-math.js src/prompt/promptWebviewHtml.ts playground/promptqueue-playground.html src/test/suite/promptReorderMath.test.ts src/test/suite/promptPlaygroundAssets.test.ts
git commit -m "refactor: extract promptqueue reorder math"
```

## Task 2: Rebuild The Webview Drag Session Around A Floating Overlay And Real Gap Slot

**Files:**
- Modify: `src/test/suite/promptWebviewAssets.test.ts`
- Modify: `media/promptqueue-view.js`

- [ ] **Step 1: Write failing asset tests for the overlay-based drag session**

Update `src/test/suite/promptWebviewAssets.test.ts` with these cases:

```ts
  it('creates a drag overlay and gap slot instead of rendering a placeholder card into the list html', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('dragOverlayEl');
    expect(script).toContain('gapIndex');
    expect(script).toContain('function createDragOverlay(card)');
    expect(script).toContain('card.cloneNode(true)');
    expect(script).not.toContain("cards.push('<article class=\"pq-card pq-card-drag-over pq-card-sortable-placeholder\"></article>')");
  });

  it('uses the shared reorder math helper for gap-index resolution', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('PromptQueueReorderMath.buildSlotMidpoints');
    expect(script).toContain('PromptQueueReorderMath.resolveGapIndex');
    expect(script).toContain('PromptQueueReorderMath.getDisplacedIndexes');
  });

  it('moves the drag overlay from pointer position and keeps the source card as the in-flow gap', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('function positionDragOverlay(session)');
    expect(script).toContain("sourceCard.classList.add('pq-card-gap')");
    expect(script).toContain('session.dragOverlayEl.style.transform =');
  });
```

- [ ] **Step 2: Run the asset test to verify RED**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptWebviewAssets.test.ts
```

Expected:

- FAIL because the webview still uses the older in-list placeholder/displacement model

- [ ] **Step 3: Implement the overlay session with cached measurements and gap-slot transforms**

In `media/promptqueue-view.js`, add the helper binding near the top:

```js
  const PromptQueueReorderMath = window.PromptQueueReorderMath;
```

Replace the current reorder session shape with:

```js
    reorderSession: null,
```

and create a session with these fields:

```js
    ui.reorderSession = {
      autoScrollDelta: 0,
      autoScrollTimer: null,
      dragOverlayEl: createDragOverlay(card),
      gapIndex: sourceIndex,
      measuredCards: measureSortableCards(),
      pendingAnimationFrame: 0,
      pendingPointerY: pointerY,
      pointerId: pointerId,
      pointerOffsetY: pointerY - card.getBoundingClientRect().top,
      sourceId: sourceId,
      sourceIndex: sourceIndex,
      sourceRect: card.getBoundingClientRect(),
      startScrollTop: list ? list.scrollTop : 0,
    };
```

Add these helpers:

```js
  function createDragOverlay(card) {
    const overlay = card.cloneNode(true);

    if (!(overlay instanceof HTMLElement)) {
      return null;
    }

    overlay.classList.add('pq-card-drag-overlay');
    overlay.removeAttribute('data-card-id');
    root.appendChild(overlay);
    return overlay;
  }

  function measureSortableCards() {
    return getReorderCards().map(function (card, index) {
      const rect = card.getBoundingClientRect();
      return {
        card: card,
        height: rect.height,
        index: index,
        top: rect.top,
      };
    });
  }

  function positionDragOverlay(session) {
    if (!(session.dragOverlayEl instanceof HTMLElement)) {
      return;
    }

    const list = getListElement();
    const scrollTop = list ? list.scrollTop : session.startScrollTop;
    const top =
      session.pendingPointerY -
      session.pointerOffsetY +
      (scrollTop - session.startScrollTop);

    session.dragOverlayEl.style.transform = 'translateY(' + String(Math.round(top - session.sourceRect.top)) + 'px)';
  }

  function updateGapIndex(pointerY) {
    const session = ui.reorderSession;

    if (!session) {
      return;
    }

    const pointerCenterY = pointerY - session.pointerOffsetY + session.sourceRect.height / 2;
    const midpoints = PromptQueueReorderMath.buildSlotMidpoints(
      session.measuredCards.map(function (measured) {
        return { top: measured.top, height: measured.height };
      }),
      session.sourceIndex,
    );

    session.gapIndex = PromptQueueReorderMath.resolveGapIndex(midpoints, pointerCenterY);
  }
```

Apply the real gap and displacement classes from cached card indexes:

```js
  function applyGapTransforms(session) {
    const displacedIndexes = PromptQueueReorderMath.getDisplacedIndexes(
      session.sourceIndex,
      session.gapIndex,
      session.measuredCards.length,
    );

    session.measuredCards.forEach(function (measured) {
      measured.card.classList.remove('pq-card-gap', 'pq-card-sortable-displaced');
      measured.card.style.transform = '';

      if (measured.index === session.sourceIndex) {
        measured.card.classList.add('pq-card-gap');
        return;
      }

      if (!displacedIndexes.includes(measured.index)) {
        return;
      }

      measured.card.classList.add('pq-card-sortable-displaced');
      measured.card.style.transform =
        session.gapIndex > session.sourceIndex
          ? 'translateY(calc(-100% - 8px))'
          : 'translateY(calc(100% + 8px))';
    });
  }
```

Commit should use the real gap index:

```js
    if (session.gapIndex === session.sourceIndex) {
      clearDragState();
      return;
    }

    postMessage({
      type: 'reorderPrompts',
      sourceId: session.sourceId,
      targetIndex: session.gapIndex,
    });
```

- [ ] **Step 4: Run the asset test again to verify GREEN**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptWebviewAssets.test.ts
```

Expected:

- PASS

- [ ] **Step 5: Commit the overlay-session slice**

Run:

```bash
git add media/promptqueue-view.js src/test/suite/promptWebviewAssets.test.ts
git commit -m "feat: add floating promptqueue drag session"
```

## Task 3: Tighten CSS Motion And Remove The Unneeded Legacy Reorder Fallback

**Files:**
- Modify: `media/promptqueue-view.css`
- Modify: `src/prompt/promptWebviewProtocol.ts`
- Modify: `src/prompt/promptWebviewViewProvider.ts`
- Modify: `src/test/suite/promptWebviewAssets.test.ts`
- Modify: `src/test/suite/promptWebviewViewProvider.test.ts`

- [ ] **Step 1: Write the failing tests for the simplified host contract and overlay styles**

Update `src/test/suite/promptWebviewViewProvider.test.ts` by replacing the legacy compatibility cases with:

```ts
  it('forwards exact target indexes without translating legacy target ids', async () => {
    const manager = createManagerStub();
    const view = createWebviewViewStub();
    const provider = new PromptWebviewViewProvider({
      hasActiveTerminal: () => true,
      manager,
      getStorageLabel: () => 'WorkSpace/PromptQueue',
      getUiLanguage: () => 'zh-CN',
      writeClipboard: vi.fn(async () => undefined),
    });

    await provider.resolveWebviewView(view as never);
    await view.fireMessage({
      type: 'reorderPrompts',
      sourceId: 'prompt-1',
      targetIndex: 2,
    } as never);

    expect(manager.reorder).toHaveBeenCalledWith('prompt-1', 2);
  });
```

Update `src/test/suite/promptWebviewAssets.test.ts` with:

```ts
  it('styles a floating drag overlay and an in-flow gap slot separately', async () => {
    const css = await readAsset('media/promptqueue-view.css');

    expect(css).toContain('.pq-card-drag-overlay');
    expect(css).toContain('.pq-card-gap');
    expect(css).toContain('pointer-events: none;');
    expect(css).toContain('cubic-bezier(0.2, 0.0, 0.2, 1)');
  });
```

- [ ] **Step 2: Run the provider and asset tests to verify RED**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptWebviewViewProvider.test.ts src/test/suite/promptWebviewAssets.test.ts
```

Expected:

- FAIL because the provider still contains `LegacyReorderPromptsMessage`
- FAIL because the CSS does not yet define overlay/gap styling

- [ ] **Step 3: Remove legacy target-id support and add mobile-style overlay/gap styling**

In `src/prompt/promptWebviewProtocol.ts`, keep only:

```ts
  | { type: 'reorderPrompts'; sourceId: string; targetIndex: number }
```

In `src/prompt/promptWebviewViewProvider.ts`, remove `LegacyReorderPromptsMessage` entirely and simplify the branch to:

```ts
        case 'reorderPrompts':
          await this.manager.reorder(
            message.sourceId,
            message.targetIndex,
          );
          break;
```

In `media/promptqueue-view.css`, add:

```css
.pq-list-sorting {
  position: relative;
}

.pq-card-drag-overlay {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 5;
  pointer-events: none;
  box-shadow: 0 0 0 1px var(--pq-accent-soft), var(--pq-shadow-soft);
  transform-origin: center center;
  scale: 1.01;
}

.pq-card-gap {
  border-style: dashed;
  background: color-mix(in srgb, var(--pq-accent-soft) 68%, transparent);
}

.pq-card-gap .pq-card-main,
.pq-card-gap .pq-card-side,
.pq-card-gap .pq-card-menu-trigger {
  opacity: 0;
}

.pq-card-sortable-displaced {
  transition: transform 160ms cubic-bezier(0.2, 0, 0.2, 1);
  will-change: transform;
}
```

- [ ] **Step 4: Re-run the provider and asset tests to verify GREEN**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptWebviewViewProvider.test.ts src/test/suite/promptWebviewAssets.test.ts
```

Expected:

- PASS

- [ ] **Step 5: Commit the contract-and-style slice**

Run:

```bash
git add media/promptqueue-view.css src/prompt/promptWebviewProtocol.ts src/prompt/promptWebviewViewProvider.ts src/test/suite/promptWebviewViewProvider.test.ts src/test/suite/promptWebviewAssets.test.ts
git commit -m "refactor: tighten promptqueue reorder contract"
```

## Task 4: Finish Auto-Scroll, Preserve Host-Side Contract Coverage, And Verify End To End

**Files:**
- Modify: `media/promptqueue-view.js`
- Modify: `playground/promptqueue-playground.js`
- Modify: `src/test/suite/promptManager.test.ts`
- Modify: `src/test/suite/promptWebviewAssets.test.ts`
- Modify: `src/test/suite/promptTreeProvider.test.ts`
- Modify: `src/test/suite/promptPlaygroundAssets.test.ts`

- [ ] **Step 1: Write the failing focused regressions for auto-scroll and exact host behavior**

Add this asset check to `src/test/suite/promptWebviewAssets.test.ts`:

```ts
  it('uses the reorder math helper to scale edge auto-scroll speed', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('PromptQueueReorderMath.getAutoScrollDelta');
    expect(script).not.toContain('delta = -8;');
    expect(script).not.toContain('delta = 8;');
  });
```

Add this manager regression to `src/test/suite/promptManager.test.ts`:

```ts
  it('clamps an oversized target index to the visual end of the list after removing the source item', async () => {
    const store = createStoreStub([
      createPromptItem({ id: 'prompt-1' }),
      createPromptItem({ id: 'prompt-2' }),
      createPromptItem({ id: 'prompt-3' }),
    ]);
    const manager = new PromptManager({
      store,
      settingsStore: createSettingsStoreStub(),
      backupStore: createBackupStoreStub(undefined),
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: () => 'generated-id',
      now: () => '2026-05-07T10:00:00.000Z',
    });

    await manager.initialize();
    await manager.reorder('prompt-1', 99);

    expect(manager.getItems().map((item) => item.id)).toEqual([
      'prompt-2',
      'prompt-3',
      'prompt-1',
    ]);
  });
```

- [ ] **Step 2: Run the focused regression tests to verify RED**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptWebviewAssets.test.ts src/test/suite/promptManager.test.ts src/test/suite/promptTreeProvider.test.ts src/test/suite/promptPlaygroundAssets.test.ts
```

Expected:

- FAIL because auto-scroll still uses hard-coded `±8` steps

- [ ] **Step 3: Switch auto-scroll to helper-driven deltas and keep host-side target-index coverage green**

Update `media/promptqueue-view.js`:

```js
  const EDGE_AUTO_SCROLL_THRESHOLD_PX = 48;
  const EDGE_AUTO_SCROLL_MAX_STEP_PX = 18;
```

```js
  function updateReorderAutoScroll(pointerY) {
    const session = ui.reorderSession;
    const list = getListElement();

    if (!session || !(list instanceof HTMLElement)) {
      return;
    }

    const rect = list.getBoundingClientRect();
    const delta = PromptQueueReorderMath.getAutoScrollDelta(
      pointerY,
      { top: rect.top, bottom: rect.bottom },
      EDGE_AUTO_SCROLL_THRESHOLD_PX,
      EDGE_AUTO_SCROLL_MAX_STEP_PX,
    );
```

Keep `playground/promptqueue-playground.js` in exact-index mode:

```js
      if (message.type === 'reorderPrompts') {
        const sourceIndex = state.items.findIndex(function (item) {
          return item.id === message.sourceId;
        });
        const targetIndex = Number(message.targetIndex);

        if (
          sourceIndex < 0 ||
          Number.isNaN(targetIndex) ||
          targetIndex < 0 ||
          targetIndex > state.items.length - 1
        ) {
          emitState();
          return;
        }

        const moved = state.items.splice(sourceIndex, 1)[0];
        state.items.splice(targetIndex, 0, moved);
        emitState();
        return;
      }
```

- [ ] **Step 4: Run focused tests, full unit tests, compile, and integration tests**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptReorderMath.test.ts src/test/suite/promptWebviewAssets.test.ts src/test/suite/promptWebviewViewProvider.test.ts src/test/suite/promptManager.test.ts src/test/suite/promptTreeProvider.test.ts src/test/suite/promptPlaygroundAssets.test.ts
npm run test:unit
npm run compile
npm run test:integration
```

Expected:

- all focused tests PASS
- unit suite PASS
- TypeScript compile PASS
- integration suite PASS

- [ ] **Step 5: Manual playground verification**

Run:

```bash
npm run playground
```

Verify in the browser playground:

- enter sort mode
- drag a middle card downward and confirm the dragged card floats above the list
- confirm the source slot becomes a real visible gap
- confirm crossed cards slide together by one slot
- drag near the bottom and confirm the list accelerates modestly rather than stepping rigidly
- release without crossing to a new slot and confirm no order change
- release at the visual end and confirm the item lands at the end
- exit sort mode and confirm click-to-copy and `...` still work

Expected:

- the interaction resembles mobile icon sorting more than card hover-and-drop

- [ ] **Step 6: Commit the final verification slice**

Run:

```bash
git add media/promptqueue-view.js playground/promptqueue-playground.js src/test/suite/promptManager.test.ts src/test/suite/promptTreeProvider.test.ts src/test/suite/promptPlaygroundAssets.test.ts src/test/suite/promptWebviewAssets.test.ts
git commit -m "feat: refine promptqueue mobile-style reordering"
```

## Self-Review

- Spec coverage:
  - overlay drag layer: Task 2
  - real gap slot and coordinated neighbor motion: Tasks 2 and 3
  - exact `targetIndex` contract: Tasks 3 and 4
  - helper-driven auto-scroll: Tasks 1 and 4
  - excluding unrelated harness changes: File Structure and all tasks
- Placeholder scan:
  - no `TODO`, `TBD`, or “similar to above” placeholders remain
- Type consistency:
  - `gapIndex`, `targetIndex`, and `PromptQueueReorderMath` names stay consistent across tasks
