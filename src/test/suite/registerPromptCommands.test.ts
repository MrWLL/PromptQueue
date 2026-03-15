import { afterEach, describe, expect, it, vi } from 'vitest';
import { commands, env } from 'vscode';

import { registerPromptCommands } from '../../prompt/registerPromptCommands';

afterEach(() => {
  commands.__reset();
  env.__reset();
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
});
