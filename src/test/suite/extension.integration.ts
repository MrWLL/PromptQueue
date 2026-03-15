import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

suite('PromptQueue extension', () => {
  test('registers the PromptQueue commands after activation', async () => {
    const extension = vscode.extensions.getExtension('local.promptqueue');
    await extension?.activate();

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('promptQueue.copyItem'));
    assert.ok(commands.includes('promptQueue.toggleUsed'));
    assert.ok(commands.includes('promptQueue.moveItemUp'));
    assert.ok(commands.includes('promptQueue.moveItemDown'));
    assert.ok(commands.includes('promptQueue.deleteItem'));
    assert.ok(commands.includes('promptQueue.deleteAllItems'));
    assert.ok(commands.includes('promptQueue.resetAllUsed'));
    assert.ok(commands.includes('promptQueue.bulkImport'));
    assert.ok(commands.includes('promptQueue.addItem'));
    assert.ok(commands.includes('promptQueue.editItem'));
  });
});
