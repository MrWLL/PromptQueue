# PromptQueue Webview Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current native PromptQueue tree sidebar with a full webview sidebar that supports card-based prompt management, last-delete restore, configurable storage path, UI language switching, and in-webview editing flows.

**Architecture:** Keep persistence and prompt business rules in the extension host, then expose a typed webview message bridge for rendering and interaction. Reuse `PromptManager` and the import parser where possible, but extend the host layer with configurable paths, backup storage, localization bundles, and a `WebviewViewProvider` that owns UI state synchronization.

**Tech Stack:** TypeScript, VS Code extension API, WebviewView, plain browser JavaScript/CSS, Vitest, @vscode/test-electron

---

## Chunk 1: Storage, Backup, and Host Configuration

### Task 1: Add failing tests for configurable storage roots and last-delete backup

**Files:**
- Create: `src/test/suite/promptBackupStore.test.ts`
- Create: `src/test/suite/promptConfig.test.ts`
- Modify: `src/test/suite/promptManager.test.ts`
- Modify: `src/prompt/workspacePaths.ts`
- Modify: `src/prompt/promptManager.ts`
- Create: `src/prompt/promptBackupStore.ts`
- Create: `src/prompt/promptConfig.ts`
- Modify: `src/prompt/promptTypes.ts`

- [ ] **Step 1: Write failing backup-store tests**

```ts
it('returns undefined when last-deleted backup is missing', async () => {
  // loadLastDeleted() => undefined
});

it('overwrites the previous last-deleted backup on save', async () => {
  // saveLastDeleted(items) then saveLastDeleted(nextItems)
});
```

- [ ] **Step 2: Write failing storage-path resolution tests**

```ts
it('resolves the default storage path under the workspace root', () => {
  // resolvePromptQueueStoragePath(undefined) => <workspace>/WorkSpace/PromptQueue
});

it('keeps absolute storage paths unchanged', () => {
  // resolvePromptQueueStoragePath('D:/PromptQueueData')
});
```

- [ ] **Step 3: Write failing manager tests for delete-all backup and restore**

```ts
it('backs up current prompts before deleteAll clears the queue', async () => {
  // deleteAll() saves last-deleted snapshot, then persists []
});

it('restores the last deleted snapshot by replacing the current queue', async () => {
  // restoreLastDeleted() swaps in the backup items
});
```

- [ ] **Step 4: Run the focused tests and verify RED**

Run:
- `npm run test:unit -- src/test/suite/promptBackupStore.test.ts`
- `npm run test:unit -- src/test/suite/promptConfig.test.ts`
- `npm run test:unit -- src/test/suite/promptManager.test.ts`

Expected:
- FAIL because backup storage and configurable path support do not exist yet

- [ ] **Step 5: Implement the minimal host-side data support**

Targets:
- `src/prompt/workspacePaths.ts`
- `src/prompt/promptBackupStore.ts`
- `src/prompt/promptConfig.ts`
- `src/prompt/promptManager.ts`
- `src/prompt/promptTypes.ts`

Implementation notes:
- move path resolution behind a helper that accepts the configured storage path
- add `last-deleted.json` path helpers
- add a backup store with `load`, `save`, and missing-file fallback
- extend `PromptManager` with backup-aware `deleteAll()` and `restoreLastDeleted()`
- keep copy behavior unchanged except for type additions needed by the webview state later

- [ ] **Step 6: Re-run the focused tests and verify GREEN**

Run:
- `npm run test:unit -- src/test/suite/promptBackupStore.test.ts`
- `npm run test:unit -- src/test/suite/promptConfig.test.ts`
- `npm run test:unit -- src/test/suite/promptManager.test.ts`

Expected:
- PASS

- [ ] **Step 7: Commit the data/config foundation**

```bash
git add src/prompt/workspacePaths.ts src/prompt/promptBackupStore.ts src/prompt/promptConfig.ts src/prompt/promptManager.ts src/prompt/promptTypes.ts src/test/suite/promptBackupStore.test.ts src/test/suite/promptConfig.test.ts src/test/suite/promptManager.test.ts
git commit -m "feat: add PromptQueue webview data foundations"
```

## Chunk 2: Localization and Webview Host Bridge

### Task 2: Add failing tests for locale bundles and webview message handling

**Files:**
- Create: `src/test/suite/promptLocalization.test.ts`
- Create: `src/test/suite/promptWebviewViewProvider.test.ts`
- Modify: `src/test/mocks/vscode.ts`
- Create: `src/prompt/promptLocalization.ts`
- Create: `src/prompt/promptWebviewProtocol.ts`
- Create: `src/prompt/promptWebviewHtml.ts`
- Create: `src/prompt/promptWebviewViewProvider.ts`
- Modify: `src/extension.ts`

- [ ] **Step 1: Write failing localization tests**

```ts
it('returns Chinese strings for zh-CN', () => {
  expect(getPromptQueueStrings('zh-CN').actions.add).toBe('新增');
});

it('falls back safely for unknown locale values', () => {
  expect(getPromptQueueStrings('unexpected').actions.add).toBeDefined();
});
```

- [ ] **Step 2: Write failing provider tests for initial state and host actions**

```ts
it('posts an initial state payload when the webview resolves', async () => {
  // resolveWebviewView() => postMessage({ type: 'state', ... })
});

it('handles copy, toggle, restore, and delete-all messages through the manager', async () => {
  // onDidReceiveMessage() dispatches expected host calls
});
```

- [ ] **Step 3: Run the focused provider/localization tests and verify RED**

Run:
- `npm run test:unit -- src/test/suite/promptLocalization.test.ts`
- `npm run test:unit -- src/test/suite/promptWebviewViewProvider.test.ts`

Expected:
- FAIL because the locale bundle and webview provider do not exist yet

- [ ] **Step 4: Implement the minimal host bridge**

Targets:
- `src/prompt/promptLocalization.ts`
- `src/prompt/promptWebviewProtocol.ts`
- `src/prompt/promptWebviewHtml.ts`
- `src/prompt/promptWebviewViewProvider.ts`
- `src/extension.ts`
- `src/test/mocks/vscode.ts`

Implementation notes:
- define explicit webview message types for copy, copyRaw, toggleUsed, create, update, import, delete, deleteAll, restoreLastDeleted, reorder, move, updateCopySettings, and requestState
- build the webview HTML shell with CSP-safe script/style URIs and a boot payload
- have the provider send normalized state including items, copy settings, storage label, locale strings, and restore availability
- keep all mutations in the host; the webview only emits intents

- [ ] **Step 5: Re-run the focused provider/localization tests and verify GREEN**

Run:
- `npm run test:unit -- src/test/suite/promptLocalization.test.ts`
- `npm run test:unit -- src/test/suite/promptWebviewViewProvider.test.ts`

Expected:
- PASS

- [ ] **Step 6: Commit the host bridge**

```bash
git add src/prompt/promptLocalization.ts src/prompt/promptWebviewProtocol.ts src/prompt/promptWebviewHtml.ts src/prompt/promptWebviewViewProvider.ts src/extension.ts src/test/mocks/vscode.ts src/test/suite/promptLocalization.test.ts src/test/suite/promptWebviewViewProvider.test.ts
git commit -m "feat: add PromptQueue webview host bridge"
```

## Chunk 3: Webview Frontend UI and Interaction Flows

### Task 3: Add failing tests for manifest wiring and webview-driven behavior

**Files:**
- Modify: `src/test/suite/manifest.test.ts`
- Modify: `src/test/suite/extension.integration.ts`
- Create: `media/promptqueue-view.css`
- Create: `media/promptqueue-view.js`
- Modify: `src/prompt/promptWebviewHtml.ts`
- Modify: `src/prompt/promptWebviewViewProvider.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing manifest expectations for the webview migration**

```ts
expect(contributes.views.promptQueue[0].id).toBe('promptQueue.sidebar');
expect(contributes.menus?.['view/title'] ?? []).toHaveLength(0);
```

- [ ] **Step 2: Extend the integration smoke test to assert the PromptQueue view still activates**

```ts
it('activates the PromptQueue sidebar view', async () => {
  // verify extension activation still succeeds with the webview provider
});
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:
- `npm run test:unit -- src/test/suite/manifest.test.ts`
- `npm run test:integration`

Expected:
- FAIL because the manifest and activation still describe the native tree workflow

- [ ] **Step 4: Implement the frontend assets and wire them into the provider**

Targets:
- `media/promptqueue-view.css`
- `media/promptqueue-view.js`
- `src/prompt/promptWebviewHtml.ts`
- `src/prompt/promptWebviewViewProvider.ts`
- `package.json`

Implementation notes:
- render rounded prompt cards with larger text and spacing
- implement top-bar actions, status row, drawer surfaces, toast feedback, context menu, and long-press support
- support card click for templated copy and status-dot click for used toggling
- support drag-and-drop reorder in the browser plus move up/down menu actions
- remove view-title actions and item context menus from the manifest because the UI now owns them

- [ ] **Step 5: Re-run the focused tests and verify GREEN**

Run:
- `npm run test:unit -- src/test/suite/manifest.test.ts`
- `npm run test:integration`

Expected:
- PASS

- [ ] **Step 6: Commit the webview UI**

```bash
git add package.json media/promptqueue-view.css media/promptqueue-view.js src/prompt/promptWebviewHtml.ts src/prompt/promptWebviewViewProvider.ts src/test/suite/manifest.test.ts src/test/suite/extension.integration.ts
git commit -m "feat: add PromptQueue webview sidebar UI"
```

## Chunk 4: Remove Native UI Wiring and Verify End-to-End

### Task 4: Remove obsolete native UI activation and verify full behavior

**Files:**
- Modify: `src/extension.ts`
- Modify: `src/test/suite/index.ts`
- Optionally modify: `src/prompt/promptTreeProvider.ts`
- Optionally modify: `src/prompt/promptTreeItem.ts`
- Optionally modify: `src/prompt/registerPromptCommands.ts`
- Optionally modify: `src/prompt/promptInputPanel.ts`
- Optionally modify: `src/prompt/promptSettingsPanel.ts`
- Modify: `docs/superpowers/specs/2026-03-16-promptqueue-webview-design.md`
- Modify: `docs/superpowers/plans/2026-03-16-promptqueue-webview-implementation.md`

- [ ] **Step 1: Remove unused native-tree-only activation paths**

Examples:
- stop creating the tree provider in `src/extension.ts`
- stop registering title-bar and item-context-only command plumbing that the webview no longer needs
- keep only the host services still used by the webview provider

- [ ] **Step 2: Run the full unit suite**

Run: `npm run test:unit`
Expected: PASS

- [ ] **Step 3: Run the full integration suite**

Run: `npm run test:integration`
Expected: PASS

- [ ] **Step 4: Manually smoke test in Extension Development Host**

Run:
`code --extensionDevelopmentPath="<worktree>" "<worktree>"`

Check:
- PromptQueue still appears in the left activity bar
- cards render inside the sidebar webview
- add, edit, bulk import, delete-all, restore-last-delete, and settings all work in-webview
- left-click copies templated content and marks used
- right-click and long-press open the secondary action menu
- storage path and UI language changes take effect after refresh/reopen

- [ ] **Step 5: Update docs if implementation details drifted**

Adjust:
- `docs/superpowers/specs/2026-03-16-promptqueue-webview-design.md`
- `docs/superpowers/plans/2026-03-16-promptqueue-webview-implementation.md`

only if the delivered behavior differs from the approved design.

- [ ] **Step 6: Commit the verified migration**

```bash
git add src/extension.ts src/test/suite/index.ts docs/superpowers/specs/2026-03-16-promptqueue-webview-design.md docs/superpowers/plans/2026-03-16-promptqueue-webview-implementation.md
git commit -m "feat: migrate PromptQueue sidebar to webview"
```
