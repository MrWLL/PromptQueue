(function () {
  const vscode = acquireVsCodeApi();
  const root = document.getElementById('promptqueue-app');
  const COPY_AGE_REFRESH_INTERVAL_MS = 60 * 1000;
  const EDGE_AUTO_SCROLL_THRESHOLD_PX = 48;
  const EDGE_AUTO_SCROLL_MAX_STEP_PX = 8;
  const inputParser = window.PromptQueueInputParser;
  const reorderMath = window.PromptQueueReorderMath;

  const ui = {
    menu: null,
    pendingForm: null,
    pendingAutoScroll: false,
    pendingFocus: null,
    panel: null,
    panelDraft: null,
    modeSession: null,
    pendingModeSave: false,
    receivedState: false,
    reorderSession: null,
    settingsMode: false,
    skipDraftSyncOnce: false,
    sortMode: false,
    state: createEmptyState(),
    toasts: [],
  };

  function createEmptyState() {
    return {
      canRestoreLastDeleted: false,
      copySettings: {
        copyMode: 'direct',
        includeTemplateOnClick: true,
        prefix: '',
        quickRunCommand: '/new',
        quickRunEnabled: false,
        suffix: '',
      },
      dataError: undefined,
      dataReady: false,
      items: [],
      quickRunAvailability: 'disabled-in-settings',
      storageLabel: '',
      workspaceReady: true,
      strings: {
        actions: {},
        buttons: {},
        confirmations: {},
        emptyState: {},
        fields: {},
        helpers: {},
        labels: {},
        messages: {},
        panels: {},
        placeholders: {},
        sections: {},
        status: {},
      },
    };
  }

  function postMessage(message) {
    vscode.postMessage(message);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function trimTitle(value) {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  function normalizeModelLevel(value) {
    return value === 'low' || value === 'medium' || value === 'high'
      ? value
      : undefined;
  }

  function normalizeRequiredContent(value) {
    const lines = String(value || '').replace(/\r\n?/g, '\n').split('\n');

    while (lines.length && /^\s*$/.test(lines[0])) {
      lines.shift();
    }

    while (lines.length && /^\s*$/.test(lines[lines.length - 1])) {
      lines.pop();
    }

    return lines.join('\n');
  }

  function getVisibleItems() {
    return ui.modeSession ? ui.modeSession.items : ui.state.items;
  }

  function startPromptMode(type) {
    if (ui.modeSession) {
      return;
    }

    ui.modeSession = {
      items: ui.state.items.map(function (item) {
        return { ...item };
      }),
      type: type,
    };
    ui.pendingModeSave = false;
    ui.settingsMode = type === 'modify';
    ui.sortMode = type === 'sort';
    cancelReorderSession();
    render();
  }

  function discardPromptMode() {
    if (!ui.modeSession || ui.pendingModeSave) {
      return;
    }

    cancelReorderSession();
    ui.modeSession = null;
    ui.pendingModeSave = false;
    ui.panel = null;
    ui.panelDraft = null;
    ui.pendingFocus = null;
    ui.settingsMode = false;
    ui.skipDraftSyncOnce = true;
    ui.sortMode = false;
    render();
  }

  function finishPromptMode() {
    if (!ui.modeSession || ui.pendingModeSave) {
      return;
    }

    ui.pendingModeSave = true;
    ui.skipDraftSyncOnce = true;
    render();
    postMessage({
      type: 'applyPromptModeChanges',
      items: ui.modeSession.items.map(function (item) {
        const modelLevel = normalizeModelLevel(item.modelLevel);

        return {
          id: item.id,
          title: item.title,
          ...(modelLevel ? { modelLevel: modelLevel } : {}),
          content: item.content,
        };
      }),
    });
  }

  function finishPromptModeAfterSave() {
    cancelReorderSession();
    ui.modeSession = null;
    ui.pendingModeSave = false;
    ui.settingsMode = false;
    ui.sortMode = false;
    ui.skipDraftSyncOnce = true;
    render();
  }

  function stagePromptDeletion(promptId) {
    if (!ui.modeSession || ui.pendingModeSave || !promptId) {
      return;
    }

    ui.modeSession.items = ui.modeSession.items.filter(function (item) {
      return item.id !== promptId;
    });
    render();
  }

  function stagePromptEdit(promptId, draft) {
    if (!ui.modeSession || ui.pendingModeSave || !promptId) {
      return false;
    }

    const modelLevel = normalizeModelLevel(draft.modelLevel);
    let updated = false;

    ui.modeSession.items = ui.modeSession.items.map(function (item) {
      if (item.id !== promptId) {
        return item;
      }

      updated = true;
      const nextItem = {
        ...item,
        title: draft.title,
        content: draft.content,
        ...(modelLevel ? { modelLevel: modelLevel } : {}),
      };

      if (!modelLevel) {
        delete nextItem.modelLevel;
      }

      if (
        (item.title !== draft.title ||
          item.content !== draft.content ||
          item.modelLevel !== modelLevel) &&
        nextItem.activeTask
      ) {
        nextItem.activeTask = false;
        nextItem.used = false;
      }

      return nextItem;
    });

    return updated;
  }

  function stagePromptReorder(sourceId, targetIndex) {
    if (!ui.modeSession) {
      return;
    }

    const sourceIndex = ui.modeSession.items.findIndex(function (item) {
      return item.id === sourceId;
    });

    if (sourceIndex < 0) {
      return;
    }

    const nextItems = ui.modeSession.items.slice();
    const sourceItem = nextItems.splice(sourceIndex, 1)[0];
    const clampedTargetIndex = Math.max(
      0,
      Math.min(targetIndex, nextItems.length),
    );
    nextItems.splice(clampedTargetIndex, 0, sourceItem);
    ui.modeSession.items = nextItems;
    render();
  }

  function getDefaultFocusName(panel) {
    if (panel.type === 'import') {
      return 'importText';
    }

    if (panel.type === 'settings') {
      return 'importText';
    }

    return 'title';
  }

  function setPendingFocus(name, options) {
    ui.pendingFocus = {
      end: options && typeof options.end === 'number' ? options.end : 0,
      name: name,
      start: options && typeof options.start === 'number' ? options.start : 0,
    };
  }

  function findPanelField(name) {
    const fields = root.querySelectorAll('.pq-drawer [name]');

    for (let index = 0; index < fields.length; index += 1) {
      const field = fields[index];

      if (
        (field instanceof HTMLInputElement ||
          field instanceof HTMLTextAreaElement) &&
        field.name === name
      ) {
        return field;
      }
    }

    return null;
  }

  function syncPanelDraftFromDom() {
    if (!ui.panelDraft) {
      return;
    }

    const fields = root.querySelectorAll('.pq-drawer [name]');

    if (!fields.length) {
      return;
    }

    const nextDraft = {
      ...ui.panelDraft,
    };

    fields.forEach(function (field) {
      if (field instanceof HTMLInputElement) {
        if (field.type === 'radio') {
          if (field.checked) {
            nextDraft[field.name] = field.value;
          }
        } else {
          nextDraft[field.name] =
            field.type === 'checkbox' ? field.checked : field.value;
        }
      }

      if (field instanceof HTMLTextAreaElement) {
        nextDraft[field.name] = field.value;
      }
    });

    ui.panelDraft = nextDraft;
  }

  function capturePanelFocusBeforeRender() {
    if (ui.pendingFocus) {
      return;
    }

    const activeElement = document.activeElement;

    if (
      !(
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement
      ) ||
      !activeElement.closest('.pq-drawer')
    ) {
      return;
    }

    setPendingFocus(activeElement.name, {
      end: activeElement.selectionEnd,
      start: activeElement.selectionStart,
    });
  }

  function restorePanelFocus() {
    if (!ui.pendingFocus) {
      return;
    }

    const field = findPanelField(ui.pendingFocus.name);

    if (
      !(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)
    ) {
      ui.pendingFocus = null;
      return;
    }

    field.focus();

    if (
      typeof ui.pendingFocus.start === 'number' &&
      typeof ui.pendingFocus.end === 'number' &&
      typeof field.setSelectionRange === 'function'
    ) {
      field.setSelectionRange(ui.pendingFocus.start, ui.pendingFocus.end);
    }

    ui.pendingFocus = null;
  }

  function adjustMenuPosition() {
    if (!ui.menu) {
      return;
    }

    const menu = root.querySelector('.pq-menu-open');

    if (!(menu instanceof HTMLElement)) {
      return;
    }

    const viewportPadding = 10;
    const maxLeft = Math.max(
      viewportPadding,
      window.innerWidth - menu.offsetWidth - viewportPadding,
    );
    const maxTop = Math.max(
      viewportPadding,
      window.innerHeight - menu.offsetHeight - viewportPadding,
    );
    const clampedLeft = Math.min(Math.max(viewportPadding, ui.menu.x), maxLeft);
    const clampedTop = Math.min(Math.max(viewportPadding, ui.menu.y), maxTop);

    menu.style.left = clampedLeft + 'px';
    menu.style.top = clampedTop + 'px';
    menu.style.visibility = 'visible';
  }

  function getCardDisplay(item) {
    const content = item.content || '';

    if (item.title) {
      return {
        title: item.title,
        body: content,
      };
    }

    return {
      title: ui.state.strings.status.untitled || 'Untitled',
      body: content,
    };
  }

  function getCardCopyAgeLabel(item) {
    return item.used && typeof item.copyAgeLabel === 'string'
      ? item.copyAgeLabel
      : '';
  }

  function renderDuplicateBadge(item) {
    if (!item.isAdjacentDuplicate) {
      return '';
    }

    return (
      '<span class="pq-card-badge pq-card-badge-duplicate">' +
      escapeHtml(ui.state.strings.status.duplicate || '') +
      '</span>'
    );
  }

  function renderCurrentTaskBadge(item) {
    if (!item.activeTask) {
      return '';
    }

    return (
      '<span class="pq-card-badge pq-card-badge-current-task">' +
      escapeHtml(ui.state.strings.status.currentTask || '') +
      '</span>'
    );
  }

  function openPanel(panel) {
    ui.panel = panel;
    ui.panelDraft = createPanelDraft(panel);
    ui.skipDraftSyncOnce = true;
    setPendingFocus(getDefaultFocusName(panel), { end: 0, start: 0 });
    closeMenu();
    render();
  }

  function closePanel() {
    ui.panel = null;
    ui.panelDraft = null;
    ui.pendingForm = null;
    ui.pendingFocus = null;
    ui.skipDraftSyncOnce = true;
    render();
  }

  function openMenu(menu) {
    ui.menu = menu;
    render();
  }

  function closeMenu() {
    if (!ui.menu) {
      return;
    }

    ui.menu = null;
    render();
  }

  function clearReorderMarkers() {
    const list = getListElement();

    if (list instanceof HTMLElement) {
      list.classList.remove('pq-list-sorting');
    }

    root
      .querySelectorAll(
        '.pq-card-drag-over, .pq-card-sortable-dragging, .pq-card-sortable-gap, .pq-card-sortable-placeholder, .pq-card-sortable-displaced',
      )
      .forEach(function (card) {
        card.classList.remove('pq-card-drag-over');
        card.classList.remove('pq-card-sortable-dragging');
        card.classList.remove('pq-card-sortable-gap');
        card.classList.remove('pq-card-sortable-placeholder');
        card.classList.remove('pq-card-sortable-displaced');
        card.style.transform = '';
      });
  }

  function clearDragState() {
    const session = ui.reorderSession;

    if (session && typeof root.releasePointerCapture === 'function') {
      try {
        if (
          typeof root.hasPointerCapture !== 'function' ||
          root.hasPointerCapture(session.pointerId)
        ) {
          root.releasePointerCapture(session.pointerId);
        }
      } catch (_error) {}
    }

    if (session && session.dragOverlayEl instanceof HTMLElement) {
      session.dragOverlayEl.remove();
    }

    ui.reorderSession = null;
    clearReorderMarkers();
  }

  function measureSortableCards() {
    return Array.from(root.querySelectorAll('.pq-list [data-card-id]'))
      .filter(function (card) {
        return card instanceof HTMLElement;
      })
      .map(function (card) {
        return {
          card: card,
          id: card.getAttribute('data-card-id'),
          rect: card.getBoundingClientRect(),
        };
      });
  }

  function createDragOverlay(card) {
    const dragOverlayEl = card.cloneNode(true);

    if (!(dragOverlayEl instanceof HTMLElement)) {
      return null;
    }

    dragOverlayEl.classList.add('pq-card-sortable-dragging');
    dragOverlayEl.removeAttribute('data-card-id');
    dragOverlayEl.style.left = '0px';
    dragOverlayEl.style.margin = '0';
    dragOverlayEl.style.pointerEvents = 'none';
    dragOverlayEl.style.position = 'fixed';
    dragOverlayEl.style.top = '0px';
    dragOverlayEl.style.width = '0px';
    dragOverlayEl.style.zIndex = '3';
    document.body.appendChild(dragOverlayEl);
    return dragOverlayEl;
  }

  function getFullGapIndex(session) {
    return session.gapIndex > session.sourceIndex
      ? session.gapIndex + 1
      : session.gapIndex;
  }

  function positionDragOverlay(session, pointerY) {
    if (!(session.dragOverlayEl instanceof HTMLElement)) {
      return;
    }

    const overlayTop = pointerY - session.pointerOffsetY;

    session.dragOverlayEl.style.width = session.sourceRect.width + 'px';
    session.dragOverlayEl.style.transform =
      'translate3d(' +
      session.sourceRect.left +
      'px, ' +
      overlayTop +
      'px, 0)';
  }

  function resolveGapIndex(pointerY) {
    const session = ui.reorderSession;
    const list = getListElement();

    if (!session || !reorderMath || !(list instanceof HTMLElement)) {
      return;
    }

    const scrollDelta = list.scrollTop - session.startScrollTop;
    const rects = session.measuredCards.map(function (measuredCard) {
      return {
        height: measuredCard.rect.height,
        top: measuredCard.rect.top - scrollDelta,
      };
    });
    const slotMidpoints = reorderMath.buildSlotMidpoints(
      rects,
      session.sourceIndex,
    );
    const overlayTop = pointerY - session.pointerOffsetY;
    const pointerCenterY = overlayTop + session.sourceRect.height / 2;
    const resolvedGapIndex = reorderMath.resolveGapIndex(
      slotMidpoints,
      pointerCenterY,
    );

    session.gapIndex =
      resolvedGapIndex > session.sourceIndex
        ? resolvedGapIndex - 1
        : resolvedGapIndex;
  }

  function applyReorderVisualState(session) {
    const list = getListElement();
    const cards = Array.from(root.querySelectorAll('.pq-list [data-card-id]')).filter(
      function (card) {
        return card instanceof HTMLElement;
      },
    );
    const fullGapIndex = getFullGapIndex(session);
    const displacedIndexes = reorderMath
      ? reorderMath.getDisplacedIndexes(
          session.sourceIndex,
          fullGapIndex,
          cards.length,
        )
      : [];

    if (list instanceof HTMLElement) {
      list.classList.add('pq-list-sorting');
    }

    cards.forEach(function (card, index) {
      card.classList.remove('pq-card-drag-over');
      card.classList.remove('pq-card-sortable-gap');
      card.classList.remove('pq-card-sortable-placeholder');
      card.classList.remove('pq-card-sortable-displaced');
      card.style.transform = '';

      if (index === session.sourceIndex) {
        card.classList.add('pq-card-drag-over');
        card.classList.add('pq-card-sortable-gap');
        card.classList.add('pq-card-sortable-placeholder');
        return;
      }

      if (displacedIndexes.indexOf(index) === -1) {
        return;
      }

      card.classList.add('pq-card-sortable-displaced');
      card.style.transform =
        fullGapIndex > session.sourceIndex + 1
          ? 'translateY(calc(-100% - 8px))'
          : 'translateY(calc(100% + 8px))';
    });
  }

  function startReorderSession(card, pointerId, pointerY) {
    const sourceId = card.getAttribute('data-card-id');
    const list = getListElement();

    if (!sourceId || !reorderMath || !(list instanceof HTMLElement)) {
      return;
    }

    if (typeof root.setPointerCapture === 'function') {
      try {
        root.setPointerCapture(pointerId);
      } catch (_error) {}
    }

    const sourceIndex = getVisibleItems().findIndex(function (item) {
      return item.id === sourceId;
    });

    if (sourceIndex < 0) {
      return;
    }

    clearDragState();
    const sourceRect = card.getBoundingClientRect();
    const dragOverlayEl = createDragOverlay(card);

    if (!(dragOverlayEl instanceof HTMLElement)) {
      return;
    }

    ui.reorderSession = {
      autoScrollTimer: null,
      dragOverlayEl: dragOverlayEl,
      gapIndex: sourceIndex,
      measuredCards: measureSortableCards(),
      pendingAnimationFrame: 0,
      pendingPointerY: pointerY,
      pointerId: pointerId,
      pointerOffsetY: pointerY - sourceRect.top,
      sourceId: sourceId,
      sourceIndex: sourceIndex,
      sourceRect: sourceRect,
      startScrollTop: list.scrollTop,
    };
    positionDragOverlay(ui.reorderSession, pointerY);
    resolveGapIndex(pointerY);
    applyReorderVisualState(ui.reorderSession);
  }

  function updateReorderSession(pointerY) {
    const session = ui.reorderSession;

    if (!session) {
      return;
    }

    positionDragOverlay(session, pointerY);
    resolveGapIndex(pointerY);
    applyReorderVisualState(session);
  }

  function scheduleReorderSessionUpdate(pointerY) {
    if (!ui.reorderSession) {
      return;
    }

    ui.reorderSession.pendingPointerY = pointerY;

    if (ui.reorderSession.pendingAnimationFrame) {
      return;
    }

    ui.reorderSession.pendingAnimationFrame = window.requestAnimationFrame(
      function () {
        if (!ui.reorderSession) {
          return;
        }

        ui.reorderSession.pendingAnimationFrame = 0;
        updateReorderSession(ui.reorderSession.pendingPointerY);
      },
    );
  }

  function updateReorderAutoScroll(pointerY) {
    const session = ui.reorderSession;
    const list = getListElement();

    if (!session || !(list instanceof HTMLElement)) {
      return;
    }

    const rect = list.getBoundingClientRect();
    const delta = reorderMath
      ? reorderMath.getAutoScrollDelta(
          pointerY,
          { top: rect.top, bottom: rect.bottom },
          EDGE_AUTO_SCROLL_THRESHOLD_PX,
          EDGE_AUTO_SCROLL_MAX_STEP_PX,
        )
      : 0;

    if (!delta) {
      if (session.autoScrollTimer) {
        window.clearInterval(session.autoScrollTimer);
        session.autoScrollTimer = null;
      }
      return;
    }

    if (session.autoScrollTimer) {
      return;
    }

    session.autoScrollTimer = window.setInterval(function () {
      list.scrollTop += delta;
      scheduleReorderSessionUpdate(session.pendingPointerY);
    }, 16);
  }

  function cancelReorderSession() {
    if (!ui.reorderSession) {
      return;
    }

    if (ui.reorderSession.pendingAnimationFrame) {
      window.cancelAnimationFrame(ui.reorderSession.pendingAnimationFrame);
    }

    if (ui.reorderSession.autoScrollTimer) {
      window.clearInterval(ui.reorderSession.autoScrollTimer);
      ui.reorderSession.autoScrollTimer = null;
    }

    clearDragState();
  }

  function commitReorderSession() {
    const session = ui.reorderSession;

    if (!session) {
      return;
    }

    if (session.pendingAnimationFrame) {
      window.cancelAnimationFrame(session.pendingAnimationFrame);
      session.pendingAnimationFrame = 0;
      updateReorderSession(session.pendingPointerY);
    }

    if (session.autoScrollTimer) {
      window.clearInterval(session.autoScrollTimer);
      session.autoScrollTimer = null;
    }

    if (session.gapIndex === session.sourceIndex) {
      clearDragState();
      return;
    }

    clearDragState();
    stagePromptReorder(session.sourceId, session.gapIndex);
  }

  function isPrimaryCardPointerDown(event) {
    return event.button === 0 && event.isPrimary !== false;
  }

  function copyCard(promptId) {
    if (!promptId) {
      return;
    }

    if (ui.menu) {
      closeMenu();
    }

    postMessage({
      type:
        ui.state.copySettings.includeTemplateOnClick !== false
          ? 'copyPrompt'
          : 'copyPromptRaw',
      promptId: promptId,
    });
  }

  function pushToast(message, kind) {
    ui.toasts = [...ui.toasts, { id: Date.now() + Math.random(), kind, message }];
    render();

    const toastId = ui.toasts[ui.toasts.length - 1].id;
    window.setTimeout(function () {
      ui.toasts = ui.toasts.filter(function (toast) {
        return toast.id !== toastId;
      });
      render();
    }, 1800);
  }

  function closeToast(toastId) {
    if (!toastId) {
      return;
    }

    ui.toasts = ui.toasts.filter(function (toast) {
      return String(toast.id) !== String(toastId);
    });
    render();
  }

  function getPanelValues() {
    if (!ui.panel) {
      return null;
    }

    if (ui.panelDraft) {
      return ui.panelDraft;
    }

    if (ui.panel.type === 'edit') {
      const prompt = getVisibleItems().find(function (item) {
        return item.id === ui.panel.promptId;
      });

      if (!prompt) {
        return null;
      }

      return {
        content: prompt.content,
        modelLevel: prompt.modelLevel || '',
        title: prompt.title || '',
      };
    }

    if (ui.panel.type === 'settings') {
      return {
        copyMode:
          ui.state.copySettings.copyMode === 'indirect-file'
            ? 'indirect-file'
            : 'direct',
        importText: '',
        includeTemplateOnClick:
          ui.state.copySettings.includeTemplateOnClick !== false,
        prefix: ui.state.copySettings.prefix,
        quickRunCommand: ui.state.copySettings.quickRunCommand || '/new',
        quickRunEnabled: ui.state.copySettings.quickRunEnabled === true,
        suffix: ui.state.copySettings.suffix,
      };
    }

    if (ui.panel.type === 'import') {
      return {
        importText: '',
      };
    }

    return {
      content: '',
      modelLevel: '',
      title: '',
    };
  }

  function createPanelDraft(panel) {
    if (panel.type === 'edit') {
      const prompt = getVisibleItems().find(function (item) {
        return item.id === panel.promptId;
      });

      if (!prompt) {
        return null;
      }

      return {
        content: prompt.content,
        modelLevel: prompt.modelLevel || '',
        title: prompt.title || '',
      };
    }

    if (panel.type === 'settings') {
      return {
        copyMode:
          ui.state.copySettings.copyMode === 'indirect-file'
            ? 'indirect-file'
            : 'direct',
        importText: '',
        includeTemplateOnClick:
          ui.state.copySettings.includeTemplateOnClick !== false,
        prefix: ui.state.copySettings.prefix,
        quickRunCommand: ui.state.copySettings.quickRunCommand || '/new',
        quickRunEnabled: ui.state.copySettings.quickRunEnabled === true,
        suffix: ui.state.copySettings.suffix,
      };
    }

    if (panel.type === 'import') {
      return {
        importText: '',
      };
    }

    return {
      content: '',
      modelLevel: '',
      title: '',
    };
  }

  function getListElement() {
    const list = root.querySelector('.pq-list');
    return list instanceof HTMLElement ? list : null;
  }

  function captureListScrollTop() {
    const list = getListElement();
    return list ? list.scrollTop : 0;
  }

  function restoreListScrollTop(scrollTop) {
    if (ui.pendingAutoScroll) {
      return;
    }

    const list = getListElement();

    if (list) {
      list.scrollTop = scrollTop;
    }
  }

  function queueAutoScroll() {
    ui.pendingAutoScroll = true;
  }

  function pulseNextTarget(card) {
    card.classList.remove('pq-card-next-target');
    void card.offsetWidth;
    card.classList.add('pq-card-next-target');

    window.setTimeout(function () {
      card.classList.remove('pq-card-next-target');
    }, 640);
  }

  function flushAutoScroll() {
    if (!ui.pendingAutoScroll) {
      return;
    }

    ui.pendingAutoScroll = false;
    window.requestAnimationFrame(function () {
      const nextUnusedCard = ui.state.items.find(function (item) {
        return item.used === false;
      });

      if (nextUnusedCard) {
        const targetCard = root.querySelector(
          '[data-card-id="' + nextUnusedCard.id + '"]',
        );

        if (targetCard instanceof HTMLElement) {
          targetCard.scrollIntoView({ block: 'center' });
          pulseNextTarget(targetCard);
        }

        return;
      }

      const lastCard = root.querySelector('.pq-list [data-card-id]:last-of-type');

      if (lastCard instanceof HTMLElement) {
        lastCard.scrollIntoView({ block: 'end' });
        pulseNextTarget(lastCard);
      }
    });
  }

  function getUsedCount(items) {
    return items.filter(function (item) {
      return item.used === true;
    }).length;
  }

  function getAdjacentDuplicateIds(items) {
    const duplicateIds = new Set();

    for (let index = 1; index < items.length; index += 1) {
      const previousContent = String(items[index - 1].content)
        .replace(/\r\n/g, '\n')
        .trim();
      const currentContent = String(items[index].content)
        .replace(/\r\n/g, '\n')
        .trim();

      if (previousContent !== currentContent) {
        continue;
      }

      duplicateIds.add(items[index - 1].id);
      duplicateIds.add(items[index].id);
    }

    return duplicateIds;
  }

  function renderQueueSummary() {
    const strings = ui.state.strings;
    const visibleItems = getVisibleItems();
    const total = visibleItems.length;
    const used = getUsedCount(visibleItems);

    return (
      total +
      ' ' +
      escapeHtml(strings.labels.prompts || '') +
      ' · ' +
      used +
      ' ' +
      escapeHtml(strings.labels.used || '')
    );
  }

  function buttonMarkup(action, label, className, disabled, extraAttributes) {
    return (
      '<button class="' +
      className +
      '" data-action="' +
      action +
      '"' +
      (disabled ? ' disabled' : '') +
      (extraAttributes ? ' ' + extraAttributes : '') +
      '>' +
      escapeHtml(label || '') +
      '</button>'
    );
  }

  function renderDrawerToggle(label, name, checked) {
    return (
      '<div class="pq-field pq-field-toggle">' +
      '<span class="pq-label">' +
      escapeHtml(label || '') +
      '</span>' +
      '<label class="pq-toggle-row">' +
      '<input class="pq-toggle-input" type="checkbox" name="' +
      escapeHtml(name) +
      '"' +
      (checked ? ' checked' : '') +
      ' />' +
      '<span class="pq-toggle-box" aria-hidden="true"></span>' +
      '<span class="pq-toggle-label">' +
      escapeHtml(label || '') +
      '</span>' +
      '</label>' +
      '</div>'
    );
  }

  function renderCopyModeControl(values) {
    const fields = ui.state.strings.fields;
    const copyMode = values.copyMode === 'indirect-file' ? 'indirect-file' : 'direct';

    return (
      '<div class="pq-field">' +
      '<span class="pq-label">' +
      escapeHtml(fields.copyMode || '') +
      '</span>' +
      '<div class="pq-segmented" role="radiogroup" aria-label="' +
      escapeHtml(fields.copyMode || '') +
      '">' +
      '<label class="pq-segment">' +
      '<input class="pq-segment-input" type="radio" name="copyMode" value="direct"' +
      (copyMode === 'direct' ? ' checked' : '') +
      ' />' +
      '<span>' +
      escapeHtml(fields.copyModeDirect || '') +
      '</span>' +
      '</label>' +
      '<label class="pq-segment">' +
      '<input class="pq-segment-input" type="radio" name="copyMode" value="indirect-file"' +
      (copyMode === 'indirect-file' ? ' checked' : '') +
      ' />' +
      '<span>' +
      escapeHtml(fields.copyModeIndirect || '') +
      '</span>' +
      '</label>' +
      '</div>' +
      '</div>'
    );
  }

  function renderModelLevelControl(values) {
    const fields = ui.state.strings.fields;
    const modelLevel = normalizeModelLevel(values.modelLevel) || '';
    const choices = [
      ['', fields.modelLevelUnset],
      ['low', fields.modelLevelLow],
      ['medium', fields.modelLevelMedium],
      ['high', fields.modelLevelHigh],
    ];

    return (
      '<div class="pq-field">' +
      '<span class="pq-label">' +
      escapeHtml(fields.modelLevel || '') +
      '</span>' +
      '<div class="pq-segmented pq-model-level-control" role="radiogroup" aria-label="' +
      escapeHtml(fields.modelLevel || '') +
      '">' +
      choices.map(function (choice) {
        return (
          '<label class="pq-segment">' +
          '<input class="pq-segment-input" type="radio" name="modelLevel" value="' +
          choice[0] +
          '"' +
          (modelLevel === choice[0] ? ' checked' : '') +
          ' />' +
          '<span>' +
          escapeHtml(choice[1] || '') +
          '</span>' +
          '</label>'
        );
      }).join('') +
      '</div>' +
      '</div>'
    );
  }

  function renderModelLevelIndicator(item) {
    const status = ui.state.strings.status;
    const modelLevel = normalizeModelLevel(item.modelLevel);
    const label = modelLevel === 'low'
      ? status.modelLevelLow
      : modelLevel === 'medium'
        ? status.modelLevelMedium
        : modelLevel === 'high'
          ? status.modelLevelHigh
          : status.modelLevelUnset;

    return (
      '<div class="pq-model-level-indicator pq-model-level-' +
      (modelLevel || 'unset') +
      '" role="img" aria-label="' +
      escapeHtml(label || '') +
      '" title="' +
      escapeHtml(label || '') +
      '">' +
      '<span class="pq-model-level-bar pq-model-level-bar-high"></span>' +
      '<span class="pq-model-level-bar pq-model-level-bar-medium"></span>' +
      '<span class="pq-model-level-bar pq-model-level-bar-low"></span>' +
      '</div>'
    );
  }

  function renderCopyModeToggle() {
    const checked = ui.state.copySettings.includeTemplateOnClick !== false;

    return (
      '<label class="pq-copy-toggle" title="' +
      escapeHtml(ui.state.strings.helpers.includeTemplateOnClickHint || '') +
      '">' +
      '<input class="pq-toggle-input" type="checkbox" name="includeTemplateOnClick"' +
      (checked ? ' checked' : '') +
      ' data-setting-toggle="includeTemplateOnClick" />' +
      '<span class="pq-toggle-box" aria-hidden="true"></span>' +
      '<span class="pq-toggle-label">' +
      escapeHtml(ui.state.strings.fields.includeTemplateOnClick || '') +
      '</span>' +
      '</label>'
    );
  }

  function renderHeader() {
    const controlsDisabled =
      !ui.state.workspaceReady || !ui.state.dataReady || Boolean(ui.modeSession);

    return (
      '<section class="pq-header">' +
      '<div class="pq-header-actions">' +
      buttonMarkup('open-add', ui.state.strings.actions.add, 'pq-btn pq-btn-primary', controlsDisabled) +
      buttonMarkup('open-settings', ui.state.strings.actions.settings, 'pq-btn pq-btn-secondary', controlsDisabled) +
      buttonMarkup('quick-run', ui.state.strings.actions.quickRun, 'pq-btn pq-btn-secondary', controlsDisabled || ui.state.quickRunAvailability !== 'ready') +
      '</div>' +
      '</section>'
    );
  }

  function renderFooter() {
    const visibleItems = getVisibleItems();
    const canSort = ui.state.dataReady && visibleItems.length >= 2;
    const canConfigureItems = ui.state.dataReady && visibleItems.length > 0;
    const modeSession = ui.modeSession;
    const modeActions = modeSession
      ? buttonMarkup(
          'finish-prompt-mode',
          modeSession.type === 'sort'
            ? ui.state.strings.actions.doneSorting
            : ui.state.strings.actions.doneItemSettings,
          'pq-btn pq-btn-active',
          ui.pendingModeSave,
        ) +
        buttonMarkup(
          'discard-prompt-mode',
          ui.state.strings.actions.cancelChanges,
          'pq-btn pq-btn-danger',
          ui.pendingModeSave,
        )
      : buttonMarkup(
          'toggle-sort-mode',
          ui.state.strings.actions.sort,
          'pq-btn pq-btn-secondary',
          !canSort,
          'aria-pressed="false"',
        ) +
        buttonMarkup(
          'toggle-settings-mode',
          ui.state.strings.actions.itemSettings,
          'pq-btn pq-btn-secondary',
          !canConfigureItems,
          'aria-pressed="false"',
        );

    return (
      '<footer class="pq-footer">' +
      '<div class="pq-footer-actions">' +
      modeActions +
      '</div>' +
      '<div class="pq-footer-summary">' +
      getUsedCount(visibleItems) +
      ' / ' +
      visibleItems.length +
      '</div>' +
      '</footer>'
    );
  }

  function renderCards() {
    if (!ui.state.workspaceReady) {
      return (
        '<section class="pq-empty">' +
        '<div class="pq-empty-title">' +
        escapeHtml(ui.state.strings.emptyState.noWorkspaceTitle || '') +
        '</div>' +
        '<div class="pq-empty-body">' +
        escapeHtml(ui.state.strings.emptyState.noWorkspaceBody || '') +
        '</div>' +
        '</section>'
      );
    }

    if (!ui.state.dataReady) {
      return (
        '<section class="pq-empty">' +
        '<div class="pq-empty-title">' +
        escapeHtml(
          ui.state.dataError
            ? ui.state.strings.emptyState.dataLoadFailedTitle || ''
            : ui.state.strings.emptyState.loadingTitle || '',
        ) +
        '</div>' +
        '<div class="pq-empty-body">' +
        escapeHtml(
          ui.state.dataError || ui.state.strings.emptyState.loadingBody || '',
        ) +
        '</div>' +
        '</section>'
      );
    }

    const visibleItems = getVisibleItems();

    if (!visibleItems.length) {
      return (
        '<section class="pq-empty">' +
        '<div class="pq-empty-title">' +
        escapeHtml(ui.state.strings.emptyState.title || '') +
        '</div>' +
        '<div class="pq-empty-body">' +
        escapeHtml(ui.state.strings.emptyState.body || '') +
        '</div>' +
        '</section>'
      );
    }

    const session = ui.reorderSession;
    const sourceId = session ? session.sourceId : null;
    const adjacentDuplicateIds = getAdjacentDuplicateIds(visibleItems);
    const cards = [];

    visibleItems.forEach(function (item) {
      const display = getCardDisplay(item);
      const copyAgeLabel = getCardCopyAgeLabel(item);
      const isGapSource = sourceId === item.id;
      const isAdjacentDuplicate = adjacentDuplicateIds.has(item.id);

      cards.push(
        '<article class="pq-card ' +
          (item.activeTask ? 'pq-card-active-task ' : '') +
          (item.used ? 'pq-card-used ' : '') +
          (isAdjacentDuplicate ? 'pq-card-duplicate ' : '') +
          (ui.settingsMode ? 'pq-card-settings ' : '') +
          (ui.sortMode ? 'pq-card-sortable ' : '') +
          (isGapSource
            ? 'pq-card-drag-over pq-card-sortable-gap pq-card-sortable-placeholder '
            : '') +
          '" data-card-id="' +
          escapeHtml(item.id) +
          '">' +
          renderModelLevelIndicator(item) +
          '<div class="pq-card-side">' +
          '<button class="pq-card-rail ' +
          (item.used ? 'pq-card-rail-used' : '') +
          '" data-action="toggle-used" data-prompt-id="' +
          escapeHtml(item.id) +
          '" aria-label="toggle used"' +
          (ui.sortMode || ui.settingsMode ? ' disabled tabindex="-1"' : '') +
          '></button>' +
          (copyAgeLabel
            ? '<div class="pq-card-age">' + escapeHtml(copyAgeLabel) + '</div>'
            : '') +
          '</div>' +
          '<div class="pq-card-main">' +
          '<div class="pq-card-title-row">' +
          '<div class="pq-card-title">' +
          escapeHtml(display.title) +
          '</div>' +
          renderCurrentTaskBadge(item) +
          renderDuplicateBadge({
            ...item,
            isAdjacentDuplicate: isAdjacentDuplicate,
          }) +
          (ui.settingsMode
            ? '<button class="pq-card-delete" type="button" data-action="delete-staged-prompt" data-prompt-id="' +
              escapeHtml(item.id) +
              '"' +
              (ui.pendingModeSave ? ' disabled' : '') +
              '>' +
              escapeHtml(ui.state.strings.actions.delete) +
              '</button>'
            : '') +
          '</div>' +
          (display.body
            ? '<div class="pq-card-body">' + escapeHtml(display.body) + '</div>'
            : '') +
          '</div>' +
          '</article>',
      );
    });

    return cards.join('');
  }

  function renderDrawer() {
    if (!ui.panel) {
      return '<div class="pq-backdrop"></div>';
    }

    const strings = ui.state.strings;
    const values = getPanelValues();

    if (!values) {
      ui.panel = null;
      return '<div class="pq-backdrop"></div>';
    }

    let title = '';
    let form = '';

    if (ui.panel.type === 'add' || ui.panel.type === 'edit') {
      title = ui.panel.type === 'add' ? strings.panels.add : strings.panels.edit;
      form =
        '<form class="pq-form" data-form="' +
        ui.panel.type +
        '">' +
        renderField(
          strings.fields.title,
          strings.placeholders.title,
          'title',
          values.title || '',
          false,
        ) +
        '<div class="pq-helper">' +
        escapeHtml(strings.helpers.titleOptional || '') +
        '</div>' +
        renderModelLevelControl(values) +
        renderTextArea(
          strings.fields.content,
          strings.placeholders.content,
          'content',
          values.content || '',
        ) +
        '<div class="pq-helper">' +
        escapeHtml(strings.helpers.contentRequired || '') +
        '</div>' +
        (ui.panel.type === 'add'
          ? '<div class="pq-helper">' +
            escapeHtml(strings.helpers.structuredPaste || '') +
            '</div>'
          : '') +
        renderFormActions(ui.pendingForm === ui.panel.type) +
        '</form>';
    }

    if (ui.panel.type === 'import') {
      title = strings.panels.bulkImport;
      form =
        '<form class="pq-form" data-form="import">' +
        renderTextArea(
          strings.actions.bulkImport,
          strings.placeholders.import,
          'importText',
          values.importText || '',
        ) +
        '<div class="pq-helper">' +
        escapeHtml(strings.helpers.bulkImport || '') +
        '</div>' +
        renderFormActions(ui.pendingForm === 'import') +
        '</form>';
    }

    if (ui.panel.type === 'settings') {
      title = strings.panels.settings;
      form =
        '<div class="pq-settings-stack">' +
        '<form class="pq-form" data-form="settings-import">' +
        renderSettingsSection(
          strings.sections.import,
          renderTextArea(
            strings.actions.bulkImport,
            strings.placeholders.import,
            'importText',
            values.importText || '',
          ) +
            '<div class="pq-helper">' +
            escapeHtml(strings.helpers.bulkImport || '') +
            '</div>',
          '<button class="pq-btn pq-btn-secondary" type="submit"' +
            (ui.pendingForm === 'import' ? ' disabled' : '') +
            '>' +
            escapeHtml(strings.actions.bulkImport || '') +
            '</button>',
        ) +
        '</form>' +
        '<form class="pq-form" data-form="settings-config">' +
        renderSettingsSection(
          strings.sections.copyBehavior,
          renderCopyModeControl(values) +
            '<div class="pq-helper">' +
            escapeHtml(strings.helpers.copyModeHint || '') +
            '</div>' +
            renderDrawerToggle(
            strings.fields.includeTemplateOnClick,
            'includeTemplateOnClick',
            values.includeTemplateOnClick !== false,
          ) +
            '<div class="pq-helper">' +
            escapeHtml(strings.helpers.includeTemplateOnClickHint || '') +
            '</div>' +
            renderTextArea(
              strings.fields.prefix,
              strings.placeholders.prefix,
              'prefix',
              values.prefix || '',
            ) +
            '<div class="pq-helper">' +
            escapeHtml(strings.helpers.prefixHint || '') +
            '</div>' +
            renderTextArea(
              strings.fields.suffix,
              strings.placeholders.suffix,
              'suffix',
              values.suffix || '',
            ) +
            '<div class="pq-helper">' +
            escapeHtml(strings.helpers.suffixHint || '') +
            '</div>',
        ) +
        renderSettingsSection(
          strings.sections.quickRun,
          renderDrawerToggle(
            strings.fields.quickRunEnabled,
            'quickRunEnabled',
            values.quickRunEnabled === true,
          ) +
            '<div class="pq-helper">' +
            escapeHtml(strings.helpers.quickRunCommandHint || '') +
            '</div>' +
            renderField(
              strings.fields.quickRunCommand,
              strings.placeholders.quickRunCommand,
              'quickRunCommand',
              values.quickRunCommand || '/new',
              false,
            ),
        ) +
        renderFormActions(ui.pendingForm === 'settings') +
        '</form>' +
        renderSettingsSection(
          strings.sections.dataManagement,
          '',
          buttonMarkup(
            'restore-last-deleted',
            strings.actions.restoreLastDeleted,
            'pq-btn pq-btn-secondary',
            !ui.state.canRestoreLastDeleted,
          ) +
            buttonMarkup(
              'delete-all',
              strings.actions.deleteAll,
              'pq-btn pq-btn-ghost pq-btn-danger',
            ),
        ) +
        '</div>';
    }

    return (
      '<div class="pq-backdrop pq-backdrop-open">' +
      '<aside class="pq-drawer" role="dialog" aria-modal="true">' +
      '<div class="pq-drawer-shell">' +
      '<div class="pq-drawer-head">' +
      '<div class="pq-drawer-title">' +
      escapeHtml(title) +
      '</div>' +
      '<button class="pq-icon-btn pq-drawer-close" data-action="close-panel">' +
      escapeHtml(strings.buttons.close || '') +
      '</button>' +
      '</div>' +
      form +
      '</div>' +
      '</aside>' +
      '</div>'
    );
  }

  function renderField(label, placeholder, name, value, required) {
    return (
      '<label class="pq-field">' +
      '<span class="pq-label">' +
      escapeHtml(label || '') +
      '</span>' +
      '<input class="pq-input" name="' +
      escapeHtml(name) +
      '" value="' +
      escapeHtml(value || '') +
      '" placeholder="' +
      escapeHtml(placeholder || '') +
      '"' +
      (required ? ' required' : '') +
      ' />' +
      '</label>'
    );
  }

  function renderTextArea(label, placeholder, name, value) {
    return (
      '<label class="pq-field">' +
      '<span class="pq-label">' +
      escapeHtml(label || '') +
      '</span>' +
      '<textarea class="pq-textarea" name="' +
      escapeHtml(name) +
      '" placeholder="' +
      escapeHtml(placeholder || '') +
      '">' +
      escapeHtml(value || '') +
      '</textarea>' +
      '</label>'
    );
  }

  function renderFormActions(isPending) {
    return (
      '<div class="pq-drawer-actions">' +
      '<button class="pq-btn pq-btn-ghost" type="button" data-action="close-panel">' +
      escapeHtml(ui.state.strings.buttons.cancel || '') +
      '</button>' +
      '<button class="pq-btn pq-btn-primary" type="submit"' +
      (isPending ? ' disabled' : '') +
      '>' +
      escapeHtml(ui.state.strings.buttons.save || '') +
      '</button>' +
      '</div>'
    );
  }

  function renderSettingsSection(title, content, actionMarkup) {
    return (
      '<section class="pq-settings-section">' +
      '<div class="pq-settings-section-title">' +
      escapeHtml(title || '') +
      '</div>' +
      '<div class="pq-settings-section-body">' +
      content +
      '</div>' +
      (actionMarkup
        ? '<div class="pq-settings-section-actions">' + actionMarkup + '</div>'
        : '') +
      '</section>'
    );
  }

  function renderMenu() {
    if (!ui.menu) {
      return '<div class="pq-menu"></div>';
    }

    const dismissLayer =
      '<button class="pq-menu-dismiss" type="button" data-action="close-menu" aria-label="close menu"></button>';

    return (
      dismissLayer +
      '<div class="pq-menu pq-menu-open" style="left:0; top:0; visibility:hidden;">' +
      menuItemMarkup('copy-raw', ui.state.strings.actions.copyRaw) +
      menuItemMarkup('edit', ui.state.strings.actions.edit) +
      menuItemMarkup('move-up', ui.state.strings.actions.moveUp) +
      menuItemMarkup('move-down', ui.state.strings.actions.moveDown) +
      menuItemMarkup('delete', ui.state.strings.actions.delete, true) +
      '</div>'
    );
  }

  function menuItemMarkup(action, label, danger) {
    return (
      '<button class="pq-menu-item ' +
      (danger ? 'pq-menu-item-danger' : '') +
      '" data-menu-action="' +
      action +
      '">' +
      escapeHtml(label || '') +
      '</button>'
    );
  }

  function renderToasts() {
    return (
      '<div class="pq-toast-stack">' +
      ui.toasts
        .map(function (toast) {
          return (
            '<div class="pq-toast ' +
            (toast.kind === 'error' ? 'pq-toast-error' : '') +
            '">' +
            '<div class="pq-toast-message">' +
            escapeHtml(toast.message) +
            '</div>' +
            '<button class="pq-toast-close" type="button" data-action="close-toast" data-toast-id="' +
            escapeHtml(toast.id) +
            '" aria-label="close toast">' +
            '&times;' +
            '</button>' +
            '</div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function render() {
    const preservedScrollTop = captureListScrollTop();

    if (ui.skipDraftSyncOnce) {
      ui.skipDraftSyncOnce = false;
    } else {
      syncPanelDraftFromDom();
      capturePanelFocusBeforeRender();
    }

    root.innerHTML =
      '<div class="pq-shell">' +
      renderHeader() +
      '<section class="pq-list' +
      (ui.reorderSession ? ' pq-list-sorting' : '') +
      '">' +
      renderCards() +
      '</section>' +
      renderFooter() +
      '</div>' +
      renderDrawer() +
      renderMenu() +
      renderToasts();

    restorePanelFocus();
    restoreListScrollTop(preservedScrollTop);
    adjustMenuPosition();
    if (ui.reorderSession) {
      positionDragOverlay(ui.reorderSession, ui.reorderSession.pendingPointerY);
      applyReorderVisualState(ui.reorderSession);
    }
    flushAutoScroll();
  }

  function buildCopySettingsPayload(overrides) {
    return {
      copyMode:
        overrides.copyMode === 'indirect-file'
          ? 'indirect-file'
          : overrides.copyMode === 'direct'
            ? 'direct'
            : ui.state.copySettings.copyMode === 'indirect-file'
              ? 'indirect-file'
              : 'direct',
      includeTemplateOnClick:
        typeof overrides.includeTemplateOnClick === 'boolean'
          ? overrides.includeTemplateOnClick
          : ui.state.copySettings.includeTemplateOnClick !== false,
      prefix:
        typeof overrides.prefix === 'string'
          ? overrides.prefix
          : ui.state.copySettings.prefix,
      quickRunCommand:
        typeof overrides.quickRunCommand === 'string'
          ? overrides.quickRunCommand
          : ui.state.copySettings.quickRunCommand || '/new',
      quickRunEnabled:
        typeof overrides.quickRunEnabled === 'boolean'
          ? overrides.quickRunEnabled
          : ui.state.copySettings.quickRunEnabled === true,
      suffix:
        typeof overrides.suffix === 'string'
          ? overrides.suffix
          : ui.state.copySettings.suffix,
    };
  }

  function resetAddForm() {
    if (!ui.panel || ui.panel.type !== 'add') {
      return;
    }

    ui.panelDraft = createPanelDraft(ui.panel);
    ui.pendingForm = null;
    ui.skipDraftSyncOnce = true;
    setPendingFocus('title', { end: 0, start: 0 });
    render();
  }

  function handleAction(action, promptId) {
    const strings = ui.state.strings;

    if (ui.menu) {
      closeMenu();
    }

    if (action === 'open-add') {
      openPanel({ type: 'add' });
      return;
    }

    if (action === 'open-settings') {
      openPanel({ type: 'settings' });
      return;
    }

    if (action === 'quick-run') {
      postMessage({ type: 'quickRun' });
      return;
    }

    if (action === 'toggle-sort-mode') {
      if (ui.state.items.length < 2) {
        return;
      }

      startPromptMode('sort');
      return;
    }

    if (action === 'toggle-settings-mode') {
      if (ui.state.items.length === 0) {
        return;
      }

      startPromptMode('modify');
      return;
    }

    if (action === 'finish-prompt-mode') {
      finishPromptMode();
      return;
    }

    if (action === 'discard-prompt-mode') {
      discardPromptMode();
      return;
    }

    if (action === 'delete-staged-prompt' && promptId) {
      stagePromptDeletion(promptId);
      return;
    }

    if (action === 'close-menu') {
      closeMenu();
      return;
    }

    if (action === 'close-panel') {
      closePanel();
      return;
    }

    if (action === 'toggle-used' && promptId) {
      postMessage({ type: 'toggleUsed', promptId: promptId });
      return;
    }

    if (action === 'delete-all') {
      postMessage({ type: 'deleteAllPrompts' });
      return;
    }

    if (action === 'restore-last-deleted') {
      if (!ui.state.canRestoreLastDeleted) {
        pushToast(strings.messages.noLastDeletedBackup || '', 'error');
        return;
      }

      postMessage({ type: 'restoreLastDeleted' });
      return;
    }
  }

  root.addEventListener('click', function (event) {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const menuAction = target.closest('[data-menu-action]');

    if (menuAction instanceof HTMLElement && ui.menu) {
      const action = menuAction.getAttribute('data-menu-action');
      const promptId = ui.menu.promptId;

      closeMenu();

      if (promptId && action === 'copy-raw') {
        postMessage({ type: 'copyPromptRaw', promptId: promptId });
      }

      if (promptId && action === 'edit') {
        openPanel({ type: 'edit', promptId: promptId });
      }

      if (promptId && action === 'move-up') {
        postMessage({ type: 'movePrompt', promptId: promptId, direction: 'up' });
      }

      if (promptId && action === 'move-down') {
        postMessage({ type: 'movePrompt', promptId: promptId, direction: 'down' });
      }

      if (promptId && action === 'delete') {
        postMessage({ type: 'deletePrompt', promptId: promptId });
      }

      return;
    }

    const actionTarget = target.closest('[data-action]');

    if (actionTarget instanceof HTMLElement) {
      event.stopPropagation();

      if (actionTarget.getAttribute('data-action') === 'close-toast') {
        closeToast(actionTarget.getAttribute('data-toast-id'));
        return;
      }

      if (
        actionTarget === target &&
        actionTarget.getAttribute('data-action') === 'close-panel'
      ) {
        closePanel();
        return;
      }

      const action = actionTarget.getAttribute('data-action');
      const promptId = actionTarget.getAttribute('data-prompt-id');

      handleAction(action, promptId);
      return;
    }

    const drawer = target.closest('.pq-drawer');

    if (drawer instanceof HTMLElement) {
      return;
    }

    const card = target.closest('[data-card-id]');

    if (card instanceof HTMLElement && ui.settingsMode && !ui.pendingModeSave) {
      openPanel({
        type: 'edit',
        promptId: card.getAttribute('data-card-id'),
      });
      return;
    }

    if (card instanceof HTMLElement && !ui.sortMode) {
      copyCard(card.getAttribute('data-card-id'));
      return;
    }

    closeMenu();
  });

  root.addEventListener('pointerdown', function (event) {
    const target = event.target;

    if (
      !(target instanceof HTMLElement) ||
      !ui.sortMode ||
      ui.pendingModeSave ||
      !isPrimaryCardPointerDown(event)
    ) {
      return;
    }

    const card = target.closest('[data-card-id]');

    if (!(card instanceof HTMLElement)) {
      return;
    }

    event.preventDefault();
    startReorderSession(card, event.pointerId, event.clientY);
  });

  window.addEventListener('pointermove', function (event) {
    if (
      !ui.sortMode ||
      !ui.reorderSession ||
      ui.reorderSession.pointerId !== event.pointerId
    ) {
      return;
    }

    updateReorderAutoScroll(event.clientY);
    scheduleReorderSessionUpdate(event.clientY);
  });

  window.addEventListener('pointerup', function (event) {
    if (
      !ui.sortMode ||
      !ui.reorderSession ||
      ui.reorderSession.pointerId !== event.pointerId
    ) {
      return;
    }

    commitReorderSession();
  });

  window.addEventListener('pointercancel', function (event) {
    if (
      !ui.reorderSession ||
      ui.reorderSession.pointerId !== event.pointerId
    ) {
      return;
    }

    cancelReorderSession();
  });

  root.addEventListener('pointerleave', function (event) {
    if (
      !ui.reorderSession ||
      ui.reorderSession.pointerId !== event.pointerId
    ) {
      return;
    }

    scheduleReorderSessionUpdate(event.clientY);
  });

  root.addEventListener('submit', function (event) {
    event.preventDefault();

    const form = event.target;

    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const formType = form.getAttribute('data-form');
    const formData = new FormData(form);
    const strings = ui.state.strings;

    if (formType === 'add') {
      if (ui.pendingForm === 'add') {
        return;
      }

      const content = normalizeRequiredContent(formData.get('content'));

      if (!content) {
        pushToast(strings.helpers.contentRequired || '', 'error');
        return;
      }

      ui.pendingForm = 'add';
      ui.skipDraftSyncOnce = true;
      render();
      postMessage({
        type: 'createPrompt',
        draft: {
          title: trimTitle(String(formData.get('title') || '')),
          modelLevel: normalizeModelLevel(formData.get('modelLevel')) || null,
          content: content,
        },
      });
      return;
    }

    if (formType === 'edit' && ui.panel && ui.panel.type === 'edit') {
      if (ui.pendingForm === 'edit') {
        return;
      }

      const content = normalizeRequiredContent(formData.get('content'));

      if (!content) {
        pushToast(strings.helpers.contentRequired || '', 'error');
        return;
      }

      const draft = {
        title: trimTitle(String(formData.get('title') || '')),
        modelLevel: normalizeModelLevel(formData.get('modelLevel')),
        content: content,
      };

      if (ui.settingsMode && ui.modeSession) {
        if (stagePromptEdit(ui.panel.promptId, draft)) {
          closePanel();
        }
        return;
      }

      ui.pendingForm = 'edit';
      ui.skipDraftSyncOnce = true;
      render();
      postMessage({
        type: 'updatePrompt',
        promptId: ui.panel.promptId,
        draft: {
          ...draft,
          modelLevel: draft.modelLevel || null,
        },
      });
      return;
    }

    if (formType === 'import') {
      if (ui.pendingForm === 'import') {
        return;
      }

      const text = String(formData.get('importText') || '').trim();

      if (!text) {
        pushToast(strings.helpers.importRequired || '', 'error');
        return;
      }

      ui.pendingForm = 'import';
      ui.skipDraftSyncOnce = true;
      render();
      postMessage({
        type: 'importPrompts',
        mode: 'append',
        text: text,
      });
      return;
    }

    if (formType === 'settings-import') {
      if (ui.pendingForm === 'import') {
        return;
      }

      const text = String(formData.get('importText') || '').trim();

      if (!text) {
        pushToast(strings.helpers.importRequired || '', 'error');
        return;
      }

      ui.pendingForm = 'import';
      ui.skipDraftSyncOnce = true;
      render();
      postMessage({
        type: 'importPrompts',
        mode: 'append',
        text: text,
      });
      return;
    }

    if (formType === 'settings-config') {
      if (ui.pendingForm === 'settings') {
        return;
      }

      ui.pendingForm = 'settings';
      ui.skipDraftSyncOnce = true;
      render();
      postMessage({
        type: 'updateCopySettings',
        settings: buildCopySettingsPayload({
          copyMode: String(formData.get('copyMode') || 'direct'),
          includeTemplateOnClick:
            formData.get('includeTemplateOnClick') === 'on',
          prefix: String(formData.get('prefix') || ''),
          quickRunCommand: String(formData.get('quickRunCommand') || ''),
          quickRunEnabled: formData.get('quickRunEnabled') === 'on',
          suffix: String(formData.get('suffix') || ''),
        }),
      });
    }
  });

  root.addEventListener('paste', function (event) {
    const target = event.target;

    if (
      !(target instanceof HTMLTextAreaElement) ||
      target.name !== 'content' ||
      !ui.panel ||
      ui.panel.type !== 'add' ||
      !ui.panelDraft ||
      !inputParser ||
      typeof inputParser.parseStructuredPromptText !== 'function'
    ) {
      return;
    }

    const pastedText = event.clipboardData
      ? event.clipboardData.getData('text/plain')
      : '';

    if (!pastedText) {
      return;
    }

    let parsedItems;

    try {
      parsedItems = inputParser.parseStructuredPromptText(pastedText);
    } catch (error) {
      event.preventDefault();
      pushToast(error instanceof Error ? error.message : String(error), 'error');
      return;
    }

    if (!parsedItems) {
      return;
    }

    event.preventDefault();

    if (parsedItems.length !== 1) {
      pushToast(ui.state.strings.helpers.bulkImport || '', 'error');
      return;
    }

    const parsed = parsedItems[0];
    const titleField = findPanelField('title');
    const currentTitle = titleField instanceof HTMLInputElement
      ? titleField.value
      : String(ui.panelDraft.title || '');
    const currentModelLevel = normalizeModelLevel(ui.panelDraft.modelLevel);

    ui.panelDraft = {
      ...ui.panelDraft,
      content: parsed.content,
      modelLevel: parsed.modelLevel || currentModelLevel || '',
      title: currentTitle.trim().length > 0 ? currentTitle : parsed.title || '',
    };
    ui.skipDraftSyncOnce = true;
    setPendingFocus('content', {
      end: parsed.content.length,
      start: parsed.content.length,
    });
    render();
  });

  root.addEventListener('input', function (event) {
    const target = event.target;

    if (
      !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
    ) {
      return;
    }

    const drawer = target.closest('.pq-drawer');

    if (!(drawer instanceof HTMLElement) || !ui.panelDraft) {
      return;
    }

    ui.panelDraft = {
      ...ui.panelDraft,
      [target.name]:
        target instanceof HTMLInputElement && target.type === 'checkbox'
          ? target.checked
          : target.value,
    };
  });

  root.addEventListener('change', function (event) {
    const target = event.target;

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.getAttribute('data-setting-toggle') !== 'includeTemplateOnClick') {
      return;
    }

    ui.state.copySettings.includeTemplateOnClick = target.checked;

    if (
      ui.panelDraft &&
      Object.prototype.hasOwnProperty.call(ui.panelDraft, 'includeTemplateOnClick')
    ) {
      ui.panelDraft.includeTemplateOnClick = target.checked;
    }

    postMessage({
      type: 'updateCopySettings',
      silent: true,
      settings: buildCopySettingsPayload({
        includeTemplateOnClick: target.checked,
      }),
    });
  });

  root.addEventListener('contextmenu', function (event) {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const card = target.closest('[data-card-id]');

    if (!(card instanceof HTMLElement)) {
      return;
    }

    const isExplicitContextMenuTrigger =
      event.button === 2 || event.ctrlKey || event.detail === 0;

    if (!isExplicitContextMenuTrigger || ui.sortMode || ui.settingsMode) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    openMenu({
      kind: 'item',
      promptId: card.getAttribute('data-card-id'),
      x: event.clientX,
      y: event.clientY,
    });
  });

  window.addEventListener('message', function (event) {
    const message = event.data;

    if (!message || typeof message !== 'object') {
      return;
    }

    if (message.type === 'state') {
      ui.state = message.state;

      if (!ui.receivedState) {
        queueAutoScroll();
      }

      if (!ui.modeSession && ui.state.items.length < 2 && ui.sortMode) {
        ui.sortMode = false;
        cancelReorderSession();
      }

      if (!ui.modeSession && ui.state.items.length === 0 && ui.settingsMode) {
        ui.settingsMode = false;
      }

      ui.receivedState = true;
      render();
      return;
    }

    if (message.type === 'panelCommand') {
      if (message.command === 'resetAddForm') {
        resetAddForm();
      }

      if (message.command === 'closeEditPanel') {
        if (ui.panel && ui.panel.type === 'edit') {
          closePanel();
        }
      }

      if (message.command === 'closeSettingsPanel') {
        if (ui.panel && ui.panel.type === 'settings') {
          closePanel();
        }
      }

      if (message.command === 'finishImport') {
        if (ui.panel && ui.panel.type === 'import') {
          closePanel();
        }

        if (ui.panel && ui.panel.type === 'settings' && ui.panelDraft) {
          ui.pendingForm = null;
          ui.panelDraft = {
            ...ui.panelDraft,
            importText: '',
          };
          ui.skipDraftSyncOnce = true;
          render();
        }
      }

      if (message.command === 'finishPromptMode') {
        finishPromptModeAfterSave();
      }
      return;
    }

    if (message.type === 'toast') {
      pushToast(message.message, 'success');
      return;
    }

    if (message.type === 'error') {
      ui.pendingForm = null;
      ui.pendingModeSave = false;
      pushToast(message.message, 'error');
    }
  });

  window.addEventListener(
    'scroll',
    function () {
      if (ui.menu) {
        closeMenu();
      }
    },
    true,
  );

  window.addEventListener('blur', function () {
    if (ui.reorderSession) {
      cancelReorderSession();
      return;
    }

    if (ui.menu) {
      closeMenu();
    }
  });

  window.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && ui.reorderSession) {
      cancelReorderSession();
      return;
    }

    if (event.key !== 'Escape') {
      return;
    }

    if (ui.menu) {
      closeMenu();
      return;
    }

    if (ui.panel) {
      closePanel();
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      if (ui.menu) {
        closeMenu();
      }
      return;
    }

    if (document.visibilityState === 'visible') {
      postMessage({ type: 'requestState' });
      queueAutoScroll();
      flushAutoScroll();
    }
  });

  window.setInterval(function () {
    if (!ui.receivedState || document.visibilityState === 'hidden') {
      return;
    }

    const hasCopiedItems = ui.state.items.some(function (item) {
      return item.used && typeof item.copyAgeLabel === 'string';
    });

    if (!hasCopiedItems) {
      return;
    }

    postMessage({ type: 'requestState' });
  }, COPY_AGE_REFRESH_INTERVAL_MS);

  render();
  postMessage({ type: 'requestState' });
})();
