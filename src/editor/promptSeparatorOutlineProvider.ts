import * as vscode from 'vscode';

import { parsePromptSeparatorSections } from './promptSeparatorParser';

const SUPPORTED_LANGUAGE_IDS = new Set(['markdown', 'plaintext']);
const DEFAULT_FALLBACK_TITLE_LENGTH = 24;

export interface PromptSeparatorOutlineProviderOptions {
  getEnabled: () => boolean;
  getUntitledLabel: () => string;
}

export class PromptSeparatorOutlineProvider
implements vscode.DocumentSymbolProvider {
  constructor(
    private readonly options: PromptSeparatorOutlineProviderOptions,
  ) {}

  provideDocumentSymbols(
    document: vscode.TextDocument,
  ): vscode.DocumentSymbol[] {
    if (
      !this.options.getEnabled() ||
      !SUPPORTED_LANGUAGE_IDS.has(document.languageId)
    ) {
      return [];
    }

    const lines = document.getText().split(/\r?\n/);

    return parsePromptSeparatorSections(document.getText(), {
      maxFallbackTitleLength: DEFAULT_FALLBACK_TITLE_LENGTH,
      untitledLabel: this.options.getUntitledLabel(),
    }).map((section) => {
      const startLineText = lines[section.startLine] ?? '';
      const endLineText = lines[section.endLine] ?? '';

      return new vscode.DocumentSymbol(
        section.displayTitle,
        '',
        vscode.SymbolKind.String,
        new vscode.Range(
          new vscode.Position(section.startLine, 0),
          new vscode.Position(section.endLine, endLineText.length),
        ),
        new vscode.Range(
          new vscode.Position(section.startLine, 0),
          new vscode.Position(section.startLine, startLineText.length),
        ),
      );
    });
  }
}
