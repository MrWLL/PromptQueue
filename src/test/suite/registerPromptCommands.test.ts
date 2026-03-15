import { afterEach, describe, expect, it, vi } from 'vitest';
import { commands, env, window, workspace } from 'vscode';

import { registerPromptCommands } from '../../prompt/registerPromptCommands';
import type { PromptItem } from '../../prompt/promptTypes';

afterEach(() => {
  commands.__reset();
  env.__reset();
  window.__reset();
  workspace.__reset();
});

describe('registerPromptCommands', () => {
  it('wires copy commands through clipboard writes and refreshes the tree', async () => {
    const manager = {
      copyItem: vi.fn(async () => undefined),
      deleteItem: vi.fn(async () => undefined),
      moveItem: vi.fn(async () => undefined),
      resetAllUsed: vi.fn(async () => undefined),
      toggleUsed: vi.fn(async () => undefined),
    };
    const treeProvider = {
      refresh: vi.fn(),
    };

    registerPromptCommands({ manager, treeProvider });
    await commands.executeCommand('promptQueue.copyItem', { promptId: 'prompt-1' });

    expect(manager.copyItem).toHaveBeenCalledWith(
      'prompt-1',
      expect.any(Function),
    );

    const clipboardWriter = manager.copyItem.mock.calls[0][1] as (
      text: string,
    ) => Promise<void>;

    await clipboardWriter('copied text');

    expect(env.clipboard.writeText).toHaveBeenCalledWith('copied text');
    expect(treeProvider.refresh).toHaveBeenCalledTimes(1);
  });

  it('wires item and view commands to manager mutations', async () => {
    const manager = {
      copyItem: vi.fn(async () => undefined),
      deleteItem: vi.fn(async () => undefined),
      moveItem: vi.fn(async () => undefined),
      resetAllUsed: vi.fn(async () => undefined),
      toggleUsed: vi.fn(async () => undefined),
    };
    const treeProvider = {
      refresh: vi.fn(),
    };

    registerPromptCommands({ manager, treeProvider });

    await commands.executeCommand('promptQueue.toggleUsed', { promptId: 'prompt-1' });
    await commands.executeCommand('promptQueue.moveItemUp', { promptId: 'prompt-1' });
    await commands.executeCommand('promptQueue.moveItemDown', { promptId: 'prompt-1' });
    await commands.executeCommand('promptQueue.deleteItem', { promptId: 'prompt-1' });
    await commands.executeCommand('promptQueue.resetAllUsed');

    expect(manager.toggleUsed).toHaveBeenCalledWith('prompt-1');
    expect(manager.moveItem).toHaveBeenCalledWith('prompt-1', 'up');
    expect(manager.moveItem).toHaveBeenCalledWith('prompt-1', 'down');
    expect(manager.deleteItem).toHaveBeenCalledWith('prompt-1');
    expect(manager.resetAllUsed).toHaveBeenCalled();
    expect(treeProvider.refresh).toHaveBeenCalledTimes(5);
  });

  it('opens create and edit drafts through the prompt editor', async () => {
    const existingItem: PromptItem = {
      id: 'prompt-1',
      title: 'Existing title',
      content: 'Existing content',
      used: false,
      createdAt: '2026-03-16T00:00:00.000Z',
      updatedAt: '2026-03-16T00:00:00.000Z',
    };
    const manager = {
      copyItem: vi.fn(async () => undefined),
      createItem: vi.fn(async () => undefined),
      deleteItem: vi.fn(async () => undefined),
      getItems: vi.fn(() => [existingItem]),
      moveItem: vi.fn(async () => undefined),
      resetAllUsed: vi.fn(async () => undefined),
      toggleUsed: vi.fn(async () => undefined),
      updateItem: vi.fn(async () => undefined),
    };
    const treeProvider = {
      refresh: vi.fn(),
    };
    const editor = {
      getContext: vi.fn(),
      openCreateEditor: vi.fn(async () => undefined),
      openEditEditor: vi.fn(async () => undefined),
      parseDocument: vi.fn(),
    };

    registerPromptCommands({ manager, treeProvider, editor });

    await commands.executeCommand('promptQueue.addItem');
    await commands.executeCommand('promptQueue.editItem', { promptId: 'prompt-1' });

    expect(editor.openCreateEditor).toHaveBeenCalled();
    expect(editor.openEditEditor).toHaveBeenCalledWith(existingItem);
  });

  it('saves create and edit drafts through the manager', async () => {
    const manager = {
      copyItem: vi.fn(async () => undefined),
      createItem: vi.fn(async () => undefined),
      deleteItem: vi.fn(async () => undefined),
      getItems: vi.fn(() => []),
      moveItem: vi.fn(async () => undefined),
      resetAllUsed: vi.fn(async () => undefined),
      toggleUsed: vi.fn(async () => undefined),
      updateItem: vi.fn(async () => undefined),
    };
    const treeProvider = {
      refresh: vi.fn(),
    };
    const editor = {
      getContext: vi
        .fn()
        .mockReturnValueOnce({ mode: 'create' })
        .mockReturnValueOnce({ mode: 'edit', promptId: 'prompt-1' }),
      openCreateEditor: vi.fn(async () => undefined),
      openEditEditor: vi.fn(async () => undefined),
      parseDocument: vi
        .fn()
        .mockReturnValueOnce({ title: 'Created title', content: 'Created content' })
        .mockReturnValueOnce({ title: undefined, content: 'Updated content' }),
    };

    registerPromptCommands({ manager, treeProvider, editor });

    window.activeTextEditor = {
      document: {
        uri: { toString: () => 'untitled:create' },
      },
    };
    await commands.executeCommand('promptQueue.saveItem');

    window.activeTextEditor = {
      document: {
        uri: { toString: () => 'untitled:edit' },
      },
    };
    await commands.executeCommand('promptQueue.saveItem');

    expect(manager.createItem).toHaveBeenCalledWith({
      title: 'Created title',
      content: 'Created content',
    });
    expect(manager.updateItem).toHaveBeenCalledWith('prompt-1', {
      title: undefined,
      content: 'Updated content',
    });
    expect(treeProvider.refresh).toHaveBeenCalledTimes(2);
  });

  it('imports prompt text from the selected source and mode', async () => {
    const manager = {
      copyItem: vi.fn(async () => undefined),
      createItem: vi.fn(async () => undefined),
      deleteItem: vi.fn(async () => undefined),
      getItems: vi.fn(() => []),
      importText: vi.fn(async () => undefined),
      moveItem: vi.fn(async () => undefined),
      resetAllUsed: vi.fn(async () => undefined),
      toggleUsed: vi.fn(async () => undefined),
      updateItem: vi.fn(async () => undefined),
    };
    const treeProvider = {
      refresh: vi.fn(),
    };
    const bulkImport = {
      pickMode: vi.fn(async () => 'append' as const),
      pickSource: vi.fn(async () => 'clipboard' as const),
      readSource: vi.fn(async () => 'imported text'),
    };

    registerPromptCommands({ manager, treeProvider, bulkImport });

    await commands.executeCommand('promptQueue.bulkImport');

    expect(manager.importText).toHaveBeenCalledWith('imported text', 'append');
    expect(treeProvider.refresh).toHaveBeenCalledTimes(1);
  });

  it('rejects empty bulk import text before calling the manager', async () => {
    const manager = {
      copyItem: vi.fn(async () => undefined),
      createItem: vi.fn(async () => undefined),
      deleteItem: vi.fn(async () => undefined),
      getItems: vi.fn(() => []),
      importText: vi.fn(async () => undefined),
      moveItem: vi.fn(async () => undefined),
      resetAllUsed: vi.fn(async () => undefined),
      toggleUsed: vi.fn(async () => undefined),
      updateItem: vi.fn(async () => undefined),
    };
    const treeProvider = {
      refresh: vi.fn(),
    };
    const bulkImport = {
      pickMode: vi.fn(async () => 'append' as const),
      pickSource: vi.fn(async () => 'clipboard' as const),
      readSource: vi.fn(async () => '   \n  '),
    };

    registerPromptCommands({ manager, treeProvider, bulkImport });

    await commands.executeCommand('promptQueue.bulkImport');

    expect(manager.importText).not.toHaveBeenCalled();
    expect(window.showErrorMessage).toHaveBeenCalledWith('没有可导入内容');
    expect(treeProvider.refresh).not.toHaveBeenCalled();
  });

  it('shows an error when bulk import parsing fails', async () => {
    const manager = {
      copyItem: vi.fn(async () => undefined),
      createItem: vi.fn(async () => undefined),
      deleteItem: vi.fn(async () => undefined),
      getItems: vi.fn(() => []),
      importText: vi.fn(async () => {
        throw new Error('No prompts parsed from import text.');
      }),
      moveItem: vi.fn(async () => undefined),
      resetAllUsed: vi.fn(async () => undefined),
      toggleUsed: vi.fn(async () => undefined),
      updateItem: vi.fn(async () => undefined),
    };
    const treeProvider = {
      refresh: vi.fn(),
    };
    const bulkImport = {
      pickMode: vi.fn(async () => 'replace' as const),
      pickSource: vi.fn(async () => 'clipboard' as const),
      readSource: vi.fn(async () => 'bad text'),
    };

    registerPromptCommands({ manager, treeProvider, bulkImport });

    await commands.executeCommand('promptQueue.bulkImport');

    expect(window.showErrorMessage).toHaveBeenCalledWith(
      'No prompts parsed from import text.',
    );
    expect(treeProvider.refresh).not.toHaveBeenCalled();
  });
});
