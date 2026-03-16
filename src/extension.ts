import * as vscode from 'vscode';

import { PromptManager } from './prompt/promptManager';
import { PromptInputPanel } from './prompt/promptInputPanel';
import { PromptSettingsPanel } from './prompt/promptSettingsPanel';
import { PromptSettingsStore } from './prompt/promptSettingsStore';
import { PromptStore } from './prompt/promptStore';
import { registerPromptCommands } from './prompt/registerPromptCommands';
import { PromptTreeProvider } from './prompt/promptTreeProvider';

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const inputPanel = new PromptInputPanel();
  const settingsPanel = new PromptSettingsPanel();
  const store = new PromptStore();
  const settingsStore = new PromptSettingsStore();
  const manager = new PromptManager({
    store,
    settingsStore,
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
    treeView.onDidChangeCheckboxState(async (event) => {
      for (const [item] of event.items) {
        await manager.toggleUsed(item.promptId);
      }

      provider.refresh();
    }),
  );
  context.subscriptions.push(
    ...registerPromptCommands({
      inputPanel,
      manager,
      settingsPanel,
      treeProvider: provider,
    }),
  );
}

export function deactivate(): void {}
