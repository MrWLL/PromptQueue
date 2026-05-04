export type PromptQuickRunErrorCode =
  | 'ambiguous-terminal'
  | 'no-active-terminal';

export class PromptQuickRunError extends Error {
  constructor(public readonly code: PromptQuickRunErrorCode) {
    super(code);
  }
}

export interface PromptTerminalLike {
  sendText(text: string, shouldExecute?: boolean): void;
  show(preserveFocus?: boolean): void;
}

export interface PromptTerminalQuickRunnerDependencies {
  executeCommand: (
    command: string,
    args?: unknown,
  ) => PromiseLike<unknown>;
  getActiveTerminal: () => PromptTerminalLike | undefined;
  getTerminalCount: () => number;
}

export class PromptTerminalQuickRunner {
  constructor(private readonly deps: PromptTerminalQuickRunnerDependencies) {}

  async run(command: string): Promise<void> {
    const normalizedCommand = command.trim() || '/new';
    const activeTerminal = this.deps.getActiveTerminal();

    if (!activeTerminal) {
      throw new PromptQuickRunError('no-active-terminal');
    }

    if (this.deps.getTerminalCount() <= 1) {
      activeTerminal.sendText(normalizedCommand, false);
      return;
    }

    await this.deps.executeCommand('workbench.action.terminal.focusNextPane');

    const probedTerminal = this.deps.getActiveTerminal();

    if (probedTerminal && probedTerminal !== activeTerminal) {
      await this.deps.executeCommand(
        'workbench.action.terminal.focusPreviousPane',
      );
      activeTerminal.show(false);
      throw new PromptQuickRunError('ambiguous-terminal');
    }

    activeTerminal.sendText(normalizedCommand, false);
  }
}
