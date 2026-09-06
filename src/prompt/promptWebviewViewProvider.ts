import * as vscode from 'vscode';

import { getPromptCopyAgeLabel } from './promptCopyAge';
import { getPromptQueueStrings } from './promptLocalization';
import { PromptQuickRunError } from './promptTerminalQuickRunner';
import { INDIRECT_COPY_INSTRUCTION } from './promptTaskFile';
import { getPromptQueueWebviewHtml } from './promptWebviewHtml';
import type {
  PromptQuickRunAvailability,
  PromptWebviewIncomingMessage,
  PromptWebviewItem,
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
  getInitializationError?(): string | undefined;
  getItems(): PromptItem[];
  hasLastDeletedBackup?(): Promise<boolean>;
  importText(text: string, mode: 'append' | 'replace'): Promise<void>;
  moveItem(id: string, direction: 'up' | 'down'): Promise<void>;
  reloadCopySettings?(): Promise<PromptCopySettings>;
  reorder(sourceId: string, targetIndex: number): Promise<void>;
  restoreLastDeleted(): Promise<void>;
  isReady?(): boolean;
  toggleUsed(id: string): Promise<void>;
  updateCopySettings(settings: PromptCopySettings): Promise<void>;
  updateItem(id: string, draft: PromptDraft): Promise<void>;
}

export interface PromptWebviewViewProviderOptions {
  extensionUri?: vscode.Uri;
  hasActiveTerminal?: () => boolean;
  hasWorkspace?: () => boolean;
  getStorageLabel: () => string;
  getUiLanguage: () => string;
  manager: PromptWebviewProviderManager;
  quickRunner?: {
    run(command: string): Promise<void>;
  };
  writeClipboard?: (text: string) => Promise<void>;
  writeTaskFile?: (text: string) => Promise<void>;
}

export class PromptWebviewViewProvider implements vscode.WebviewViewProvider {
  private manager: PromptWebviewProviderManager;
  private messageQueue: Promise<void> = Promise.resolve();
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
      this.enqueueMessage(message),
    );

    await this.refresh();
  }

  async refresh(): Promise<void> {
    const nextRefresh = this.messageQueue.then(() => this.postState());

    this.messageQueue = nextRefresh.catch(() => undefined);
    await nextRefresh;
  }

  private enqueueMessage(message: PromptWebviewIncomingMessage): Promise<void> {
    const managerAtEnqueue = this.manager;
    const nextMessage = this.messageQueue.then(async () => {
      if (managerAtEnqueue !== this.manager) {
        await this.postState();
        return;
      }

      await this.handleMessage(message);
    });

    this.messageQueue = nextMessage.catch(() => undefined);
    return nextMessage;
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

      if (message.type !== 'requestState' && !this.isDataReady()) {
        throw new Error(
          this.manager.getInitializationError?.() ??
            this.getCurrentStrings().emptyState.loadingBody,
        );
      }

      switch (message.type) {
        case 'requestState':
          if (this.isDataReady()) {
            await this.manager.reloadCopySettings?.();
          }
          break;
        case 'copyPrompt':
          await this.copyPrompt(message.promptId, 'templated');
          break;
        case 'copyPromptRaw':
          await this.copyPrompt(message.promptId, 'raw');
          break;
        case 'toggleUsed':
          await this.manager.toggleUsed(message.promptId);
          break;
        case 'createPrompt':
          await this.manager.createItem(message.draft);
          await this.postMessage({
            type: 'panelCommand',
            command: 'resetAddForm',
          });
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
          if (
            !(await this.confirmWarning(
              this.getCurrentStrings().confirmations.deletePrompt,
              this.getCurrentStrings().actions.delete,
              this.getCurrentStrings().confirmations.destructiveDetail,
            ))
          ) {
            return;
          }
          await this.manager.deleteItem(message.promptId);
          await this.postToast(this.getCurrentStrings().messages.deleted);
          break;
        case 'deleteAllPrompts':
          if (
            !(await this.confirmWarning(
              this.getCurrentStrings().confirmations.deleteAll,
              this.getCurrentStrings().actions.deleteAll,
              this.getCurrentStrings().confirmations.destructiveDetail,
            ))
          ) {
            return;
          }
          await this.manager.deleteAll();
          await this.postToast(this.getCurrentStrings().messages.deletedAll);
          break;
        case 'restoreLastDeleted':
          if (
            this.manager.getItems().length > 0 &&
            !(await this.confirmWarning(
              this.getCurrentStrings().confirmations.restoreReplace,
              this.getCurrentStrings().actions.restoreLastDeleted,
            ))
          ) {
            return;
          }
          await this.manager.restoreLastDeleted();
          await this.postToast(this.getCurrentStrings().messages.restored);
          break;
        case 'movePrompt':
          await this.manager.moveItem(
            message.promptId,
            message.direction,
          );
          break;
        case 'quickRun':
          if (!this.options.quickRunner) {
            throw new PromptQuickRunError('no-active-terminal');
          }
          await this.options.quickRunner.run(
            this.manager.getCopySettings().quickRunCommand,
          );
          await this.postToast(
            this.getCurrentStrings().messages.quickRunExecuted,
          );
          break;
        case 'reorderPrompts': {
          if (typeof message.targetIndex !== 'number') {
            break;
          }

          await this.manager.reorder(
            message.sourceId,
            message.targetIndex,
          );
          break;
        }
        case 'updateCopySettings':
          await this.manager.updateCopySettings(message.settings);
          if (!message.silent) {
            await this.postToast(this.getCurrentStrings().messages.saved);
          }
          break;
      }

      await this.postState();
    } catch (error) {
      const strings = this.getCurrentStrings();
      const messageText = error instanceof Error ? error.message : String(error);
      const quickRunErrorCode =
        error instanceof PromptQuickRunError
          ? error.code
          : typeof error === 'object' &&
              error !== null &&
              'code' in error &&
              typeof (error as { code?: unknown }).code === 'string'
            ? (error as { code: string }).code
            : undefined;

      await this.postMessage({
        type: 'error',
        message:
          quickRunErrorCode === 'no-active-terminal'
            ? strings.messages.quickRunNoActiveTerminal
            : quickRunErrorCode === 'ambiguous-terminal'
              ? strings.messages.quickRunAmbiguousTerminal
            : messageText === 'No deleted prompt backup available.'
            ? strings.messages.noLastDeletedBackup
            : messageText === 'PromptQueue requires an open workspace.'
              ? strings.messages.noWorkspace
            : messageText,
      });
      await this.postState();
    }
  }

  private async postState(): Promise<void> {
    const manager = this.manager;
    const strings = this.getCurrentStrings();
    const dataReady = this.isDataReady(manager);
    const copySettings = manager.getCopySettings();
    const items = dataReady ? this.buildWebviewItems(manager) : [];
    const state: PromptWebviewState = {
      canRestoreLastDeleted:
        dataReady && ((await manager.hasLastDeletedBackup?.()) ?? false),
      copySettings,
      dataError: dataReady
        ? undefined
        : manager.getInitializationError?.(),
      dataReady,
      items,
      quickRunAvailability: this.getQuickRunAvailability(copySettings),
      storageLabel: this.options.getStorageLabel(),
      strings,
      workspaceReady: this.isWorkspaceReady(),
    };

    if (manager !== this.manager) {
      await this.postState();
      return;
    }

    await this.postMessage({
      type: 'state',
      state,
    });
  }

  private buildWebviewItems(
    manager: PromptWebviewProviderManager = this.manager,
  ): PromptWebviewItem[] {
    const nowMs = Date.now();
    const items = manager.getItems();
    const duplicateIndexes = new Set<number>();

    for (let index = 1; index < items.length; index += 1) {
      const previousContent = this.normalizeDuplicateContent(
        items[index - 1].content,
      );
      const currentContent = this.normalizeDuplicateContent(
        items[index].content,
      );

      if (previousContent !== currentContent) {
        continue;
      }

      duplicateIndexes.add(index - 1);
      duplicateIndexes.add(index);
    }

    return items.map((item, index) => ({
      ...item,
      copyAgeLabel: item.used
        ? getPromptCopyAgeLabel(item.lastCopiedAt, nowMs)
        : undefined,
      isAdjacentDuplicate: duplicateIndexes.has(index),
    }));
  }

  private normalizeDuplicateContent(content: string): string {
    return content.replace(/\r\n/g, '\n').trim();
  }

  private getCurrentStrings() {
    return getPromptQueueStrings(this.options.getUiLanguage());
  }

  private async copyPrompt(
    promptId: string,
    mode: 'raw' | 'templated',
  ): Promise<void> {
    const strings = this.getCurrentStrings();
    const visibleCopyMode = this.manager.getCopySettings().copyMode;
    const copySettings = this.manager.reloadCopySettings
      ? await this.manager.reloadCopySettings()
      : this.manager.getCopySettings();
    const copyMode = copySettings.copyMode;

    if (copyMode !== visibleCopyMode) {
      throw new Error(strings.messages.copyModeChanged);
    }

    if (
      copyMode === 'indirect-file' &&
      !(await this.confirmWarning(
        strings.confirmations.replaceMainTask,
        strings.actions.replaceMainTask,
        strings.confirmations.replaceMainTaskDetail,
      ))
    ) {
      return;
    }

    let clipboardError: unknown;

    await this.manager.copyItem(
      promptId,
      mode,
      async (text) => {
        clipboardError = await this.deliverCopyText(text, copyMode);
      },
    );

    if (typeof clipboardError !== 'undefined') {
      throw clipboardError;
    }

    await this.postToast(strings.messages.copied);
  }

  private async deliverCopyText(
    text: string,
    copyMode: PromptCopySettings['copyMode'],
  ): Promise<unknown> {
    const writeClipboard = this.options.writeClipboard ?? (async () => undefined);

    if (copyMode !== 'indirect-file') {
      await writeClipboard(text);
      return undefined;
    }

    if (!this.options.writeTaskFile) {
      throw new Error('PromptQueue cannot write WorkSpace/main-task.md.');
    }

    await this.options.writeTaskFile(text);

    try {
      await writeClipboard(INDIRECT_COPY_INSTRUCTION);
      return undefined;
    } catch (error) {
      return error;
    }
  }

  private getQuickRunAvailability(
    copySettings: PromptCopySettings,
  ): PromptQuickRunAvailability {
    if (copySettings.quickRunEnabled !== true) {
      return 'disabled-in-settings';
    }

    if (!(this.options.hasActiveTerminal?.() ?? false)) {
      return 'no-active-terminal';
    }

    return 'ready';
  }

  private isWorkspaceReady(): boolean {
    return this.options.hasWorkspace ? this.options.hasWorkspace() : true;
  }

  private isDataReady(
    manager: PromptWebviewProviderManager = this.manager,
  ): boolean {
    return !this.isWorkspaceReady() || (manager.isReady?.() ?? true);
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

  private async confirmWarning(
    message: string,
    actionLabel: string,
    detail?: string,
  ): Promise<boolean> {
    const confirmed = await vscode.window.showWarningMessage(
      message,
      detail
        ? { modal: true, detail }
        : { modal: true },
      actionLabel,
    );

    return confirmed === actionLabel;
  }
}
