(function () {
  const STRINGS = {
    actions: {
      add: '新增',
      bulkImport: '批量导入',
      copyRaw: '仅复制正文',
      delete: '删除',
      deleteAll: '全部删除',
      edit: '编辑',
      moveDown: '下移',
      moveUp: '上移',
      restoreLastDeleted: '恢复上次删除',
      settings: '设置',
    },
    buttons: {
      cancel: '取消',
      close: '关闭',
      save: '保存',
    },
    confirmations: {
      deleteAll: '确认删除全部提示词吗？',
      deletePrompt: '确认删除这条提示词吗？',
      destructiveDetail: '此操作不可撤销。',
      restoreReplace: '恢复会覆盖当前列表，是否继续？',
    },
    emptyState: {
      body: '先新增一条提示词，或者直接批量导入。',
      noWorkspaceBody: '当前是 playground 的“无工作区”模式，用来模拟真实插件在没有工作区时的提示。',
      noWorkspaceTitle: '当前没有可用工作区',
      title: '这里还是空的',
    },
    fields: {
      content: '正文',
      includeTemplateOnClick: '附带前后缀',
      prefix: '前提示词',
      suffix: '后提示词',
      title: '标题',
    },
    helpers: {
      bulkImport: '按 “-*- 标题” 或 “-*-” 分隔多条提示词。',
      contentRequired: '正文不能为空',
      includeTemplateOnClickHint: '关闭后，左键单击只复制正文；右键菜单仍可手动选择复制方式。',
      importRequired: '没有可导入内容',
      prefixHint: '留空会自动省略这一段。单独填 ``` 或 ```ts 会自动补全代码块围栏。',
      suffixHint: '留空会自动省略这一段。单独填 ``` 或 ```ts 会自动补全代码块围栏。',
      titleOptional: '标题可选',
    },
    labels: {
      storage: '存储',
      total: '总数',
      used: '已使用',
    },
    messages: {
      created: '已新增',
      copied: '已复制',
      deleted: '已删除',
      deletedAll: '已全部删除',
      imported: '已导入',
      noLastDeletedBackup: '没有可恢复的上次删除记录',
      noWorkspace: '请先打开一个工作区文件夹。',
      restored: '已恢复',
      saved: '已保存',
      updated: '已更新',
    },
    panels: {
      add: '新增提示词',
      bulkImport: '批量导入',
      edit: '编辑提示词',
      settings: '复制设置',
    },
    placeholders: {
      content: '输入提示词正文',
      import: '-*- 标题1\n提示词1\n-*- 标题2\n提示词2',
      prefix: '每次复制时自动加在最前面',
      suffix: '每次复制时自动加在最后面',
      title: '可选标题',
    },
    status: {
      untitled: '<无标题>',
    },
  };

  const clipboardBox = document.getElementById('playground-clipboard');
  const clipboardStatus = document.getElementById('playground-clipboard-status');
  const copyModeLabel = document.getElementById('playground-copy-mode');
  const logBox = document.getElementById('playground-log');
  const resetButton = document.getElementById('playground-reset');
  const seedButton = document.getElementById('playground-seed');
  const summaryBox = document.getElementById('playground-summary');
  const workspaceButton = document.getElementById('playground-workspace');

  const debug = {
    lastClipboardText: '',
    logs: [],
  };

  let deletedBackup = undefined;

  const state = {
    canRestoreLastDeleted: false,
    copySettings: {
      includeTemplateOnClick: true,
      prefix: '请先阅读以下上下文，再完成任务：',
      suffix: '输出时请分点、准确、不要省略关键约束。',
    },
    dataReady: true,
    items: createSeedItems(18),
    storageLabel: 'Playground/PromptQueue',
    strings: STRINGS,
    workspaceReady: true,
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function now() {
    return new Date().toISOString();
  }

  function createSeedItems(count) {
    const timestamp = now();
    const items = [];

    for (let index = 1; index <= count; index += 1) {
      const isBottomTester = index === count;
      const title = index % 4 === 0 ? undefined : `测试提示词 ${index}`;
      const content = isBottomTester
        ? '滚到最下面以后，右键这条卡片，检查菜单是否仍然完整出现在可视区域内。'
        : index % 3 === 0
          ? '请把下面这段需求改写成一个更适合发给大模型的高质量提示词，并保留关键限制条件。'
          : index % 2 === 0
            ? '你是一名谨慎的代码审查助手。请先列风险，再给修改建议，最后给验证方案。'
            : '将用户需求拆解成实现步骤、边界情况和测试清单，保持输出结构稳定。';

      items.push({
        id: `playground-${index}`,
        title: title,
        content: content,
        used: index <= 2,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    return items;
  }

  function addLog(kind, payload) {
    debug.logs.unshift({
      id: `${Date.now()}-${Math.random()}`,
      kind: kind,
      payload: payload,
    });
    debug.logs = debug.logs.slice(0, 24);
    renderDebug();
  }

  function renderDebug() {
    const usedCount = state.items.filter(function (item) {
      return item.used;
    }).length;

    summaryBox.textContent =
      `卡片 ${state.items.length} 条，已使用 ${usedCount} 条，` +
      `恢复备份 ${state.canRestoreLastDeleted ? '可用' : '不可用'}。`;
    copyModeLabel.textContent =
      `左键复制模式：${state.copySettings.includeTemplateOnClick ? '附带前后提示词' : '只复制正文'}。`;
    clipboardStatus.textContent =
      `工作区状态：${state.workspaceReady ? '可用' : '无工作区'}。`;
    clipboardBox.value = debug.lastClipboardText;
    logBox.innerHTML = debug.logs
      .map(function (entry) {
        return (
          '<div class="playground-log-item">' +
          `${entry.kind}\n${escapeHtml(entry.payload)}` +
          '</div>'
        );
      })
      .join('');
    workspaceButton.textContent = state.workspaceReady ? '切换无工作区' : '恢复工作区';
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function emit(message) {
    window.postMessage(message, '*');
  }

  function emitState() {
    state.canRestoreLastDeleted = Array.isArray(deletedBackup) && deletedBackup.length > 0;
    renderDebug();
    emit({
      type: 'state',
      state: clone(state),
    });
  }

  function emitToast(message) {
    addLog('toast', message);
    emit({
      type: 'toast',
      message: message,
    });
  }

  function emitError(message) {
    addLog('error', message);
    emit({
      type: 'error',
      message: message,
    });
  }

  function emitPanelCommand(command) {
    addLog('panelCommand', command);
    emit({
      type: 'panelCommand',
      command: command,
    });
  }

  function getRequiredItem(id) {
    const item = state.items.find(function (entry) {
      return entry.id === id;
    });

    if (!item) {
      throw new Error(`Prompt item not found: ${id}`);
    }

    return item;
  }

  function normalizeCopySettings(settings) {
    const normalizeText = function (value) {
      const normalized = String(value || '').replace(/\r\n/g, '\n');
      return normalized.trim().length === 0 ? '' : normalized;
    };

    return {
      includeTemplateOnClick:
        typeof settings.includeTemplateOnClick === 'boolean'
          ? settings.includeTemplateOnClick
          : true,
      prefix: normalizeText(settings.prefix),
      suffix: normalizeText(settings.suffix),
    };
  }

  function parseStandaloneMarkdownFence(value) {
    const trimmed = String(value || '').trim();

    if (trimmed.length === 0 || trimmed.includes('\n')) {
      return undefined;
    }

    const match = trimmed.match(/^(`{3,}|~{3,})([^\r\n]*)$/);

    if (!match) {
      return undefined;
    }

    return {
      opening: trimmed,
      closing: match[1],
    };
  }

  function buildCopyText(content, mode) {
    if (mode === 'raw') {
      return content;
    }

    const prefix = state.copySettings.prefix;
    const suffix = state.copySettings.suffix;
    const prefixFence = parseStandaloneMarkdownFence(prefix);
    const suffixFence = parseStandaloneMarkdownFence(suffix);
    let sections;

    if (prefixFence && suffix.trim().length === 0) {
      sections = [prefixFence.opening, content, prefixFence.closing];
    } else if (suffixFence && prefix.trim().length === 0) {
      sections = [suffixFence.opening, content, suffixFence.closing];
    } else {
      sections = [prefix, content, suffix];
    }

    return sections
      .filter(function (section) {
        return String(section).trim().length > 0;
      })
      .join('\n');
  }

  async function writeClipboard(text) {
    debug.lastClipboardText = text;

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        addLog('clipboard', '已写入系统剪贴板');
      } else {
        addLog('clipboard', '当前浏览器环境不支持系统剪贴板，已保存在右侧预览框');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog('clipboard', `系统剪贴板写入失败，已保存在右侧预览框\n${message}`);
    }

    renderDebug();
  }

  function createPromptFromDraft(draft) {
    const timestamp = now();

    return {
      id: `playground-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: draft.title,
      content: draft.content,
      used: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  function parseImportText(text) {
    const normalized = String(text || '').replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');
    const items = [];
    let currentTitle;
    let currentLines = [];

    function pushCurrent() {
      const content = currentLines.join('\n').trim();

      if (!content) {
        currentLines = [];
        currentTitle = undefined;
        return;
      }

      items.push({
        title: currentTitle,
        content: content,
      });
      currentLines = [];
      currentTitle = undefined;
    }

    lines.forEach(function (line) {
      const match = line.match(/^\s*-\*-\s*(.*)$/);

      if (match) {
        pushCurrent();
        const title = match[1].trim();
        currentTitle = title.length > 0 ? title : undefined;
        return;
      }

      currentLines.push(line);
    });

    pushCurrent();

    if (!items.length) {
      const content = normalized.trim();

      if (content.length > 0) {
        items.push({
          title: undefined,
          content: content,
        });
      }
    }

    return items;
  }

  async function handleWebviewMessage(message) {
    addLog('from webview', JSON.stringify(message, null, 2));

    try {
      if (message.type !== 'requestState' && !state.workspaceReady) {
        throw new Error(STRINGS.messages.noWorkspace);
      }

      if (message.type === 'requestState') {
        emitState();
        return;
      }

      if (message.type === 'copyPrompt' || message.type === 'copyPromptRaw') {
        const item = getRequiredItem(message.promptId);
        const mode = message.type === 'copyPrompt' ? 'templated' : 'raw';
        const text = buildCopyText(item.content, mode);
        item.used = true;
        item.updatedAt = now();
        await writeClipboard(text);
        emitToast(STRINGS.messages.copied);
        emitState();
        return;
      }

      if (message.type === 'toggleUsed') {
        const item = getRequiredItem(message.promptId);
        item.used = !item.used;
        item.updatedAt = now();
        emitState();
        return;
      }

      if (message.type === 'createPrompt') {
        state.items.push(createPromptFromDraft(message.draft));
        emitPanelCommand('resetAddForm');
        emitToast(STRINGS.messages.created);
        emitState();
        return;
      }

      if (message.type === 'updatePrompt') {
        const item = getRequiredItem(message.promptId);
        item.title = message.draft.title;
        item.content = message.draft.content;
        item.updatedAt = now();
        emitToast(STRINGS.messages.updated);
        emitState();
        return;
      }

      if (message.type === 'importPrompts') {
        const parsed = parseImportText(message.text);

        if (!parsed.length) {
          throw new Error(STRINGS.helpers.importRequired);
        }

        const created = parsed.map(createPromptFromDraft);
        state.items = message.mode === 'replace'
          ? created
          : state.items.concat(created);
        emitToast(STRINGS.messages.imported);
        emitState();
        return;
      }

      if (message.type === 'deletePrompt') {
        state.items = state.items.filter(function (item) {
          return item.id !== message.promptId;
        });
        emitToast(STRINGS.messages.deleted);
        emitState();
        return;
      }

      if (message.type === 'deleteAllPrompts') {
        deletedBackup = clone(state.items);
        state.items = [];
        emitToast(STRINGS.messages.deletedAll);
        emitState();
        return;
      }

      if (message.type === 'restoreLastDeleted') {
        if (!Array.isArray(deletedBackup) || !deletedBackup.length) {
          throw new Error(STRINGS.messages.noLastDeletedBackup);
        }

        state.items = clone(deletedBackup);
        emitToast(STRINGS.messages.restored);
        emitState();
        return;
      }

      if (message.type === 'movePrompt') {
        const index = state.items.findIndex(function (item) {
          return item.id === message.promptId;
        });
        const targetIndex = message.direction === 'up' ? index - 1 : index + 1;

        if (
          index < 0 ||
          targetIndex < 0 ||
          targetIndex >= state.items.length
        ) {
          emitState();
          return;
        }

        const temp = state.items[index];
        state.items[index] = state.items[targetIndex];
        state.items[targetIndex] = temp;
        emitState();
        return;
      }

      if (message.type === 'reorderPrompts') {
        const sourceIndex = state.items.findIndex(function (item) {
          return item.id === message.sourceId;
        });
        const targetIndex = Number(message.targetIndex);

        if (
          sourceIndex < 0 ||
          Number.isNaN(targetIndex) ||
          targetIndex < 0 ||
          targetIndex > state.items.length - 1
        ) {
          emitState();
          return;
        }

        const moved = state.items.splice(sourceIndex, 1)[0];
        state.items.splice(targetIndex, 0, moved);
        emitState();
        return;
      }

      if (message.type === 'updateCopySettings') {
        state.copySettings = normalizeCopySettings(message.settings);

        if (!message.silent) {
          emitToast(STRINGS.messages.saved);
        }

        emitState();
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      emitError(messageText);
      emitState();
    }
  }

  window.acquireVsCodeApi = function acquireVsCodeApi() {
    return {
      getState: function getState() {
        return undefined;
      },
      postMessage: function postMessage(message) {
        void handleWebviewMessage(message);
      },
      setState: function setState(value) {
        return value;
      },
    };
  };

  resetButton.addEventListener('click', function () {
    deletedBackup = undefined;
    state.workspaceReady = true;
    state.copySettings = {
      includeTemplateOnClick: true,
      prefix: '请先阅读以下上下文，再完成任务：',
      suffix: '输出时请分点、准确、不要省略关键约束。',
    };
    state.items = createSeedItems(18);
    addLog('debug', '已重置 playground 样例数据');
    emitState();
  });

  seedButton.addEventListener('click', function () {
    state.items = createSeedItems(36);
    addLog('debug', '已生成更多卡片，适合测试底部右键菜单');
    emitState();
  });

  workspaceButton.addEventListener('click', function () {
    state.workspaceReady = !state.workspaceReady;
    addLog(
      'debug',
      state.workspaceReady ? '已恢复工作区模式' : '已切换为无工作区模式',
    );
    emitState();
  });

  renderDebug();
})();
