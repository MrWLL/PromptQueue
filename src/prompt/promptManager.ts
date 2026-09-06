import { randomUUID } from 'node:crypto';

import { parseImportText } from './importParser';
import type {
  PromptCopySettings,
  PromptDraft,
  PromptItem,
} from './promptTypes';
import type { WorkspaceFolderLike } from './workspacePaths';

export interface PromptManagerStore {
  load(workspaceFolder: WorkspaceFolderLike | undefined): Promise<PromptItem[]>;
  save(
    workspaceFolder: WorkspaceFolderLike | undefined,
    items: PromptItem[],
  ): Promise<void>;
}

export interface PromptManagerSettingsStore {
  load(
    workspaceFolder: WorkspaceFolderLike | undefined,
  ): Promise<PromptCopySettings>;
  save(
    workspaceFolder: WorkspaceFolderLike | undefined,
    settings: PromptCopySettings,
  ): Promise<void>;
}

export interface PromptManagerBackupStore {
  load(
    workspaceFolder: WorkspaceFolderLike | undefined,
  ): Promise<PromptItem[] | undefined>;
  save(
    workspaceFolder: WorkspaceFolderLike | undefined,
    items: PromptItem[],
  ): Promise<void>;
}

export interface PromptManagerOptions {
  backupStore?: PromptManagerBackupStore;
  store: PromptManagerStore;
  settingsStore: PromptManagerSettingsStore;
  workspaceFolder: WorkspaceFolderLike | undefined;
  idFactory?: () => string;
  now?: () => string;
}

export type PromptCopyMode = 'raw' | 'templated';

interface MarkdownFence {
  closing: string;
  opening: string;
}

export class PromptManager {
  private readonly backupStore: PromptManagerBackupStore;
  private readonly store: PromptManagerStore;
  private readonly settingsStore: PromptManagerSettingsStore;
  private readonly workspaceFolder: WorkspaceFolderLike | undefined;
  private readonly idFactory: () => string;
  private readonly now: () => string;

  private items: PromptItem[] = [];
  private initialized = false;
  private initializationError: Error | undefined;
  private copySettings: PromptCopySettings = {
    copyMode: 'direct',
    includeTemplateOnClick: true,
    prefix: '',
    quickRunCommand: '/new',
    quickRunEnabled: false,
    suffix: '',
  };

  constructor(options: PromptManagerOptions) {
    this.backupStore = options.backupStore ?? {
      load: async () => undefined,
      save: async () => undefined,
    };
    this.store = options.store;
    this.settingsStore = options.settingsStore;
    this.workspaceFolder = options.workspaceFolder;
    this.idFactory = options.idFactory ?? randomUUID;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async initialize(): Promise<void> {
    this.initialized = false;
    this.initializationError = undefined;

    try {
      const items = await this.store.load(this.workspaceFolder);
      const copySettings = await this.settingsStore.load(this.workspaceFolder);

      this.items = items;
      this.copySettings = copySettings;
      this.initialized = true;
    } catch (error) {
      this.initializationError =
        error instanceof Error ? error : new Error(String(error));
      throw error;
    }
  }

  isReady(): boolean {
    return this.initialized;
  }

  getInitializationError(): string | undefined {
    return this.initializationError?.message;
  }

  getItems(): PromptItem[] {
    return structuredClone(this.items);
  }

  getCopySettings(): PromptCopySettings {
    return structuredClone(this.copySettings);
  }

  async reloadCopySettings(): Promise<PromptCopySettings> {
    this.assertReady();
    const copySettings = await this.settingsStore.load(this.workspaceFolder);

    this.copySettings = copySettings;
    return this.getCopySettings();
  }

  async copyItem(
    id: string,
    mode: PromptCopyMode,
    writeClipboard: (text: string) => Promise<void>,
  ): Promise<void> {
    this.assertReady();
    const item = this.getRequiredItem(id);
    const copyText = this.buildCopyText(item.content, mode);
    const copyMode = this.copySettings.copyMode;

    await writeClipboard(copyText);

    await this.mutateItemsAndPersist(() => {
      const timestamp = this.now();

      if (copyMode === 'indirect-file') {
        for (const candidate of this.items) {
          candidate.activeTask = candidate.id === id;
        }
      }

      item.used = true;
      item.lastCopiedAt = timestamp;
      item.updatedAt = timestamp;
    });
  }

  async updateCopySettings(settings: PromptCopySettings): Promise<void> {
    this.assertReady();
    const previousSettings = this.copySettings;
    const nextSettings = this.normalizeCopySettings(settings);

    this.copySettings = nextSettings;

    try {
      await this.settingsStore.save(this.workspaceFolder, this.copySettings);
    } catch (error) {
      this.copySettings = previousSettings;
      throw error;
    }
  }

  async toggleUsed(id: string): Promise<void> {
    this.assertReady();

    await this.mutateItemsAndPersist(() => {
      const item = this.getRequiredItem(id);

      if (item.activeTask) {
        item.activeTask = false;
        item.used = false;
      } else {
        item.used = !item.used;
      }
      item.updatedAt = this.now();
    });
  }

  async moveItem(id: string, direction: 'up' | 'down'): Promise<void> {
    this.assertReady();
    const index = this.getRequiredItemIndex(id);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= this.items.length) {
      return;
    }

    await this.mutateItemsAndPersist(() => {
      [this.items[index], this.items[targetIndex]] = [
        this.items[targetIndex],
        this.items[index],
      ];
    });
  }

  async reorder(sourceId: string, targetIndex: number): Promise<void> {
    this.assertReady();
    const sourceIndex = this.getRequiredItemIndex(sourceId);

    await this.mutateItemsAndPersist(() => {
      const [sourceItem] = this.items.splice(sourceIndex, 1);
      const clampedTargetIndex = Math.max(
        0,
        Math.min(targetIndex, this.items.length),
      );

      this.items.splice(clampedTargetIndex, 0, sourceItem);
    });
  }

  async deleteItem(id: string): Promise<void> {
    this.assertReady();
    const index = this.getRequiredItemIndex(id);

    await this.mutateItemsAndPersist(() => {
      this.items.splice(index, 1);
    });
  }

  async deleteAll(): Promise<void> {
    this.assertReady();

    if (this.items.length > 0) {
      await this.backupStore.load(this.workspaceFolder);
      await this.backupStore.save(this.workspaceFolder, this.items);
    }

    await this.replaceItemsAndPersist([]);
  }

  async restoreLastDeleted(): Promise<void> {
    this.assertReady();
    const backupItems = await this.backupStore.load(this.workspaceFolder);

    if (!backupItems) {
      throw new Error('No deleted prompt backup available.');
    }

    await this.replaceItemsAndPersist(backupItems);
  }

  async hasLastDeletedBackup(): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    try {
      const backupItems = await this.backupStore.load(this.workspaceFolder);
      return Array.isArray(backupItems) && backupItems.length > 0;
    } catch {
      return false;
    }
  }

  async resetAllUsed(): Promise<void> {
    this.assertReady();
    const timestamp = this.now();

    await this.replaceItemsAndPersist(this.items.map((item) => ({
      ...item,
      used: false,
      updatedAt: timestamp,
    })));
  }

  async importText(text: string, mode: 'append' | 'replace'): Promise<void> {
    this.assertReady();
    const parsedItems = parseImportText(text);

    if (parsedItems.length === 0) {
      throw new Error('没有解析出可导入的提示词。');
    }

    const timestamp = this.now();
    const importedItems: PromptItem[] = parsedItems.map((item) => ({
      id: this.idFactory(),
      title: item.title,
      content: item.content,
      used: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));

    await this.replaceItemsAndPersist(mode === 'replace'
      ? importedItems
      : [...this.items, ...importedItems]);
  }

  async createItem(draft: PromptDraft): Promise<void> {
    this.assertReady();
    const timestamp = this.now();

    await this.mutateItemsAndPersist(() => {
      this.items.push({
        id: this.idFactory(),
        title: draft.title,
        content: draft.content,
        used: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
  }

  async updateItem(id: string, draft: PromptDraft): Promise<void> {
    this.assertReady();

    await this.mutateItemsAndPersist(() => {
      const item = this.getRequiredItem(id);

      item.title = draft.title;
      item.content = draft.content;

      if (item.activeTask) {
        item.activeTask = false;
        item.used = false;
      }

      item.updatedAt = this.now();
    });
  }

  private getRequiredItem(id: string): PromptItem {
    const index = this.getRequiredItemIndex(id);
    return this.items[index];
  }

  private getRequiredItemIndex(id: string): number {
    const index = this.items.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new Error(`Prompt item not found: ${id}`);
    }

    return index;
  }

  private async persist(): Promise<void> {
    await this.store.save(this.workspaceFolder, this.items);
  }

  private assertReady(): void {
    if (this.initialized) {
      return;
    }

    throw this.initializationError ?? new Error('PromptQueue data is still loading.');
  }

  private async mutateItemsAndPersist(mutate: () => void): Promise<void> {
    const previousItems = structuredClone(this.items);

    try {
      mutate();
      await this.persist();
    } catch (error) {
      this.items = previousItems;
      throw error;
    }
  }

  private async replaceItemsAndPersist(items: PromptItem[]): Promise<void> {
    const previousItems = this.items;

    this.items = structuredClone(items);

    try {
      await this.persist();
    } catch (error) {
      this.items = previousItems;
      throw error;
    }
  }

  private buildCopyText(content: string, mode: PromptCopyMode): string {
    if (mode === 'raw') {
      return content;
    }

    return this.resolveTemplatedCopySections(content)
      .filter((section) => section.trim().length > 0)
      .join('\n');
  }

  private resolveTemplatedCopySections(content: string): string[] {
    const { prefix, suffix } = this.copySettings;
    const prefixFence = this.parseStandaloneMarkdownFence(prefix);
    const suffixFence = this.parseStandaloneMarkdownFence(suffix);

    if (prefixFence && suffix.trim().length === 0) {
      return [prefixFence.opening, content, prefixFence.closing];
    }

    if (suffixFence && prefix.trim().length === 0) {
      return [suffixFence.opening, content, suffixFence.closing];
    }

    return [prefix, content, suffix];
  }

  private parseStandaloneMarkdownFence(
    value: string,
  ): MarkdownFence | undefined {
    const trimmed = value.trim();

    if (trimmed.length === 0 || trimmed.includes('\n')) {
      return undefined;
    }

    const match = trimmed.match(/^(`{3,}|~{3,})([^\r\n]*)$/);

    if (!match) {
      return undefined;
    }

    return {
      opening: trimmed,
      closing: match[1],
    };
  }

  private normalizeCopySettings(
    settings: PromptCopySettings,
  ): PromptCopySettings {
    const normalize = (value: string): string => {
      const normalized = value.replace(/\r\n/g, '\n');
      return normalized.trim().length === 0 ? '' : normalized;
    };

    return {
      copyMode:
        settings.copyMode === 'indirect-file' ? 'indirect-file' : 'direct',
      includeTemplateOnClick:
        typeof settings.includeTemplateOnClick === 'boolean'
          ? settings.includeTemplateOnClick
          : true,
      prefix: normalize(settings.prefix),
      quickRunCommand: normalize(settings.quickRunCommand || '') || '/new',
      quickRunEnabled:
        typeof settings.quickRunEnabled === 'boolean'
          ? settings.quickRunEnabled
          : false,
      suffix: normalize(settings.suffix),
    };
  }
}
