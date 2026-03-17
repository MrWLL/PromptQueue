import { vi } from 'vitest';

export enum TreeItemCollapsibleState {
  None = 0,
}

export enum TreeItemCheckboxState {
  Unchecked = 0,
  Checked = 1,
}

export class Disposable {
  constructor(private readonly onDispose: () => void = () => undefined) {}

  dispose(): void {
    this.onDispose();
  }
}

export class ThemeIcon {
  constructor(public readonly id: string) {}
}

export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number,
  ) {}
}

export class Range {
  readonly start: Position;
  readonly end: Position;

  constructor(
    startLineOrPosition: number | Position,
    startCharacterOrPosition: number | Position,
    endLine?: number,
    endCharacter?: number,
  ) {
    if (
      startLineOrPosition instanceof Position &&
      startCharacterOrPosition instanceof Position
    ) {
      this.start = startLineOrPosition;
      this.end = startCharacterOrPosition;
      return;
    }

    this.start = new Position(
      startLineOrPosition as number,
      startCharacterOrPosition as number,
    );
    this.end = new Position(endLine ?? 0, endCharacter ?? 0);
  }
}

export enum SymbolKind {
  String = 15,
}

export class TextEditorDecorationType extends Disposable {
  constructor(public readonly options: Record<string, unknown>) {
    super();
  }
}

export class DocumentSymbol {
  constructor(
    public readonly name: string,
    public readonly detail: string,
    public readonly kind: SymbolKind,
    public readonly range: Range,
    public readonly selectionRange: Range,
  ) {}
}

export class TreeItem {
  description?: string;
  tooltip?: string;
  iconPath?: ThemeIcon;
  contextValue?: string;
  checkboxState?: TreeItemCheckboxState;
  command?: {
    command: string;
    title: string;
    arguments?: unknown[];
  };

  constructor(
    public readonly label: string,
    public readonly collapsibleState: TreeItemCollapsibleState,
  ) {}
}

export class DataTransferItem {
  constructor(private readonly value: string) {}

  asString(): Promise<string> {
    return Promise.resolve(this.value);
  }
}

export class EventEmitter<T> {
  private readonly listeners: Array<(value: T) => void> = [];

  readonly event = (listener: (value: T) => void) => {
    this.listeners.push(listener);
    return {
      dispose: () => {
        const index = this.listeners.indexOf(listener);

        if (index >= 0) {
          this.listeners.splice(index, 1);
        }
      },
    };
  };

  fire(value: T): void {
    for (const listener of this.listeners) {
      listener(value);
    }
  }
}

const commandRegistry = new Map<string, (...args: unknown[]) => unknown>();

export const commands = {
  __reset(): void {
    commandRegistry.clear();
  },
  async executeCommand<T>(command: string, ...args: unknown[]): Promise<T> {
    const handler = commandRegistry.get(command);

    if (!handler) {
      throw new Error(`Command not registered: ${command}`);
    }

    return (await handler(...args)) as T;
  },
  async getCommands(): Promise<string[]> {
    return [...commandRegistry.keys()];
  },
  registerCommand(
    command: string,
    callback: (...args: unknown[]) => unknown,
  ): Disposable {
    commandRegistry.set(command, callback);
    return new Disposable(() => {
      commandRegistry.delete(command);
    });
  },
};

export const languages = {
  __reset(): void {
    languages.registerDocumentSymbolProvider.mockClear();
  },
  registerDocumentSymbolProvider: vi.fn(() => new Disposable()),
};

export const env = {
  __reset(): void {
    env.clipboard.readText.mockClear();
    env.clipboard.writeText.mockClear();
  },
  clipboard: {
    readText: vi.fn(async () => ''),
    writeText: vi.fn(async (_text: string) => undefined),
  },
};

export const window = {
  activeTextEditor: undefined as { document: unknown } | undefined,
  visibleTextEditors: [] as Array<{ document: { languageId: string }; setDecorations: (...args: unknown[]) => void }>,
  __reset(): void {
    window.activeTextEditor = undefined;
    window.visibleTextEditors = [];
    window.createTreeView.mockClear();
    window.createTextEditorDecorationType.mockClear();
    window.onDidChangeActiveTextEditor.mockClear();
    window.onDidChangeVisibleTextEditors.mockClear();
    window.registerWebviewViewProvider.mockClear();
    window.setStatusBarMessage.mockClear();
    window.showErrorMessage.mockClear();
    window.showInformationMessage.mockClear();
    window.showWarningMessage.mockClear();
    window.showQuickPick.mockClear();
    window.showTextDocument.mockClear();
  },
  createTreeView: vi.fn(() => new Disposable()),
  createTextEditorDecorationType: vi.fn(
    (options: Record<string, unknown>) => new TextEditorDecorationType(options),
  ),
  onDidChangeActiveTextEditor: vi.fn(() => new Disposable()),
  onDidChangeVisibleTextEditors: vi.fn(() => new Disposable()),
  registerWebviewViewProvider: vi.fn(() => new Disposable()),
  setStatusBarMessage: vi.fn((_text: string, _hideAfterTimeout?: number) => new Disposable()),
  showErrorMessage: vi.fn(async (_message: string) => undefined),
  showInformationMessage: vi.fn(async (_message: string) => undefined),
  showWarningMessage: vi.fn(async (_message: string, ..._items: string[]) => undefined),
  showQuickPick: vi.fn(async () => undefined),
  showTextDocument: vi.fn(async (document: unknown) => ({ document })),
};

export const workspace = {
  workspaceFolders: [{ uri: { fsPath: '/tmp/workspace' } }],
  __reset(): void {
    workspace.workspaceFolders = [{ uri: { fsPath: '/tmp/workspace' } }];
    workspace.getConfiguration.mockClear();
    workspace.onDidChangeConfiguration.mockClear();
    workspace.onDidChangeTextDocument.mockClear();
    workspace.onDidChangeWorkspaceFolders.mockClear();
    workspace.openTextDocument.mockClear();
  },
  getConfiguration: vi.fn(
    (_section?: string) =>
      ({
        get: (key: string) => {
          if (key === 'separatorHighlight.enabled') {
            return true;
          }

          if (key === 'separatorOutline.enabled') {
            return true;
          }

          if (key === 'storagePath') {
            return 'WorkSpace/PromptQueue';
          }

          if (key === 'uiLanguage') {
            return 'zh-CN';
          }

          return undefined;
        },
      }) as { get: <T>(key: string) => T | undefined },
  ),
  onDidChangeConfiguration: vi.fn(() => new Disposable()),
  onDidChangeTextDocument: vi.fn(() => new Disposable()),
  onDidChangeWorkspaceFolders: vi.fn(() => new Disposable()),
  openTextDocument: vi.fn(async (options: { content: string }) => ({
    uri: {
      toString: () => 'untitled:mock',
    },
    getText: () => options.content,
  })),
};
