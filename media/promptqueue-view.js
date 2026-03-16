(function () {
  const vscode = acquireVsCodeApi();
  const root = document.getElementById('promptqueue-app');

  const ui = {
    dragSourceId: null,
    longPressTimer: null,
    longPressTriggered: false,
    menu: null,
    panel: null,
    state: createEmptyState(),
    toasts: [],
  };

  function createEmptyState() {
    return {
      canRestoreLastDeleted: false,
      copySettings: { prefix: '', suffix: '' },
      items: [],
      storageLabel: '',
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

  function getCardDisplay(item) {
    const content = item.content || '';

    if (item.title) {
      return {
        title: item.title,
        body: content,
      };
    }

    const lines = content.split(/\r?\n/).filter(Boolean);
    const title = lines[0] || ui.state.strings.status.untitled || 'Untitled';
    const body = lines.slice(1).join('\n');

    return { title, body };
  }

  function openPanel(panel) {
    ui.panel = panel;
    closeMenu();
    render();
  }

  function closePanel() {
    ui.panel = null;
    render();
  }

  function openMenu(promptId, x, y) {
    ui.menu = { promptId, x, y };
    render();
  }

  function closeMenu() {
    clearTimeout(ui.longPressTimer);
    ui.longPressTriggered = false;
    ui.menu = null;
    render();
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
        prefix: ui.state.copySettings.prefix,
        suffix: ui.state.copySettings.suffix,
      };
    }

    return {
      content: '',
      title: '',
    };
  }

  function renderToolbar() {
    const strings = ui.state.strings;

    return [
      buttonMarkup('open-add', strings.actions.add, 'pq-chip pq-chip-solid'),
      buttonMarkup('open-import', strings.actions.bulkImport, 'pq-chip'),
      buttonMarkup('delete-all', strings.actions.deleteAll, 'pq-chip pq-chip-danger'),
      buttonMarkup(
        'restore-last-deleted',
        strings.actions.restoreLastDeleted,
        'pq-chip pq-chip-ghost',
        !ui.state.canRestoreLastDeleted,
      ),
      buttonMarkup('open-settings', strings.actions.settings, 'pq-chip'),
    ].join('');
  }

  function buttonMarkup(action, label, className, disabled) {
    return '<button class="' +
      className +
      '" data-action="' +
      action +
      '"' +
      (disabled ? ' disabled' : '') +
      '>' +
      escapeHtml(label || '') +
      '</button>';
  }

  function renderCards() {
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

        return (
          '<article class="pq-card ' +
          (item.used ? 'pq-card-used ' : '') +
          '" data-card-id="' +
          escapeHtml(item.id) +
          '" draggable="true">' +
          '<button class="pq-dot ' +
          (item.used ? 'pq-dot-used' : '') +
          '" data-action="toggle-used" data-prompt-id="' +
          escapeHtml(item.id) +
          '" aria-label="toggle used"></button>' +
          '<div class="pq-card-main">' +
          '<div class="pq-card-title">' + escapeHtml(display.title) + '</div>' +
          (display.body
            ? '<div class="pq-card-body">' + escapeHtml(display.body) + '</div>'
            : '') +
          '</div>' +
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
        '<form class="pq-form" data-form="' + ui.panel.type + '">' +
        renderField(strings.fields.title, strings.placeholders.title, 'title', values.title || '', false) +
        '<div class="pq-helper">' + escapeHtml(strings.helpers.titleOptional || '') + '</div>' +
        renderTextArea(strings.fields.content, strings.placeholders.content, 'content', values.content || '') +
        '<div class="pq-helper">' + escapeHtml(strings.helpers.contentRequired || '') + '</div>' +
        renderFormActions() +
        '</form>';
    }

    if (ui.panel.type === 'import') {
      title = strings.panels.bulkImport;
      form =
        '<form class="pq-form" data-form="import">' +
        renderTextArea(strings.actions.bulkImport, strings.placeholders.import, 'importText', '') +
        '<div class="pq-helper">' + escapeHtml(strings.helpers.bulkImport || '') + '</div>' +
        renderFormActions() +
        '</form>';
    }

    if (ui.panel.type === 'settings') {
      title = strings.panels.settings;
      form =
        '<form class="pq-form" data-form="settings">' +
        renderTextArea(strings.fields.prefix, strings.placeholders.prefix, 'prefix', values.prefix || '') +
        '<div class="pq-helper">' + escapeHtml(strings.helpers.prefixHint || '') + '</div>' +
        renderTextArea(strings.fields.suffix, strings.placeholders.suffix, 'suffix', values.suffix || '') +
        '<div class="pq-helper">' + escapeHtml(strings.helpers.suffixHint || '') + '</div>' +
        renderFormActions() +
        '</form>';
    }

    return (
      '<div class="pq-backdrop pq-backdrop-open" data-action="close-panel">' +
      '<aside class="pq-drawer" role="dialog" aria-modal="true">' +
      '<div class="pq-drawer-shell">' +
      '<div class="pq-drawer-head">' +
      '<div class="pq-drawer-title">' + escapeHtml(title) + '</div>' +
      '<button class="pq-chip pq-chip-ghost" data-action="close-panel">' +
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
      '<span class="pq-label">' + escapeHtml(label || '') + '</span>' +
      '<input class="pq-input" name="' + escapeHtml(name) + '" value="' + escapeHtml(value || '') +
      '" placeholder="' + escapeHtml(placeholder || '') + '"' +
      (required ? ' required' : '') +
      ' />' +
      '</label>'
    );
  }

  function renderTextArea(label, placeholder, name, value) {
    return (
      '<label class="pq-field">' +
      '<span class="pq-label">' + escapeHtml(label || '') + '</span>' +
      '<textarea class="pq-textarea" name="' + escapeHtml(name) + '" placeholder="' +
      escapeHtml(placeholder || '') + '">' + escapeHtml(value || '') + '</textarea>' +
      '</label>'
    );
  }

  function renderFormActions() {
    return (
      '<div class="pq-drawer-actions">' +
      '<button class="pq-btn pq-chip-ghost" type="button" data-action="close-panel">' +
      escapeHtml(ui.state.strings.buttons.cancel || '') +
      '</button>' +
      '<button class="pq-btn pq-chip-solid" type="submit">' +
      escapeHtml(ui.state.strings.buttons.save || '') +
      '</button>' +
      '</div>'
    );
  }

  function renderMenu() {
    if (!ui.menu) {
      return '<div class="pq-menu"></div>';
    }

    const strings = ui.state.strings;

    return (
      '<div class="pq-menu pq-menu-open" style="left:' +
      Math.max(10, ui.menu.x) +
      'px; top:' +
      Math.max(10, ui.menu.y) +
      'px;">' +
      menuItemMarkup('copy-raw', strings.actions.copyRaw) +
      menuItemMarkup('edit', strings.actions.edit) +
      menuItemMarkup('move-up', strings.actions.moveUp) +
      menuItemMarkup('move-down', strings.actions.moveDown) +
      menuItemMarkup('delete', strings.actions.delete, true) +
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
    root.innerHTML =
      '<div class="pq-shell">' +
      '<section class="pq-toolbar">' + renderToolbar() + '</section>' +
      '<section class="pq-list">' + renderCards() + '</section>' +
      '</div>' +
      renderDrawer() +
      renderMenu() +
      renderToasts();
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

    if (action === 'open-import') {
      openPanel({ type: 'import' });
      return;
    }

    if (action === 'open-settings') {
      openPanel({ type: 'settings' });
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
      if (window.confirm(strings.confirmations.deleteAll || 'Delete all?')) {
        postMessage({ type: 'deleteAllPrompts' });
      }
      return;
    }

    if (action === 'restore-last-deleted') {
      if (!ui.state.canRestoreLastDeleted) {
        pushToast(strings.messages.noLastDeletedBackup || '', 'error');
        return;
      }

      if (
        ui.state.items.length > 0 &&
        !window.confirm(strings.confirmations.restoreReplace || 'Continue?')
      ) {
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

      if (action === 'copy-raw') {
        postMessage({ type: 'copyPromptRaw', promptId: promptId });
      }

      if (action === 'edit') {
        openPanel({ type: 'edit', promptId: promptId });
      }

      if (action === 'move-up') {
        postMessage({ type: 'movePrompt', promptId: promptId, direction: 'up' });
      }

      if (action === 'move-down') {
        postMessage({ type: 'movePrompt', promptId: promptId, direction: 'down' });
      }

      if (action === 'delete') {
        if (window.confirm(ui.state.strings.confirmations.deletePrompt || 'Delete?')) {
          postMessage({ type: 'deletePrompt', promptId: promptId });
        }
      }

      return;
    }

    const actionTarget = target.closest('[data-action]');

    if (actionTarget instanceof HTMLElement) {
      event.stopPropagation();

      if (actionTarget.getAttribute('data-action') === 'close-panel' && target.classList.contains('pq-backdrop')) {
        closePanel();
        return;
      }

      handleAction(
        actionTarget.getAttribute('data-action'),
        actionTarget.getAttribute('data-prompt-id'),
      );
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
      type: 'copyPrompt',
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
      closePanel();
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

    if (formType === 'settings') {
      postMessage({
        type: 'updateCopySettings',
        settings: {
          prefix: String(formData.get('prefix') || ''),
          suffix: String(formData.get('suffix') || ''),
        },
      });
      closePanel();
    }
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
    openMenu(card.getAttribute('data-card-id'), event.clientX, event.clientY);
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
      openMenu(card.getAttribute('data-card-id'), event.clientX, event.clientY);
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

    ui.dragSourceId = card.getAttribute('data-card-id');

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', ui.dragSourceId || '');
    }
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

    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const card = target.closest('[data-card-id]');

    if (!(card instanceof HTMLElement)) {
      return;
    }

    const targetId = card.getAttribute('data-card-id');
    const sourceId = ui.dragSourceId;
    card.classList.remove('pq-card-drag-over');
    ui.dragSourceId = null;

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
      render();
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

  window.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && ui.menu) {
      closeMenu();
    }
  });

  window.addEventListener('scroll', function () {
    if (ui.menu) {
      closeMenu();
    }
  }, true);

  render();
  postMessage({ type: 'requestState' });
})();
