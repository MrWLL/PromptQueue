import { window } from 'vscode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PromptWebviewViewProvider } from '../../prompt/promptWebviewViewProvider';
import type {
  PromptWebviewIncomingMessage,
  PromptWebviewOutgoingMessage,
} from '../../prompt/promptWebviewProtocol';
import type { PromptCopySettings, PromptItem } from '../../prompt/promptTypes';

function createPromptItem(
  overrides: Partial<PromptItem> = {},
): PromptItem {
  return {
    id: overrides.id ?? 'prompt-1',
    title: overrides.title ?? 'Title',
    content: overrides.content ?? 'Body',
    used: overrides.used ?? false,
    createdAt: overrides.createdAt ?? '2026-03-16T00:00:00.000Z',
    lastCopiedAt: overrides.lastCopiedAt,
    updatedAt: overrides.updatedAt ?? '2026-03-16T00:00:00.000Z',
  };
}

function createManagerStub() {
  const items = [createPromptItem()];
  const copySettings: PromptCopySettings = {
    includeTemplateOnClick: true,
    prefix: 'Prefix',
    quickRunCommand: '/new',
    quickRunEnabled: true,
    suffix: 'Suffix',
  };

  return {
    copyItem: vi.fn(async () => undefined),
    createItem: vi.fn(async () => undefined),
    deleteAll: vi.fn(async () => undefined),
    deleteItem: vi.fn(async () => undefined),
    getCopySettings: vi.fn(() => structuredClone(copySettings)),
    getItems: vi.fn(() => structuredClone(items)),
    hasLastDeletedBackup: vi.fn(async () => true),
    importText: vi.fn(async () => undefined),
    moveItem: vi.fn(async () => undefined),
    reorder: vi.fn(async () => undefined),
    resetAllUsed: vi.fn(async () => undefined),
    restoreLastDeleted: vi.fn(async () => undefined),
    toggleUsed: vi.fn(async () => undefined),
    updateCopySettings: vi.fn(async () => undefined),
    updateItem: vi.fn(async () => undefined),
  };
}

function createWebviewViewStub() {
  let onDidReceiveMessage:
    | ((message: PromptWebviewIncomingMessage) => Promise<void> | void)
    | undefined;
  const postedMessages: PromptWebviewOutgoingMessage[] = [];

  const webview = {
    html: '',
    options: undefined as { enableScripts?: boolean } | undefined,
    onDidReceiveMessage: vi.fn(
      (
        callback: (
          message: PromptWebviewIncomingMessage,
        ) => Promise<void> | void,
      ) => {
        onDidReceiveMessage = callback;
        return { dispose: () => undefined };
      },
    ),
    postMessage: vi.fn(async (message: PromptWebviewOutgoingMessage) => {
      postedMessages.push(message);
      return true;
    }),
  };

  return {
    webview,
    postedMessages,
    async fireMessage(message: PromptWebviewIncomingMessage) {
      await onDidReceiveMessage?.(message);
    },
  };
}

describe('PromptWebviewViewProvider', () => {
  beforeEach(() => {
    window.__reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('posts an initial state payload when the webview resolves', async () => {
    const manager = createManagerStub();
    const view = createWebviewViewStub();
    const provider = new PromptWebviewViewProvider({
      hasActiveTerminal: () => true,
      manager,
      getStorageLabel: () => 'WorkSpace/PromptQueue',
      getUiLanguage: () => 'zh-CN',
      writeClipboard: vi.fn(async () => undefined),
    });

    await provider.resolveWebviewView(view as never);

    expect(view.webview.html).toContain('promptqueue-app');
    expect(view.postedMessages[0]).toMatchObject({
      type: 'state',
      state: {
        storageLabel: 'WorkSpace/PromptQueue',
        canRestoreLastDeleted: true,
        workspaceReady: true,
        strings: {
          actions: {
            add: '新增',
          },
        },
      },
    });
  });

  it('includes copy-age labels for used prompts with a copy timestamp', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-05T12:00:00.000Z'));

    const manager = createManagerStub();
    manager.getItems.mockReturnValueOnce([
      createPromptItem({
        id: 'prompt-1',
        used: true,
        lastCopiedAt: '2026-05-05T11:55:00.000Z',
      }),
      createPromptItem({
        id: 'prompt-2',
        used: true,
        lastCopiedAt: undefined,
      }),
    ]);
    const view = createWebviewViewStub();
    const provider = new PromptWebviewViewProvider({
      hasActiveTerminal: () => true,
      manager,
      getStorageLabel: () => 'WorkSpace/PromptQueue',
      getUiLanguage: () => 'zh-CN',
      writeClipboard: vi.fn(async () => undefined),
    });

    await provider.resolveWebviewView(view as never);

    expect(view.postedMessages[0]).toMatchObject({
      type: 'state',
      state: {
        items: [
          expect.objectContaining({
            id: 'prompt-1',
            copyAgeLabel: '<10m',
          }),
          expect.objectContaining({
            id: 'prompt-2',
            copyAgeLabel: undefined,
          }),
        ],
      },
    });
  });

  it('handles copy, toggle, restore, and delete-all messages through the manager', async () => {
    const manager = createManagerStub();
    const writeClipboard = vi.fn(async () => undefined);
    const view = createWebviewViewStub();
    const provider = new PromptWebviewViewProvider({
      hasActiveTerminal: () => true,
      manager,
      getStorageLabel: () => 'WorkSpace/PromptQueue',
      getUiLanguage: () => 'zh-CN',
      writeClipboard,
    });

    await provider.resolveWebviewView(view as never);
    await view.fireMessage({ type: 'copyPrompt', promptId: 'prompt-1' });
    await view.fireMessage({ type: 'toggleUsed', promptId: 'prompt-1' });

    expect(manager.copyItem).toHaveBeenCalledWith(
      'prompt-1',
      'templated',
      expect.any(Function),
    );
    expect(manager.toggleUsed).toHaveBeenCalledWith('prompt-1');
    expect(view.postedMessages.at(-1)).toMatchObject({
      type: 'state',
    });
  });

  it('resets the add form after a successful create before posting fresh state', async () => {
    const manager = createManagerStub();
    const view = createWebviewViewStub();
    const provider = new PromptWebviewViewProvider({
      hasActiveTerminal: () => true,
      manager,
      getStorageLabel: () => 'WorkSpace/PromptQueue',
      getUiLanguage: () => 'zh-CN',
      writeClipboard: vi.fn(async () => undefined),
    });

    await provider.resolveWebviewView(view as never);
    await view.fireMessage({ type: 'createPrompt', draft: { content: 'body' } });

    expect(manager.createItem).toHaveBeenCalledWith({ content: 'body' });
    expect(view.postedMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'panelCommand',
          command: 'resetAddForm',
        }),
      ]),
    );
  });

  it('confirms before deleting all prompts from the webview', async () => {
    const manager = createManagerStub();
    const view = createWebviewViewStub();
    const provider = new PromptWebviewViewProvider({
      hasActiveTerminal: () => true,
      manager,
      getStorageLabel: () => 'WorkSpace/PromptQueue',
      getUiLanguage: () => 'zh-CN',
      writeClipboard: vi.fn(async () => undefined),
    });

    window.showWarningMessage.mockResolvedValueOnce('全部删除');

    await provider.resolveWebviewView(view as never);
    await view.fireMessage({ type: 'deleteAllPrompts' });

    expect(window.showWarningMessage).toHaveBeenCalledWith(
      '确认删除全部提示词吗？',
      { modal: true, detail: '此操作不可撤销。' },
      '全部删除',
    );
    expect(manager.deleteAll).toHaveBeenCalledTimes(1);
  });

  it('does not delete all prompts when the webview confirmation is canceled', async () => {
    const manager = createManagerStub();
    const view = createWebviewViewStub();
    const provider = new PromptWebviewViewProvider({
      hasActiveTerminal: () => true,
      manager,
      getStorageLabel: () => 'WorkSpace/PromptQueue',
      getUiLanguage: () => 'zh-CN',
      writeClipboard: vi.fn(async () => undefined),
    });

    window.showWarningMessage.mockResolvedValueOnce(undefined);

    await provider.resolveWebviewView(view as never);
    await view.fireMessage({ type: 'deleteAllPrompts' });

    expect(manager.deleteAll).not.toHaveBeenCalled();
  });

  it('reports a no-workspace state and blocks mutating actions when no workspace is open', async () => {
    const manager = createManagerStub();
    const view = createWebviewViewStub();
    const provider = new PromptWebviewViewProvider({
      hasActiveTerminal: () => true,
      manager,
      getStorageLabel: () => 'WorkSpace/PromptQueue',
      getUiLanguage: () => 'zh-CN',
      hasWorkspace: () => false,
      writeClipboard: vi.fn(async () => undefined),
    });

    await provider.resolveWebviewView(view as never);
    await view.fireMessage({ type: 'createPrompt', draft: { content: 'body' } });

    expect(view.postedMessages[0]).toMatchObject({
      type: 'state',
      state: {
        workspaceReady: false,
      },
    });
    expect(view.postedMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'error',
        }),
      ]),
    );
    expect(view.postedMessages.at(-1)).toMatchObject({
      type: 'state',
    });
    expect(view.postedMessages.at(-2)).toMatchObject({
      type: 'error',
    });
    expect(manager.createItem).not.toHaveBeenCalled();
  });

  it('runs the quick-run action with the configured command and posts a success toast', async () => {
    const manager = createManagerStub();
    const quickRunner = {
      run: vi.fn(async (_command: string) => undefined),
    };
    const view = createWebviewViewStub();
    const provider = new PromptWebviewViewProvider({
      hasActiveTerminal: () => true,
      manager,
      quickRunner,
      getStorageLabel: () => 'WorkSpace/PromptQueue',
      getUiLanguage: () => 'zh-CN',
      writeClipboard: vi.fn(async () => undefined),
    } as never);

    await provider.resolveWebviewView(view as never);
    await view.fireMessage({ type: 'quickRun' } as never);

    expect(quickRunner.run).toHaveBeenCalledWith('/new');
    expect(view.postedMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'toast',
          message: '已执行快捷运行',
        }),
      ]),
    );
  });

  it('maps ambiguous quick-run errors to the localized message', async () => {
    const manager = createManagerStub();
    const quickRunner = {
      run: vi.fn(async () => undefined),
    };
    const view = createWebviewViewStub();
    const provider = new PromptWebviewViewProvider({
      hasActiveTerminal: () => true,
      manager,
      quickRunner,
      getStorageLabel: () => 'WorkSpace/PromptQueue',
      getUiLanguage: () => 'zh-CN',
      writeClipboard: vi.fn(async () => undefined),
    } as never);

    quickRunner.run.mockRejectedValueOnce(
      Object.assign(new Error('ambiguous-terminal'), {
        code: 'ambiguous-terminal',
      }),
    );

    await provider.resolveWebviewView(view as never);
    await view.fireMessage({ type: 'quickRun' } as never);

    expect(view.postedMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'error',
          message: '当前同时显示了多个终端，不允许快捷运行。',
        }),
      ]),
    );
  });

  it('reports quick run as disabled when settings turn it off', async () => {
    const manager = createManagerStub();
    manager.getCopySettings.mockReturnValueOnce({
      includeTemplateOnClick: true,
      prefix: 'Prefix',
      quickRunCommand: '/new',
      quickRunEnabled: false,
      suffix: 'Suffix',
    });
    const view = createWebviewViewStub();
    const provider = new PromptWebviewViewProvider({
      hasActiveTerminal: () => true,
      manager,
      getStorageLabel: () => 'WorkSpace/PromptQueue',
      getUiLanguage: () => 'zh-CN',
      writeClipboard: vi.fn(async () => undefined),
    } as never);

    await provider.resolveWebviewView(view as never);

    expect(view.postedMessages[0]).toMatchObject({
      type: 'state',
      state: {
        quickRunAvailability: 'disabled-in-settings',
      },
    });
  });

  it('reports quick run as unavailable when there is no active terminal', async () => {
    const manager = createManagerStub();
    const view = createWebviewViewStub();
    const provider = new PromptWebviewViewProvider({
      hasActiveTerminal: () => false,
      manager,
      getStorageLabel: () => 'WorkSpace/PromptQueue',
      getUiLanguage: () => 'zh-CN',
      writeClipboard: vi.fn(async () => undefined),
    } as never);

    await provider.resolveWebviewView(view as never);

    expect(view.postedMessages[0]).toMatchObject({
      type: 'state',
      state: {
        quickRunAvailability: 'no-active-terminal',
      },
    });
  });

  it('reports quick run as ready when settings are enabled and a terminal is active', async () => {
    const manager = createManagerStub();
    const view = createWebviewViewStub();
    const provider = new PromptWebviewViewProvider({
      hasActiveTerminal: () => true,
      manager,
      getStorageLabel: () => 'WorkSpace/PromptQueue',
      getUiLanguage: () => 'zh-CN',
      writeClipboard: vi.fn(async () => undefined),
    } as never);

    await provider.resolveWebviewView(view as never);

    expect(view.postedMessages[0]).toMatchObject({
      type: 'state',
      state: {
        quickRunAvailability: 'ready',
      },
    });
  });
});
