import * as vscode from 'vscode';

import {
  formatPromptInputText,
  parseSinglePromptInputText,
  type PromptInputPanelApi,
} from './promptInputPanel';
import type { PromptSettingsPanelApi } from './promptSettingsPanel';
import type {
  PromptCopySettings,
  PromptDraft,
  PromptItem,
} from './promptTypes';

export interface PromptCommandTarget {
  promptId: string;
}

export interface PromptCommandManager {
  copyItem(
    id: string,
    mode: 'raw' | 'templated',
    writeClipboard: (text: string) => Promise<void>,
  ): Promise<void>;
  deleteAll(): Promise<void>;
  deleteItem(id: string): Promise<void>;
  getCopySettings(): PromptCopySettings;
  getItems(): PromptItem[];
  importText(text: string, mode: 'append' | 'replace'): Promise<void>;
  moveItem(id: string, direction: 'up' | 'down'): Promise<void>;
  resetAllUsed(): Promise<void>;
  toggleUsed(id: string): Promise<void>;
  createItem(draft: PromptDraft): Promise<void>;
  updateCopySettings(settings: PromptCopySettings): Promise<void>;
  updateItem(id: string, draft: PromptDraft): Promise<void>;
}

export interface PromptCommandTreeProvider {
  refresh(): void;
}

export interface RegisterPromptCommandsOptions {
  inputPanel?: PromptInputPanelApi;
  manager: PromptCommandManager;
  settingsPanel?: PromptSettingsPanelApi;
  treeProvider: PromptCommandTreeProvider;
}

const COPY_SETTINGS_HELPER_TEXT =
  '留空会自动省略该段。单独输入 ``` 或 ```ts 时，复制会自动补全另一侧代码块围栏。';

function getPromptId(target: PromptCommandTarget | undefined): string | undefined {
  return target?.promptId;
}

export function registerPromptCommands(
  options: RegisterPromptCommandsOptions,
): vscode.Disposable[] {
  const { inputPanel, manager, settingsPanel, treeProvider } = options;
  const panel = inputPanel;
  const copySettingsPanel = settingsPanel;

  return [
    vscode.commands.registerCommand(
      'promptQueue.copyItem',
      async (target: PromptCommandTarget | undefined) => {
        const promptId = getPromptId(target);

        if (!promptId) {
          return;
        }

        await manager.copyItem(promptId, 'templated', (text) =>
          Promise.resolve(vscode.env.clipboard.writeText(text)),
        );
        vscode.window.setStatusBarMessage('已复制', 1500);
        treeProvider.refresh();
      },
    ),
    vscode.commands.registerCommand(
      'promptQueue.copyItemRaw',
      async (target: PromptCommandTarget | undefined) => {
        const promptId = getPromptId(target);

        if (!promptId) {
          return;
        }

        await manager.copyItem(promptId, 'raw', (text) =>
          Promise.resolve(vscode.env.clipboard.writeText(text)),
        );
        vscode.window.setStatusBarMessage('已复制', 1500);
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
    vscode.commands.registerCommand('promptQueue.deleteAllItems', async () => {
      const confirmed = await vscode.window.showWarningMessage(
        '确认删除全部提示词吗？',
        { modal: true, detail: '此操作不可撤销。' },
        '全部删除',
      );

      if (confirmed !== '全部删除') {
        return;
      }

      await manager.deleteAll();
      treeProvider.refresh();
    }),
    vscode.commands.registerCommand('promptQueue.openSettings', async () => {
      if (!copySettingsPanel) {
        return;
      }

      const settings = await copySettingsPanel.open({
        title: '复制设置',
        confirmLabel: '保存',
        helperText: COPY_SETTINGS_HELPER_TEXT,
        initialSettings: manager.getCopySettings(),
      });

      if (!settings) {
        return;
      }

      try {
        await manager.updateCopySettings(settings);
        vscode.window.setStatusBarMessage('已保存设置', 1500);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(message);
      }
    }),
    vscode.commands.registerCommand('promptQueue.bulkImport', async () => {
      if (!panel) {
        return;
      }

      const text = await panel.open({
        title: '批量导入提示词',
        confirmLabel: '导入',
        helperText:
          '请按 “-*- 标题” 或 “-*-” 的格式分隔多条提示词，导入后会追加到当前列表末尾。',
        initialText: '',
      });

      if (typeof text !== 'string') {
        return;
      }

      if (text.trim().length === 0) {
        await vscode.window.showErrorMessage('没有可导入内容');
        return;
      }

      try {
        await manager.importText(text, 'append');
        treeProvider.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(message);
      }
    }),
    vscode.commands.registerCommand('promptQueue.addItem', async () => {
      if (!panel) {
        return;
      }

      const text = await panel.open({
        title: '新增提示词',
        confirmLabel: '保存',
        helperText:
          '直接输入正文可保存为无标题提示词；也可以用第一行 “-*- 标题” 来设置标题。',
        initialText: '',
      });

      if (typeof text !== 'string') {
        return;
      }

      try {
        const draft = parseSinglePromptInputText(text);
        await manager.createItem(draft);
        treeProvider.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(message);
      }
    }),
    vscode.commands.registerCommand(
      'promptQueue.editItem',
      async (target: PromptCommandTarget | undefined) => {
        if (!panel) {
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

        const text = await panel.open({
          title: '编辑提示词',
          confirmLabel: '保存修改',
          helperText:
            '直接编辑正文即可保存为无标题提示词；如果需要标题，请把第一行写成 “-*- 标题”。',
          initialText: formatPromptInputText({
            title: item.title,
            content: item.content,
          }),
        });

        if (typeof text !== 'string') {
          return;
        }

        try {
          const draft = parseSinglePromptInputText(text);
          await manager.updateItem(promptId, draft);
          treeProvider.refresh();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await vscode.window.showErrorMessage(message);
        }
      },
    ),
  ];
}
