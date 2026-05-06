import { describe, expect, it } from 'vitest';

import {
  getPromptQueueStrings,
  type PromptQueueStrings,
} from '../../prompt/promptLocalization';

function expectCoreActions(strings: PromptQueueStrings): void {
  expect(strings.actions.add.length).toBeGreaterThan(0);
  expect(strings.actions.bulkImport.length).toBeGreaterThan(0);
  expect(strings.actions.deleteAll.length).toBeGreaterThan(0);
  expect(strings.actions.more.length).toBeGreaterThan(0);
  expect((strings.actions as Record<string, string>).sort.length).toBeGreaterThan(0);
  expect((strings.actions as Record<string, string>).doneSorting.length).toBeGreaterThan(0);
  expect(strings.actions.settings.length).toBeGreaterThan(0);
}

describe('promptLocalization', () => {
  it('returns Chinese strings for zh-CN', () => {
    const strings = getPromptQueueStrings('zh-CN');

    expect(strings.actions.add).toBe('新增');
    expect(strings.actions.more).toBe('更多');
    expect(strings.actions.restoreLastDeleted).toBe('恢复上次删除');
    expect((strings.actions as Record<string, string>).quickRun).toBe('快捷运行');
    expect((strings.actions as Record<string, string>).sort).toBe('排序');
    expect((strings.actions as Record<string, string>).doneSorting).toBe(
      '完成排序',
    );
    expect((strings.fields as Record<string, string>).quickRunCommand).toBe(
      '快捷运行命令',
    );
    expect((strings.messages as Record<string, string>).quickRunExecuted).toBe(
      '已执行快捷运行',
    );
    expect(strings.panels.settings).toBe('设置');
    expect(strings).toMatchObject({
      sections: {
        import: '导入',
        copyBehavior: '复制行为',
        quickRun: '快捷运行',
        dataManagement: '数据管理',
      },
    });
    expect(strings.labels.prompts).toBe('条提示词');
    expect(strings.labels.used).toBe('已使用');
    expect(strings.status.untitled).toBe('<无标题>');
    expectCoreActions(strings);
  });

  it('falls back safely for unknown locale values', () => {
    const strings = getPromptQueueStrings('unexpected');

    expect(strings.actions.add).toBe('Add');
    expect(strings.actions.more).toBe('More');
    expect((strings.actions as Record<string, string>).quickRun).toBe(
      'Quick Run',
    );
    expect((strings.actions as Record<string, string>).sort).toBe('Sort');
    expect((strings.actions as Record<string, string>).doneSorting).toBe(
      'Done Sorting',
    );
    expect((strings.fields as Record<string, string>).quickRunCommand).toBe(
      'Quick Run Command',
    );
    expect(strings.messages.copied).toBe('Copied');
    expect((strings.messages as Record<string, string>).quickRunExecuted).toBe(
      'Quick run executed',
    );
    expect(strings.panels.settings).toBe('Settings');
    expect(strings).toMatchObject({
      sections: {
        import: 'Import',
        copyBehavior: 'Copy Behavior',
        quickRun: 'Quick Run',
        dataManagement: 'Data Management',
      },
    });
    expect(strings.labels.prompts).toBe('prompts');
    expect(strings.labels.used).toBe('used');
    expect(strings.status.untitled).toBe('<Untitled>');
    expectCoreActions(strings);
  });
});
