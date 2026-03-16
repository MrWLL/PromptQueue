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
  extensionUri?: vscode.Uri;
  hasWorkspace?: () => boolean;
  getStorageLabel: () => string;
  getUiLanguage: () => string;
  manager: PromptWebviewProviderManager;
  writeClipboard?: (text: string) => Promise<void>;
}

export class PromptWebviewViewProvider implements vscode.WebviewViewProvider {
  private manager: PromptWebviewProviderManager;
  private view: vscode.WebviewView | undefined;

  constructor(private readonly options: PromptWebviewViewProviderOptions) {
    this.manager = options.manager;
  }

  setManager(manager: PromptWebviewProviderManager): void {
    this.manager = manager;
  }

  async resolveWebviewView(view: vscode.WebviewView): Promise<void> {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
    };
    view.webview.html = getPromptQueueWebviewHtml(
      view.webview,
      this.options.extensionUri,
    );
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
      if (
        message.type !== 'requestState' &&
        !this.isWorkspaceReady()
      ) {
        throw new Error('PromptQueue requires an open workspace.');
      }

      switch (message.type) {
        case 'requestState':
          break;
        case 'copyPrompt':
          await this.manager.copyItem(
            message.promptId,
            'templated',
            this.options.writeClipboard ?? (async () => undefined),
          );
          await this.postToast(this.getCurrentStrings().messages.copied);
          break;
        case 'copyPromptRaw':
          await this.manager.copyItem(
            message.promptId,
            'raw',
            this.options.writeClipboard ?? (async () => undefined),
          );
          await this.postToast(this.getCurrentStrings().messages.copied);
          break;
        case 'toggleUsed':
          await this.manager.toggleUsed(message.promptId);
          break;
        case 'createPrompt':
          await this.manager.createItem(message.draft);
          await this.postToast(this.getCurrentStrings().messages.created);
          break;
        case 'updatePrompt':
          await this.manager.updateItem(message.promptId, message.draft);
          await this.postToast(this.getCurrentStrings().messages.updated);
          break;
        case 'importPrompts':
          await this.manager.importText(message.text, message.mode);
          await this.postToast(this.getCurrentStrings().messages.imported);
          break;
        case 'deletePrompt':
          await this.manager.deleteItem(message.promptId);
          await this.postToast(this.getCurrentStrings().messages.deleted);
          break;
        case 'deleteAllPrompts':
          await this.manager.deleteAll();
          await this.postToast(this.getCurrentStrings().messages.deletedAll);
          break;
        case 'restoreLastDeleted':
          await this.manager.restoreLastDeleted();
          await this.postToast(this.getCurrentStrings().messages.restored);
          break;
        case 'movePrompt':
          await this.manager.moveItem(
            message.promptId,
            message.direction,
          );
          break;
        case 'reorderPrompts':
          await this.manager.reorder(
            message.sourceId,
            message.targetId,
          );
          break;
        case 'updateCopySettings':
          await this.manager.updateCopySettings(message.settings);
          await this.postToast(this.getCurrentStrings().messages.saved);
          break;
      }

      await this.postState();
    } catch (error) {
      const strings = this.getCurrentStrings();
      const messageText = error instanceof Error ? error.message : String(error);
      await this.postMessage({
        type: 'error',
        message:
          messageText === 'No deleted prompt backup available.'
            ? strings.messages.noLastDeletedBackup
            : messageText === 'PromptQueue requires an open workspace.'
              ? strings.messages.noWorkspace
            : messageText,
      });
    }
  }

  private async postState(): Promise<void> {
    const strings = this.getCurrentStrings();
    const state: PromptWebviewState = {
      canRestoreLastDeleted:
        (await this.manager.hasLastDeletedBackup?.()) ?? false,
      copySettings: this.manager.getCopySettings(),
      items: this.manager.getItems(),
      storageLabel: this.options.getStorageLabel(),
      strings,
      workspaceReady: this.isWorkspaceReady(),
    };

    await this.postMessage({
      type: 'state',
      state,
    });
  }

  private getCurrentStrings() {
    return getPromptQueueStrings(this.options.getUiLanguage());
  }

  private isWorkspaceReady(): boolean {
    return this.options.hasWorkspace ? this.options.hasWorkspace() : true;
  }

  private async postMessage(
    message: PromptWebviewOutgoingMessage,
  ): Promise<void> {
    if (!this.view) {
      return;
    }

    await this.view.webview.postMessage(message);
  }

  private async postToast(message: string): Promise<void> {
    await this.postMessage({
      type: 'toast',
      message,
    });
  }
}
