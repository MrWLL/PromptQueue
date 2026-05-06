(function () {
  const vscode = acquireVsCodeApi();
  const root = document.getElementById('promptqueue-app');
  const COPY_AGE_REFRESH_INTERVAL_MS = 60 * 1000;

  const ui = {
    dragSourceId: null,
    longPressTimer: null,
    longPressTriggered: false,
    menu: null,
    pendingAutoScroll: false,
    pendingFocus: null,
    panel: null,
    panelDraft: null,
    receivedState: false,
    skipDraftSyncOnce: false,
    state: createEmptyState(),
    toasts: [],
  };

  function createEmptyState() {
    return {
      canRestoreLastDeleted: false,
      copySettings: {
        includeTemplateOnClick: true,
        prefix: '',
        quickRunCommand: '/new',
        quickRunEnabled: false,
        suffix: '',
      },
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
        nextDraft[field.name] =
          field.type === 'checkbox' ? field.checked : field.value;
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
    ui.pendingFocus = null;
    ui.skipDraftSyncOnce = true;
    render();
  }

  function openMenu(menu) {
    ui.menu = menu;
    render();
  }

  function openAnchoredMenu(anchor, menu) {
    const rect = anchor.getBoundingClientRect();

    openMenu({
      ...menu,
      x: rect.right - 12,
      y: rect.bottom + 6,
    });
  }

  function closeMenu() {
    clearTimeout(ui.longPressTimer);
    ui.longPressTriggered = false;

    if (!ui.menu) {
      return;
    }

    ui.menu = null;
    render();
  }

  function clearDragState() {
    ui.dragSourceId = null;

    root.querySelectorAll('.pq-card-drag-over').forEach(function (card) {
      card.classList.remove('pq-card-drag-over');
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

  function getPanelValues() {
    if (!ui.panel) {
      return null;
    }

    if (ui.panelDraft) {
      return ui.panelDraft;
    }

    if (ui.panel.type === 'edit') {
      const prompt = ui.state.items.find(function (item) {
        return item.id === ui.panel.promptId;
      });

      if (!prompt) {
        return null;
      }

      return {
        content: prompt.content,
        title: prompt.title || '',
      };
    }

    if (ui.panel.type === 'settings') {
      return {
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
      title: '',
    };
  }

  function createPanelDraft(panel) {
    if (panel.type === 'edit') {
      const prompt = ui.state.items.find(function (item) {
        return item.id === panel.promptId;
      });

      if (!prompt) {
        return null;
      }

      return {
        content: prompt.content,
        title: prompt.title || '',
      };
    }

    if (panel.type === 'settings') {
      return {
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
      title: '',
    };
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

  function renderQueueSummary() {
    const strings = ui.state.strings;
    const total = ui.state.items.length;
    const used = getUsedCount(ui.state.items);

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

  function buttonMarkup(action, label, className, disabled) {
    return (
      '<button class="' +
      className +
      '" data-action="' +
      action +
      '"' +
      (disabled ? ' disabled' : '') +
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
    return (
      '<section class="pq-header">' +
      '<div class="pq-header-actions">' +
      buttonMarkup('open-add', ui.state.strings.actions.add, 'pq-btn pq-btn-primary') +
      buttonMarkup('open-settings', ui.state.strings.actions.settings, 'pq-btn pq-btn-secondary') +
      buttonMarkup('quick-run', ui.state.strings.actions.quickRun, 'pq-btn pq-btn-secondary', ui.state.quickRunAvailability !== 'ready') +
      '</div>' +
      '</section>'
    );
  }

  function renderFooter() {
    return (
      '<footer class="pq-footer">' +
      '<div class="pq-footer-summary">' +
      getUsedCount(ui.state.items) +
      ' / ' +
      ui.state.items.length +
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

    if (!ui.state.items.length) {
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

    return ui.state.items
      .map(function (item) {
        const display = getCardDisplay(item);
        const copyAgeLabel = getCardCopyAgeLabel(item);

        return (
          '<article class="pq-card ' +
          (item.used ? 'pq-card-used ' : '') +
          '" data-card-id="' +
          escapeHtml(item.id) +
          '" draggable="true">' +
          '<div class="pq-card-side">' +
          '<button class="pq-card-rail ' +
          (item.used ? 'pq-card-rail-used' : '') +
          '" data-action="toggle-used" data-prompt-id="' +
          escapeHtml(item.id) +
          '" aria-label="toggle used"></button>' +
          (copyAgeLabel
            ? '<div class="pq-card-age">' + escapeHtml(copyAgeLabel) + '</div>'
            : '') +
          '</div>' +
          '<div class="pq-card-main">' +
          '<div class="pq-card-title">' +
          escapeHtml(display.title) +
          '</div>' +
          (display.body
            ? '<div class="pq-card-body">' + escapeHtml(display.body) + '</div>'
            : '') +
          '</div>' +
          '<button class="pq-icon-btn pq-card-menu-trigger" data-action="open-item-menu" data-prompt-id="' +
          escapeHtml(item.id) +
          '" aria-label="' +
          escapeHtml(ui.state.strings.actions.more || 'More') +
          '">' +
          '&hellip;' +
          '</button>' +
          '</article>'
        );
      })
      .join('');
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
        renderTextArea(
          strings.fields.content,
          strings.placeholders.content,
          'content',
          values.content || '',
        ) +
        '<div class="pq-helper">' +
        escapeHtml(strings.helpers.contentRequired || '') +
        '</div>' +
        renderFormActions() +
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
        renderFormActions() +
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
          '<button class="pq-btn pq-btn-secondary" type="submit">' +
            escapeHtml(strings.actions.bulkImport || '') +
            '</button>',
        ) +
        '</form>' +
        '<form class="pq-form" data-form="settings-config">' +
        renderSettingsSection(
          strings.sections.copyBehavior,
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
        renderFormActions() +
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

  function renderFormActions() {
    return (
      '<div class="pq-drawer-actions">' +
      '<button class="pq-btn pq-btn-ghost" type="button" data-action="close-panel">' +
      escapeHtml(ui.state.strings.buttons.cancel || '') +
      '</button>' +
      '<button class="pq-btn pq-btn-primary" type="submit">' +
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
            escapeHtml(toast.message) +
            '</div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function render() {
    if (ui.skipDraftSyncOnce) {
      ui.skipDraftSyncOnce = false;
    } else {
      syncPanelDraftFromDom();
      capturePanelFocusBeforeRender();
    }

    root.innerHTML =
      '<div class="pq-shell">' +
      renderHeader() +
      '<section class="pq-list">' +
      renderCards() +
      '</section>' +
      renderFooter() +
      '</div>' +
      renderDrawer() +
      renderMenu() +
      renderToasts();

    restorePanelFocus();
    adjustMenuPosition();
    flushAutoScroll();
  }

  function buildCopySettingsPayload(overrides) {
    return {
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

      if (
        actionTarget === target &&
        actionTarget.getAttribute('data-action') === 'close-panel'
      ) {
        closePanel();
        return;
      }

      const action = actionTarget.getAttribute('data-action');
      const promptId = actionTarget.getAttribute('data-prompt-id');

      if (action === 'open-item-menu' && promptId) {
        openAnchoredMenu(actionTarget, {
          kind: 'item',
          promptId: promptId,
        });
        return;
      }

      handleAction(action, promptId);
      return;
    }

    const drawer = target.closest('.pq-drawer');

    if (drawer instanceof HTMLElement) {
      return;
    }

    const card = target.closest('[data-card-id]');

    if (!(card instanceof HTMLElement)) {
      closeMenu();
      return;
    }

    if (ui.longPressTriggered) {
      ui.longPressTriggered = false;
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
      promptId: card.getAttribute('data-card-id'),
    });
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
      const content = String(formData.get('content') || '').trim();

      if (!content) {
        pushToast(strings.helpers.contentRequired || '', 'error');
        return;
      }

      postMessage({
        type: 'createPrompt',
        draft: {
          title: trimTitle(String(formData.get('title') || '')),
          content: content,
        },
      });
      return;
    }

    if (formType === 'edit' && ui.panel && ui.panel.type === 'edit') {
      const content = String(formData.get('content') || '').trim();

      if (!content) {
        pushToast(strings.helpers.contentRequired || '', 'error');
        return;
      }

      postMessage({
        type: 'updatePrompt',
        promptId: ui.panel.promptId,
        draft: {
          title: trimTitle(String(formData.get('title') || '')),
          content: content,
        },
      });
      closePanel();
      return;
    }

    if (formType === 'import') {
      const text = String(formData.get('importText') || '').trim();

      if (!text) {
        pushToast(strings.helpers.importRequired || '', 'error');
        return;
      }

      postMessage({
        type: 'importPrompts',
        mode: 'append',
        text: text,
      });
      closePanel();
      return;
    }

    if (formType === 'settings-import') {
      const text = String(formData.get('importText') || '').trim();

      if (!text) {
        pushToast(strings.helpers.importRequired || '', 'error');
        return;
      }

      postMessage({
        type: 'importPrompts',
        mode: 'append',
        text: text,
      });
      ui.panelDraft = {
        ...ui.panelDraft,
        importText: '',
      };
      ui.skipDraftSyncOnce = true;
      render();
      return;
    }

    if (formType === 'settings-config') {
      postMessage({
        type: 'updateCopySettings',
        settings: buildCopySettingsPayload({
          includeTemplateOnClick:
            formData.get('includeTemplateOnClick') === 'on',
          prefix: String(formData.get('prefix') || ''),
          quickRunCommand: String(formData.get('quickRunCommand') || ''),
          quickRunEnabled: formData.get('quickRunEnabled') === 'on',
          suffix: String(formData.get('suffix') || ''),
        }),
      });
      closePanel();
    }
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

    event.preventDefault();
    openMenu({
      kind: 'item',
      promptId: card.getAttribute('data-card-id'),
      x: event.clientX,
      y: event.clientY,
    });
  });

  root.addEventListener('pointerdown', function (event) {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const card = target.closest('[data-card-id]');

    if (!(card instanceof HTMLElement)) {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    clearTimeout(ui.longPressTimer);
    ui.longPressTimer = window.setTimeout(function () {
      ui.longPressTriggered = true;
      openMenu({
        kind: 'item',
        promptId: card.getAttribute('data-card-id'),
        x: event.clientX,
        y: event.clientY,
      });
    }, 520);
  });

  root.addEventListener('pointerup', function () {
    clearTimeout(ui.longPressTimer);
  });

  root.addEventListener('pointerleave', function () {
    clearTimeout(ui.longPressTimer);
  });

  root.addEventListener('dragstart', function (event) {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const card = target.closest('[data-card-id]');

    if (!(card instanceof HTMLElement)) {
      return;
    }

    clearDragState();
    ui.dragSourceId = card.getAttribute('data-card-id');

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', ui.dragSourceId || '');
    }
  });

  root.addEventListener('dragend', function () {
    clearDragState();
  });

  root.addEventListener('dragover', function (event) {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const card = target.closest('[data-card-id]');

    if (!(card instanceof HTMLElement)) {
      return;
    }

    const targetId = card.getAttribute('data-card-id');

    if (!ui.dragSourceId || !targetId || ui.dragSourceId === targetId) {
      return;
    }

    event.preventDefault();
    card.classList.add('pq-card-drag-over');
  });

  root.addEventListener('dragleave', function (event) {
    const target = event.target;

    if (target instanceof HTMLElement) {
      const card = target.closest('[data-card-id]');

      if (card instanceof HTMLElement) {
        card.classList.remove('pq-card-drag-over');
      }
    }
  });

  root.addEventListener('drop', function (event) {
    event.preventDefault();

    const sourceId = ui.dragSourceId;
    clearDragState();

    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const card = target.closest('[data-card-id]');

    if (!(card instanceof HTMLElement)) {
      return;
    }

    const targetId = card.getAttribute('data-card-id');

    if (!sourceId || !targetId || sourceId === targetId) {
      return;
    }

    postMessage({
      type: 'reorderPrompts',
      sourceId: sourceId,
      targetId: targetId,
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

      ui.receivedState = true;
      render();
      return;
    }

    if (message.type === 'panelCommand') {
      if (message.command === 'resetAddForm') {
        resetAddForm();
      }
      return;
    }

    if (message.type === 'toast') {
      pushToast(message.message, 'success');
      return;
    }

    if (message.type === 'error') {
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
    if (ui.menu) {
      closeMenu();
    }
  });

  window.addEventListener('keydown', function (event) {
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
