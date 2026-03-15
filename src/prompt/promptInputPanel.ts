import * as vscode from 'vscode';

import { parseImportText } from './importParser';
import type { PromptDraft } from './promptTypes';

export interface PromptInputPanelOptions {
  title: string;
  confirmLabel: string;
  helperText: string;
  initialText: string;
}

export interface PromptInputPanelApi {
  open(options: PromptInputPanelOptions): Promise<string | undefined>;
}

export function formatPromptInputText(draft: PromptDraft): string {
  if (draft.title && draft.title.trim().length > 0) {
    return `-*- ${draft.title.trim()}\n${draft.content}`;
  }

  return draft.content;
}

export function parseSinglePromptInputText(text: string): PromptDraft {
  const normalizedText = text.replace(/\r\n/g, '\n').trim();

  if (normalizedText.length === 0) {
    throw new Error('请输入提示词内容。');
  }

  const items = parseImportText(normalizedText);

  if (items.length === 0) {
    throw new Error('请输入提示词内容。');
  }

  if (items.length > 1) {
    throw new Error('新增或编辑时一次只能保存一条提示词。');
  }

  return items[0];
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export class PromptInputPanel implements PromptInputPanelApi {
  constructor(private readonly windowApi = vscode.window) {}

  async open(options: PromptInputPanelOptions): Promise<string | undefined> {
    const panel = this.windowApi.createWebviewPanel(
      'promptQueue.inputPanel',
      options.title,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
      },
    );

    panel.webview.html = this.renderHtml(options);

    return await new Promise<string | undefined>((resolve) => {
      let settled = false;

      const finish = (value: string | undefined) => {
        if (settled) {
          return;
        }

        settled = true;
        resolve(value);
        panel.dispose();
      };

      const messageDisposable = panel.webview.onDidReceiveMessage((message) => {
        if (message?.type === 'confirm') {
          finish(typeof message.value === 'string' ? message.value : '');
          return;
        }

        if (message?.type === 'cancel') {
          finish(undefined);
        }
      });

      const disposeDisposable = panel.onDidDispose(() => {
        finish(undefined);
      });

      panel.onDidDispose(() => {
        messageDisposable.dispose();
        disposeDisposable.dispose();
      });
    });
  }

  private renderHtml(options: PromptInputPanelOptions): string {
    const title = escapeHtml(options.title);
    const confirmLabel = escapeHtml(options.confirmLabel);
    const helperText = escapeHtml(options.helperText);
    const initialText = escapeHtml(options.initialText);

    return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light dark;
      }

      body {
        font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
        margin: 0;
        padding: 20px;
        background: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
      }

      .wrap {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      h1 {
        margin: 0;
        font-size: 18px;
      }

      p {
        margin: 0;
        color: var(--vscode-descriptionForeground);
        line-height: 1.6;
      }

      textarea {
        width: 100%;
        min-height: 320px;
        resize: vertical;
        box-sizing: border-box;
        border: 1px solid var(--vscode-input-border, transparent);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border-radius: 8px;
        padding: 12px;
        font: 13px/1.6 Consolas, "Courier New", monospace;
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }

      button {
        border: none;
        border-radius: 6px;
        padding: 9px 16px;
        cursor: pointer;
      }

      .cancel {
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
      }

      .confirm {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
      }

      .tips {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>${title}</h1>
      <p>${helperText}</p>
      <textarea id="input" spellcheck="false">${initialText}</textarea>
      <div class="tips">支持直接输入正文；也支持用第一行 <code>-*- 标题</code> 设置标题。按 Ctrl/Cmd + Enter 可直接确认。</div>
      <div class="actions">
        <button class="cancel" id="cancel">取消</button>
        <button class="confirm" id="confirm">${confirmLabel}</button>
      </div>
    </div>
    <script>
      const vscode = acquireVsCodeApi();
      const textarea = document.getElementById('input');
      const confirmButton = document.getElementById('confirm');
      const cancelButton = document.getElementById('cancel');

      confirmButton.addEventListener('click', () => {
        vscode.postMessage({ type: 'confirm', value: textarea.value });
      });

      cancelButton.addEventListener('click', () => {
        vscode.postMessage({ type: 'cancel' });
      });

      textarea.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault();
          vscode.postMessage({ type: 'confirm', value: textarea.value });
        }
      });

      textarea.focus();
      textarea.selectionStart = textarea.value.length;
      textarea.selectionEnd = textarea.value.length;
    </script>
  </body>
</html>`;
  }
}
