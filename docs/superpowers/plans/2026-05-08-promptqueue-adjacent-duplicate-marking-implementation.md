# PromptQueue Adjacent Duplicate Marking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mark both prompts in the PromptQueue webview whenever two neighboring items have equal normalized content, using a localized duplicate badge and subtle duplicate card styling without changing persisted data or the native tree view.

**Architecture:** Keep duplicate detection as derived extension-side state inside `PromptWebviewViewProvider.buildWebviewItems()`. Extend `PromptWebviewItem` with a transient `isAdjacentDuplicate` flag, localize the duplicate badge text through `promptLocalization.ts`, and let the existing static webview assets render the badge and card styling from that derived state.

**Tech Stack:** TypeScript, Vitest, VS Code extension API, plain browser JavaScript, CSS

---

## Preflight

- [ ] **Step 1: Create a dedicated worktree if you are still on the shared branch**

Run:

```bash
git worktree add .worktrees/promptqueue-adjacent-duplicates -b feature/promptqueue-adjacent-duplicates HEAD
```

Expected:
- a new worktree is created at `.worktrees/promptqueue-adjacent-duplicates`

- [ ] **Step 2: Run all remaining commands from the new worktree root**

Run:

```bash
git rev-parse --show-toplevel
```

Expected:
- the printed path ends with `.worktrees/promptqueue-adjacent-duplicates`

## File Structure

- Modify `src/prompt/promptWebviewProtocol.ts`
  - add `isAdjacentDuplicate?: boolean` to `PromptWebviewItem`
- Modify `src/prompt/promptWebviewViewProvider.ts`
  - normalize prompt content, detect adjacent duplicate ranges, and emit the derived duplicate flag in webview state
- Modify `src/prompt/promptLocalization.ts`
  - add localized duplicate badge text to `status`
- Modify `src/test/suite/promptWebviewViewProvider.test.ts`
  - cover adjacent duplicate detection, normalization, and non-adjacent non-matches
- Modify `src/test/suite/promptLocalization.test.ts`
  - cover duplicate badge localization in Chinese and English
- Modify `media/promptqueue-view.js`
  - render duplicate cards and duplicate badges from `isAdjacentDuplicate`
- Modify `media/promptqueue-view.css`
  - style duplicate rows, title/badge layout, and duplicate badges
- Modify `src/test/suite/promptWebviewAssets.test.ts`
  - lock in duplicate badge markup and duplicate styling classes

Files intentionally out of scope:

- `src/prompt/promptManager.ts`
- `src/prompt/promptStore.ts`
- `src/prompt/promptTreeProvider.ts`
- `src/prompt/promptTreeItem.ts`
- persisted prompt JSON files

## Task 1: Derive Adjacent Duplicate State In The Provider And Localize The Badge Text

**Files:**
- Modify: `src/prompt/promptWebviewProtocol.ts`
- Modify: `src/prompt/promptWebviewViewProvider.ts`
- Modify: `src/prompt/promptLocalization.ts`
- Test: `src/test/suite/promptWebviewViewProvider.test.ts`
- Test: `src/test/suite/promptLocalization.test.ts`

- [ ] **Step 1: Write the failing provider and localization tests**

Add this test to `src/test/suite/promptWebviewViewProvider.test.ts`:

```ts
  it('marks both prompts in an adjacent normalized duplicate pair', async () => {
    const manager = createManagerStub();
    manager.getItems.mockReturnValueOnce([
      createPromptItem({
        id: 'prompt-1',
        title: 'Alpha',
        content: 'same body\n',
      }),
      createPromptItem({
        id: 'prompt-2',
        title: 'Beta',
        content: '  same body\r\n',
      }),
      createPromptItem({
        id: 'prompt-3',
        title: 'Gamma',
        content: 'different body',
      }),
    ]);
    const view = createWebviewViewStub();
    const provider = new PromptWebviewViewProvider({
      hasActiveTerminal: () => true,
      manager,
      getStorageLabel: () => 'WorkSpace/PromptQueue',
      getUiLanguage: () => 'zh-CN',
      writeClipboard: vi.fn(async () => undefined),
    });

    await provider.resolveWebviewView(view as never);

    expect(view.postedMessages[0]).toMatchObject({
      type: 'state',
      state: {
        items: [
          expect.objectContaining({
            id: 'prompt-1',
            isAdjacentDuplicate: true,
          }),
          expect.objectContaining({
            id: 'prompt-2',
            isAdjacentDuplicate: true,
          }),
          expect.objectContaining({
            id: 'prompt-3',
            isAdjacentDuplicate: false,
          }),
        ],
      },
    });
  });
```

Add this second test to `src/test/suite/promptWebviewViewProvider.test.ts`:

```ts
  it('does not mark equal content when a different prompt breaks adjacency', async () => {
    const manager = createManagerStub();
    manager.getItems.mockReturnValueOnce([
      createPromptItem({
        id: 'prompt-1',
        content: 'same body',
      }),
      createPromptItem({
        id: 'prompt-2',
        content: 'different body',
      }),
      createPromptItem({
        id: 'prompt-3',
        content: ' same body ',
      }),
    ]);
    const view = createWebviewViewStub();
    const provider = new PromptWebviewViewProvider({
      hasActiveTerminal: () => true,
      manager,
      getStorageLabel: () => 'WorkSpace/PromptQueue',
      getUiLanguage: () => 'zh-CN',
      writeClipboard: vi.fn(async () => undefined),
    });

    await provider.resolveWebviewView(view as never);

    expect(view.postedMessages[0]).toMatchObject({
      type: 'state',
      state: {
        items: [
          expect.objectContaining({
            id: 'prompt-1',
            isAdjacentDuplicate: false,
          }),
          expect.objectContaining({
            id: 'prompt-2',
            isAdjacentDuplicate: false,
          }),
          expect.objectContaining({
            id: 'prompt-3',
            isAdjacentDuplicate: false,
          }),
        ],
      },
    });
  });
```

Update `src/test/suite/promptLocalization.test.ts` with these assertions:

```ts
    expect(strings.status).toMatchObject({
      untitled: '<无标题>',
      duplicate: '重复',
    });
```

```ts
    expect(strings.status).toMatchObject({
      untitled: '<Untitled>',
      duplicate: 'Duplicate',
    });
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptWebviewViewProvider.test.ts src/test/suite/promptLocalization.test.ts
```

Expected:
- FAIL because `PromptWebviewItem` does not yet expose `isAdjacentDuplicate`
- FAIL because `PromptWebviewViewProvider.buildWebviewItems()` does not yet calculate duplicate flags
- FAIL because `PromptQueueStrings.status` does not yet include `duplicate`

- [ ] **Step 3: Write the minimal protocol, provider, and localization implementation**

Extend `src/prompt/promptWebviewProtocol.ts`:

```ts
export interface PromptWebviewItem extends PromptItem {
  copyAgeLabel?: string;
  isAdjacentDuplicate?: boolean;
}
```

Extend the `status` type in `src/prompt/promptLocalization.ts`:

```ts
  status: {
    duplicate: string;
    untitled: string;
  };
```

Update the Chinese locale object:

```ts
  status: {
    duplicate: '重复',
    untitled: '<无标题>',
  },
```

Update the English locale object:

```ts
  status: {
    duplicate: 'Duplicate',
    untitled: '<Untitled>',
  },
```

Add duplicate normalization and adjacent-pair detection to `src/prompt/promptWebviewViewProvider.ts`:

```ts
  private buildWebviewItems(): PromptWebviewItem[] {
    const nowMs = Date.now();
    const items = this.manager.getItems();
    const duplicateIndexes = new Set<number>();

    for (let index = 1; index < items.length; index += 1) {
      const previousContent = this.normalizeDuplicateContent(
        items[index - 1].content,
      );
      const currentContent = this.normalizeDuplicateContent(
        items[index].content,
      );

      if (previousContent !== currentContent) {
        continue;
      }

      duplicateIndexes.add(index - 1);
      duplicateIndexes.add(index);
    }

    return items.map((item, index) => ({
      ...item,
      copyAgeLabel: item.used
        ? getPromptCopyAgeLabel(item.lastCopiedAt, nowMs)
        : undefined,
      isAdjacentDuplicate: duplicateIndexes.has(index),
    }));
  }

  private normalizeDuplicateContent(content: string): string {
    return content.replace(/\r\n/g, '\n').trim();
  }
```

- [ ] **Step 4: Re-run the focused tests and verify GREEN**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptWebviewViewProvider.test.ts src/test/suite/promptLocalization.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit the derived-state slice**

Run:

```bash
git add src/prompt/promptWebviewProtocol.ts src/prompt/promptWebviewViewProvider.ts src/prompt/promptLocalization.ts src/test/suite/promptWebviewViewProvider.test.ts src/test/suite/promptLocalization.test.ts
git commit -m "feat: detect adjacent duplicate prompts"
```

Expected:
- commit succeeds with only the provider/protocol/localization files staged

## Task 2: Render Duplicate Badges And Duplicate Card Styling In The Webview

**Files:**
- Modify: `media/promptqueue-view.js`
- Modify: `media/promptqueue-view.css`
- Test: `src/test/suite/promptWebviewAssets.test.ts`

- [ ] **Step 1: Write the failing webview asset assertions**

Add this test to `src/test/suite/promptWebviewAssets.test.ts`:

```ts
  it('renders duplicate badges from derived duplicate state', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('isAdjacentDuplicate');
    expect(script).toContain('strings.status.duplicate');
    expect(script).toContain('pq-card-title-row');
    expect(script).toContain('pq-card-badge-duplicate');
  });
```

Add this CSS-oriented test to `src/test/suite/promptWebviewAssets.test.ts`:

```ts
  it('styles duplicate cards and duplicate badges distinctly', async () => {
    const css = await readAsset('media/promptqueue-view.css');

    expect(css).toContain('--pq-duplicate');
    expect(css).toContain('.pq-card-duplicate');
    expect(css).toContain('.pq-card-title-row');
    expect(css).toContain('.pq-card-badge');
    expect(css).toContain('.pq-card-badge-duplicate');
  });
```

- [ ] **Step 2: Run the focused asset test and verify RED**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptWebviewAssets.test.ts
```

Expected:
- FAIL because the webview script does not yet render duplicate badges
- FAIL because the stylesheet does not yet define duplicate card or badge classes

- [ ] **Step 3: Write the minimal duplicate rendering and styling implementation**

Add a duplicate badge helper to `media/promptqueue-view.js`:

```js
  function renderDuplicateBadge(item) {
    if (!item.isAdjacentDuplicate) {
      return '';
    }

    return (
      '<span class="pq-card-badge pq-card-badge-duplicate">' +
      escapeHtml(ui.state.strings.status.duplicate || '') +
      '</span>'
    );
  }
```

Update the card markup in `renderCards()` inside `media/promptqueue-view.js`:

```js
      cards.push(
        '<article class="pq-card ' +
          (item.used ? 'pq-card-used ' : '') +
          (item.isAdjacentDuplicate ? 'pq-card-duplicate ' : '') +
          (ui.sortMode ? 'pq-card-sortable ' : '') +
          (isGapSource
            ? 'pq-card-drag-over pq-card-sortable-gap pq-card-sortable-placeholder '
            : '') +
          '" data-card-id="' +
          escapeHtml(item.id) +
          '">' +
          '<div class="pq-card-side">' +
          '<button class="pq-card-rail ' +
          (item.used ? 'pq-card-rail-used' : '') +
          '" data-action="toggle-used" data-prompt-id="' +
          escapeHtml(item.id) +
          '" aria-label="toggle used"' +
          (ui.sortMode ? ' disabled tabindex="-1"' : '') +
          '></button>' +
          (copyAgeLabel
            ? '<div class="pq-card-age">' + escapeHtml(copyAgeLabel) + '</div>'
            : '') +
          '</div>' +
          '<div class="pq-card-main">' +
          '<div class="pq-card-title-row">' +
          '<div class="pq-card-title">' +
          escapeHtml(display.title) +
          '</div>' +
          renderDuplicateBadge(item) +
          '</div>' +
          (display.body
            ? '<div class="pq-card-body">' + escapeHtml(display.body) + '</div>'
            : '') +
          '</div>' +
          '<button class="pq-icon-btn pq-card-menu-trigger" data-action="open-item-menu" data-prompt-id="' +
          escapeHtml(item.id) +
          '" aria-label="' +
          escapeHtml(ui.state.strings.actions.more || 'More') +
          '"' +
          (ui.sortMode ? ' disabled tabindex="-1"' : '') +
          '>' +
          '&hellip;' +
          '</button>' +
          '</article>',
      );
```

Add duplicate tokens and styles to `media/promptqueue-view.css`:

```css
:root {
  --pq-duplicate: rgba(245, 158, 11, 0.38);
  --pq-duplicate-soft: rgba(245, 158, 11, 0.14);
}

.pq-card-duplicate {
  border-color: var(--pq-duplicate);
  background: color-mix(
    in srgb,
    var(--pq-duplicate-soft) 72%,
    var(--pq-surface-panel)
  );
}

.pq-card-title-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.pq-card-title {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
  word-break: break-word;
}

.pq-card-badge {
  flex: 0 0 auto;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.pq-card-badge-duplicate {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.12);
  border: 1px solid rgba(251, 191, 36, 0.28);
}
```

- [ ] **Step 4: Re-run the focused asset test and verify GREEN**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptWebviewAssets.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit the webview rendering slice**

Run:

```bash
git add media/promptqueue-view.js media/promptqueue-view.css src/test/suite/promptWebviewAssets.test.ts
git commit -m "feat: mark duplicate prompt cards in webview"
```

Expected:
- commit succeeds with only the webview asset files staged

## Task 3: Run Verification And Smoke-Test Adjacent Duplicate Behavior

**Files:**
- Modify: `src/prompt/promptWebviewProtocol.ts`
- Modify: `src/prompt/promptWebviewViewProvider.ts`
- Modify: `src/prompt/promptLocalization.ts`
- Modify: `media/promptqueue-view.js`
- Modify: `media/promptqueue-view.css`
- Test: `src/test/suite/promptWebviewViewProvider.test.ts`
- Test: `src/test/suite/promptLocalization.test.ts`
- Test: `src/test/suite/promptWebviewAssets.test.ts`

- [ ] **Step 1: Run the focused regression suite**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptWebviewViewProvider.test.ts src/test/suite/promptLocalization.test.ts src/test/suite/promptWebviewAssets.test.ts
```

Expected:
- PASS

- [ ] **Step 2: Run the full unit suite**

Run:

```bash
npm run test:unit
```

Expected:
- PASS

- [ ] **Step 3: Run the TypeScript compile check**

Run:

```bash
npm run compile
```

Expected:
- PASS

- [ ] **Step 4: Launch the extension host and manually verify duplicate behavior**

Run:

```bash
code --extensionDevelopmentPath="." ".\\playground\\promptqueue-test.code-workspace"
```

Expected manual checks:
- open the PromptQueue sidebar webview
- create three prompts where the first content is `same body`, the second content is `same body` with extra outer spaces or newline differences, and the third content is `different body`
- confirm the first two cards both show the localized duplicate badge
- edit or reorder so the matching prompts are no longer adjacent, and confirm both duplicate badges disappear
- toggle one duplicate card to `used`, and confirm the duplicate badge remains visible while the used-state body hiding still works

- [ ] **Step 5: Check worktree state before handoff**

Run:

```bash
git status --short
```

Expected:
- clean worktree if each task commit succeeded
- or only the intended implementation files remain if commits were intentionally deferred

## Self-Review

- Spec coverage:
  - derived adjacent duplicate detection: Task 1
  - normalization of `\r\n` and trimming: Task 1
  - duplicate badge localization: Task 1
  - webview-only duplicate badge and card styling: Task 2
  - no storage or tree-view changes: File Structure and scoped files list
  - regression and manual verification: Task 3
- Placeholder scan:
  - no `TODO`, `TBD`, “similar to above”, or abstract “add validation” instructions remain
- Type consistency:
  - `isAdjacentDuplicate` is used consistently in protocol, provider, tests, and webview assets
  - duplicate text is consistently modeled as `strings.status.duplicate`
