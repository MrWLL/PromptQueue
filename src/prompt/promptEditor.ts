import * as vscode from 'vscode';

import type { PromptDraft, PromptItem } from './promptTypes';

export interface PromptEditorContext {
  mode: 'create' | 'edit';
  promptId?: string;
}

export function buildPromptEditorText(draft: PromptDraft): string {
  return `Title: ${draft.title ?? ''}\n\n---\n${draft.content}`;
}

export function parsePromptEditorText(text: string): PromptDraft {
  const normalizedText = text.replace(/\r\n/g, '\n');
  const separator = '\n---\n';
  const separatorIndex = normalizedText.indexOf(separator);

  if (separatorIndex === -1) {
    throw new Error('Prompt editor text must contain a --- separator.');
  }

  const header = normalizedText.slice(0, separatorIndex);
  const body = normalizedText.slice(separatorIndex + separator.length).trim();
  const titleLine = header.split(/\r?\n/u, 1)[0] ?? '';

  if (!titleLine.startsWith('Title:')) {
    throw new Error('Prompt editor text must start with Title:.');
  }

  if (body.length === 0) {
    throw new Error('Prompt content is required.');
  }

  const title = titleLine.slice('Title:'.length).trim();

  return {
    title: title.length > 0 ? title : undefined,
    content: body,
  };
}

export class PromptEditor {
  private readonly contexts = new Map<string, PromptEditorContext>();

  constructor(
    private readonly workspaceApi = vscode.workspace,
    private readonly windowApi = vscode.window,
  ) {}

  async openCreateEditor(
    initialDraft: PromptDraft = { title: undefined, content: '' },
  ): Promise<vscode.TextDocument> {
    const document = await this.workspaceApi.openTextDocument({
      content: buildPromptEditorText(initialDraft),
      language: 'markdown',
    });

    this.contexts.set(document.uri.toString(), { mode: 'create' });
    await this.windowApi.showTextDocument(document);

    return document;
  }

  async openEditEditor(item: PromptItem): Promise<vscode.TextDocument> {
    const document = await this.workspaceApi.openTextDocument({
      content: buildPromptEditorText({
        title: item.title,
        content: item.content,
      }),
      language: 'markdown',
    });

    this.contexts.set(document.uri.toString(), {
      mode: 'edit',
      promptId: item.id,
    });
    await this.windowApi.showTextDocument(document);

    return document;
  }

  getContext(document: vscode.TextDocument): PromptEditorContext | undefined {
    return this.contexts.get(document.uri.toString());
  }

  parseDocument(document: vscode.TextDocument): PromptDraft {
    return parsePromptEditorText(document.getText());
  }
}
