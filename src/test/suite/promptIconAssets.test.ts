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
