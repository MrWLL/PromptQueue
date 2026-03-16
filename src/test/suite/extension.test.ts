import { afterEach, describe, expect, it } from 'vitest';
import * as vscode from 'vscode';

import { activate } from '../../extension';

describe('extension activation', () => {
  afterEach(() => {
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
    expect(vscode.window.createTreeView).not.toHaveBeenCalled();
  });
});
