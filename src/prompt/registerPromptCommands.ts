import * as vscode from 'vscode';

import type { PromptDraft, PromptItem } from './promptTypes';

export interface PromptCommandTarget {
  promptId: string;
}

export interface PromptCommandManager {
  copyItem(
    id: string,
    writeClipboard: (text: string) => Promise<void>,
  ): Promise<void>;
  deleteItem(id: string): Promise<void>;
  getItems(): PromptItem[];
  importText(text: string, mode: 'append' | 'replace'): Promise<void>;
  moveItem(id: string, direction: 'up' | 'down'): Promise<void>;
  resetAllUsed(): Promise<void>;
  toggleUsed(id: string): Promise<void>;
  createItem(draft: PromptDraft): Promise<void>;
  updateItem(id: string, draft: PromptDraft): Promise<void>;
}

export interface PromptCommandTreeProvider {
  refresh(): void;
}

export interface PromptCommandEditor {
  getContext(document: { uri: { toString(): string } }):
    | { mode: 'create' | 'edit'; promptId?: string }
    | undefined;
  openCreateEditor(): Promise<unknown>;
  openEditEditor(item: PromptItem): Promise<unknown>;
  parseDocument(document: { getText(): string }): PromptDraft;
}

export interface RegisterPromptCommandsOptions {
  bulkImport?: PromptBulkImportController;
  editor?: PromptCommandEditor;
  manager: PromptCommandManager;
  treeProvider: PromptCommandTreeProvider;
}

export interface PromptBulkImportController {
  pickMode(): Promise<'append' | 'replace' | undefined>;
  pickSource(): Promise<'clipboard' | 'document' | 'selection' | undefined>;
  readSource(source: 'clipboard' | 'document' | 'selection'): Promise<string>;
}

function getPromptId(target: PromptCommandTarget | undefined): string | undefined {
  return target?.promptId;
}

export function registerPromptCommands(
  options: RegisterPromptCommandsOptions,
): vscode.Disposable[] {
  const { bulkImport, editor, manager, treeProvider } = options;

  return [
    vscode.commands.registerCommand(
      'promptQueue.copyItem',
      async (target: PromptCommandTarget | undefined) => {
        const promptId = getPromptId(target);

        if (!promptId) {
          return;
        }

        await manager.copyItem(promptId, (text) =>
          Promise.resolve(vscode.env.clipboard.writeText(text)),
        );
        treeProvider.refresh();
      },
    ),
    vscode.commands.registerCommand(
      'promptQueue.toggleUsed',
      async (target: PromptCommandTarget | undefined) => {
        const promptId = getPromptId(target);

        if (!promptId) {
          return;
        }

        await manager.toggleUsed(promptId);
        treeProvider.refresh();
      },
    ),
    vscode.commands.registerCommand(
      'promptQueue.moveItemUp',
      async (target: PromptCommandTarget | undefined) => {
        const promptId = getPromptId(target);

        if (!promptId) {
          return;
        }

        await manager.moveItem(promptId, 'up');
        treeProvider.refresh();
      },
    ),
    vscode.commands.registerCommand(
      'promptQueue.moveItemDown',
      async (target: PromptCommandTarget | undefined) => {
        const promptId = getPromptId(target);

        if (!promptId) {
          return;
        }

        await manager.moveItem(promptId, 'down');
        treeProvider.refresh();
      },
    ),
    vscode.commands.registerCommand(
      'promptQueue.deleteItem',
      async (target: PromptCommandTarget | undefined) => {
        const promptId = getPromptId(target);

        if (!promptId) {
          return;
        }

        await manager.deleteItem(promptId);
        treeProvider.refresh();
      },
    ),
    vscode.commands.registerCommand('promptQueue.resetAllUsed', async () => {
      await manager.resetAllUsed();
      treeProvider.refresh();
    }),
    vscode.commands.registerCommand('promptQueue.bulkImport', async () => {
      const importController = bulkImport ?? createDefaultBulkImportController();
      const source = await importController.pickSource();

      if (!source) {
        return;
      }

      const text = await importController.readSource(source);

      if (text.trim().length === 0) {
        await vscode.window.showErrorMessage('没有可导入内容');
        return;
      }

      const mode = await importController.pickMode();

      if (!mode) {
        return;
      }

      try {
        await manager.importText(text, mode);
        treeProvider.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(message);
      }
    }),
    vscode.commands.registerCommand('promptQueue.addItem', async () => {
      if (!editor) {
        return;
      }

      await editor.openCreateEditor();
    }),
    vscode.commands.registerCommand(
      'promptQueue.editItem',
      async (target: PromptCommandTarget | undefined) => {
        if (!editor) {
          return;
        }

        const promptId = getPromptId(target);

        if (!promptId) {
          return;
        }

        const item = manager.getItems().find((entry) => entry.id === promptId);

        if (!item) {
          return;
        }

        await editor.openEditEditor(item);
      },
    ),
    vscode.commands.registerCommand('promptQueue.saveItem', async () => {
      if (!editor) {
        return;
      }

      const document = vscode.window.activeTextEditor?.document;

      if (!document) {
        return;
      }

      const context = editor.getContext(document);

      if (!context) {
        return;
      }

      const draft = editor.parseDocument(document);

      if (context.mode === 'create') {
        await manager.createItem(draft);
      } else if (context.promptId) {
        await manager.updateItem(context.promptId, draft);
      }

      treeProvider.refresh();
    }),
  ];
}

function createDefaultBulkImportController(): PromptBulkImportController {
  return {
    async pickMode() {
      const selected = await vscode.window.showQuickPick(
        [
          { label: '追加导入', value: 'append' as const },
          { label: '清空后导入', value: 'replace' as const },
        ],
        {
          title: 'PromptQueue: 选择导入模式',
        },
      );

      return selected?.value;
    },
    async pickSource() {
      const selected = await vscode.window.showQuickPick(
        [
          { label: '当前选区', value: 'selection' as const },
          { label: '当前文档', value: 'document' as const },
          { label: '系统剪贴板', value: 'clipboard' as const },
        ],
        {
          title: 'PromptQueue: 选择导入来源',
        },
      );

      return selected?.value;
    },
    async readSource(source) {
      if (source === 'clipboard') {
        return vscode.env.clipboard.readText();
      }

      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        return '';
      }

      if (source === 'selection') {
        return editor.document.getText(editor.selection);
      }

      return editor.document.getText();
    },
  };
}
