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
  labels: {
    storage: string;
    total: string;
    used: string;
  };
  messages: {
    copied: string;
    noLastDeletedBackup: string;
    restored: string;
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
  labels: {
    storage: '存储',
    total: '总数',
    used: '已使用',
  },
  messages: {
    copied: '已复制',
    noLastDeletedBackup: '没有可恢复的上次删除记录',
    restored: '已恢复',
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
  labels: {
    storage: 'Storage',
    total: 'Total',
    used: 'Used',
  },
  messages: {
    copied: 'Copied',
    noLastDeletedBackup: 'No deleted backup is available',
    restored: 'Restored',
  },
};

export function getPromptQueueStrings(locale: string): PromptQueueStrings {
  return locale === 'zh-CN' ? ZH_CN_STRINGS : EN_STRINGS;
}
