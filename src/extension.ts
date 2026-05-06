import * as vscode from 'vscode';

import { PromptSeparatorHighlighter } from './editor/promptSeparatorHighlighter';
import { PromptSeparatorOutlineProvider } from './editor/promptSeparatorOutlineProvider';
import {
  normalizePromptQueueSeparatorHighlightEnabled,
  normalizePromptQueueSeparatorOutlineEnabled,
  DEFAULT_PROMPT_QUEUE_UI_LANGUAGE,
  normalizePromptQueueStoragePath,
  normalizePromptQueueUiLanguage,
} from './prompt/promptConfig';
import { PromptBackupStore } from './prompt/promptBackupStore';
import { PromptManager } from './prompt/promptManager';
import { getPromptQueueStrings } from './prompt/promptLocalization';
import { PromptSettingsStore } from './prompt/promptSettingsStore';
import { PromptStore } from './prompt/promptStore';
import { PromptTerminalQuickRunner } from './prompt/promptTerminalQuickRunner';
import { PromptWebviewViewProvider } from './prompt/promptWebviewViewProvider';

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const getWorkspaceFolder = () => vscode.workspace.workspaceFolders?.[0];
  const getWorkspaceUri = () => getWorkspaceFolder()?.uri;

  const getConfiguration = () => {
    const config = vscode.workspace.getConfiguration(
      'promptQueue',
      getWorkspaceUri(),
    );

    return {
      separatorHighlightEnabled: normalizePromptQueueSeparatorHighlightEnabled(
        config.get<boolean>('separatorHighlight.enabled'),
      ),
      separatorOutlineEnabled: normalizePromptQueueSeparatorOutlineEnabled(
        config.get<boolean>('separatorOutline.enabled'),
      ),
      storagePath: config.get<string>('storagePath'),
      uiLanguage: normalizePromptQueueUiLanguage(
        config.get<string>('uiLanguage') ?? DEFAULT_PROMPT_QUEUE_UI_LANGUAGE,
      ),
    };
  };

  const createManager = (storagePath?: string) => {
    const workspaceFolder = getWorkspaceFolder();
    const manager = new PromptManager({
      backupStore: new PromptBackupStore(storagePath),
      settingsStore: new PromptSettingsStore(storagePath),
      store: new PromptStore(storagePath),
      workspaceFolder,
    });

    return manager;
  };

  const initializeManager = async (
    nextManager: PromptManager,
  ): Promise<void> => {
    if (!getWorkspaceFolder()) {
      return;
    }

    try {
      await nextManager.initialize();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await vscode.window.showErrorMessage(
        `PromptQueue 无法加载工作区数据：${message}`,
      );
    }
  };

  let manager = createManager(getConfiguration().storagePath);
  const highlighter = new PromptSeparatorHighlighter({
    getEnabled: () => getConfiguration().separatorHighlightEnabled,
  });
  const provider = new PromptWebviewViewProvider({
    extensionUri: context.extensionUri,
    hasActiveTerminal: () => Boolean(vscode.window.activeTerminal),
    hasWorkspace: () => Boolean(getWorkspaceFolder()),
    getStorageLabel: () =>
      normalizePromptQueueStoragePath(getConfiguration().storagePath),
    getUiLanguage: () => getConfiguration().uiLanguage,
    manager,
    quickRunner: new PromptTerminalQuickRunner({
      executeCommand: (command) => vscode.commands.executeCommand(command),
      getActiveTerminal: () => vscode.window.activeTerminal,
      getTerminalCount: () => vscode.window.terminals.length,
    }),
    writeClipboard: (text) => Promise.resolve(vscode.env.clipboard.writeText(text)),
  });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('promptQueue.sidebar', provider),
  );
  await initializeManager(manager);
  await provider.refresh();
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      [
        { language: 'plaintext' },
        { language: 'markdown' },
      ],
      new PromptSeparatorOutlineProvider({
        getEnabled: () => getConfiguration().separatorOutlineEnabled,
        getUntitledLabel: () =>
          getPromptQueueStrings(getConfiguration().uiLanguage).status.untitled,
      }),
    ),
  );
  context.subscriptions.push(highlighter);
  context.subscriptions.push(
    vscode.window.onDidChangeVisibleTextEditors((editors) => {
      highlighter.refreshVisibleEditors(editors);
    }),
  );
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTerminal(() => {
      void provider.refresh();
    }),
  );
  context.subscriptions.push(
    vscode.window.onDidOpenTerminal(() => {
      void provider.refresh();
    }),
  );
  context.subscriptions.push(
    vscode.window.onDidCloseTerminal(() => {
      void provider.refresh();
    }),
  );
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      highlighter.refreshVisibleEditors(vscode.window.visibleTextEditors);
    }),
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(() => {
      highlighter.refreshVisibleEditors(vscode.window.visibleTextEditors);
    }),
  );
  highlighter.refreshVisibleEditors(vscode.window.visibleTextEditors);
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      manager = createManager(getConfiguration().storagePath);
      provider.setManager(manager);
      await initializeManager(manager);
      await provider.refresh();
    }),
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      const storageChanged = event.affectsConfiguration(
        'promptQueue.storagePath',
      );
      const highlightChanged = event.affectsConfiguration(
        'promptQueue.separatorHighlight.enabled',
      );
      const languageChanged = event.affectsConfiguration(
        'promptQueue.uiLanguage',
      );
      const outlineChanged = event.affectsConfiguration(
        'promptQueue.separatorOutline.enabled',
      );

      if (!storageChanged && !highlightChanged && !languageChanged && !outlineChanged) {
        return;
      }

      if (storageChanged) {
        manager = createManager(getConfiguration().storagePath);
        provider.setManager(manager);
        await initializeManager(manager);
      }

      if (highlightChanged) {
        highlighter.refreshVisibleEditors(vscode.window.visibleTextEditors);
      }

      await provider.refresh();
    }),
  );
}

export function deactivate(): void {}
