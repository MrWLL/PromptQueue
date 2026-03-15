import * as vscode from 'vscode';

import type { PromptItem } from './promptTypes';
import { PromptTreeItem } from './promptTreeItem';

export const PROMPT_QUEUE_TREE_MIME = 'application/vnd.promptqueue.item';

export interface PromptTreeManager {
  getItems(): PromptItem[];
  reorder(sourceId: string, targetId: string): Promise<void>;
}

export class PromptTreeProvider
  implements
    vscode.TreeDataProvider<PromptTreeItem>,
    vscode.TreeDragAndDropController<PromptTreeItem>
{
  readonly dragMimeTypes = [PROMPT_QUEUE_TREE_MIME];
  readonly dropMimeTypes = [PROMPT_QUEUE_TREE_MIME];

  private readonly onDidChangeTreeDataEmitter =
    new vscode.EventEmitter<PromptTreeItem | undefined>();

  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly manager: PromptTreeManager) {}

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  getTreeItem(element: PromptTreeItem): PromptTreeItem {
    return element;
  }

  getChildren(): PromptTreeItem[] {
    return this.manager
      .getItems()
      .map((item, index) => new PromptTreeItem(item, index));
  }

  async handleDrag(
    source: readonly PromptTreeItem[],
    dataTransfer: vscode.DataTransfer,
  ): Promise<void> {
    const draggedIds = source.map((item) => item.promptId);

    dataTransfer.set(
      PROMPT_QUEUE_TREE_MIME,
      new vscode.DataTransferItem(JSON.stringify(draggedIds)),
    );
  }

  async handleDrop(
    target: PromptTreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
  ): Promise<void> {
    if (!target) {
      return;
    }

    const transferItem = dataTransfer.get(PROMPT_QUEUE_TREE_MIME);

    if (!transferItem) {
      return;
    }

    const draggedIds = JSON.parse(await transferItem.asString()) as string[];
    const sourceId = draggedIds[0];

    if (!sourceId || sourceId === target.promptId) {
      return;
    }

    await this.manager.reorder(sourceId, target.promptId);
    this.refresh();
  }
}
