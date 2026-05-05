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
    expect(css).toContain('.pq-card-used .pq-card-rail');
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
    expect(script).toContain("window.addEventListener(");
    expect(script).toContain("'scroll'");
  });

  it('does not close drawers from backdrop clicks and keeps escape support', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('<div class="pq-backdrop pq-backdrop-open">');
    expect(script).toContain('<button class="pq-icon-btn pq-drawer-close" data-action="close-panel">');
    expect(script).toContain("ui.panel = null");
    expect(script).toContain('Escape');
  });

  it('preserves drawer input drafts across rerenders', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('panelDraft');
    expect(script).toContain("if (panel.type === 'edit')");
    expect(script).toContain("if (panel.type === 'settings')");
    expect(script).toContain("if (panel.type === 'import')");
    expect(script).toContain("content: ''");
    expect(script).toContain("title: ''");
    expect(script).toContain("importText: ''");
    expect(script).toContain("root.addEventListener('input'");
    expect(script).toContain("target.closest('.pq-drawer')");
  });

  it('uses the explicit untitled label instead of deriving a title from content', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain("title: ui.state.strings.status.untitled || 'Untitled'");
    expect(script).toContain('body: content');
    expect(script).not.toContain("const title = lines[0] || ui.state.strings.status.untitled || 'Untitled';");
  });

  it('does not depend on browser confirm dialogs for destructive actions', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).not.toContain('window.confirm(');
  });

  it('avoids hard-coded black surfaces for toast and context menu', async () => {
    const css = await readAsset('media/promptqueue-view.css');

    expect(css).not.toContain('rgba(24, 24, 27, 0.96)');
    expect(css).toContain('--pq-overlay');
  });

  it('uses a pure solid sidebar background without color overlays', async () => {
    const css = await readAsset('media/promptqueue-view.css');

    expect(css).toContain('background: var(--pq-surface-base);');
    expect(css).not.toContain('radial-gradient(');
  });

  it('renders quick-run controls in the toolbar and settings drawer', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain("buttonMarkup('quick-run'");
    expect(script).toContain('quickRunEnabled');
    expect(script).toContain('quickRunCommand');
    expect(script).toContain("type: 'quickRun'");
  });

  it('queues auto-scroll only on first state and visibility changes', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain("document.addEventListener('visibilitychange'");
    expect(script).toContain('item.used === false');
    expect(script).toContain("scrollIntoView({ block: 'center' })");
    expect(script).toContain("scrollIntoView({ block: 'end' })");
    expect(script).toContain('window.requestAnimationFrame');
    expect(script).not.toContain('previousSignature !== nextSignature');
  });

  it('renders a header and bottom action dock instead of the old toolbar shell', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('function renderHeader()');
    expect(script).toContain('function renderActionDock()');
    expect(script).toContain('function renderQueueSummary()');
    expect(script).toContain("'<section class=\"pq-header\">'");
    expect(script).toContain("'<section class=\"pq-action-dock\">'");
    expect(script).not.toContain("'<section class=\"pq-toolbar\">'");
  });

  it('routes low-frequency queue actions through the global more menu', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain("'open-more-actions'");
    expect(script).toContain("kind: 'global'");
    expect(script).toContain('strings.actions.more');
    expect(script).toContain("'restore-last-deleted'");
    expect(script).not.toContain("buttonMarkup('delete-all'");
  });

  it('renders prompt items with a status rail and trailing action trigger', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('pq-card-rail');
    expect(script).toContain('pq-card-main');
    expect(script).toContain('data-action="open-item-menu"');
    expect(script).toContain('pq-card-menu-trigger');
  });

  it('styles prompt items as flatter rows instead of lifted cards', async () => {
    const css = await readAsset('media/promptqueue-view.css');

    expect(css).toContain('.pq-card-rail');
    expect(css).toContain('.pq-card-menu-trigger');
    expect(css).toContain('.pq-card:hover .pq-card-menu-trigger');
    expect(css).toContain('.pq-card-used .pq-card-rail');
  });

  it('defines semantic surface tokens and a dedicated dock surface', async () => {
    const css = await readAsset('media/promptqueue-view.css');

    expect(css).toContain('--pq-surface-base');
    expect(css).toContain('--pq-surface-panel');
    expect(css).toContain('--pq-surface-dock');
    expect(css).toContain('--pq-border-subtle');
    expect(css).toContain('.pq-action-dock');
  });

  it('adds a next-target pulse after auto-scroll', async () => {
    const script = await readAsset('media/promptqueue-view.js');
    const css = await readAsset('media/promptqueue-view.css');

    expect(script).toContain('function pulseNextTarget(card)');
    expect(script).toContain("card.classList.add('pq-card-next-target')");
    expect(css).toContain('@keyframes pq-next-target-pulse');
    expect(css).toContain('.pq-card-next-target');
  });

  it('uses sticky drawer actions for the unified drawer shell', async () => {
    const css = await readAsset('media/promptqueue-view.css');

    expect(css).toContain('.pq-drawer-actions');
    expect(css).toContain('position: sticky');
    expect(css).toContain('bottom: 0');
  });
});
