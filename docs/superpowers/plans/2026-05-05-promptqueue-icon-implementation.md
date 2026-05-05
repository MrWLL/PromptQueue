# PromptQueue Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace PromptQueue's marketplace and activity bar icons with the approved stacked-card icon system, and make the marketplace PNG reproducible from a maintained SVG source.

**Architecture:** Keep runtime extension behavior unchanged. Introduce a canonical marketplace source SVG plus a tiny Node export script that rasterizes it into the existing PNG path, while authoring a separate monochrome activity-bar SVG that stays theme-tintable in VS Code. Lock the assets down with focused Vitest checks that read the manifest and icon files directly.

**Tech Stack:** SVG, PNG, Node.js, npm scripts, Sharp, Vitest

---

## File Structure

- Create `media/promptqueue-marketplace.svg` as the canonical vector source for the marketplace icon.
- Modify `media/promptqueue-marketplace.png` as the generated raster output consumed by `package.json`.
- Modify `media/promptqueue.svg` as the Activity Bar icon used by VS Code theme tinting.
- Create `scripts/export-marketplace-icon.mjs` as the reproducible SVG-to-PNG export helper.
- Modify `package.json` to expose the export command.
- Modify `package-lock.json` to record the added asset-export dependency.
- Create `src/test/suite/promptIconAssets.test.ts` to regression-test the icon source, generated PNG, and export wiring.

## Task 1: Add A Reproducible Marketplace Icon Pipeline

**Files:**
- Create: `src/test/suite/promptIconAssets.test.ts`
- Create: `media/promptqueue-marketplace.svg`
- Create: `scripts/export-marketplace-icon.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `media/promptqueue-marketplace.png`

- [ ] **Step 1: Write the failing icon asset regression test**

Create `src/test/suite/promptIconAssets.test.ts` with this full content:

```ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

function resolveRepoPath(relativePath: string): string {
  return path.resolve(__dirname, '../../../', relativePath);
}

async function readText(relativePath: string): Promise<string> {
  return fs.readFile(resolveRepoPath(relativePath), 'utf8');
}

async function readBinary(relativePath: string): Promise<Buffer> {
  return fs.readFile(resolveRepoPath(relativePath));
}

describe('PromptQueue icon assets', () => {
  it('defines a reproducible marketplace export command', async () => {
    const raw = await readText('package.json');
    const manifest = JSON.parse(raw) as {
      icon?: string;
      scripts?: Record<string, string>;
    };

    expect(manifest.icon).toBe('media/promptqueue-marketplace.png');
    expect(manifest.scripts?.['icons:export']).toBe(
      'node scripts/export-marketplace-icon.mjs',
    );
  });

  it('keeps the marketplace icon source as vector artwork', async () => {
    const svg = await readText('media/promptqueue-marketplace.svg');

    expect(svg).toContain('viewBox="0 0 128 128"');
    expect(svg).toContain('#2563EB');
    expect(svg).toContain('#173A8F');
    expect(svg).toContain('#7DD3FC');
    expect(svg).toContain('#DBEAFE');
  });

  it('keeps the generated marketplace icon as a non-trivial PNG', async () => {
    const png = await readBinary('media/promptqueue-marketplace.png');

    expect(Array.from(png.subarray(0, 8))).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);
    expect(png.length).toBeGreaterThan(1000);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptIconAssets.test.ts
```

Expected:
- FAIL because `package.json` does not yet expose `icons:export`
- FAIL because `media/promptqueue-marketplace.svg` does not exist yet
- FAIL because the current PNG is too small to satisfy the new regression guard

- [ ] **Step 3: Install the PNG export dependency and expose the script**

Run:

```bash
npm install --save-dev sharp
```

Then update the `scripts` block in `package.json` so it includes:

```json
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p .",
    "icons:export": "node scripts/export-marketplace-icon.mjs",
    "playground": "node scripts/serve-playground.mjs",
    "test:unit": "vitest run --passWithNoTests --config vitest.config.ts",
    "test:integration": "npm run compile && node ./out/test/runTest.js",
    "test": "npm run test:unit && npm run test:integration"
  }
```

Expected:
- `package.json` contains the new `icons:export` command
- `package-lock.json` records `sharp` under `devDependencies`

- [ ] **Step 4: Add the export script**

Create `scripts/export-marketplace-icon.mjs` with this full content:

```js
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const inputPath = path.join(repoRoot, 'media', 'promptqueue-marketplace.svg');
const outputPath = path.join(repoRoot, 'media', 'promptqueue-marketplace.png');

await sharp(inputPath)
  .resize(256, 256, { fit: 'contain' })
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

console.log(`Wrote ${outputPath}`);
```

- [ ] **Step 5: Add the initial marketplace source SVG and export the PNG**

Create `media/promptqueue-marketplace.svg` with this full content:

```svg
<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="12" y="12" width="104" height="104" rx="26" fill="#2563EB"/>
  <rect x="35" y="28" width="48" height="36" rx="11" fill="#173A8F"/>
  <rect x="45" y="39" width="48" height="36" rx="11" fill="#1D4ED8"/>
  <rect x="28" y="52" width="72" height="48" rx="14" fill="#F8FBFF"/>
  <rect x="40" y="66" width="34" height="8" rx="4" fill="#2563EB"/>
  <rect x="80" y="66" width="12" height="8" rx="4" fill="#7DD3FC"/>
  <rect x="40" y="81" width="44" height="6" rx="3" fill="#DBEAFE"/>
  <rect x="40" y="93" width="30" height="6" rx="3" fill="#DBEAFE"/>
</svg>
```

Run:

```bash
npm run icons:export
```

Expected:
- stdout contains `Wrote`
- `media/promptqueue-marketplace.png` is regenerated from the SVG source

- [ ] **Step 6: Re-run the focused test and verify GREEN**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptIconAssets.test.ts
```

Expected:
- PASS

- [ ] **Step 7: Commit the marketplace pipeline slice**

Run:

```bash
git add src/test/suite/promptIconAssets.test.ts media/promptqueue-marketplace.svg media/promptqueue-marketplace.png scripts/export-marketplace-icon.mjs package.json package-lock.json
git commit -m "feat: add promptqueue icon export pipeline"
```

Expected:
- Commit succeeds with only the marketplace icon pipeline files staged

## Task 2: Finalize The Approved Icon Assets

**Files:**
- Modify: `src/test/suite/promptIconAssets.test.ts`
- Modify: `media/promptqueue-marketplace.svg`
- Modify: `media/promptqueue-marketplace.png`
- Modify: `media/promptqueue.svg`

- [ ] **Step 1: Extend the asset regression test for the final icon semantics**

Append these two test cases to `src/test/suite/promptIconAssets.test.ts` inside the existing `describe('PromptQueue icon assets', ...)` block:

```ts
  it('keeps the activity bar icon theme-tintable and minimal', async () => {
    const svg = await readText('media/promptqueue.svg');

    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain('stroke="currentColor"');
    expect(svg.match(/<rect /g)?.length).toBe(3);
    expect(svg.match(/<path /g)?.length).toBe(2);
  });

  it('keeps the marketplace source aligned with the stacked-card composition', async () => {
    const svg = await readText('media/promptqueue-marketplace.svg');

    expect(svg).toContain('fill="#F8FBFF"');
    expect(svg).toContain('rx="26"');
    expect(svg.match(/<rect /g)?.length).toBeGreaterThanOrEqual(8);
  });
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptIconAssets.test.ts
```

Expected:
- FAIL because the current `media/promptqueue.svg` still contains the older blue filled artwork
- FAIL if the marketplace source SVG does not yet match the approved final composition exactly

- [ ] **Step 3: Replace the activity-bar SVG and refine the marketplace source SVG to the approved final artwork**

Replace `media/promptqueue.svg` with this full content:

```svg
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="7.25" y="4.25" width="10.5" height="7.5" rx="1.75" stroke="currentColor" stroke-width="1.75"/>
  <rect x="5.25" y="8.25" width="10.5" height="7.5" rx="1.75" stroke="currentColor" stroke-width="1.75"/>
  <rect x="3.25" y="12.25" width="10.5" height="7.5" rx="1.75" stroke="currentColor" stroke-width="1.75"/>
  <path d="M6.5 15.5H11.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
  <path d="M6.5 18H9.75" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
</svg>
```

Replace `media/promptqueue-marketplace.svg` with this full content:

```svg
<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="12" y="12" width="104" height="104" rx="26" fill="#2563EB"/>
  <rect x="35" y="28" width="48" height="36" rx="11" fill="#173A8F"/>
  <rect x="45" y="39" width="48" height="36" rx="11" fill="#1D4ED8"/>
  <rect x="28" y="52" width="72" height="48" rx="14" fill="#F8FBFF"/>
  <rect x="40" y="66" width="34" height="8" rx="4" fill="#2563EB"/>
  <rect x="80" y="66" width="12" height="8" rx="4" fill="#7DD3FC"/>
  <rect x="40" y="81" width="44" height="6" rx="3" fill="#DBEAFE"/>
  <rect x="40" y="93" width="30" height="6" rx="3" fill="#DBEAFE"/>
</svg>
```

- [ ] **Step 4: Re-export the marketplace PNG from the refined SVG source**

Run:

```bash
npm run icons:export
```

Expected:
- stdout contains `Wrote`
- `media/promptqueue-marketplace.png` timestamp updates

- [ ] **Step 5: Re-run the focused test and verify GREEN**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptIconAssets.test.ts
```

Expected:
- PASS

- [ ] **Step 6: Commit the final icon asset slice**

Run:

```bash
git add src/test/suite/promptIconAssets.test.ts media/promptqueue.svg media/promptqueue-marketplace.svg media/promptqueue-marketplace.png
git commit -m "feat: redesign promptqueue extension icons"
```

Expected:
- Commit succeeds with the final icon asset files staged

## Task 3: Run Final Verification

**Files:**
- Modify: `src/test/suite/promptIconAssets.test.ts`
- Modify: `media/promptqueue-marketplace.svg`
- Modify: `media/promptqueue-marketplace.png`
- Modify: `media/promptqueue.svg`
- Modify: `scripts/export-marketplace-icon.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Run the focused icon regression tests**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptIconAssets.test.ts
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

- [ ] **Step 3: Run the TypeScript compile**

Run:

```bash
npm run compile
```

Expected:
- PASS

- [ ] **Step 4: Check the worktree before handoff**

Run:

```bash
git status --short
```

Expected:
- clean worktree if both task commits succeeded
- or only the intended icon files remain if commits were intentionally deferred
