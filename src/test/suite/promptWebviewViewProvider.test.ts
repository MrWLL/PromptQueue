import * as vscode from 'vscode';
import { window } from 'vscode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PromptWebviewViewProvider } from '../../prompt/promptWebviewViewProvider';
import { INDIRECT_COPY_INSTRUCTION } from '../../prompt/promptTaskFile';
import type {
  PromptWebviewIncomingMessage,
  PromptWebviewOutgoingMessage,
} from '../../prompt/promptWebviewProtocol';
import type { PromptCopySettings, PromptItem } from '../../prompt/promptTypes';

function createPromptItem(
  overrides: Partial<PromptItem> = {},
): PromptItem {
  return {
    activeTask: overrides.activeTask,
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
    copyMode: 'direct',
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
    reloadCopySettings: vi.fn(async () => structuredClone(copySettings)),
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
    asWebviewUri: vi.fn((uri: { path?: string }) => `webview:${uri.path ?? ''}`),
    cspSource: 'vscode-webview-source',
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

function ensureUriMock() {
  const vscodeModule = vscode as typeof vscode & {
    Uri?: {
      joinPath: (
        base: { path?: string },
        ...paths: string[]
      ) => { path: string };
    };
  };

  vscodeModule.Uri = {
    joinPath(base, ...paths) {
      const parts = [base.path ?? '', ...paths]
        .join('/')
        .replace(/\\/g, '/')
        .replace(/\/+/g, '/');

      return {
        path: parts.startsWith('/') ? parts : `/${parts}`,
      };
    },
  };
}

describe('PromptWebviewViewProvider', () => {
  beforeEach(() => {
    window.__reset();
    ensureUriMock();
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

  it('loads the reorder math helper before the main webview script in the production webview html', async () => {
    const manager = createManagerStub();
    const view = createWebviewViewStub();
    const provider = new PromptWebviewViewProvider({
      extensionUri: { path: '/extension' } as never,
      hasActiveTerminal: () => true,
      manager,
      getStorageLabel: () => 'WorkSpace/PromptQueue',
      getUiLanguage: () => 'zh-CN',
      writeClipboard: vi.fn(async () => undefined),
    });

    await provider.resolveWebviewView(view as never);

    const helperIndex = view.webview.html.indexOf('promptqueue-reorder-math.js');
    const scriptIndex = view.webview.html.indexOf('promptqueue-view.js');

    expect(helperIndex).toBeGreaterThanOrEqual(0);
    expect(scriptIndex).toBeGreaterThan(helperIndex);
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

  it('marks both prompts in an adjacent normalized duplicate pair', async () => {
    const manager = createManagerStub();
    manager.getItems.mockReturnValueOnce([
      createPromptItem({
        id: 'prompt-1',
        title: 'Alpha',
        content: 'same body\n',
      }),
      createPromptItem({
        id: 'prompt-2',
        title: 'Beta',
        content: '  same body\r\n',
      }),
      createPromptItem({
        id: 'prompt-3',
        title: 'Gamma',
        content: 'different body',
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
            isAdjacentDuplicate: true,
          }),
          expect.objectContaining({
            id: 'prompt-2',
            isAdjacentDuplicate: true,
          }),
          expect.objectContaining({
            id: 'prompt-3',
            isAdjacentDuplicate: false,
          }),
        ],
      },
    });
  });

  it('does not mark equal content when a different prompt breaks adjacency', async () => {
    const manager = createManagerStub();
    manager.getItems.mockReturnValueOnce([
      createPromptItem({
        id: 'prompt-1',
        content: 'same body',
      }),
      createPromptItem({
        id: 'prompt-2',
        content: 'different body',
      }),
      createPromptItem({
        id: 'prompt-3',
        content: ' same body ',
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
            isAdjacentDuplicate: false,
          }),
          expect.objectContaining({
            id: 'prompt-2',
            isAdjacentDuplicate: false,
          }),
          expect.objectContaining({
            id: 'prompt-3',
            isAdjacentDuplicate: false,
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

  it('keeps direct copy text on the clipboard', async () => {
    const manager = createManagerStub();
    manager.copyItem.mockImplementationOnce(
      async (_id, _mode, deliverText) => deliverText('assembled prompt'),
    );
    const writeClipboard = vi.fn(async () => undefined);
    const writeTaskFile = vi.fn(async () => undefined);
    const view = createWebviewViewStub();
    const provider = new PromptWebviewViewProvider({
      hasActiveTerminal: () => true,
      manager,
      getStorageLabel: () => 'WorkSpace/PromptQueue',
      getUiLanguage: () => 'zh-CN',
      writeClipboard,
      writeTaskFile,
    });

    await provider.resolveWebviewView(view as never);
    await view.fireMessage({ type: 'copyPrompt', promptId: 'prompt-1' });

    expect(writeClipboard).toHaveBeenCalledWith('assembled prompt');
    expect(writeTaskFile).not.toHaveBeenCalled();
    expect(window.showWarningMessage).not.toHaveBeenCalled();
  });

  it('writes indirect copies to main-task.md and copies only the execution instruction', async () => {
    const manager = createManagerStub();
    manager.getCopySettings.mockReturnValue({
      ...manager.getCopySettings(),
      copyMode: 'indirect-file',
    });
    manager.reloadCopySettings.mockResolvedValue({
      ...manager.getCopySettings(),
      copyMode: 'indirect-file',
    });
    manager.copyItem.mockImplementationOnce(
      async (_id, _mode, deliverText) => deliverText('assembled prompt'),
    );
    const writeClipboard = vi.fn(async () => undefined);
    const writeTaskFile = vi.fn(async () => undefined);
    const view = createWebviewViewStub();
    const provider = new PromptWebviewViewProvider({
      hasActiveTerminal: () => true,
      manager,
      getStorageLabel: () => 'WorkSpace/PromptQueue',
      getUiLanguage: () => 'zh-CN',
      writeClipboard,
      writeTaskFile,
    });

    window.showWarningMessage.mockResolvedValueOnce('覆盖并切换');

    await provider.resolveWebviewView(view as never);
    await view.fireMessage({ type: 'copyPrompt', promptId: 'prompt-1' });

    expect(window.showWarningMessage).toHaveBeenCalledWith(
      '这会覆盖 WorkSpace/main-task.md。确认切换到这条任务吗？',
      {
        modal: true,
        detail: '请先确认当前 Agent 已停止运行，或可以安全切换任务。',
      },
      '覆盖并切换',
    );
    expect(writeTaskFile).toHaveBeenCalledWith('assembled prompt');
    expect(writeClipboard).toHaveBeenCalledWith(INDIRECT_COPY_INSTRUCTION);
    expect(writeTaskFile.mock.invocationCallOrder[0]).toBeLessThan(
      writeClipboard.mock.invocationCallOrder[0],
    );
  });

  it('does not overwrite the task file when indirect copy is canceled', async () => {
    const manager = createManagerStub();
    manager.getCopySettings.mockReturnValue({
      ...manager.getCopySettings(),
      copyMode: 'indirect-file',
    });
    manager.reloadCopySettings.mockResolvedValue({
      ...manager.getCopySettings(),
      copyMode: 'indirect-file',
    });
    const writeClipboard = vi.fn(async () => undefined);
    const writeTaskFile = vi.fn(async () => undefined);
    const view = createWebviewViewStub();
    const provider = new PromptWebviewViewProvider({
      hasActiveTerminal: () => true,
      manager,
      getStorageLabel: () => 'WorkSpace/PromptQueue',
      getUiLanguage: () => 'zh-CN',
      writeClipboard,
      writeTaskFile,
    });

    window.showWarningMessage.mockResolvedValueOnce(undefined);

    await provider.resolveWebviewView(view as never);
    await view.fireMessage({ type: 'copyPrompt', promptId: 'prompt-1' });

    expect(manager.copyItem).not.toHaveBeenCalled();
    expect(writeTaskFile).not.toHaveBeenCalled();
    expect(writeClipboard).not.toHaveBeenCalled();
  });

  it('blocks copying when persisted mode differs from the current view', async () => {
    const manager = createManagerStub();
    manager.getCopySettings.mockReturnValue({
      ...manager.getCopySettings(),
      copyMode: 'indirect-file',
    });
    manager.reloadCopySettings.mockResolvedValue({
      ...manager.getCopySettings(),
      copyMode: 'direct',
    });
    const writeClipboard = vi.fn(async () => undefined);
    const writeTaskFile = vi.fn(async () => undefined);
    const view = createWebviewViewStub();
    const provider = new PromptWebviewViewProvider({
      hasActiveTerminal: () => true,
      manager,
      getStorageLabel: () => 'WorkSpace/PromptQueue',
      getUiLanguage: () => 'zh-CN',
      writeClipboard,
      writeTaskFile,
    });

    await provider.resolveWebviewView(view as never);
    await view.fireMessage({ type: 'copyPrompt', promptId: 'prompt-1' });

    expect(manager.reloadCopySettings).toHaveBeenCalledTimes(1);
    expect(manager.copyItem).not.toHaveBeenCalled();
    expect(writeTaskFile).not.toHaveBeenCalled();
    expect(writeClipboard).not.toHaveBeenCalled();
    expect(view.postedMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'error',
          message: '复制模式已在其他窗口中更改，界面已刷新，请重新点击任务。',
        }),
      ]),
    );
  });

  it('serializes rapid copy messages', async () => {
    const manager = createManagerStub();
    let releaseFirstCopy: (() => void) | undefined;
    const firstCopyBlocked = new Promise<void>((resolve) => {
      releaseFirstCopy = resolve;
    });
    manager.copyItem
      .mockImplementationOnce(async () => firstCopyBlocked)
      .mockImplementationOnce(async () => undefined);
    const view = createWebviewViewStub();
    const provider = new PromptWebviewViewProvider({
      hasActiveTerminal: () => true,
      manager,
      getStorageLabel: () => 'WorkSpace/PromptQueue',
      getUiLanguage: () => 'zh-CN',
      writeClipboard: vi.fn(async () => undefined),
    });

    await provider.resolveWebviewView(view as never);
    const first = view.fireMessage({ type: 'copyPrompt', promptId: 'prompt-1' });
    const second = view.fireMessage({ type: 'copyPrompt', promptId: 'prompt-2' });
    await vi.waitFor(() => expect(manager.copyItem).toHaveBeenCalledTimes(1));

    releaseFirstCopy?.();
    await Promise.all([first, second]);

    expect(manager.copyItem.mock.calls.map((call) => call[0])).toEqual([
      'prompt-1',
      'prompt-2',
    ]);
  });

  it('reports clipboard failure after preserving an indirect file delivery', async () => {
    const manager = createManagerStub();
    manager.getCopySettings.mockReturnValue({
      ...manager.getCopySettings(),
      copyMode: 'indirect-file',
    });
    manager.reloadCopySettings.mockResolvedValue({
      ...manager.getCopySettings(),
      copyMode: 'indirect-file',
    });
    let managerObservedDeliverySuccess = false;
    manager.copyItem.mockImplementationOnce(
      async (_id, _mode, deliverText) => {
        await deliverText('assembled prompt');
        managerObservedDeliverySuccess = true;
      },
    );
    const writeTaskFile = vi.fn(async () => undefined);
    const view = createWebviewViewStub();
    const provider = new PromptWebviewViewProvider({
      hasActiveTerminal: () => true,
      manager,
      getStorageLabel: () => 'WorkSpace/PromptQueue',
      getUiLanguage: () => 'zh-CN',
      writeClipboard: vi.fn(async () => {
        throw new Error('clipboard failed');
      }),
      writeTaskFile,
    });

    window.showWarningMessage.mockResolvedValueOnce('覆盖并切换');

    await provider.resolveWebviewView(view as never);
    await view.fireMessage({ type: 'copyPrompt', promptId: 'prompt-1' });

    expect(writeTaskFile).toHaveBeenCalledWith('assembled prompt');
    expect(managerObservedDeliverySuccess).toBe(true);
    expect(view.postedMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'error',
          message: 'clipboard failed',
        }),
      ]),
    );
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

  it('passes reorder target indexes through to the manager', async () => {
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
    await view.fireMessage({
      type: 'reorderPrompts',
      sourceId: 'prompt-1',
      targetIndex: 2,
    } as never);

    expect(manager.reorder).toHaveBeenCalledWith('prompt-1', 2);
  });

  it('ignores malformed reorder messages that omit targetIndex', async () => {
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
    await view.fireMessage({
      type: 'reorderPrompts',
      sourceId: 'prompt-1',
    } as never);

    expect(manager.reorder).not.toHaveBeenCalled();
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
      copyMode: 'direct',
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
