import * as vscode from 'vscode';

import { PromptManager } from './prompt/promptManager';
import { PromptStore } from './prompt/promptStore';
import { registerPromptCommands } from './prompt/registerPromptCommands';
import { PromptTreeProvider } from './prompt/promptTreeProvider';

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const store = new PromptStore();
  const manager = new PromptManager({
    store,
    workspaceFolder,
  });

  if (workspaceFolder) {
    await manager.initialize();
  }

  const provider = new PromptTreeProvider(manager);
  const treeView = vscode.window.createTreeView('promptQueue.sidebar', {
    treeDataProvider: provider,
    dragAndDropController: provider,
  });
  context.subscriptions.push(treeView);
  context.subscriptions.push(
    ...registerPromptCommands({
      manager,
      treeProvider: provider,
    }),
  );
}

export function deactivate(): void {}
