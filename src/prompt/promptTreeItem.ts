import * as vscode from 'vscode';

import type { PromptItem } from './promptTypes';

function getItemLabel(promptItem: PromptItem, index: number): string {
  const numberLabel = String(index + 1).padStart(2, '0');
  const preview = promptItem.title ?? promptItem.content.slice(0, 23);

  return `${numberLabel}. ${preview}`;
}

function getTooltip(promptItem: PromptItem): string {
  const parts = [
    promptItem.title ? `标题: ${promptItem.title}` : '标题: 无',
    `状态: ${promptItem.used ? '已使用' : '未使用'}`,
    '',
    promptItem.content,
  ];

  return parts.join('\n');
}

export class PromptTreeItem extends vscode.TreeItem {
  readonly promptId: string;

  constructor(promptItem: PromptItem, index: number) {
    super(getItemLabel(promptItem, index), vscode.TreeItemCollapsibleState.None);

    this.promptId = promptItem.id;
    this.description = promptItem.used ? '已使用' : '未使用';
    this.tooltip = getTooltip(promptItem);
    this.contextValue = 'promptQueue.item';
    this.iconPath = new vscode.ThemeIcon(
      promptItem.used ? 'pass-filled' : 'circle-large-outline',
    );
  }
}
