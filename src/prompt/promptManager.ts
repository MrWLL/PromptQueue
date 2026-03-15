import { randomUUID } from 'node:crypto';

import { parseImportText } from './importParser';
import type { PromptDraft, PromptItem } from './promptTypes';
import type { WorkspaceFolderLike } from './workspacePaths';

export interface PromptManagerStore {
  load(workspaceFolder: WorkspaceFolderLike | undefined): Promise<PromptItem[]>;
  save(
    workspaceFolder: WorkspaceFolderLike | undefined,
    items: PromptItem[],
  ): Promise<void>;
}

export interface PromptManagerOptions {
  store: PromptManagerStore;
  workspaceFolder: WorkspaceFolderLike | undefined;
  idFactory?: () => string;
  now?: () => string;
}

export class PromptManager {
  private readonly store: PromptManagerStore;
  private readonly workspaceFolder: WorkspaceFolderLike | undefined;
  private readonly idFactory: () => string;
  private readonly now: () => string;

  private items: PromptItem[] = [];

  constructor(options: PromptManagerOptions) {
    this.store = options.store;
    this.workspaceFolder = options.workspaceFolder;
    this.idFactory = options.idFactory ?? randomUUID;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async initialize(): Promise<void> {
    this.items = await this.store.load(this.workspaceFolder);
  }

  getItems(): PromptItem[] {
    return structuredClone(this.items);
  }

  async copyItem(
    id: string,
    writeClipboard: (text: string) => Promise<void>,
  ): Promise<void> {
    const item = this.getRequiredItem(id);

    await writeClipboard(item.content);

    item.used = true;
    item.updatedAt = this.now();

    await this.persist();
  }

  async toggleUsed(id: string): Promise<void> {
    const item = this.getRequiredItem(id);

    item.used = !item.used;
    item.updatedAt = this.now();

    await this.persist();
  }

  async moveItem(id: string, direction: 'up' | 'down'): Promise<void> {
    const index = this.getRequiredItemIndex(id);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= this.items.length) {
      return;
    }

    [this.items[index], this.items[targetIndex]] = [
      this.items[targetIndex],
      this.items[index],
    ];

    await this.persist();
  }

  async reorder(sourceId: string, targetId: string): Promise<void> {
    if (sourceId === targetId) {
      return;
    }

    const sourceIndex = this.getRequiredItemIndex(sourceId);
    const [sourceItem] = this.items.splice(sourceIndex, 1);
    const targetIndex = this.getRequiredItemIndex(targetId);

    this.items.splice(targetIndex, 0, sourceItem);

    await this.persist();
  }

  async deleteItem(id: string): Promise<void> {
    const index = this.getRequiredItemIndex(id);

    this.items.splice(index, 1);

    await this.persist();
  }

  async deleteAll(): Promise<void> {
    this.items = [];
    await this.persist();
  }

  async resetAllUsed(): Promise<void> {
    const timestamp = this.now();

    this.items = this.items.map((item) => ({
      ...item,
      used: false,
      updatedAt: timestamp,
    }));

    await this.persist();
  }

  async importText(text: string, mode: 'append' | 'replace'): Promise<void> {
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

    this.items = mode === 'replace'
      ? importedItems
      : [...this.items, ...importedItems];

    await this.persist();
  }

  async createItem(draft: PromptDraft): Promise<void> {
    const timestamp = this.now();

    this.items.push({
      id: this.idFactory(),
      title: draft.title,
      content: draft.content,
      used: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await this.persist();
  }

  async updateItem(id: string, draft: PromptDraft): Promise<void> {
    const item = this.getRequiredItem(id);

    item.title = draft.title;
    item.content = draft.content;
    item.updatedAt = this.now();

    await this.persist();
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
}
