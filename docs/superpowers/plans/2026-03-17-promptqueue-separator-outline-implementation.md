# PromptQueue Separator Highlight and Outline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PromptQueue-style `-*-` separator highlighting and built-in Outline entries for all open plaintext and Markdown documents, with independent VS Code settings for each capability.

**Architecture:** Introduce a shared editor-side parser that scans documents for `-*-` separator sections and caches results by document version. Build a `DocumentSymbolProvider` and a visible-editor highlighter on top of that parser, then wire both into extension activation and the extension manifest so they can be toggled independently through VS Code settings.

**Tech Stack:** TypeScript, VS Code extension API, Vitest, @vscode/test-electron

---

## Chunk 1: Shared Parser and Config Surface

### Task 1: Add failing parser and config tests

**Files:**
- Create: `src/test/suite/promptSeparatorParser.test.ts`
- Modify: `src/test/suite/manifest.test.ts`
- Modify: `src/prompt/promptConfig.ts`
- Create: `src/editor/promptSeparatorParser.ts`

- [ ] **Step 1: Write the failing parser tests**

```ts
it('parses explicit separator titles with and without a space', () => {
  const sections = parsePromptSeparatorSections('-*-One\nA\n-*- Two\nB', {
    untitledLabel: '<无标题>',
    maxFallbackTitleLength: 24,
  });

  expect(sections.map((section) => section.displayTitle)).toEqual([
    'One',
    'Two',
  ]);
});

it('uses the next non-empty line as the fallback title when the separator has no title', () => {
  const sections = parsePromptSeparatorSections('-*-\n\n正文第一行\n正文第二行', {
    untitledLabel: '<无标题>',
    maxFallbackTitleLength: 24,
  });

  expect(sections[0]?.displayTitle).toBe('正文第一行');
});

it('falls back to the untitled label when no content exists before the next separator or file end', () => {
  const sections = parsePromptSeparatorSections('-*-\n\n-*-Next\nBody', {
    untitledLabel: '<无标题>',
    maxFallbackTitleLength: 24,
  });

  expect(sections[0]?.displayTitle).toBe('<无标题>');
});

it('returns section line ranges that stop before the next separator', () => {
  const sections = parsePromptSeparatorSections('-*- First\nA\nB\n-*- Second\nC', {
    untitledLabel: '<无标题>',
    maxFallbackTitleLength: 24,
  });

  expect(sections.map(({ startLine, endLine }) => [startLine, endLine])).toEqual([
    [0, 2],
    [3, 4],
  ]);
});
```

- [ ] **Step 2: Run the focused parser test and verify it fails**

Run: `npm run test:unit -- src/test/suite/promptSeparatorParser.test.ts`
Expected: FAIL because `promptSeparatorParser.ts` does not exist yet

- [ ] **Step 3: Write the failing manifest expectation for the new editor settings**

```ts
expect(manifest.contributes?.configuration).toMatchObject({
  properties: {
    'promptQueue.separatorHighlight.enabled': {
      default: true,
      scope: 'window',
      type: 'boolean',
    },
    'promptQueue.separatorOutline.enabled': {
      default: true,
      scope: 'window',
      type: 'boolean',
    },
  },
});
```

- [ ] **Step 4: Run the focused manifest test and verify it fails**

Run: `npm run test:unit -- src/test/suite/manifest.test.ts`
Expected: FAIL because the new settings are not contributed yet

- [ ] **Step 5: Implement the parser and config defaults**

Targets:
- `src/editor/promptSeparatorParser.ts`
- `src/prompt/promptConfig.ts`

Implementation notes:
- keep the parser pure and independent from `vscode` imports
- return one section per separator with `displayTitle`, `startLine`, `endLine`, and `separatorLineText`
- trim titles after the `-*-` marker so `-*-new` and `-*- new` both become `new`
- skip blank lines when deriving fallback titles
- truncate fallback titles to a fixed maximum length with a trailing ellipsis when needed
- add `normalizePromptQueueSeparatorHighlightEnabled()` and `normalizePromptQueueSeparatorOutlineEnabled()` helpers in `promptConfig.ts`

- [ ] **Step 6: Re-run the focused tests**

Run:
- `npm run test:unit -- src/test/suite/promptSeparatorParser.test.ts`
- `npm run test:unit -- src/test/suite/manifest.test.ts`

Expected: parser test PASS, manifest test still FAIL until manifest work lands in a later chunk

- [ ] **Step 7: Commit the parser groundwork**

```bash
git add src/editor/promptSeparatorParser.ts src/prompt/promptConfig.ts src/test/suite/promptSeparatorParser.test.ts src/test/suite/manifest.test.ts
git commit -m "feat: add PromptQueue separator parser"
```

## Chunk 2: Outline Provider and Extension Wiring

### Task 2: Add failing Outline and activation tests

**Files:**
- Create: `src/test/suite/promptSeparatorOutlineProvider.test.ts`
- Modify: `src/test/suite/extension.test.ts`
- Modify: `src/test/mocks/vscode.ts`
- Create: `src/editor/promptSeparatorOutlineProvider.ts`
- Modify: `src/extension.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing Outline provider tests**

```ts
it('returns one flat DocumentSymbol per parsed separator section', () => {
  const provider = new PromptSeparatorOutlineProvider({
    getEnabled: () => true,
    getUntitledLabel: () => '<无标题>',
  });

  const symbols = provider.provideDocumentSymbols(createDocument('-*- One\nBody\n-*-\n\nNext line'));

  expect(symbols?.map((symbol) => symbol.name)).toEqual(['One', 'Next line']);
});

it('returns no symbols when the Outline setting is disabled', () => {
  const provider = new PromptSeparatorOutlineProvider({
    getEnabled: () => false,
    getUntitledLabel: () => '<无标题>',
  });

  expect(provider.provideDocumentSymbols(createDocument('-*- One\nBody'))).toEqual([]);
});
```

- [ ] **Step 2: Run the focused Outline test and verify it fails**

Run: `npm run test:unit -- src/test/suite/promptSeparatorOutlineProvider.test.ts`
Expected: FAIL because the provider and supporting VS Code mocks do not exist yet

- [ ] **Step 3: Write the failing activation test for document symbol registration**

```ts
expect(vscode.languages.registerDocumentSymbolProvider).toHaveBeenCalledWith(
  [
    { language: 'plaintext' },
    { language: 'markdown' },
  ],
  expect.any(Object),
);
```

- [ ] **Step 4: Run the focused activation test and verify it fails**

Run: `npm run test:unit -- src/test/suite/extension.test.ts`
Expected: FAIL because activation does not register a symbol provider yet

- [ ] **Step 5: Implement the Outline provider, mocks, manifest settings, and activation wiring**

Targets:
- `src/editor/promptSeparatorOutlineProvider.ts`
- `src/extension.ts`
- `src/test/mocks/vscode.ts`
- `package.json`

Implementation notes:
- extend the VS Code mock with `Position`, `Range`, `DocumentSymbol`, `SymbolKind`, `languages.registerDocumentSymbolProvider`, and configuration getters for the new boolean settings
- register one `DocumentSymbolProvider` for `markdown` and `plaintext`
- use `promptQueue.uiLanguage` to choose the untitled label via existing localization strings
- expose the two new settings in `package.json` with `window` scope and default `true`

- [ ] **Step 6: Re-run the focused tests**

Run:
- `npm run test:unit -- src/test/suite/promptSeparatorOutlineProvider.test.ts`
- `npm run test:unit -- src/test/suite/extension.test.ts`
- `npm run test:unit -- src/test/suite/manifest.test.ts`

Expected: PASS

- [ ] **Step 7: Commit the Outline wiring**

```bash
git add package.json src/editor/promptSeparatorOutlineProvider.ts src/extension.ts src/test/mocks/vscode.ts src/test/suite/promptSeparatorOutlineProvider.test.ts src/test/suite/extension.test.ts src/test/suite/manifest.test.ts
git commit -m "feat: add PromptQueue separator outline provider"
```

## Chunk 3: Editor Highlighting and Refresh Lifecycle

### Task 3: Add failing highlight and refresh tests

**Files:**
- Create: `src/test/suite/promptSeparatorHighlighter.test.ts`
- Modify: `src/test/suite/extension.test.ts`
- Modify: `src/test/mocks/vscode.ts`
- Create: `src/editor/promptSeparatorHighlighter.ts`
- Modify: `src/extension.ts`

- [ ] **Step 1: Write the failing highlighter tests**

```ts
it('decorates only separator lines in visible editors when highlighting is enabled', () => {
  const editor = createTextEditor('-*- One\nBody\n-*- Two\nMore');
  const highlighter = new PromptSeparatorHighlighter({
    getEnabled: () => true,
    getUntitledLabel: () => '<无标题>',
  });

  highlighter.refreshVisibleEditors([editor]);

  expect(editor.setDecorations).toHaveBeenCalledWith(
    expect.anything(),
    expect.arrayContaining([
      expect.objectContaining({ range: expect.objectContaining({ start: expect.objectContaining({ line: 0 }) }) }),
      expect.objectContaining({ range: expect.objectContaining({ start: expect.objectContaining({ line: 2 }) }) }),
    ]),
  );
});

it('clears decorations when highlighting is disabled', () => {
  const editor = createTextEditor('-*- One\nBody');
  const highlighter = new PromptSeparatorHighlighter({
    getEnabled: () => false,
    getUntitledLabel: () => '<无标题>',
  });

  highlighter.refreshVisibleEditors([editor]);

  expect(editor.setDecorations).toHaveBeenCalledWith(expect.anything(), []);
});
```

- [ ] **Step 2: Run the focused highlight test and verify it fails**

Run: `npm run test:unit -- src/test/suite/promptSeparatorHighlighter.test.ts`
Expected: FAIL because the highlighter and decoration mocks do not exist yet

- [ ] **Step 3: Write the failing activation test for decoration refresh hooks**

```ts
expect(vscode.window.createTextEditorDecorationType).toHaveBeenCalledTimes(1);
expect(vscode.window.onDidChangeVisibleTextEditors).toHaveBeenCalled();
expect(vscode.window.onDidChangeActiveTextEditor).toHaveBeenCalled();
expect(vscode.workspace.onDidChangeTextDocument).toHaveBeenCalled();
```

- [ ] **Step 4: Run the focused activation test and verify it fails**

Run: `npm run test:unit -- src/test/suite/extension.test.ts`
Expected: FAIL because highlight lifecycle hooks are not wired yet

- [ ] **Step 5: Implement the highlighter and refresh subscriptions**

Targets:
- `src/editor/promptSeparatorHighlighter.ts`
- `src/extension.ts`
- `src/test/mocks/vscode.ts`

Implementation notes:
- create one decoration type with a solid neutral background plus a thin left border
- use `isWholeLine: true`
- refresh only visible editors whose documents are `plaintext` or `markdown`
- clear decorations immediately when the setting is off
- subscribe to visible-editor, active-editor, text-document, and configuration changes

- [ ] **Step 6: Re-run the focused tests**

Run:
- `npm run test:unit -- src/test/suite/promptSeparatorHighlighter.test.ts`
- `npm run test:unit -- src/test/suite/extension.test.ts`

Expected: PASS

- [ ] **Step 7: Commit the highlight lifecycle**

```bash
git add src/editor/promptSeparatorHighlighter.ts src/extension.ts src/test/mocks/vscode.ts src/test/suite/promptSeparatorHighlighter.test.ts src/test/suite/extension.test.ts
git commit -m "feat: add PromptQueue separator highlighting"
```

## Chunk 4: Full Verification and Manual Sanity Check

### Task 4: Verify the feature end to end

**Files:**
- Modify: `docs/superpowers/specs/2026-03-17-promptqueue-separator-outline-design.md`
- Modify: `docs/superpowers/plans/2026-03-17-promptqueue-separator-outline-implementation.md`

- [ ] **Step 1: Run the full unit suite**

Run: `npm run test:unit`
Expected: PASS with all unit tests green

- [ ] **Step 2: Run the integration suite**

Run: `npm run test:integration`
Expected: PASS with the extension smoke test green

- [ ] **Step 3: Manually sanity-check the feature in Extension Development Host**

Run:
`code --extensionDevelopmentPath="<worktree>" "<worktree>"`

Check:
- open a `txt` file and confirm `-*-` lines are highlighted
- open a `md` file and confirm `-*-` sections appear in Outline alongside normal headings
- toggle `promptQueue.separatorHighlight.enabled` and verify highlight appears/disappears immediately
- toggle `promptQueue.separatorOutline.enabled` and verify Outline entries appear/disappear immediately
- confirm `-*-new` displays `new` and bare `-*-` uses the next non-empty line snippet

- [ ] **Step 4: Update docs only if implementation diverges from the approved design**

Adjust:
- `docs/superpowers/specs/2026-03-17-promptqueue-separator-outline-design.md`
- `docs/superpowers/plans/2026-03-17-promptqueue-separator-outline-implementation.md`

- [ ] **Step 5: Commit the verified final state**

```bash
git add docs/superpowers/specs/2026-03-17-promptqueue-separator-outline-design.md docs/superpowers/plans/2026-03-17-promptqueue-separator-outline-implementation.md
git commit -m "docs: record PromptQueue separator editor support"
```
