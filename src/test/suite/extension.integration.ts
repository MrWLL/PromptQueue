import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

suite('PromptQueue extension', () => {
  test('activates the PromptQueue extension', async () => {
    const extension = vscode.extensions.getExtension('MrLeilei.promptqueue');
    assert.ok(extension);

    await extension?.activate();

    assert.equal(extension?.isActive, true);
  });
});
