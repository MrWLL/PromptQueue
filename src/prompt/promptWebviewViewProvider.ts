import * as vscode from 'vscode';

import { getPromptQueueStrings } from './promptLocalization';
import { getPromptQueueWebviewHtml } from './promptWebviewHtml';
import type {
  PromptWebviewIncomingMessage,
  PromptWebviewOutgoingMessage,
  PromptWebviewState,
} from './promptWebviewProtocol';
import type {
  PromptCopySettings,
  PromptDraft,
  PromptItem,
} from './promptTypes';

export interface PromptWebviewProviderManager {
  copyItem(
    id: string,
    mode: 'raw' | 'templated',
    writeClipboard: (text: string) => Promise<void>,
  ): Promise<void>;
  createItem(draft: PromptDraft): Promise<void>;
  deleteAll(): Promise<void>;
  deleteItem(id: string): Promise<void>;
  getCopySettings(): PromptCopySettings;
  getItems(): PromptItem[];
  hasLastDeletedBackup?(): Promise<boolean>;
  importText(text: string, mode: 'append' | 'replace'): Promise<void>;
  moveItem(id: string, direction: 'up' | 'down'): Promise<void>;
  reorder(sourceId: string, targetId: string): Promise<void>;
  restoreLastDeleted(): Promise<void>;
  toggleUsed(id: string): Promise<void>;
  updateCopySettings(settings: PromptCopySettings): Promise<void>;
  updateItem(id: string, draft: PromptDraft): Promise<void>;
}

export interface PromptWebviewViewProviderOptions {
  getStorageLabel: () => string;
  getUiLanguage: () => string;
  manager: PromptWebviewProviderManager;
  writeClipboard?: (text: string) => Promise<void>;
}

export class PromptWebviewViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;

  constructor(private readonly options: PromptWebviewViewProviderOptions) {}

  async resolveWebviewView(view: vscode.WebviewView): Promise<void> {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
    };
    view.webview.html = getPromptQueueWebviewHtml();
    view.webview.onDidReceiveMessage((message: PromptWebviewIncomingMessage) =>
      this.handleMessage(message),
    );

    await this.postState();
  }

  async refresh(): Promise<void> {
    await this.postState();
  }

  private async handleMessage(
    message: PromptWebviewIncomingMessage,
  ): Promise<void> {
    try {
      switch (message.type) {
        case 'requestState':
          break;
        case 'copyPrompt':
          await this.options.manager.copyItem(
            message.promptId,
            'templated',
            this.options.writeClipboard ?? (async () => undefined),
          );
          break;
        case 'copyPromptRaw':
          await this.options.manager.copyItem(
            message.promptId,
            'raw',
            this.options.writeClipboard ?? (async () => undefined),
          );
          break;
        case 'toggleUsed':
          await this.options.manager.toggleUsed(message.promptId);
          break;
        case 'createPrompt':
          await this.options.manager.createItem(message.draft);
          break;
        case 'updatePrompt':
          await this.options.manager.updateItem(message.promptId, message.draft);
          break;
        case 'importPrompts':
          await this.options.manager.importText(message.text, message.mode);
          break;
        case 'deletePrompt':
          await this.options.manager.deleteItem(message.promptId);
          break;
        case 'deleteAllPrompts':
          await this.options.manager.deleteAll();
          break;
        case 'restoreLastDeleted':
          await this.options.manager.restoreLastDeleted();
          break;
        case 'movePrompt':
          await this.options.manager.moveItem(
            message.promptId,
            message.direction,
          );
          break;
        case 'reorderPrompts':
          await this.options.manager.reorder(
            message.sourceId,
            message.targetId,
          );
          break;
        case 'updateCopySettings':
          await this.options.manager.updateCopySettings(message.settings);
          break;
      }

      await this.postState();
    } catch (error) {
      await this.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async postState(): Promise<void> {
    const strings = getPromptQueueStrings(this.options.getUiLanguage());
    const state: PromptWebviewState = {
      canRestoreLastDeleted:
        (await this.options.manager.hasLastDeletedBackup?.()) ?? false,
      copySettings: this.options.manager.getCopySettings(),
      items: this.options.manager.getItems(),
      storageLabel: this.options.getStorageLabel(),
      strings,
    };

    await this.postMessage({
      type: 'state',
      state,
    });
  }

  private async postMessage(
    message: PromptWebviewOutgoingMessage,
  ): Promise<void> {
    if (!this.view) {
      return;
    }

    await this.view.webview.postMessage(message);
  }
}
