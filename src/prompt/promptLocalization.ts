export interface PromptQueueStrings {
  actions: {
    add: string;
    bulkImport: string;
    copyRaw: string;
    delete: string;
    deleteAll: string;
    edit: string;
    more: string;
    moveDown: string;
    moveUp: string;
    quickRun: string;
    restoreLastDeleted: string;
    settings: string;
  };
  confirmations: {
    deleteAll: string;
    deletePrompt: string;
    destructiveDetail: string;
    restoreReplace: string;
  };
  emptyState: {
    body: string;
    noWorkspaceBody: string;
    noWorkspaceTitle: string;
    title: string;
  };
  fields: {
    content: string;
    includeTemplateOnClick: string;
    prefix: string;
    quickRunCommand: string;
    quickRunEnabled: string;
    suffix: string;
    title: string;
  };
  helpers: {
    bulkImport: string;
    contentRequired: string;
    includeTemplateOnClickHint: string;
    importRequired: string;
    prefixHint: string;
    quickRunCommandHint: string;
    suffixHint: string;
    titleOptional: string;
  };
  labels: {
    prompts: string;
    storage: string;
    total: string;
    used: string;
  };
  messages: {
    created: string;
    copied: string;
    deleted: string;
    deletedAll: string;
    imported: string;
    noLastDeletedBackup: string;
    noWorkspace: string;
    quickRunAmbiguousTerminal: string;
    quickRunExecuted: string;
    quickRunNoActiveTerminal: string;
    restored: string;
    saved: string;
    updated: string;
  };
  panels: {
    add: string;
    bulkImport: string;
    edit: string;
    settings: string;
  };
  placeholders: {
    content: string;
    import: string;
    prefix: string;
    quickRunCommand: string;
    suffix: string;
    title: string;
  };
  buttons: {
    cancel: string;
    close: string;
    save: string;
  };
  status: {
    untitled: string;
  };
}

const ZH_CN_STRINGS: PromptQueueStrings = {
  actions: {
    add: '新增',
    bulkImport: '批量导入',
    copyRaw: '仅复制正文',
    delete: '删除',
    deleteAll: '全部删除',
    edit: '编辑',
    more: '更多',
    moveDown: '下移',
    moveUp: '上移',
    quickRun: '快捷运行',
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
    noWorkspaceBody: '请先打开一个本地工作区文件夹，PromptQueue 才能读取和保存数据。',
    noWorkspaceTitle: '当前没有可用工作区',
    title: '这里还是空的',
  },
  fields: {
    content: '正文',
    includeTemplateOnClick: '附带前后缀',
    prefix: '前提示词',
    quickRunCommand: '快捷运行命令',
    quickRunEnabled: '启用快捷运行',
    suffix: '后提示词',
    title: '标题',
  },
  helpers: {
    bulkImport: '按 “-*- 标题” 或 “-*-” 分隔多条提示词。',
    contentRequired: '正文不能为空',
    includeTemplateOnClickHint: '关闭后，左键单击只复制正文；右键菜单仍可手动选择复制方式。',
    importRequired: '没有可导入内容',
    prefixHint: '留空会自动省略这一段。单独填 ``` 或 ```ts 会自动补全代码块围栏。',
    quickRunCommandHint: '发送到当前活动终端，并自动回车执行。',
    suffixHint: '留空会自动省略这一段。单独填 ``` 或 ```ts 会自动补全代码块围栏。',
    titleOptional: '标题可选',
  },
  labels: {
    prompts: '条提示词',
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
    quickRunAmbiguousTerminal: '当前同时显示了多个终端，不允许快捷运行。',
    quickRunExecuted: '已执行快捷运行',
    quickRunNoActiveTerminal: '当前没有可用终端。',
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
    quickRunCommand: '/new',
    suffix: '每次复制时自动加在最后面',
    title: '可选标题',
  },
  status: {
    untitled: '<无标题>',
  },
};

const EN_STRINGS: PromptQueueStrings = {
  actions: {
    add: 'Add',
    bulkImport: 'Bulk Import',
    copyRaw: 'Copy Content Only',
    delete: 'Delete',
    deleteAll: 'Delete All',
    edit: 'Edit',
    more: 'More',
    moveDown: 'Move Down',
    moveUp: 'Move Up',
    quickRun: 'Quick Run',
    restoreLastDeleted: 'Restore Last Delete',
    settings: 'Settings',
  },
  buttons: {
    cancel: 'Cancel',
    close: 'Close',
    save: 'Save',
  },
  confirmations: {
    deleteAll: 'Delete all prompts?',
    deletePrompt: 'Delete this prompt?',
    destructiveDetail: 'This action cannot be undone.',
    restoreReplace: 'Restore will replace the current list. Continue?',
  },
  emptyState: {
    body: 'Add one prompt first, or import a batch.',
    noWorkspaceBody: 'Open a local workspace folder before using PromptQueue so it can read and save data.',
    noWorkspaceTitle: 'No workspace is open',
    title: 'Nothing here yet',
  },
  fields: {
    content: 'Content',
    includeTemplateOnClick: 'Use affixes',
    prefix: 'Prefix',
    quickRunCommand: 'Quick Run Command',
    quickRunEnabled: 'Enable Quick Run',
    suffix: 'Suffix',
    title: 'Title',
  },
  helpers: {
    bulkImport: 'Split prompts with "-*- Title" or "-*-" lines.',
    contentRequired: 'Content is required',
    includeTemplateOnClickHint: 'Turn this off to copy only the prompt body on left click. The context menu still lets you choose manually.',
    importRequired: 'There is nothing to import',
    prefixHint: 'This section is skipped when empty. A standalone ``` or ```ts auto-completes the matching code fence.',
    quickRunCommandHint: 'Send this command to the active terminal and execute it immediately.',
    suffixHint: 'This section is skipped when empty. A standalone ``` or ```ts auto-completes the matching code fence.',
    titleOptional: 'Title is optional',
  },
  labels: {
    prompts: 'prompts',
    storage: 'Storage',
    total: 'Total',
    used: 'used',
  },
  messages: {
    created: 'Created',
    copied: 'Copied',
    deleted: 'Deleted',
    deletedAll: 'Deleted all',
    imported: 'Imported',
    noLastDeletedBackup: 'No deleted backup is available',
    noWorkspace: 'Open a workspace folder first.',
    quickRunAmbiguousTerminal: 'Multiple terminals are visible, so quick run is blocked.',
    quickRunExecuted: 'Quick run executed',
    quickRunNoActiveTerminal: 'There is no active terminal to run the command in.',
    restored: 'Restored',
    saved: 'Saved',
    updated: 'Updated',
  },
  panels: {
    add: 'Add Prompt',
    bulkImport: 'Bulk Import',
    edit: 'Edit Prompt',
    settings: 'Copy Settings',
  },
  placeholders: {
    content: 'Enter prompt content',
    import: '-*- Title 1\nPrompt 1\n-*- Title 2\nPrompt 2',
    prefix: 'Automatically inserted before copied content',
    quickRunCommand: '/new',
    suffix: 'Automatically inserted after copied content',
    title: 'Optional title',
  },
  status: {
    untitled: '<Untitled>',
  },
};

export function getPromptQueueStrings(locale: string): PromptQueueStrings {
  return locale === 'zh-CN' ? ZH_CN_STRINGS : EN_STRINGS;
}
