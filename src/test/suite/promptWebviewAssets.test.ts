import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

async function readAsset(relativePath: string): Promise<string> {
  const filePath = path.resolve(__dirname, '../../../', relativePath);
  return fs.readFile(filePath, 'utf8');
}

describe('PromptQueue webview assets', () => {
  it('does not render the removed status summary block', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).not.toContain('renderStatus()');
  });

  it('renders used cards with strong completion styling', async () => {
    const css = await readAsset('media/promptqueue-view.css');

    expect(css).toContain('.pq-card-used .pq-card-title');
    expect(css).toContain('text-decoration: line-through');
    expect(css).toContain('.pq-card-used .pq-card-body');
    expect(css).toContain('display: none');
    expect(css).toContain('.pq-dot-used');
    expect(css).toContain('var(--pq-danger)');
  });

  it('uses denser card spacing and shorter preview length', async () => {
    const css = await readAsset('media/promptqueue-view.css');

    expect(css).not.toContain('padding: 16px 14px 16px 12px;');
    expect(css).toContain('-webkit-line-clamp: 2');
  });

  it('closes the menu on escape and scroll', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain("window.addEventListener('keydown'");
    expect(script).toContain('Escape');
    expect(script).toContain("window.addEventListener('scroll'");
  });

  it('does not close drawers from backdrop clicks and keeps escape support', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('<div class="pq-backdrop pq-backdrop-open">');
    expect(script).toContain('<button class="pq-chip pq-chip-ghost" data-action="close-panel">');
    expect(script).toContain("ui.panel = null");
    expect(script).toContain('Escape');
  });

  it('avoids hard-coded black surfaces for toast and context menu', async () => {
    const css = await readAsset('media/promptqueue-view.css');

    expect(css).not.toContain('rgba(24, 24, 27, 0.96)');
    expect(css).toContain('--pq-overlay');
  });

  it('uses a pure solid sidebar background without color overlays', async () => {
    const css = await readAsset('media/promptqueue-view.css');

    expect(css).toContain('background: var(--pq-bg);');
    expect(css).not.toContain('radial-gradient(');
  });
});
