import { describe, expect, it, vi } from 'vitest';

import {
  PromptQuickRunError,
  PromptTerminalQuickRunner,
} from '../../prompt/promptTerminalQuickRunner';

describe('PromptTerminalQuickRunner', () => {
  it('runs the configured command in the active terminal when only one terminal exists', async () => {
    const terminal = {
      sendText: vi.fn(),
      show: vi.fn(),
    };
    const executeCommand = vi.fn(async () => undefined);
    const runner = new PromptTerminalQuickRunner({
      executeCommand,
      getActiveTerminal: () => terminal as never,
      getTerminalCount: () => 1,
    });

    await runner.run('/new');

    expect(terminal.sendText).toHaveBeenCalledWith('/new', true);
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('throws a typed error when there is no active terminal', async () => {
    const runner = new PromptTerminalQuickRunner({
      executeCommand: vi.fn(async () => undefined),
      getActiveTerminal: () => undefined,
      getTerminalCount: () => 1,
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
      getTerminalCount: () => 2,
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

  it('runs after a safe multi-terminal probe', async () => {
    const terminal = {
      sendText: vi.fn(),
      show: vi.fn(),
    };
    const executeCommand = vi.fn(async () => undefined);
    const runner = new PromptTerminalQuickRunner({
      executeCommand,
      getActiveTerminal: () => terminal as never,
      getTerminalCount: () => 2,
    });

    await runner.run('/new');

    expect(executeCommand).toHaveBeenNthCalledWith(
      1,
      'workbench.action.terminal.focusNextPane',
    );
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(terminal.sendText).toHaveBeenCalledWith('/new', true);
  });
});
