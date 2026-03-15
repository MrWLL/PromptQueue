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
    env.clipboard.writeText.mockClear();
  },
  clipboard: {
    writeText: vi.fn(async (_text: string) => undefined),
  },
};
