import { describe, expect, it, vi } from 'vitest';

import {
  PromptQuickRunError,
  PromptTerminalQuickRunner,
} from '../../prompt/promptTerminalQuickRunner';

describe('PromptTerminalQuickRunner', () => {
  it('sends the configured command to the active terminal when no split pane is detected', async () => {
    const terminal = {
      sendText: vi.fn(),
      show: vi.fn(),
    };
    const executeCommand = vi.fn(async () => undefined);
    const runner = new PromptTerminalQuickRunner({
      executeCommand,
      getActiveTerminal: () => terminal as never,
    });

    await runner.run('/new');

    expect(executeCommand).toHaveBeenCalledWith(
      'workbench.action.terminal.focusNextPane',
    );
    expect(terminal.sendText).toHaveBeenCalledWith('/new', true);
  });

  it('throws a typed error when there is no active terminal', async () => {
    const runner = new PromptTerminalQuickRunner({
      executeCommand: vi.fn(async () => undefined),
      getActiveTerminal: () => undefined,
    });

    await expect(runner.run('/new')).rejects.toMatchObject({
      code: 'no-active-terminal',
    } satisfies Partial<PromptQuickRunError>);
  });

  it('rejects ambiguous split panes and restores the original terminal', async () => {
    const firstTerminal = {
      sendText: vi.fn(),
      show: vi.fn(),
    };
    const secondTerminal = {
      sendText: vi.fn(),
      show: vi.fn(),
    };
    let activeTerminal: typeof firstTerminal | typeof secondTerminal | undefined =
      firstTerminal;
    const executeCommand = vi.fn(async (command: string) => {
      if (command === 'workbench.action.terminal.focusNextPane') {
        activeTerminal = secondTerminal;
      }

      if (command === 'workbench.action.terminal.focusPreviousPane') {
        activeTerminal = firstTerminal;
      }
    });
    const runner = new PromptTerminalQuickRunner({
      executeCommand,
      getActiveTerminal: () => activeTerminal as never,
    });

    await expect(runner.run('/new')).rejects.toMatchObject({
      code: 'ambiguous-terminal',
    } satisfies Partial<PromptQuickRunError>);
    expect(executeCommand).toHaveBeenCalledWith(
      'workbench.action.terminal.focusPreviousPane',
    );
    expect(firstTerminal.show).toHaveBeenCalledWith(false);
    expect(firstTerminal.sendText).not.toHaveBeenCalled();
  });
});
