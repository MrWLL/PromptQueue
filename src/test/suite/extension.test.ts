import { afterEach, describe, expect, it } from 'vitest';
import * as vscode from 'vscode';

import { activate } from '../../extension';

describe('extension activation', () => {
  afterEach(() => {
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
});
