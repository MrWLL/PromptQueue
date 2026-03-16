# PromptQueue Webview Polish Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten the PromptQueue sidebar webview so it fits more items, shows used state clearly, and uses better toast/menu behavior.

**Architecture:** Keep the host/provider layer unchanged and limit the work to the frontend webview assets plus small regression tests that read those assets. This keeps the polish isolated from persistence and command logic.

**Tech Stack:** TypeScript, Vitest, plain browser JavaScript, CSS

---

## Chunk 1: Asset Regression Tests

### Task 1: Add failing tests that describe the new sidebar behavior

**Files:**
- Create: `src/test/suite/promptWebviewAssets.test.ts`
- Modify: `media/promptqueue-view.css`
- Modify: `media/promptqueue-view.js`

- [ ] **Step 1: Write failing asset regression tests**

Cover:
- the root render path no longer injects the status summary block
- used cards hide the body and strike the title
- used dots use the danger color
- the script closes menus on `Esc`
- the script closes menus on scroll
- toast and menu styling are not hard-coded pure black

- [ ] **Step 2: Run the focused asset test and verify RED**

Run:
`npm run test:unit -- src/test/suite/promptWebviewAssets.test.ts`

Expected:
- FAIL because the current assets still render the summary block and still use the older toast/menu behavior

- [ ] **Step 3: Implement the minimal CSS/JS polish**

Targets:
- `media/promptqueue-view.css`
- `media/promptqueue-view.js`

- [ ] **Step 4: Re-run the focused asset test and verify GREEN**

Run:
`npm run test:unit -- src/test/suite/promptWebviewAssets.test.ts`

Expected:
- PASS

## Chunk 2: Verification

### Task 2: Verify the sidebar still builds cleanly

**Files:**
- Modify: `media/promptqueue-view.css`
- Modify: `media/promptqueue-view.js`

- [ ] **Step 1: Run the full unit suite**

Run:
`npm run test:unit`

Expected:
- PASS

- [ ] **Step 2: Run TypeScript compile**

Run:
`npm run compile`

Expected:
- PASS

- [ ] **Step 3: Check webview script syntax directly**

Run:
`node --check media/promptqueue-view.js`

Expected:
- PASS
