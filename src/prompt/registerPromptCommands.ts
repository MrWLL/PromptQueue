import * as vscode from 'vscode';

export interface PromptCommandTarget {
  promptId: string;
}

export interface PromptCommandManager {
  copyItem(
    id: string,
    writeClipboard: (text: string) => Promise<void>,
  ): Promise<void>;
  deleteItem(id: string): Promise<void>;
  moveItem(id: string, direction: 'up' | 'down'): Promise<void>;
  resetAllUsed(): Promise<void>;
  toggleUsed(id: string): Promise<void>;
}

export interface PromptCommandTreeProvider {
  refresh(): void;
}

export interface RegisterPromptCommandsOptions {
  manager: PromptCommandManager;
  treeProvider: PromptCommandTreeProvider;
}

function getPromptId(target: PromptCommandTarget | undefined): string | undefined {
  return target?.promptId;
}

export function registerPromptCommands(
  options: RegisterPromptCommandsOptions,
): vscode.Disposable[] {
  const { manager, treeProvider } = options;

  return [
    vscode.commands.registerCommand(
      'promptQueue.copyItem',
      async (target: PromptCommandTarget | undefined) => {
        const promptId = getPromptId(target);

        if (!promptId) {
          return;
        }

        await manager.copyItem(promptId, (text) =>
          Promise.resolve(vscode.env.clipboard.writeText(text)),
        );
        treeProvider.refresh();
      },
    ),
    vscode.commands.registerCommand(
      'promptQueue.toggleUsed',
      async (target: PromptCommandTarget | undefined) => {
        const promptId = getPromptId(target);

        if (!promptId) {
          return;
        }

        await manager.toggleUsed(promptId);
        treeProvider.refresh();
      },
    ),
    vscode.commands.registerCommand(
      'promptQueue.moveItemUp',
      async (target: PromptCommandTarget | undefined) => {
        const promptId = getPromptId(target);

        if (!promptId) {
          return;
        }

        await manager.moveItem(promptId, 'up');
        treeProvider.refresh();
      },
    ),
    vscode.commands.registerCommand(
      'promptQueue.moveItemDown',
      async (target: PromptCommandTarget | undefined) => {
        const promptId = getPromptId(target);

        if (!promptId) {
          return;
        }

        await manager.moveItem(promptId, 'down');
        treeProvider.refresh();
      },
    ),
    vscode.commands.registerCommand(
      'promptQueue.deleteItem',
      async (target: PromptCommandTarget | undefined) => {
        const promptId = getPromptId(target);

        if (!promptId) {
          return;
        }

        await manager.deleteItem(promptId);
        treeProvider.refresh();
      },
    ),
    vscode.commands.registerCommand('promptQueue.resetAllUsed', async () => {
      await manager.resetAllUsed();
      treeProvider.refresh();
    }),
    vscode.commands.registerCommand('promptQueue.bulkImport', async () => undefined),
    vscode.commands.registerCommand('promptQueue.addItem', async () => undefined),
    vscode.commands.registerCommand('promptQueue.editItem', async () => undefined),
    vscode.commands.registerCommand('promptQueue.saveItem', async () => undefined),
  ];
}
