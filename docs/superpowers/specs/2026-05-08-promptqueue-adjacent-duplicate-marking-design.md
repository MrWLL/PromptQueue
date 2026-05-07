# PromptQueue Adjacent Duplicate Marking

## Status

Approved in conversation on 2026-05-08.

## Scope

This change adds duplicate-content marking to the PromptQueue webview list when two neighboring prompts have the same normalized content.

The scope includes:

- detecting adjacent duplicate prompt content in extension-side webview state construction
- marking both prompts in a matching adjacent pair
- rendering a duplicate badge and duplicate card styling in the webview only
- adding localized duplicate badge text for Chinese and English
- adding focused tests for duplicate detection and duplicate rendering

The scope does not include:

- changes to the native VS Code tree view
- changes to prompt storage format or saved prompt data
- non-adjacent duplicate searching across the whole list
- warnings, blocking flows, or copy restrictions

## Goals

- Make immediately repeated prompt content visible at a glance in the webview list.
- Keep duplicate detection derived from current list order and prompt content rather than persisted state.
- Preserve all existing prompt behaviors such as copy, edit, reorder, delete, and toggle-used.
- Keep the comparison rule predictable and narrow.

## Non-Goals

- Do not add a new stored `duplicate` field to `PromptItem`.
- Do not compare titles, timestamps, or `used` state.
- Do not flag duplicates that are separated by any different prompt.
- Do not introduce a settings toggle for this behavior.

## Recommended Approach

Use extension-side derived state in `PromptWebviewViewProvider` and let the webview render that state.

### Option 1: Provider-Side Derived Marking

Compute adjacent duplicate flags while building `PromptWebviewItem[]`, then pass the flags to the webview.

Pros:

- keeps comparison logic in one place
- avoids contaminating persisted prompt data
- makes the behavior easy to test through provider state tests

Cons:

- requires a small protocol extension

This is recommended.

### Option 2: Webview-Side Inline Comparison

Detect duplicates directly in `media/promptqueue-view.js` while rendering cards.

Pros:

- smaller immediate diff in TypeScript

Cons:

- pushes business rules into the asset script
- makes state-level tests weaker
- duplicates logic if another surface ever needs the same derived flag

This is not recommended.

### Option 3: Persist Duplicate State

Write duplicate flags into saved prompt items whenever prompts are added, edited, imported, deleted, or reordered.

Pros:

- none that justify the cost here

Cons:

- derived data can go stale
- increases mutation complexity
- creates unnecessary storage coupling

This is not recommended.

## Detection Rules

Duplicate marking uses these exact rules:

1. Compare prompt `content` only.
2. Normalize line endings from `\r\n` to `\n`.
3. Trim leading and trailing whitespace from the normalized content.
4. Compare each item only with the immediately previous item in the current list order.
5. When two adjacent items match, mark both items as duplicates.

Implications:

- matching titles are irrelevant
- a matching pair separated by any different item is not marked
- three or more consecutive matching items result in the whole consecutive block being marked

## UI Behavior

Duplicate marking appears only in the PromptQueue webview.

Each duplicate-marked card should:

- show a compact badge beside the title
- use localized badge text: `重复` for Chinese and `Duplicate` for English
- receive subtle warning styling so duplicate rows are easy to scan

Rules:

- duplicate marking is passive and informational only
- duplicate-marked cards remain fully clickable and editable
- duplicate marking remains visible even when a card is also in the `used` state
- no toast, modal, or context-menu action is added for duplicates

## Architecture

### State Shape

Extend `PromptWebviewItem` with a derived boolean field:

- `isAdjacentDuplicate?: boolean`

This field exists only in webview state and is never written to `PromptItem` storage.

### Detection Location

`PromptWebviewViewProvider.buildWebviewItems()` becomes the sole place that computes duplicate flags.

Recommended flow:

1. read items from `manager.getItems()`
2. normalize each item content for comparison
3. detect adjacent matches in order
4. emit `PromptWebviewItem[]` with `copyAgeLabel` and `isAdjacentDuplicate`

### Rendering

The webview renderer consumes the derived field and:

- adds a duplicate class on the card when `isAdjacentDuplicate` is true
- renders the duplicate badge beside the title

No extra message type or incremental sync path is needed because existing `postState()` refreshes already rebuild the full item list after edits, imports, deletions, and reorders.

## Implementation Boundaries

### Expected Files

- `src/prompt/promptWebviewProtocol.ts`
- `src/prompt/promptWebviewViewProvider.ts`
- `src/prompt/promptLocalization.ts`
- `media/promptqueue-view.js`
- `media/promptqueue-view.css`
- `src/test/suite/promptWebviewViewProvider.test.ts`
- `src/test/suite/promptWebviewAssets.test.ts`

### Files Out Of Scope

- `src/prompt/promptManager.ts`
- `src/prompt/promptStore.ts`
- `src/prompt/promptTreeProvider.ts`
- `src/prompt/promptTreeItem.ts`

## Testing Strategy

Follow test-first discipline for the implementation work.

Required coverage:

- provider-state test proving two adjacent prompts with equivalent normalized content both receive `isAdjacentDuplicate: true`
- provider-state test proving non-adjacent matching content is not marked
- provider-state test proving normalization treats `\r\n` and `\n` plus outer whitespace differences as equal
- asset test proving the webview script renders duplicate badge markup
- asset test proving the stylesheet defines duplicate card and badge styling

Regression expectations:

- existing used/copy-age behavior continues to work
- reorder, edit, import, and delete flows automatically recompute duplicate flags through ordinary state refresh

## Acceptance Criteria

This change is complete when:

- two neighboring prompts with equal normalized content are both marked in the webview
- prompts that only match non-adjacently are not marked
- duplicate marking survives reorder, edit, import, and delete operations through normal refreshes
- duplicate marking does not appear in the native tree view
- no duplicate state is written to persisted prompt data
- the badge text is localized in Chinese and English
