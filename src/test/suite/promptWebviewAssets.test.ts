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

  it('highlights the current indirect task without completed styling', async () => {
    const script = await readAsset('media/promptqueue-view.js');
    const css = await readAsset('media/promptqueue-view.css');

    expect(script).toContain('function renderCurrentTaskBadge(item)');
    expect(script).toContain("item.activeTask ? 'pq-card-active-task '");
    expect(script).toContain('pq-card-badge-current-task');
    expect(css).toContain('--pq-active-task');
    expect(css).toContain('.pq-card-active-task:not(');
    expect(css).toContain('.pq-card-active-task.pq-card-used .pq-card-title');
    expect(css).toContain('text-decoration: none;');
    expect(css).toContain('.pq-card-active-task.pq-card-used .pq-card-body');
    expect(css).toContain('display: -webkit-box;');
  });

  it('renders direct and indirect file copy modes in settings', async () => {
    const script = await readAsset('media/promptqueue-view.js');
    const css = await readAsset('media/promptqueue-view.css');

    expect(script).toContain('function renderCopyModeControl(values)');
    expect(script).toContain('name="copyMode" value="direct"');
    expect(script).toContain('name="copyMode" value="indirect-file"');
    expect(script).toContain("copyMode: String(formData.get('copyMode') || 'direct')");
    expect(css).toContain('.pq-segmented');
    expect(css).toContain('.pq-segment-input');
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

  it('keeps the header focused on add, settings, and quick run only', async () => {
    const script = await readAsset('media/promptqueue-view.js');
    const renderHeaderIndex = script.indexOf('function renderHeader()');
    const renderFooterIndex = script.indexOf('function renderFooter()');

    expect(script).toContain("buttonMarkup('open-add'");
    expect(script).toContain("buttonMarkup('open-settings'");
    expect(script).toContain("buttonMarkup('quick-run'");
    expect(renderHeaderIndex).toBeGreaterThan(-1);
    expect(renderFooterIndex).toBeGreaterThan(renderHeaderIndex);
    expect(
      script.indexOf("'toggle-sort-mode'", renderHeaderIndex),
    ).toBeGreaterThan(renderFooterIndex);
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

  it('renders a footer row with sorting on the left and used-over-total on the right', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('function renderFooter()');
    expect(script).toContain("'<div class=\"pq-footer-actions\">' +");
    expect(script).toContain("'toggle-sort-mode'");
    expect(script).toContain('ui.state.strings.actions.doneSorting');
    expect(script).toContain('ui.state.strings.actions.sort');
    expect(script).toContain('getUsedCount(ui.state.items)');
    expect(script).toContain("' / ' +");
    expect(script).toContain('ui.state.items.length');
    expect(script).toContain("'<div class=\"pq-footer-summary\">' +");
    expect(script).toContain('ui.state.items.length < 2');
  });

  it('renders prompt items with a status rail and trailing action trigger', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('pq-card-rail');
    expect(script).toContain('pq-card-main');
    expect(script).toContain('data-action="open-item-menu"');
    expect(script).toContain('pq-card-menu-trigger');
  });

  it('uses an explicit sort-mode toggle instead of long-press reorder gestures', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('sortMode: false');
    expect(script).toContain("action === 'toggle-sort-mode'");
    expect(script).toContain('ui.sortMode = !ui.sortMode');
    expect(script).toContain('if (ui.state.items.length < 2 && ui.sortMode) {');
    expect(script).not.toContain('const LONG_PRESS_DURATION_MS = 520;');
    expect(script).not.toContain('const LONG_PRESS_CONTEXT_MENU_SUPPRESSION_MS = 900;');
    expect(script).not.toContain('const LONG_PRESS_MOVE_TOLERANCE_PX = 6;');
    expect(script).not.toContain('function armPointerReorder(cardId)');
    expect(script).not.toContain('function commitPointerReorder()');
    expect(script).not.toContain('function updatePointerReorderTarget(clientX, clientY)');
  });

  it('uses click-to-copy outside sort mode and pointer sessions inside sort mode', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('function copyCard(promptId)');
    expect(script).toContain("if (card instanceof HTMLElement && !ui.sortMode) {");
    expect(script).toContain('copyCard(card.getAttribute(\'data-card-id\'));');
    expect(script).toContain('reorderSession: null');
    expect(script).toContain("root.addEventListener('pointerdown'");
    expect(script).toContain('startReorderSession(card, event.pointerId, event.clientY);');
    expect(script).not.toContain(' draggable="true"');
    expect(script).not.toContain("root.addEventListener('dragstart'");
  });

  it('keeps long-press and native drag scaffolding out of the webview script', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).not.toContain("type: 'debugTrace'");
    expect(script).not.toContain('function postDebugTrace(label, detail)');
    expect(script).not.toContain('function traceDomEvent(label, event, extraDetail)');
    expect(script).not.toContain('const LONG_PRESS_DURATION_MS = 520;');
    expect(script).not.toContain('const LONG_PRESS_CONTEXT_MENU_SUPPRESSION_MS = 900;');
    expect(script).not.toContain('const LONG_PRESS_MOVE_TOLERANCE_PX = 6;');
    expect(script).not.toContain("root.addEventListener('dragend'");
    expect(script).not.toContain("root.addEventListener('dragover'");
    expect(script).not.toContain("root.addEventListener('drop'");
  });

  it('keeps item menus reachable from the trailing button and context menu', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('data-action="open-item-menu"');
    expect(script).toContain("root.addEventListener('contextmenu'");
    expect(script).toContain('openAnchoredMenu(actionTarget, {');
  });

  it('creates a floating drag overlay instead of inserting placeholder card markup', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('dragOverlayEl');
    expect(script).toContain('cloneNode(true)');
    expect(script).toContain('gapIndex');
    expect(script).toContain('pq-card-sortable-gap');
    expect(script).not.toContain(
      `cards.push('<article class="pq-card pq-card-drag-over pq-card-sortable-placeholder"></article>');`,
    );
  });

  it('resolves gap indexes and displaced ranges through PromptQueueReorderMath', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('window.PromptQueueReorderMath');
    expect(script).toContain('buildSlotMidpoints');
    expect(script).toContain('resolveGapIndex');
    expect(script).toContain('getDisplacedIndexes');
    expect(script).not.toContain('const midpoint = rect.top + rect.height / 2;');
  });

  it('positions the drag overlay from pointer movement while the source card becomes the gap', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('pointerOffsetY');
    expect(script).toContain('sourceRect');
    expect(script).toContain('startScrollTop');
    expect(script).toContain('measuredCards');
    expect(script).toContain('session.dragOverlayEl.style.transform =');
    expect(script).toContain('targetIndex: session.gapIndex');
    expect(script).toContain('if (session.gapIndex === session.sourceIndex) {');
    expect(script).not.toContain('targetIndex: session.placeholderIndex');
  });

  it('keeps active reorder listeners on window so rerenders do not sever drag sessions', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('root.innerHTML =');
    expect(script).toContain("root.addEventListener('pointerdown'");
    expect(script).toContain("window.addEventListener('pointermove'");
    expect(script).toContain("window.addEventListener('pointerup'");
    expect(script).toContain("window.addEventListener('pointercancel'");
    expect(script).not.toContain("root.addEventListener('pointermove'");
    expect(script).not.toContain("root.addEventListener('pointerup'");
    expect(script).not.toContain("root.addEventListener('pointercancel'");
  });

  it('cancels active reorder sessions on pointercancel, blur, and Escape', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain("window.addEventListener('pointercancel'");
    expect(script).toContain("window.addEventListener('blur'");
    expect(script).toContain("window.addEventListener('keydown'");
    expect(script).toContain("if (event.key === 'Escape' && ui.reorderSession) {");
    expect(script).toContain('cancelReorderSession();');
  });

  it('treats the current gap slot as a reorder no-op for the dragged card', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('if (session.gapIndex === session.sourceIndex) {');
    expect(script).not.toContain('if (session.placeholderIndex === session.sourceIndex + 1) {');
    expect(script).toContain("type: 'reorderPrompts'");
    expect(script).toContain('targetIndex: session.gapIndex');
  });

  it('cleans up auto-scroll timers and the drag overlay on reorder completion paths', async () => {
    const script = await readAsset('media/promptqueue-view.js');
    const clearDragStateIndex = script.indexOf('function clearDragState()');
    const measureSortableCardsIndex = script.indexOf('function measureSortableCards()');
    const commitIndex = script.indexOf('function commitReorderSession()');
    const copyCardIndex = script.indexOf('function copyCard(promptId)');
    const clearDragStateBody = script.slice(
      clearDragStateIndex,
      measureSortableCardsIndex,
    );
    const commitBody = script.slice(commitIndex, copyCardIndex);

    expect(clearDragStateBody).toContain(
      'if (session && session.dragOverlayEl instanceof HTMLElement) {',
    );
    expect(clearDragStateBody).toContain('session.dragOverlayEl.remove();');
    expect(commitBody).toContain('if (session.autoScrollTimer) {');
    expect(commitBody).toContain('window.clearInterval(session.autoScrollTimer);');
    expect(commitBody).toContain('session.autoScrollTimer = null;');
  });


  it('drives list-edge auto-scroll from the active reorder session', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('function updateReorderAutoScroll(pointerY)');
    expect(script).toContain('EDGE_AUTO_SCROLL_THRESHOLD_PX');
    expect(script).toContain('EDGE_AUTO_SCROLL_MAX_STEP_PX');
    expect(script).toContain('reorderMath.getAutoScrollDelta(');
    expect(script).toContain('list.scrollTop');
    expect(script).toContain('session.autoScrollTimer');
    expect(script).not.toContain('delta = -8;');
    expect(script).not.toContain('delta = 8;');
  });

  it('styles prompt items as flatter rows instead of lifted cards', async () => {
    const css = await readAsset('media/promptqueue-view.css');

    expect(css).toContain('.pq-card-rail');
    expect(css).toContain('.pq-card-menu-trigger');
    expect(css).toContain(
      '.pq-card:hover:not(.pq-card-drag-over):not(.pq-card-sortable):not(.pq-card-sortable-dragging) .pq-card-menu-trigger',
    );
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

  it('uses compact rectangular text buttons for the shell actions', async () => {
    const css = await readAsset('media/promptqueue-view.css');

    expect(css).toContain('.pq-btn {');
    expect(css).toContain('border-radius: 6px;');
    expect(css).toContain('.pq-footer-actions');
    expect(css).toContain('justify-content: space-between;');
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

  it('styles the active reorder list, dragged card, gap slot, and displaced cards separately', async () => {
    const script = await readAsset('media/promptqueue-view.js');
    const css = await readAsset('media/promptqueue-view.css');

    expect(script).toContain("list.classList.add('pq-list-sorting')");
    expect(script).toContain("card.classList.add('pq-card-sortable-displaced')");
    expect(script).toContain("card.classList.add('pq-card-sortable-gap')");
    expect(script).toContain("card.classList.add('pq-card-sortable-placeholder')");
    expect(css).toContain('.pq-list-sorting');
    expect(css).toContain('.pq-list-sorting .pq-card-sortable');
    expect(css).toContain('.pq-card-sortable-gap');
    expect(css).toContain('.pq-card-sortable-placeholder');
    expect(css).toContain('.pq-card-sortable-dragging');
    expect(css).toContain('.pq-card-sortable-displaced');
  });

  it('uses concise non-bouncy motion for dragged, gap, and displaced sortable cards', async () => {
    const css = await readAsset('media/promptqueue-view.css');

    expect(css).toContain('transition: transform 180ms cubic-bezier(0.2, 0, 0, 1)');
    expect(css).toContain('.pq-list-sorting .pq-card-sortable-dragging');
    expect(css).toContain('.pq-list-sorting .pq-card-sortable-gap');
    expect(css).toContain('.pq-list-sorting .pq-card-sortable-placeholder');
    expect(css).toContain('.pq-list-sorting .pq-card-sortable-displaced');
    expect(css).toContain('.pq-card-sortable-gap');
    expect(css).toContain('.pq-card-sortable-placeholder');
    expect(css).toContain('transform: translateY(');
    expect(css).not.toContain('scale(1.01)');
    expect(css).toContain('z-index: 3');
  });

  it('keeps normal-mode trailing menu triggers reachable without relying on transient hover hit testing', async () => {
    const css = await readAsset('media/promptqueue-view.css');
    const menuTriggerStyleStart = css.indexOf('.pq-card-menu-trigger {');
    const menuTriggerHoverStart = css.indexOf(
      '.pq-card:hover:not(.pq-card-drag-over)',
    );
    const menuTriggerStyle = css.slice(
      menuTriggerStyleStart,
      menuTriggerHoverStart,
    );

    expect(css).toContain('.pq-card-menu-trigger');
    expect(css).toContain('.pq-card-sortable-gap .pq-card-menu-trigger');
    expect(menuTriggerStyle).toContain('opacity: 0.72;');
    expect(menuTriggerStyle).toContain('pointer-events: auto;');
    expect(css).toContain(
      '.pq-card:hover:not(.pq-card-drag-over):not(.pq-card-sortable):not(.pq-card-sortable-dragging) .pq-card-menu-trigger',
    );
    expect(css).toContain(
      '.pq-card:focus-within:not(.pq-card-drag-over):not(.pq-card-sortable):not(.pq-card-sortable-dragging) .pq-card-menu-trigger',
    );
  });

  it('keeps menu opening logic free of the temporary gesture investigation gates', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain("if (action === 'open-item-menu' && promptId) {");
    expect(script).toContain('openAnchoredMenu(actionTarget, {');
    expect(script).not.toContain('consumeItemMenuButtonPress(promptId, event)');
    expect(script).not.toContain('isItemMenuLocked()');
  });

  it('clears active reorder sessions on pointercancel, blur, and Escape', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('function cancelReorderSession()');
    expect(script).toContain("window.addEventListener('pointercancel'");
    expect(script).toContain("window.addEventListener('blur'");
    expect(script).toContain("if (event.key === 'Escape' && ui.reorderSession) {");
    expect(script).toContain('cancelReorderSession();');
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

  it('renders duplicate badges from derived duplicate state', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('isAdjacentDuplicate');
    expect(script).toContain('if (!item.isAdjacentDuplicate) {');
    expect(script).toContain('strings.status.duplicate');
    expect(script).toContain('pq-card-title-row');
    expect(script).toContain('pq-card-badge-duplicate');
    expect(script).toContain('renderDuplicateBadge(item)');
  });

  it('styles duplicate cards and duplicate badges distinctly', async () => {
    const css = await readAsset('media/promptqueue-view.css');
    const badgeIndex = css.indexOf('.pq-card-badge {');
    const duplicateBadgeIndex = css.indexOf('.pq-card-badge-duplicate {');

    expect(css).toContain('--pq-duplicate');
    expect(css).toContain(
      '.pq-card-duplicate:not(.pq-card-drag-over):not(.pq-card-sortable-gap):not(.pq-card-sortable-placeholder):not(.pq-card-sortable-dragging)',
    );
    expect(css).toContain('.pq-card-title-row');
    expect(css).toContain('.pq-card-badge');
    expect(css).toContain('.pq-card-badge-duplicate');
    expect(css).not.toContain('.pq-card-duplicate {');
    expect(badgeIndex).toBeGreaterThan(-1);
    expect(duplicateBadgeIndex).toBeGreaterThan(badgeIndex);
    expect(css.slice(badgeIndex, duplicateBadgeIndex)).not.toContain(
      'text-transform: uppercase;',
    );
  });
});
