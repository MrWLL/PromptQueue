import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

suite('PromptQueue extension', () => {
  test('registers the copy command after activation', async () => {
    const extension = vscode.extensions.getExtension('local.promptqueue');
    await extension?.activate();

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('promptQueue.copyItem'));
  });
});
