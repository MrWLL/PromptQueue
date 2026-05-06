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

  it('renders toast close controls and keeps toast bodies clickable', async () => {
    const script = await readAsset('media/promptqueue-view.js');
    const css = await readAsset('media/promptqueue-view.css');

    expect(script).toContain('function closeToast(toastId)');
    expect(script).toContain('data-action="close-toast"');
    expect(script).toContain("closeToast(actionTarget.getAttribute('data-toast-id'))");
    expect(script).toContain('window.setTimeout');
    expect(css).toContain('.pq-toast {');
    expect(css).toContain('pointer-events: auto');
    expect(css).toContain('.pq-toast-close');
  });

  it('uses a pure solid sidebar background without color overlays', async () => {
    const css = await readAsset('media/promptqueue-view.css');

    expect(css).toContain('background: var(--pq-surface-base);');
    expect(css).not.toContain('radial-gradient(');
  });

  it('renders quick-run controls in the header and settings drawer', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain("buttonMarkup('quick-run'");
    expect(script).toContain('quickRunAvailability');
    expect(script).toContain("ui.state.quickRunAvailability !== 'ready'");
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

  it('preserves the prompt list scroll position across ordinary rerenders', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('function getListElement()');
    expect(script).toContain('function captureListScrollTop()');
    expect(script).toContain('function restoreListScrollTop(scrollTop)');
    expect(script).toContain('const preservedScrollTop = captureListScrollTop();');
    expect(script).toContain('restoreListScrollTop(preservedScrollTop);');
  });

  it('lets explicit auto-scroll flows opt out of scroll restoration', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('if (ui.pendingAutoScroll)');
    expect(script).toContain("scrollIntoView({ block: 'center' })");
    expect(script).toContain("scrollIntoView({ block: 'end' })");
  });

  it('renders a pinned header and footer instead of the old action dock', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('function renderHeader()');
    expect(script).toContain('function renderFooter()');
    expect(script).toContain("'<section class=\"pq-header\">'");
    expect(script).toContain("'<footer class=\"pq-footer\">'");
    expect(script).not.toContain('function renderActionDock()');
  });

  it('keeps only add, settings, and quick run in the header', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain("buttonMarkup('open-add'");
    expect(script).toContain("buttonMarkup('open-settings'");
    expect(script).toContain("buttonMarkup('quick-run'");
    expect(script).not.toContain("'open-import'");
    expect(script).not.toContain("'open-more-actions'");
  });

  it('renders grouped settings sections for import, copy behavior, quick run, and data management', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('function renderSettingsSection(');
    expect(script).toContain('strings.sections.import');
    expect(script).toContain('strings.sections.copyBehavior');
    expect(script).toContain('strings.sections.quickRun');
    expect(script).toContain('strings.sections.dataManagement');
  });

  it('renders a read-only footer summary in used-over-total form', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('function renderFooter()');
    expect(script).toContain('getUsedCount(ui.state.items)');
    expect(script).toContain("' / ' +");
    expect(script).toContain('ui.state.items.length');
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

  it('makes the list the only scrollable main region', async () => {
    const css = await readAsset('media/promptqueue-view.css');

    expect(css).toContain('height: 100vh');
    expect(css).toContain('overflow: hidden');
    expect(css).toContain('.pq-list');
    expect(css).toContain('overflow-y: auto');
    expect(css).toContain('.pq-footer');
  });

  it('defines semantic surface tokens for the pinned shell layout', async () => {
    const css = await readAsset('media/promptqueue-view.css');

    expect(css).toContain('--pq-surface-base');
    expect(css).toContain('--pq-surface-panel');
    expect(css).toContain('--pq-border-subtle');
    expect(css).toContain('.pq-header');
    expect(css).toContain('.pq-footer');
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

  it('clears drag state when a drag ends or drops outside a prompt card', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('function clearDragState()');
    expect(script).toContain("root.addEventListener('dragend'");
    expect(script).toContain('card.classList.remove(\'pq-card-drag-over\')');
    expect(script).toContain('ui.dragSourceId = null;');
  });

  it('closes menus when the webview loses focus or becomes hidden', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain("window.addEventListener('blur'");
    expect(script).toContain("document.visibilityState === 'hidden'");
    expect(script).toContain('closeMenu();');
  });

  it('renders a dedicated click-capture layer behind open menus', async () => {
    const script = await readAsset('media/promptqueue-view.js');
    const css = await readAsset('media/promptqueue-view.css');

    expect(script).toContain('pq-menu-dismiss');
    expect(script).toContain("data-action=\"close-menu\"");
    expect(css).toContain('.pq-menu-dismiss');
    expect(css).toContain('inset: 0');
  });

  it('renders copy-age badges for used prompts and refreshes them on a timer', async () => {
    const script = await readAsset('media/promptqueue-view.js');
    const css = await readAsset('media/promptqueue-view.css');

    expect(script).toContain('copyAgeLabel');
    expect(script).toContain('pq-card-age');
    expect(script).toContain("type: 'requestState'");
    expect(script).toContain('window.setInterval');
    expect(css).toContain('.pq-card-age');
  });
});
