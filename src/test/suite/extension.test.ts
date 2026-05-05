import { afterEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';

import { activate } from '../../extension';
import { PromptManager } from '../../prompt/promptManager';

describe('extension activation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vscode.languages.__reset();
    vscode.window.__reset();
    vscode.workspace.__reset();
  });

  it('registers the PromptQueue webview provider instead of creating a tree view', async () => {
    const context = {
      extensionUri: { fsPath: '/tmp/extension' },
      subscriptions: [] as Array<{ dispose(): void }>,
    };

    await activate(context as never);

    expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledWith(
      'promptQueue.sidebar',
      expect.any(Object),
    );
    expect(vscode.languages.registerDocumentSymbolProvider).toHaveBeenCalledWith(
      [
        { language: 'plaintext' },
        { language: 'markdown' },
      ],
      expect.any(Object),
    );
    expect(vscode.window.createTextEditorDecorationType).toHaveBeenCalledTimes(1);
    expect(vscode.window.onDidChangeVisibleTextEditors).toHaveBeenCalled();
    expect(vscode.window.onDidChangeActiveTextEditor).toHaveBeenCalled();
    expect(vscode.workspace.onDidChangeTextDocument).toHaveBeenCalled();
    expect(vscode.window.createTreeView).not.toHaveBeenCalled();
  });

  it('reads PromptQueue settings against the active workspace folder resource', async () => {
    const context = {
      extensionUri: { fsPath: '/tmp/extension' },
      subscriptions: [] as Array<{ dispose(): void }>,
    };

    await activate(context as never);

    expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith(
      'promptQueue',
      vscode.workspace.workspaceFolders?.[0]?.uri,
    );
  });

  it('surfaces initialization errors instead of failing activation', async () => {
    const context = {
      extensionUri: { fsPath: '/tmp/extension' },
      subscriptions: [] as Array<{ dispose(): void }>,
    };

    vi.spyOn(PromptManager.prototype, 'initialize').mockRejectedValueOnce(
      new Error('settings broken'),
    );

    await expect(activate(context as never)).resolves.toBeUndefined();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'PromptQueue 无法加载工作区数据：settings broken',
    );
    expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledWith(
      'promptQueue.sidebar',
      expect.any(Object),
    );
  });
});
