# PromptQueue Copy Template Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add workspace-level prefix/suffix copy templates to PromptQueue, plus a raw-content copy action that still marks items as used.

**Architecture:** Store copy template settings alongside prompt data in a separate workspace-local JSON file. Extend the prompt manager to load/save settings and generate copy text for either templated or raw modes, while keeping command handlers thin and native-tree UX unchanged except for a new title-bar settings entry and a new context-menu copy action.

**Tech Stack:** TypeScript, VS Code extension API, Vitest, @vscode/test-electron

---

## Chunk 1: Settings Data and Manager Logic

### Task 1: Add failing tests for settings storage and copy composition

**Files:**
- Create: `src/test/suite/promptSettingsStore.test.ts`
- Modify: `src/test/suite/promptManager.test.ts`
- Modify: `src/prompt/promptManager.ts`
- Create: `src/prompt/promptSettingsStore.ts`
- Modify: `src/prompt/workspacePaths.ts`
- Modify: `src/prompt/promptTypes.ts`

- [ ] **Step 1: Write failing settings-store tests**

```ts
it('returns empty prefix/suffix when settings file is missing', async () => {
  // load() => { prefix: '', suffix: '' }
});

it('saves prefix and suffix into settings.json', async () => {
  // save() persists expected JSON payload
});
```

- [ ] **Step 2: Run the focused settings-store test and verify it fails**

Run: `npm run test:unit -- src/test/suite/promptSettingsStore.test.ts`
Expected: FAIL because `promptSettingsStore.ts` does not exist yet

- [ ] **Step 3: Write failing manager tests for templated and raw copy**

```ts
it('copies prefix, content, and suffix with empty blocks omitted', async () => {
  // copyItem('id', 'templated', writer)
});

it('copies only content in raw mode and still marks item as used', async () => {
  // copyItem('id', 'raw', writer)
});
```

- [ ] **Step 4: Run the focused manager test and verify it fails**

Run: `npm run test:unit -- src/test/suite/promptManager.test.ts`
Expected: FAIL because copy settings behavior is not implemented

- [ ] **Step 5: Implement minimal settings store, types, workspace paths, and manager logic**

Targets:
- `src/prompt/promptTypes.ts`
- `src/prompt/workspacePaths.ts`
- `src/prompt/promptSettingsStore.ts`
- `src/prompt/promptManager.ts`

Implementation notes:
- add `PromptCopySettings`
- add `settings.json` path helpers
- add manager initialization/loading for settings
- add `getCopySettings()` and `updateCopySettings()`
- extend copy flow to support `templated` vs `raw`

- [ ] **Step 6: Re-run focused unit tests**

Run:
- `npm run test:unit -- src/test/suite/promptSettingsStore.test.ts`
- `npm run test:unit -- src/test/suite/promptManager.test.ts`

Expected: PASS

- [ ] **Step 7: Commit data-layer progress**

```bash
git add src/prompt/promptTypes.ts src/prompt/workspacePaths.ts src/prompt/promptSettingsStore.ts src/prompt/promptManager.ts src/test/suite/promptSettingsStore.test.ts src/test/suite/promptManager.test.ts
git commit -m "feat: add PromptQueue copy template settings"
```

## Chunk 2: Commands, Panel, and Manifest Wiring

### Task 2: Add failing command and manifest tests

**Files:**
- Modify: `src/test/suite/registerPromptCommands.test.ts`
- Modify: `src/test/suite/manifest.test.ts`
- Create: `src/prompt/promptSettingsPanel.ts`
- Modify: `src/prompt/registerPromptCommands.ts`
- Modify: `src/extension.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing manifest expectations**

```ts
expect(commandTitles.get('promptQueue.openSettings')).toBe('设置');
expect(itemMenuCommands).toContainEqual({
  command: 'promptQueue.copyItemRaw',
  group: 'navigation',
});
```

- [ ] **Step 2: Run manifest test to verify it fails**

Run: `npm run test:unit -- src/test/suite/manifest.test.ts`
Expected: FAIL because the new commands are not contributed yet

- [ ] **Step 3: Write failing command tests**

```ts
it('opens the settings panel and saves prefix/suffix', async () => {
  // openSettings -> manager.updateCopySettings(...)
});

it('routes raw copy through the clipboard without templates', async () => {
  // copyItemRaw -> manager.copyItem(id, 'raw', writer)
});
```

- [ ] **Step 4: Run command test to verify it fails**

Run: `npm run test:unit -- src/test/suite/registerPromptCommands.test.ts`
Expected: FAIL because the new commands and panel plumbing do not exist

- [ ] **Step 5: Implement panel, command wiring, manifest entries, and activation plumbing**

Targets:
- `src/prompt/promptSettingsPanel.ts`
- `src/prompt/registerPromptCommands.ts`
- `src/extension.ts`
- `package.json`

Implementation notes:
- add a compact Chinese settings panel with two multiline fields
- add title-bar `设置`
- add item context `仅复制正文`
- keep success feedback consistent with existing copy behavior

- [ ] **Step 6: Re-run focused unit tests**

Run:
- `npm run test:unit -- src/test/suite/registerPromptCommands.test.ts`
- `npm run test:unit -- src/test/suite/manifest.test.ts`

Expected: PASS

- [ ] **Step 7: Commit command/UI progress**

```bash
git add package.json src/extension.ts src/prompt/promptSettingsPanel.ts src/prompt/registerPromptCommands.ts src/test/suite/registerPromptCommands.test.ts src/test/suite/manifest.test.ts
git commit -m "feat: add PromptQueue copy template commands"
```

## Chunk 3: Full Verification and Documentation

### Task 3: Verify the feature end-to-end

**Files:**
- Modify: `docs/superpowers/specs/2026-03-16-promptqueue-copy-template-design.md`
- Modify: `docs/superpowers/plans/2026-03-16-promptqueue-copy-template-implementation.md`

- [ ] **Step 1: Run the full unit suite**

Run: `npm run test:unit`
Expected: PASS with all unit tests green

- [ ] **Step 2: Run the full integration suite**

Run: `npm run test:integration`
Expected: PASS with the extension smoke test green

- [ ] **Step 3: Manually sanity-check the feature in Extension Development Host**

Run:
`code --extensionDevelopmentPath="<worktree>" "<worktree>"`

Check:
- title bar shows `设置`
- saving prefix/suffix affects left-click copy
- `仅复制正文` bypasses prefix/suffix
- both copy modes mark the item as used

- [ ] **Step 4: Update docs if implementation details changed**

Adjust the spec/plan only if actual behavior diverges from the approved design.

- [ ] **Step 5: Commit verification-safe final state**

```bash
git add docs/superpowers/specs/2026-03-16-promptqueue-copy-template-design.md docs/superpowers/plans/2026-03-16-promptqueue-copy-template-implementation.md
git commit -m "docs: record PromptQueue copy template delivery"
```
