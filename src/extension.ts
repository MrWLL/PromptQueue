import * as vscode from 'vscode';

class PlaceholderPromptTreeProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.ProviderResult<vscode.TreeItem[]> {
    return [];
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new PlaceholderPromptTreeProvider();
  const treeView = vscode.window.createTreeView('promptQueue.sidebar', {
    treeDataProvider: provider,
  });

  context.subscriptions.push(treeView);

  const commandIds = [
    'promptQueue.copyItem',
    'promptQueue.toggleUsed',
    'promptQueue.moveItemUp',
    'promptQueue.moveItemDown',
    'promptQueue.deleteItem',
    'promptQueue.resetAllUsed',
    'promptQueue.bulkImport',
    'promptQueue.addItem',
    'promptQueue.editItem',
    'promptQueue.saveItem',
  ];

  for (const commandId of commandIds) {
    context.subscriptions.push(
      vscode.commands.registerCommand(commandId, async () => {
        return undefined;
      }),
    );
  }
}

export function deactivate(): void {}
