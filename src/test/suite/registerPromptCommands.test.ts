import { afterEach, describe, expect, it, vi } from 'vitest';
import { commands, env, window, workspace } from 'vscode';

import { registerPromptCommands } from '../../prompt/registerPromptCommands';
import type {
  PromptCopySettings,
  PromptItem,
} from '../../prompt/promptTypes';

function createManagerStub(
  overrides: Partial<{
    getCopySettings: () => PromptCopySettings;
    getItems: () => PromptItem[];
  }> = {},
) {
  return {
    copyItem: vi.fn(async () => undefined),
    createItem: vi.fn(async () => undefined),
    deleteAll: vi.fn(async () => undefined),
    deleteItem: vi.fn(async () => undefined),
    getCopySettings: vi.fn(
      overrides.getCopySettings ?? (() => ({ prefix: '', suffix: '' })),
    ),
    getItems: vi.fn(overrides.getItems ?? (() => [])),
    importText: vi.fn(async () => undefined),
    moveItem: vi.fn(async () => undefined),
    resetAllUsed: vi.fn(async () => undefined),
    toggleUsed: vi.fn(async () => undefined),
    updateCopySettings: vi.fn(async () => undefined),
    updateItem: vi.fn(async () => undefined),
  };
}

afterEach(() => {
  commands.__reset();
  env.__reset();
  window.__reset();
  workspace.__reset();
});

describe('registerPromptCommands', () => {
  it('wires templated copy through clipboard writes and refreshes the tree', async () => {
    const manager = createManagerStub();
    const treeProvider = {
      refresh: vi.fn(),
    };

    registerPromptCommands({ manager, treeProvider });
    await commands.executeCommand('promptQueue.copyItem', {
      promptId: 'prompt-1',
    });

    expect(manager.copyItem).toHaveBeenCalledWith(
      'prompt-1',
      'templated',
      expect.any(Function),
    );

    const clipboardWriter = manager.copyItem.mock.calls[0][2] as (
      text: string,
    ) => Promise<void>;

    await clipboardWriter('copied text');

    expect(env.clipboard.writeText).toHaveBeenCalledWith('copied text');
    expect(window.setStatusBarMessage).toHaveBeenCalledWith('已复制', 1500);
    expect(treeProvider.refresh).toHaveBeenCalledTimes(1);
  });

  it('wires raw-content copy through clipboard writes and refreshes the tree', async () => {
    const manager = createManagerStub();
    const treeProvider = {
      refresh: vi.fn(),
    };

    registerPromptCommands({ manager, treeProvider });
    await commands.executeCommand('promptQueue.copyItemRaw', {
      promptId: 'prompt-1',
    });

    expect(manager.copyItem).toHaveBeenCalledWith(
      'prompt-1',
      'raw',
      expect.any(Function),
    );

    const clipboardWriter = manager.copyItem.mock.calls[0][2] as (
      text: string,
    ) => Promise<void>;

    await clipboardWriter('raw text');

    expect(env.clipboard.writeText).toHaveBeenCalledWith('raw text');
    expect(window.setStatusBarMessage).toHaveBeenCalledWith('已复制', 1500);
    expect(treeProvider.refresh).toHaveBeenCalledTimes(1);
  });

  it('wires item and view commands to manager mutations', async () => {
    const manager = createManagerStub();
    const treeProvider = {
      refresh: vi.fn(),
    };

    registerPromptCommands({ manager, treeProvider });

    await commands.executeCommand('promptQueue.toggleUsed', {
      promptId: 'prompt-1',
    });
    await commands.executeCommand('promptQueue.moveItemUp', {
      promptId: 'prompt-1',
    });
    await commands.executeCommand('promptQueue.moveItemDown', {
      promptId: 'prompt-1',
    });
    await commands.executeCommand('promptQueue.deleteItem', {
      promptId: 'prompt-1',
    });
    await commands.executeCommand('promptQueue.resetAllUsed');

    expect(manager.toggleUsed).toHaveBeenCalledWith('prompt-1');
    expect(manager.moveItem).toHaveBeenCalledWith('prompt-1', 'up');
    expect(manager.moveItem).toHaveBeenCalledWith('prompt-1', 'down');
    expect(manager.deleteItem).toHaveBeenCalledWith('prompt-1');
    expect(manager.resetAllUsed).toHaveBeenCalled();
    expect(treeProvider.refresh).toHaveBeenCalledTimes(5);
  });

  it('opens a Chinese add-item panel and saves the parsed draft immediately', async () => {
    const manager = createManagerStub();
    const treeProvider = {
      refresh: vi.fn(),
    };
    const inputPanel = {
      open: vi.fn(async () => '这是没有标题的提示词'),
    };

    registerPromptCommands({ manager, treeProvider, inputPanel });

    await commands.executeCommand('promptQueue.addItem');

    expect(inputPanel.open).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '新增提示词',
        confirmLabel: '保存',
        initialText: '',
      }),
    );
    expect(manager.createItem).toHaveBeenCalledWith({
      title: undefined,
      content: '这是没有标题的提示词',
    });
    expect(treeProvider.refresh).toHaveBeenCalledTimes(1);
  });

  it('opens the settings panel with existing copy settings and saves immediately', async () => {
    const manager = createManagerStub({
      getCopySettings: () => ({
        prefix: '旧前提示词',
        suffix: '旧后提示词',
      }),
    });
    const treeProvider = {
      refresh: vi.fn(),
    };
    const settingsPanel = {
      open: vi.fn(async () => ({
        prefix: '新前提示词',
        suffix: '新后提示词',
      })),
    };

    registerPromptCommands({ manager, treeProvider, settingsPanel });

    await commands.executeCommand('promptQueue.openSettings');

    expect(settingsPanel.open).toHaveBeenCalledWith({
      title: '复制设置',
      confirmLabel: '保存',
      helperText: '留空会自动省略该段。',
      initialSettings: {
        prefix: '旧前提示词',
        suffix: '旧后提示词',
      },
    });
    expect(manager.updateCopySettings).toHaveBeenCalledWith({
      prefix: '新前提示词',
      suffix: '新后提示词',
    });
  });

  it('opens the edit panel with the existing formatted content and saves immediately', async () => {
    const existingItem: PromptItem = {
      id: 'prompt-1',
      title: '旧标题',
      content: '旧正文',
      used: false,
      createdAt: '2026-03-16T00:00:00.000Z',
      updatedAt: '2026-03-16T00:00:00.000Z',
    };
    const manager = createManagerStub({
      getItems: () => [existingItem],
    });
    const treeProvider = {
      refresh: vi.fn(),
    };
    const inputPanel = {
      open: vi.fn(async () => '-*- 新标题\n新正文'),
    };

    registerPromptCommands({ manager, treeProvider, inputPanel });

    await commands.executeCommand('promptQueue.editItem', {
      promptId: 'prompt-1',
    });

    expect(inputPanel.open).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '编辑提示词',
        confirmLabel: '保存修改',
        initialText: '-*- 旧标题\n旧正文',
      }),
    );
    expect(manager.updateItem).toHaveBeenCalledWith('prompt-1', {
      title: '新标题',
      content: '新正文',
    });
    expect(treeProvider.refresh).toHaveBeenCalledTimes(1);
  });

  it('shows a Chinese error when add-item input is empty', async () => {
    const manager = createManagerStub();
    const treeProvider = {
      refresh: vi.fn(),
    };
    const inputPanel = {
      open: vi.fn(async () => '   \n '),
    };

    registerPromptCommands({ manager, treeProvider, inputPanel });

    await commands.executeCommand('promptQueue.addItem');

    expect(manager.createItem).not.toHaveBeenCalled();
    expect(window.showErrorMessage).toHaveBeenCalledWith('请输入提示词内容。');
  });

  it('uses the multiline panel for bulk import and appends prompts', async () => {
    const manager = createManagerStub();
    const treeProvider = {
      refresh: vi.fn(),
    };
    const inputPanel = {
      open: vi.fn(async () => '-*- 标题1\n正文1\n-*-   \n正文2'),
    };

    registerPromptCommands({ manager, treeProvider, inputPanel });

    await commands.executeCommand('promptQueue.bulkImport');

    expect(inputPanel.open).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '批量导入提示词',
        confirmLabel: '导入',
      }),
    );
    expect(manager.importText).toHaveBeenCalledWith(
      '-*- 标题1\n正文1\n-*-   \n正文2',
      'append',
    );
    expect(treeProvider.refresh).toHaveBeenCalledTimes(1);
  });

  it('shows a Chinese error when bulk import panel is empty', async () => {
    const manager = createManagerStub();
    const treeProvider = {
      refresh: vi.fn(),
    };
    const inputPanel = {
      open: vi.fn(async () => '   \n  '),
    };

    registerPromptCommands({ manager, treeProvider, inputPanel });

    await commands.executeCommand('promptQueue.bulkImport');

    expect(manager.importText).not.toHaveBeenCalled();
    expect(window.showErrorMessage).toHaveBeenCalledWith('没有可导入内容');
  });

  it('confirms before deleting all prompts', async () => {
    const manager = createManagerStub();
    const treeProvider = {
      refresh: vi.fn(),
    };

    window.showWarningMessage.mockResolvedValueOnce('全部删除');

    registerPromptCommands({ manager, treeProvider });

    await commands.executeCommand('promptQueue.deleteAllItems');

    expect(window.showWarningMessage).toHaveBeenCalledWith(
      '确认删除全部提示词吗？',
      { modal: true, detail: '此操作不可撤销。' },
      '全部删除',
    );
    expect(manager.deleteAll).toHaveBeenCalledTimes(1);
    expect(treeProvider.refresh).toHaveBeenCalledTimes(1);
  });

  it('does not delete all prompts when the confirmation is canceled', async () => {
    const manager = createManagerStub();
    const treeProvider = {
      refresh: vi.fn(),
    };

    window.showWarningMessage.mockResolvedValueOnce(undefined);

    registerPromptCommands({ manager, treeProvider });

    await commands.executeCommand('promptQueue.deleteAllItems');

    expect(manager.deleteAll).not.toHaveBeenCalled();
    expect(treeProvider.refresh).not.toHaveBeenCalled();
  });
});
