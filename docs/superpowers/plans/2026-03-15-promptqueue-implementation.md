# PromptQueue Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a workspace-scoped VS Code extension MVP that shows ordered prompts in a native sidebar, supports one-click copy with used-state tracking, and imports many prompts from `-*-`-separated text.

**Architecture:** Use a native `TreeView` backed by a small prompt manager layer. Keep parsing, persistence, editor-draft handling, and tree rendering in separate files so command handlers stay thin and testable. Persist prompt data under `WorkSpace/PromptQueue/prompts.json` with safe writes.

**Tech Stack:** TypeScript, VS Code Extension API, Node.js `fs/promises`, `vitest` for unit tests, `@vscode/test-electron` for extension smoke tests

---

## Preconditions

- Node.js and npm must be installed before implementation starts. The current environment did not have `node` available during brainstorming.
- The repository was initialized in-place on `main`. If you want isolation before code changes, create a worktree or feature branch before executing this plan.
- Use `@superpowers/test-driven-development` while implementing each task.
- Use `@superpowers/verification-before-completion` before claiming the feature is done.

## File Map

Create:

- `package.json`
  - extension manifest, commands, view contributions, npm scripts, dependencies
- `tsconfig.json`
  - TypeScript compiler configuration for extension and tests
- `.vscodeignore`
  - excludes tests and local artifacts from packaged extension output
- `src/extension.ts`
  - activation entrypoint, tree registration, command registration
- `src/prompt/promptTypes.ts`
  - shared prompt item and draft types
- `src/prompt/workspacePaths.ts`
  - resolves `WorkSpace/PromptQueue/` and `prompts.json`
- `src/prompt/importParser.ts`
  - parses `-*-` and `-*- title` import text
- `src/prompt/promptStore.ts`
  - loads and saves prompt JSON with safe write semantics
- `src/prompt/promptManager.ts`
  - in-memory prompt list, mutation methods, store coordination
- `src/prompt/promptTreeItem.ts`
  - `TreeItem` wrapper and labels/tooltips/icons
- `src/prompt/promptTreeProvider.ts`
  - `TreeDataProvider` and drag/drop controller
- `src/prompt/promptEditor.ts`
  - opens untitled editor drafts and saves parsed content back to manager
- `src/prompt/registerPromptCommands.ts`
  - registers all `promptQueue.*` commands
- `src/test/suite/importParser.test.ts`
  - parser unit tests
- `src/test/suite/promptStore.test.ts`
  - storage unit tests
- `src/test/suite/promptManager.test.ts`
  - mutation and command-logic tests
- `src/test/suite/promptTreeProvider.test.ts`
  - tree label, tooltip, and drag/drop tests
- `src/test/runTest.ts`
  - VS Code extension smoke-test launcher
- `src/test/suite/extension.integration.test.ts`
  - activation and command registration smoke tests

Modify:

- `.gitignore`
  - append new generated folders if implementation introduces them

## Chunk 1: Bootstrap and Core Domain

### Task 1: Scaffold the extension project and test harness

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.vscodeignore`
- Create: `src/extension.ts`
- Create: `src/test/runTest.ts`
- Create: `src/test/suite/extension.integration.test.ts`

- [ ] **Step 1: Verify the local toolchain exists**

Run: `node --version && npm --version`
Expected: both commands print versions. If `node` is missing, install Node.js 20 LTS before continuing.

- [ ] **Step 2: Write the failing extension smoke test**

Create `src/test/suite/extension.integration.test.ts` with a minimal activation expectation:

```ts
import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

suite('PromptQueue extension', () => {
  test('registers the copy command after activation', async () => {
    const extension = vscode.extensions.getExtension('local.promptqueue');
    await extension?.activate();

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('promptQueue.copyItem'));
  });
});
```

- [ ] **Step 3: Run the smoke test to confirm the project is not wired yet**

Run: `npm test`
Expected: fail immediately because `package.json` and scripts do not exist yet.

- [ ] **Step 4: Create the minimal extension scaffold**

Add `package.json` with:

- `name: "promptqueue"`
- `displayName: "PromptQueue"`
- `publisher: "local"`
- activation events for `onView:promptQueue.sidebar` and `onCommand:promptQueue.copyItem`
- contributed view container and view id `promptQueue.sidebar`
- placeholder commands for all MVP actions
- scripts:
  - `compile`: `tsc -p .`
  - `test:unit`: `vitest run --passWithNoTests`
  - `test:integration`: `npm run compile && node ./out/test/runTest.js`
  - `test`: `npm run test:unit && npm run test:integration`

Also add `tsconfig.json`, `.vscodeignore`, `src/extension.ts`, and `src/test/runTest.ts` so the extension compiles even with placeholder registrations.

- [ ] **Step 5: Install dependencies and make the smoke test pass**

Run: `npm install`

Required dependencies:

- `vscode`
- `vitest`
- `typescript`
- `@types/node`
- `@types/vscode`
- `@vscode/test-electron`

Then implement the minimal `activate()` that registers `promptQueue.copyItem` and a placeholder tree provider.

Run: `npm test`
Expected: unit tests report no test files or pass trivially, integration smoke test passes.

- [ ] **Step 6: Commit the scaffold**

```bash
git add package.json tsconfig.json .vscodeignore src/extension.ts src/test/runTest.ts src/test/suite/extension.integration.test.ts
git commit -m "chore: scaffold PromptQueue extension"
```

### Task 2: Build the prompt types and bulk import parser

**Files:**

- Create: `src/prompt/promptTypes.ts`
- Create: `src/prompt/importParser.ts`
- Test: `src/test/suite/importParser.test.ts`

- [ ] **Step 1: Write the failing parser tests**

Create tests for:

- plain `-*-` separator
- `-*- Analysis` title separator
- repeated separators producing no empty items
- leading/trailing whitespace trimming

Example case:

```ts
import { describe, expect, it } from 'vitest';
import { parseImportText } from '../../prompt/importParser';

describe('parseImportText', () => {
  it('assigns a separator title to the next item', () => {
    const result = parseImportText('first\\n-*- Analysis\\nsecond');
    expect(result.map((item) => ({ title: item.title, content: item.content }))).toEqual([
      { title: undefined, content: 'first' },
      { title: 'Analysis', content: 'second' },
    ]);
  });
});
```

- [ ] **Step 2: Run only the parser tests and verify they fail**

Run: `npm run test:unit -- src/test/suite/importParser.test.ts`
Expected: fail because `parseImportText` does not exist.

- [ ] **Step 3: Implement the parser and shared types**

Create:

- `PromptItem`
- `PromptDraft`
- `ParsedImportItem`

Implement `parseImportText(text: string): ParsedImportItem[]` so separator titles apply to the next item and empty blocks are ignored.

- [ ] **Step 4: Re-run the parser tests**

Run: `npm run test:unit -- src/test/suite/importParser.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the parser**

```bash
git add src/prompt/promptTypes.ts src/prompt/importParser.ts src/test/suite/importParser.test.ts
git commit -m "feat: add PromptQueue import parser"
```

### Task 3: Implement workspace path resolution and prompt storage

**Files:**

- Create: `src/prompt/workspacePaths.ts`
- Create: `src/prompt/promptStore.ts`
- Test: `src/test/suite/promptStore.test.ts`

- [ ] **Step 1: Write the failing storage tests**

Cover:

- no workspace folder returns a typed error
- missing `WorkSpace/PromptQueue/` is created on save
- save writes `prompts.json.tmp` before replacing `prompts.json`
- load returns `[]` if the data file does not exist

- [ ] **Step 2: Run the storage tests and confirm failure**

Run: `npm run test:unit -- src/test/suite/promptStore.test.ts`
Expected: fail because store/path helpers do not exist.

- [ ] **Step 3: Implement path helpers and safe storage**

Key APIs:

```ts
export function getPromptQueuePaths(workspaceFolder: vscode.WorkspaceFolder | undefined): {
  rootDir: string;
  dataDir: string;
  dataFile: string;
  tempFile: string;
};

export class PromptStore {
  async load(workspaceFolder: vscode.WorkspaceFolder | undefined): Promise<PromptItem[]>;
  async save(workspaceFolder: vscode.WorkspaceFolder | undefined, items: PromptItem[]): Promise<void>;
}
```

Use `fs.mkdir(..., { recursive: true })`, write `tempFile`, then rename into place.

- [ ] **Step 4: Re-run the storage tests**

Run: `npm run test:unit -- src/test/suite/promptStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the storage layer**

```bash
git add src/prompt/workspacePaths.ts src/prompt/promptStore.ts src/test/suite/promptStore.test.ts
git commit -m "feat: add PromptQueue workspace storage"
```

## Chunk 2: Manager, Tree, and Commands

### Task 4: Build the prompt manager mutation layer

**Files:**

- Create: `src/prompt/promptManager.ts`
- Test: `src/test/suite/promptManager.test.ts`

- [ ] **Step 1: Write failing manager tests**

Cover:

- copy success marks an item used
- copy failure leaves `used` unchanged
- toggle used flips the flag
- move up/down swaps the correct items
- reset all clears every `used` flag
- delete removes the correct item
- bulk import appends or replaces depending on mode

- [ ] **Step 2: Run the manager tests and verify failure**

Run: `npm run test:unit -- src/test/suite/promptManager.test.ts`
Expected: fail because `PromptManager` does not exist.

- [ ] **Step 3: Implement the manager**

`PromptManager` should:

- load from `PromptStore`
- expose `getItems()`
- persist after every successful mutation
- accept a clipboard writer callback for copy operations so tests can simulate success/failure

Core methods:

```ts
copyItem(id: string, writeClipboard: (text: string) => Promise<void>): Promise<void>
toggleUsed(id: string): Promise<void>
moveItem(id: string, direction: 'up' | 'down'): Promise<void>
reorder(sourceId: string, targetId: string): Promise<void>
deleteItem(id: string): Promise<void>
resetAllUsed(): Promise<void>
importText(text: string, mode: 'append' | 'replace'): Promise<void>
```

- [ ] **Step 4: Re-run the manager tests**

Run: `npm run test:unit -- src/test/suite/promptManager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the manager**

```bash
git add src/prompt/promptManager.ts src/test/suite/promptManager.test.ts
git commit -m "feat: add PromptQueue prompt manager"
```

### Task 5: Render prompt items in a native tree view

**Files:**

- Create: `src/prompt/promptTreeItem.ts`
- Create: `src/prompt/promptTreeProvider.ts`
- Test: `src/test/suite/promptTreeProvider.test.ts`
- Modify: `src/extension.ts`

- [ ] **Step 1: Write failing tree provider tests**

Cover:

- labels are numbered `01.`, `02.`, ...
- title is preferred over content preview
- `已使用` and `未使用` descriptions are correct
- tooltip includes full content
- drag payload uses a custom mime type such as `application/vnd.promptqueue.item`

- [ ] **Step 2: Run tree tests and verify failure**

Run: `npm run test:unit -- src/test/suite/promptTreeProvider.test.ts`
Expected: fail because tree classes do not exist.

- [ ] **Step 3: Implement tree items and provider**

`PromptTreeProvider` should implement:

- `vscode.TreeDataProvider<PromptTreeItem>`
- `vscode.TreeDragAndDropController<PromptTreeItem>`

It should read from `PromptManager`, emit `onDidChangeTreeData`, and expose a `refresh()` method.

- [ ] **Step 4: Register the tree view in `src/extension.ts`**

Use:

```ts
vscode.window.createTreeView('promptQueue.sidebar', {
  treeDataProvider: promptTreeProvider,
  dragAndDropController: promptTreeProvider,
});
```

- [ ] **Step 5: Re-run tree tests**

Run: `npm run test:unit -- src/test/suite/promptTreeProvider.test.ts`
Expected: PASS

- [ ] **Step 6: Commit the tree view**

```bash
git add src/prompt/promptTreeItem.ts src/prompt/promptTreeProvider.ts src/test/suite/promptTreeProvider.test.ts src/extension.ts
git commit -m "feat: add PromptQueue tree view"
```

### Task 6: Register MVP commands for copy, toggle, reorder, delete, and reset

**Files:**

- Create: `src/prompt/registerPromptCommands.ts`
- Modify: `package.json`
- Modify: `src/extension.ts`
- Test: `src/test/suite/promptManager.test.ts`
- Test: `src/test/suite/extension.integration.test.ts`

- [ ] **Step 1: Extend the existing tests with command registration expectations**

Add coverage for:

- `promptQueue.copyItem`
- `promptQueue.toggleUsed`
- `promptQueue.moveItemUp`
- `promptQueue.moveItemDown`
- `promptQueue.deleteItem`
- `promptQueue.resetAllUsed`

- [ ] **Step 2: Run the affected tests and verify failure**

Run: `npm run test:unit -- src/test/suite/promptManager.test.ts && npm run test:integration`
Expected: command-related checks fail because handlers are not registered.

- [ ] **Step 3: Implement command registration**

`registerPromptCommands.ts` should wire command ids to `PromptManager` mutations and call `promptTreeProvider.refresh()` after success.

In `package.json`, add command titles and item/view menu contributions for the native tree.

- [ ] **Step 4: Re-run the command-related tests**

Run: `npm run test:unit -- src/test/suite/promptManager.test.ts && npm run test:integration`
Expected: PASS

- [ ] **Step 5: Commit the command layer**

```bash
git add package.json src/prompt/registerPromptCommands.ts src/extension.ts src/test/suite/promptManager.test.ts src/test/suite/extension.integration.test.ts
git commit -m "feat: add PromptQueue command handlers"
```

## Chunk 3: Editing, Import UX, and Verification

### Task 7: Add untitled-editor workflows for create and edit

**Files:**

- Create: `src/prompt/promptEditor.ts`
- Modify: `src/prompt/promptManager.ts`
- Modify: `src/prompt/registerPromptCommands.ts`
- Modify: `package.json`
- Test: `src/test/suite/promptManager.test.ts`

- [ ] **Step 1: Write failing tests for editor draft parsing**

Cover:

- empty `Title:` produces `undefined`
- text below `---` is preserved as multiline content
- empty content rejects save

- [ ] **Step 2: Run the targeted tests and verify failure**

Run: `npm run test:unit -- src/test/suite/promptManager.test.ts`
Expected: fail because editor draft parsing and create/update flows do not exist.

- [ ] **Step 3: Implement `PromptEditor`**

Responsibilities:

- open untitled documents for add/edit
- remember draft metadata by document URI
- parse the active editor on `promptQueue.saveItem`

Template:

```text
Title: optional title here

---
prompt body here
```

`PromptManager` should gain:

- `createItem(draft: PromptDraft): Promise<void>`
- `updateItem(id: string, draft: PromptDraft): Promise<void>`

- [ ] **Step 4: Re-run the draft tests**

Run: `npm run test:unit -- src/test/suite/promptManager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the editor workflow**

```bash
git add package.json src/prompt/promptEditor.ts src/prompt/promptManager.ts src/prompt/registerPromptCommands.ts src/test/suite/promptManager.test.ts
git commit -m "feat: add PromptQueue item editor workflow"
```

### Task 8: Add bulk import command flow for selection, editor, and clipboard

**Files:**

- Modify: `src/prompt/registerPromptCommands.ts`
- Modify: `src/prompt/promptManager.ts`
- Modify: `package.json`
- Test: `src/test/suite/promptManager.test.ts`
- Test: `src/test/suite/extension.integration.test.ts`

- [ ] **Step 1: Add failing tests for import source and mode handling**

Cover:

- append import from raw text
- replace import from raw text
- empty input shows an error and does not mutate state
- zero parsed items shows an error

- [ ] **Step 2: Run the relevant tests and confirm failure**

Run: `npm run test:unit -- src/test/suite/promptManager.test.ts && npm run test:integration`
Expected: import-related checks fail.

- [ ] **Step 3: Implement the import command**

Flow:

1. Quick pick source: selection / current document / clipboard
2. Read text from that source
3. Quick pick mode: append / replace
4. Call `promptManager.importText()`
5. Refresh tree and show a summary notification

Register:

- `promptQueue.bulkImport`

Keep the three data sources inside the command handler; do not create three separate user-facing commands in the MVP.

- [ ] **Step 4: Re-run the import tests**

Run: `npm run test:unit -- src/test/suite/promptManager.test.ts && npm run test:integration`
Expected: PASS

- [ ] **Step 5: Commit the import flow**

```bash
git add package.json src/prompt/registerPromptCommands.ts src/prompt/promptManager.ts src/test/suite/promptManager.test.ts src/test/suite/extension.integration.test.ts
git commit -m "feat: add PromptQueue bulk import flow"
```

### Task 9: Run end-to-end verification and tighten packaging

**Files:**

- Modify: `.gitignore`
- Modify: `.vscodeignore`
- Modify: `package.json`

- [ ] **Step 1: Run the full automated test suite**

Run: `npm test`
Expected: all unit and integration tests pass.

- [ ] **Step 2: Launch a manual extension smoke test**

Run: `code --extensionDevelopmentPath "$(pwd)"`

Manual checks:

- add an item through the untitled editor flow
- copy an item and verify it flips to `已使用`
- toggle the used state back
- move an item up and down
- drag one item onto another to reorder
- bulk import three prompts using `-*-` and `-*- title`
- confirm `WorkSpace/PromptQueue/prompts.json` is created

- [ ] **Step 3: Tighten packaging inputs**

Update `.vscodeignore` so tests, temporary output, and `WorkSpace/PromptQueue/` are excluded from packaged builds. Update `.gitignore` only if execution introduced additional generated directories.

- [ ] **Step 4: Re-run compile and tests after packaging changes**

Run: `npm run compile && npm test`
Expected: PASS

- [ ] **Step 5: Commit the verified MVP**

```bash
git add .gitignore .vscodeignore package.json
git add src
git commit -m "feat: implement PromptQueue MVP"
```

## Notes for Execution

- Keep command handlers thin. Business rules belong in `PromptManager`, parsing belongs in `importParser`, and filesystem logic belongs in `PromptStore`.
- If VS Code drag-and-drop proves flaky, keep the button-based `move up` / `move down` path working first and treat drag/drop as the last behavior in Chunk 2.
- Do not add search, tags, grouping, sync, or webviews in this MVP.
