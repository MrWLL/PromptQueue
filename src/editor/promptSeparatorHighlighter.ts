import * as vscode from 'vscode';

import { parsePromptSeparatorSections } from './promptSeparatorParser';

const SUPPORTED_LANGUAGE_IDS = new Set(['markdown', 'plaintext']);

export interface PromptSeparatorHighlighterOptions {
  getEnabled: () => boolean;
}

export class PromptSeparatorHighlighter implements vscode.Disposable {
  private readonly decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(196, 68, 68, 0.10)',
    borderColor: 'rgba(196, 68, 68, 0.35)',
    borderStyle: 'solid',
    borderWidth: '0 0 0 2px',
    isWholeLine: true,
  });

  constructor(
    private readonly options: PromptSeparatorHighlighterOptions,
  ) {}

  refreshVisibleEditors(editors: readonly vscode.TextEditor[]): void {
    for (const editor of editors) {
      if (
        !this.options.getEnabled() ||
        !SUPPORTED_LANGUAGE_IDS.has(editor.document.languageId)
      ) {
        editor.setDecorations(this.decorationType, []);
        continue;
      }

      const decorationRanges = parsePromptSeparatorSections(
        editor.document.getText(),
        {
          maxFallbackTitleLength: 24,
          untitledLabel: '',
        },
      ).map((section) => ({
        range: new vscode.Range(
          new vscode.Position(section.startLine, 0),
          new vscode.Position(section.startLine, 0),
        ),
      }));

      editor.setDecorations(this.decorationType, decorationRanges);
    }
  }

  dispose(): void {
    this.decorationType.dispose();
  }
}
