import { vi } from 'vitest';

export enum TreeItemCollapsibleState {
  None = 0,
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

export class TreeItem {
  description?: string;
  tooltip?: string;
  iconPath?: ThemeIcon;
  contextValue?: string;

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
  __reset(): void {
    window.activeTextEditor = undefined;
    window.createTreeView.mockClear();
    window.showErrorMessage.mockClear();
    window.showInformationMessage.mockClear();
    window.showQuickPick.mockClear();
    window.showTextDocument.mockClear();
  },
  createTreeView: vi.fn(() => new Disposable()),
  showErrorMessage: vi.fn(async (_message: string) => undefined),
  showInformationMessage: vi.fn(async (_message: string) => undefined),
  showQuickPick: vi.fn(async () => undefined),
  showTextDocument: vi.fn(async (document: unknown) => ({ document })),
};

export const workspace = {
  __reset(): void {
    workspace.openTextDocument.mockClear();
  },
  openTextDocument: vi.fn(async (options: { content: string }) => ({
    uri: {
      toString: () => 'untitled:mock',
    },
    getText: () => options.content,
  })),
};
