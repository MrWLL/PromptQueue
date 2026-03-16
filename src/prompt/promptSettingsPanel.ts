import * as vscode from 'vscode';

import type { PromptCopySettings } from './promptTypes';

export interface PromptSettingsPanelOptions {
  title: string;
  confirmLabel: string;
  helperText: string;
  initialSettings: PromptCopySettings;
}

export interface PromptSettingsPanelApi {
  open(options: PromptSettingsPanelOptions): Promise<PromptCopySettings | undefined>;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export class PromptSettingsPanel implements PromptSettingsPanelApi {
  constructor(private readonly windowApi = vscode.window) {}

  async open(
    options: PromptSettingsPanelOptions,
  ): Promise<PromptCopySettings | undefined> {
    const panel = this.windowApi.createWebviewPanel(
      'promptQueue.settingsPanel',
      options.title,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
      },
    );

    panel.webview.html = this.renderHtml(options);

    return await new Promise<PromptCopySettings | undefined>((resolve) => {
      let settled = false;

      const finish = (value: PromptCopySettings | undefined) => {
        if (settled) {
          return;
        }

        settled = true;
        resolve(value);
        panel.dispose();
      };

      const messageDisposable = panel.webview.onDidReceiveMessage((message) => {
        if (message?.type === 'confirm') {
          finish({
            prefix:
              typeof message.value?.prefix === 'string'
                ? message.value.prefix
                : '',
            suffix:
              typeof message.value?.suffix === 'string'
                ? message.value.suffix
                : '',
          });
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

  private renderHtml(options: PromptSettingsPanelOptions): string {
    const title = escapeHtml(options.title);
    const confirmLabel = escapeHtml(options.confirmLabel);
    const helperText = escapeHtml(options.helperText);
    const initialPrefix = escapeHtml(options.initialSettings.prefix);
    const initialSuffix = escapeHtml(options.initialSettings.suffix);

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

      .field {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      label {
        font-size: 13px;
        font-weight: 600;
      }

      textarea {
        width: 100%;
        min-height: 140px;
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
      <div class="field">
        <label for="prefix">前提示词</label>
        <textarea id="prefix" spellcheck="false">${initialPrefix}</textarea>
      </div>
      <div class="field">
        <label for="suffix">后提示词</label>
        <textarea id="suffix" spellcheck="false">${initialSuffix}</textarea>
      </div>
      <div class="tips">留空会自动省略该段。按 Ctrl/Cmd + Enter 可直接保存。</div>
      <div class="actions">
        <button class="cancel" id="cancel">取消</button>
        <button class="confirm" id="confirm">${confirmLabel}</button>
      </div>
    </div>
    <script>
      const vscode = acquireVsCodeApi();
      const prefix = document.getElementById('prefix');
      const suffix = document.getElementById('suffix');
      const confirmButton = document.getElementById('confirm');
      const cancelButton = document.getElementById('cancel');

      const confirm = () => {
        vscode.postMessage({
          type: 'confirm',
          value: {
            prefix: prefix.value,
            suffix: suffix.value,
          },
        });
      };

      confirmButton.addEventListener('click', confirm);

      cancelButton.addEventListener('click', () => {
        vscode.postMessage({ type: 'cancel' });
      });

      const handleHotkey = (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault();
          confirm();
        }
      };

      prefix.addEventListener('keydown', handleHotkey);
      suffix.addEventListener('keydown', handleHotkey);

      prefix.focus();
      prefix.selectionStart = prefix.value.length;
      prefix.selectionEnd = prefix.value.length;
    </script>
  </body>
</html>`;
  }
}
