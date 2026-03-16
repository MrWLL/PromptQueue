import * as vscode from 'vscode';

import {
  DEFAULT_PROMPT_QUEUE_UI_LANGUAGE,
  normalizePromptQueueStoragePath,
  normalizePromptQueueUiLanguage,
} from './prompt/promptConfig';
import { PromptBackupStore } from './prompt/promptBackupStore';
import { PromptManager } from './prompt/promptManager';
import { PromptSettingsStore } from './prompt/promptSettingsStore';
import { PromptStore } from './prompt/promptStore';
import { PromptWebviewViewProvider } from './prompt/promptWebviewViewProvider';

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const getWorkspaceFolder = () => vscode.workspace.workspaceFolders?.[0];

  const getConfiguration = () => {
    const config = vscode.workspace.getConfiguration('promptQueue');

    return {
      storagePath: config.get<string>('storagePath'),
      uiLanguage: normalizePromptQueueUiLanguage(
        config.get<string>('uiLanguage') ?? DEFAULT_PROMPT_QUEUE_UI_LANGUAGE,
      ),
    };
  };

  const createManager = async (storagePath?: string) => {
    const workspaceFolder = getWorkspaceFolder();
    const manager = new PromptManager({
      backupStore: new PromptBackupStore(storagePath),
      settingsStore: new PromptSettingsStore(storagePath),
      store: new PromptStore(storagePath),
      workspaceFolder,
    });

    if (workspaceFolder) {
      await manager.initialize();
    }

    return manager;
  };

  let manager = await createManager(getConfiguration().storagePath);
  const provider = new PromptWebviewViewProvider({
    extensionUri: context.extensionUri,
    hasWorkspace: () => Boolean(getWorkspaceFolder()),
    getStorageLabel: () =>
      normalizePromptQueueStoragePath(getConfiguration().storagePath),
    getUiLanguage: () => getConfiguration().uiLanguage,
    manager,
    writeClipboard: (text) => Promise.resolve(vscode.env.clipboard.writeText(text)),
  });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('promptQueue.sidebar', provider),
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      manager = await createManager(getConfiguration().storagePath);
      provider.setManager(manager);
      await provider.refresh();
    }),
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      const storageChanged = event.affectsConfiguration(
        'promptQueue.storagePath',
      );
      const languageChanged = event.affectsConfiguration(
        'promptQueue.uiLanguage',
      );

      if (!storageChanged && !languageChanged) {
        return;
      }

      if (storageChanged) {
        manager = await createManager(getConfiguration().storagePath);
        provider.setManager(manager);
      }

      await provider.refresh();
    }),
  );
}

export function deactivate(): void {}
