export interface PromptQueueStrings {
  actions: {
    add: string;
    bulkImport: string;
    copyRaw: string;
    delete: string;
    deleteAll: string;
    edit: string;
    moveDown: string;
    moveUp: string;
    restoreLastDeleted: string;
    settings: string;
  };
  confirmations: {
    deleteAll: string;
    deletePrompt: string;
    restoreReplace: string;
  };
  emptyState: {
    body: string;
    title: string;
  };
  fields: {
    content: string;
    prefix: string;
    suffix: string;
    title: string;
  };
  helpers: {
    bulkImport: string;
    contentRequired: string;
    importRequired: string;
    prefixHint: string;
    suffixHint: string;
    titleOptional: string;
  };
  labels: {
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
    restoreReplace: '恢复会覆盖当前列表，是否继续？',
  },
  emptyState: {
    body: '先新增一条提示词，或者直接批量导入。',
    title: '这里还是空的',
  },
  fields: {
    content: '正文',
    prefix: '前提示词',
    suffix: '后提示词',
    title: '标题',
  },
  helpers: {
    bulkImport: '按 “-*- 标题” 或 “-*-” 分隔多条提示词。',
    contentRequired: '正文不能为空',
    importRequired: '没有可导入内容',
    prefixHint: '留空会自动省略这一段。',
    suffixHint: '留空会自动省略这一段。',
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
    untitled: '未命名',
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
    moveDown: 'Move Down',
    moveUp: 'Move Up',
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
    restoreReplace: 'Restore will replace the current list. Continue?',
  },
  emptyState: {
    body: 'Add one prompt first, or import a batch.',
    title: 'Nothing here yet',
  },
  fields: {
    content: 'Content',
    prefix: 'Prefix',
    suffix: 'Suffix',
    title: 'Title',
  },
  helpers: {
    bulkImport: 'Split prompts with "-*- Title" or "-*-" lines.',
    contentRequired: 'Content is required',
    importRequired: 'There is nothing to import',
    prefixHint: 'This section is skipped when empty.',
    suffixHint: 'This section is skipped when empty.',
    titleOptional: 'Title is optional',
  },
  labels: {
    storage: 'Storage',
    total: 'Total',
    used: 'Used',
  },
  messages: {
    created: 'Created',
    copied: 'Copied',
    deleted: 'Deleted',
    deletedAll: 'Deleted all',
    imported: 'Imported',
    noLastDeletedBackup: 'No deleted backup is available',
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
    suffix: 'Automatically inserted after copied content',
    title: 'Optional title',
  },
  status: {
    untitled: 'Untitled',
  },
};

export function getPromptQueueStrings(locale: string): PromptQueueStrings {
  return locale === 'zh-CN' ? ZH_CN_STRINGS : EN_STRINGS;
}
