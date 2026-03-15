# PromptQueue Native Tree Refinement Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the native PromptQueue sidebar so it uses shorter labels, checkbox-based used-state toggling, right-click edit/delete, and confirmed bulk deletion.

**Architecture:** Keep the native `TreeView` and reuse the existing store, manager, and parser layers. Limit changes to manifest contributions, tree item presentation, checkbox event handling, and a small command-layer addition for confirmed bulk deletion.

**Tech Stack:** TypeScript, VS Code Extension API, `vitest`, `@vscode/test-electron`

---

## Chunk 1: Native Tree Interaction Refinement

### Task 1: Update manifest labels and menu placement

**Files:**
- Modify: `package.json`
- Test: `src/test/suite/manifest.test.ts`

- [ ] **Step 1: Write the failing manifest expectations**

Cover:
- activity bar title becomes `队列`
- view title becomes shorter
- title bar commands are `新增`, `批量导入`, `全部删除`
- row inline actions no longer expose edit/delete/toggle
- row context menu keeps `编辑`, `删除`

- [ ] **Step 2: Run the manifest test to verify it fails**

Run: `npm run test:unit -- src/test/suite/manifest.test.ts`
Expected: FAIL because current labels and menu placements still reflect the older crowded layout.

- [ ] **Step 3: Implement the minimal manifest update**

Update `package.json` to:
- shorten activity bar and view labels
- add `promptQueue.deleteAllItems`
- move edit/delete to context menu only
- remove inline used/edit/delete commands from the row

- [ ] **Step 4: Re-run the manifest test**

Run: `npm run test:unit -- src/test/suite/manifest.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json src/test/suite/manifest.test.ts
git commit -m "feat: refine PromptQueue native tree menus"
```

### Task 2: Add checkbox-based used-state toggling while preserving row-copy behavior

**Files:**
- Modify: `src/prompt/promptTreeItem.ts`
- Modify: `src/prompt/promptTreeProvider.ts`
- Modify: `src/extension.ts`
- Test: `src/test/suite/promptTreeProvider.test.ts`

- [ ] **Step 1: Write the failing tree tests**

Cover:
- tree items expose `checkboxState` based on `used`
- row command still points to copy
- checkbox changes are handled without changing the row command

- [ ] **Step 2: Run the tree tests to verify they fail**

Run: `npm run test:unit -- src/test/suite/promptTreeProvider.test.ts`
Expected: FAIL because tree items do not yet expose checkbox state or checkbox-driven interaction.

- [ ] **Step 3: Implement checkbox support**

Use native VS Code checkbox APIs:
- set `TreeItem.checkboxState`
- listen to `treeView.onDidChangeCheckboxState` in `src/extension.ts`
- reuse the manager toggle behavior when checkbox changes

- [ ] **Step 4: Re-run the tree tests**

Run: `npm run test:unit -- src/test/suite/promptTreeProvider.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/prompt/promptTreeItem.ts src/prompt/promptTreeProvider.ts src/extension.ts src/test/suite/promptTreeProvider.test.ts
git commit -m "feat: add PromptQueue checkbox state toggles"
```

## Chunk 2: Confirmed Bulk Delete and Verification

### Task 3: Add confirmed "delete all" behavior

**Files:**
- Modify: `src/prompt/promptManager.ts`
- Modify: `src/prompt/registerPromptCommands.ts`
- Modify: `src/test/mocks/vscode.ts`
- Test: `src/test/suite/registerPromptCommands.test.ts`

- [ ] **Step 1: Write the failing command tests**

Cover:
- `全部删除` asks for confirmation first
- confirming clears all prompts
- cancel leaves items unchanged

- [ ] **Step 2: Run the command tests to verify they fail**

Run: `npm run test:unit -- src/test/suite/registerPromptCommands.test.ts`
Expected: FAIL because bulk delete and confirmation are not implemented yet.

- [ ] **Step 3: Implement manager + command changes**

Add:
- a manager method that clears all items and persists
- a command handler that shows a warning confirmation dialog
- only execute delete-all when user explicitly confirms

- [ ] **Step 4: Re-run the command tests**

Run: `npm run test:unit -- src/test/suite/registerPromptCommands.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/prompt/promptManager.ts src/prompt/registerPromptCommands.ts src/test/mocks/vscode.ts src/test/suite/registerPromptCommands.test.ts
git commit -m "feat: add PromptQueue delete-all confirmation"
```

### Task 4: Run full verification and refresh the extension smoke test

**Files:**
- Modify: `src/test/suite/extension.integration.ts`

- [ ] **Step 1: Extend the smoke test if command ids changed**

Ensure the integration smoke test checks the updated command registration set, including `promptQueue.deleteAllItems`.

- [ ] **Step 2: Run full verification**

Run: `npm test`
Expected: all unit tests and the integration smoke test pass.

- [ ] **Step 3: Manual development-host sanity check**

Run:

```bash
code --extensionDevelopmentPath "$(pwd)" "$(pwd)"
```

Verify:
- activity bar label is shorter
- title bar shows `新增`, `批量导入`, `全部删除`
- checkbox toggles used state
- left-click row still copies
- edit/delete only appear on right click
- delete-all requires confirmation

- [ ] **Step 4: Commit**

```bash
git add src/test/suite/extension.integration.ts
git commit -m "test: verify PromptQueue native tree refinement"
```
