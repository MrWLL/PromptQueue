import { describe, expect, it } from 'vitest';

import {
  getPromptQueueStrings,
  type PromptQueueStrings,
} from '../../prompt/promptLocalization';

function expectCoreActions(strings: PromptQueueStrings): void {
  expect(strings.actions.add.length).toBeGreaterThan(0);
  expect(strings.actions.bulkImport.length).toBeGreaterThan(0);
  expect(strings.actions.deleteAll.length).toBeGreaterThan(0);
  expect(strings.actions.settings.length).toBeGreaterThan(0);
}

describe('promptLocalization', () => {
  it('returns Chinese strings for zh-CN', () => {
    const strings = getPromptQueueStrings('zh-CN');

    expect(strings.actions.add).toBe('新增');
    expect(strings.actions.restoreLastDeleted).toBe('恢复上次删除');
    expect(strings.status.untitled).toBe('<无标题>');
    expectCoreActions(strings);
  });

  it('falls back safely for unknown locale values', () => {
    const strings = getPromptQueueStrings('unexpected');

    expect(strings.actions.add).toBe('Add');
    expect(strings.messages.copied).toBe('Copied');
    expect(strings.status.untitled).toBe('<Untitled>');
    expectCoreActions(strings);
  });
});
