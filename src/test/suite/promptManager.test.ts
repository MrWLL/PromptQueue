import { describe, expect, it, vi } from 'vitest';

import { PromptManager } from '../../prompt/promptManager';
import type { PromptCopySettings, PromptItem } from '../../prompt/promptTypes';
import type { WorkspaceFolderLike } from '../../prompt/workspacePaths';

function createPromptItem(
  overrides: Partial<PromptItem> = {},
): PromptItem {
  return {
    activeTask: overrides.activeTask,
    id: overrides.id ?? 'prompt-1',
    title: overrides.title,
    content: overrides.content ?? 'Prompt body',
    used: overrides.used ?? false,
    createdAt: overrides.createdAt ?? '2026-03-16T00:00:00.000Z',
    lastCopiedAt: overrides.lastCopiedAt,
    updatedAt: overrides.updatedAt ?? '2026-03-16T00:00:00.000Z',
  };
}

function createStoreStub(initialItems: PromptItem[]) {
  let storedItems = structuredClone(initialItems);

  return {
    load: vi.fn(async () => structuredClone(storedItems)),
    save: vi.fn(
      async (
        _workspaceFolder: WorkspaceFolderLike | undefined,
        items: PromptItem[],
      ) => {
        storedItems = structuredClone(items);
      },
    ),
    getStoredItems: () => structuredClone(storedItems),
  };
}

function createSettingsStoreStub(
  initialSettings: Partial<PromptCopySettings> = {},
) {
  let storedSettings: PromptCopySettings = {
    copyMode: 'direct',
    includeTemplateOnClick: true,
    prefix: '',
    quickRunCommand: '/new',
    quickRunEnabled: false,
    suffix: '',
    ...structuredClone(initialSettings),
  };

  return {
    load: vi.fn(async () => structuredClone(storedSettings)),
    save: vi.fn(
      async (
        _workspaceFolder: WorkspaceFolderLike | undefined,
        settings: PromptCopySettings,
      ) => {
        storedSettings = structuredClone(settings);
      },
    ),
    getStoredSettings: () => structuredClone(storedSettings),
  };
}

function createBackupStoreStub(initialItems: PromptItem[] | undefined) {
  let storedItems =
    typeof initialItems === 'undefined'
      ? undefined
      : structuredClone(initialItems);

  return {
    load: vi.fn(async () =>
      typeof storedItems === 'undefined'
        ? undefined
        : structuredClone(storedItems),
    ),
    save: vi.fn(
      async (
        _workspaceFolder: WorkspaceFolderLike | undefined,
        items: PromptItem[],
      ) => {
        storedItems = structuredClone(items);
      },
    ),
    getStoredItems: () =>
      typeof storedItems === 'undefined'
        ? undefined
        : structuredClone(storedItems),
  };
}

function createWorkspaceFolder(rootPath: string): WorkspaceFolderLike {
  return {
    uri: {
      fsPath: rootPath,
    },
  };
}

describe('PromptManager', () => {
  it('marks an item as used after a successful templated copy', async () => {
    const store = createStoreStub([createPromptItem()]);
    const settingsStore = createSettingsStoreStub({
      prefix: '前提示词',
      suffix: '后提示词',
    });
    const backupStore = createBackupStoreStub(undefined);
    const writeClipboard = vi.fn(async () => undefined);
    const manager = new PromptManager({
      store,
      settingsStore,
      backupStore,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: () => 'generated-id',
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();
    await manager.copyItem('prompt-1', 'templated', writeClipboard);

    expect(manager.getItems()[0]).toMatchObject({
      id: 'prompt-1',
      used: true,
      lastCopiedAt: '2026-03-16T01:00:00.000Z',
      updatedAt: '2026-03-16T01:00:00.000Z',
    });
    expect(writeClipboard).toHaveBeenCalledWith(
      '前提示词\nPrompt body\n后提示词',
    );
  });

  it('leaves an item unchanged when copy fails', async () => {
    const store = createStoreStub([createPromptItem()]);
    const settingsStore = createSettingsStoreStub();
    const backupStore = createBackupStoreStub(undefined);
    const manager = new PromptManager({
      store,
      settingsStore,
      backupStore,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: () => 'generated-id',
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();

    await expect(
      manager.copyItem('prompt-1', 'templated', async () => {
        throw new Error('clipboard failed');
      }),
    ).rejects.toThrow('clipboard failed');

    expect(manager.getItems()[0]).toMatchObject({
      id: 'prompt-1',
      lastCopiedAt: undefined,
      used: false,
      updatedAt: '2026-03-16T00:00:00.000Z',
    });
  });

  it('moves the active task marker after a successful indirect copy', async () => {
    const store = createStoreStub([
      createPromptItem({ id: 'prompt-1', activeTask: true }),
      createPromptItem({ id: 'prompt-2' }),
    ]);
    const settingsStore = createSettingsStoreStub({
      copyMode: 'indirect-file',
    });
    const manager = new PromptManager({
      store,
      settingsStore,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();
    await manager.copyItem('prompt-2', 'templated', async () => undefined);

    expect(manager.getItems()).toEqual([
      expect.objectContaining({ id: 'prompt-1', activeTask: false }),
      expect.objectContaining({
        id: 'prompt-2',
        activeTask: true,
        used: true,
      }),
    ]);
    expect(store.getStoredItems()).toEqual(manager.getItems());
  });

  it('keeps the active task marker unchanged after a direct copy', async () => {
    const store = createStoreStub([
      createPromptItem({ id: 'prompt-1', activeTask: true }),
      createPromptItem({ id: 'prompt-2' }),
    ]);
    const settingsStore = createSettingsStoreStub({ copyMode: 'direct' });
    const manager = new PromptManager({
      store,
      settingsStore,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
    });

    await manager.initialize();
    await manager.copyItem('prompt-2', 'templated', async () => undefined);

    expect(manager.getItems()).toEqual([
      expect.objectContaining({ id: 'prompt-1', activeTask: true }),
      expect.objectContaining({ id: 'prompt-2', activeTask: undefined }),
    ]);
  });

  it('uses the copy mode captured before delivery begins', async () => {
    const store = createStoreStub([createPromptItem()]);
    const settingsStore = createSettingsStoreStub({
      copyMode: 'indirect-file',
    });
    const manager = new PromptManager({
      store,
      settingsStore,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
    });

    await manager.initialize();
    await manager.copyItem('prompt-1', 'templated', async () => {
      await manager.updateCopySettings({
        ...manager.getCopySettings(),
        copyMode: 'direct',
      });
    });

    expect(manager.getItems()[0]).toMatchObject({
      activeTask: true,
      used: true,
    });
  });

  it('rolls back item state when persistence fails after a successful copy', async () => {
    const store = createStoreStub([createPromptItem()]);
    const manager = new PromptManager({
      store,
      settingsStore: createSettingsStoreStub(),
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();
    store.save.mockRejectedValueOnce(new Error('disk full'));

    await expect(
      manager.copyItem('prompt-1', 'templated', async () => undefined),
    ).rejects.toThrow('disk full');
    expect(manager.getItems()[0]).toMatchObject({
      lastCopiedAt: undefined,
      used: false,
      updatedAt: '2026-03-16T00:00:00.000Z',
    });
  });

  it('rolls back copy settings when their persistence fails', async () => {
    const settingsStore = createSettingsStoreStub();
    const manager = new PromptManager({
      store: createStoreStub([createPromptItem()]),
      settingsStore,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
    });

    await manager.initialize();
    settingsStore.save.mockRejectedValueOnce(new Error('settings disk full'));

    await expect(
      manager.updateCopySettings({
        ...manager.getCopySettings(),
        prefix: 'New prefix',
      }),
    ).rejects.toThrow('settings disk full');
    expect(manager.getCopySettings().prefix).toBe('');
  });

  it('blocks mutations after initialization fails so corrupted data cannot be overwritten', async () => {
    const store = createStoreStub([createPromptItem()]);
    store.load.mockRejectedValueOnce(new Error('invalid JSON'));
    const manager = new PromptManager({
      store,
      settingsStore: createSettingsStoreStub(),
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
    });

    await expect(manager.initialize()).rejects.toThrow('invalid JSON');
    await expect(manager.createItem({ content: 'New prompt' })).rejects.toThrow(
      'invalid JSON',
    );
    expect(store.save).not.toHaveBeenCalled();
  });

  it('toggles the used flag', async () => {
    const store = createStoreStub([createPromptItem()]);
    const settingsStore = createSettingsStoreStub();
    const backupStore = createBackupStoreStub(undefined);
    const manager = new PromptManager({
      store,
      settingsStore,
      backupStore,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: () => 'generated-id',
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();
    await manager.toggleUsed('prompt-1');

    expect(manager.getItems()[0]?.used).toBe(true);
  });

  it('cancels the current task when its used-state rail is clicked', async () => {
    const store = createStoreStub([
      createPromptItem({ activeTask: true, used: true }),
    ]);
    const manager = new PromptManager({
      store,
      settingsStore: createSettingsStoreStub(),
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
    });

    await manager.initialize();
    await manager.toggleUsed('prompt-1');

    expect(manager.getItems()[0]).toMatchObject({
      activeTask: false,
      used: false,
    });
  });

  it('moves items up and down in the list', async () => {
    const store = createStoreStub([
      createPromptItem({ id: 'prompt-1', title: 'One' }),
      createPromptItem({ id: 'prompt-2', title: 'Two' }),
      createPromptItem({ id: 'prompt-3', title: 'Three' }),
    ]);
    const settingsStore = createSettingsStoreStub();
    const backupStore = createBackupStoreStub(undefined);
    const manager = new PromptManager({
      store,
      settingsStore,
      backupStore,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: () => 'generated-id',
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();
    await manager.moveItem('prompt-2', 'up');
    await manager.moveItem('prompt-1', 'down');

    expect(manager.getItems().map((item) => item.id)).toEqual([
      'prompt-2',
      'prompt-3',
      'prompt-1',
    ]);
  });

  it('moves a reordered item to the exact final index after removal', async () => {
    const store = createStoreStub([
      createPromptItem({ id: 'prompt-1', title: 'One' }),
      createPromptItem({ id: 'prompt-2', title: 'Two' }),
      createPromptItem({ id: 'prompt-3', title: 'Three' }),
      createPromptItem({ id: 'prompt-4', title: 'Four' }),
    ]);
    const settingsStore = createSettingsStoreStub();
    const backupStore = createBackupStoreStub(undefined);
    const manager = new PromptManager({
      store,
      settingsStore,
      backupStore,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: () => 'generated-id',
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();
    await manager.reorder('prompt-2', 3);

    expect(manager.getItems().map((item) => item.id)).toEqual([
      'prompt-1',
      'prompt-3',
      'prompt-4',
      'prompt-2',
    ]);
  });

  it('clamps an oversized reorder target to the visual end after source removal', async () => {
    const store = createStoreStub([
      createPromptItem({ id: 'prompt-1', title: 'One' }),
      createPromptItem({ id: 'prompt-2', title: 'Two' }),
      createPromptItem({ id: 'prompt-3', title: 'Three' }),
      createPromptItem({ id: 'prompt-4', title: 'Four' }),
    ]);
    const settingsStore = createSettingsStoreStub();
    const backupStore = createBackupStoreStub(undefined);
    const manager = new PromptManager({
      store,
      settingsStore,
      backupStore,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: () => 'generated-id',
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();
    await manager.reorder('prompt-2', 99);

    expect(manager.getItems().map((item) => item.id)).toEqual([
      'prompt-1',
      'prompt-3',
      'prompt-4',
      'prompt-2',
    ]);
  });

  it('keeps reorder unchanged when the item is already at the final index', async () => {
    const store = createStoreStub([
      createPromptItem({ id: 'prompt-1', title: 'One' }),
      createPromptItem({ id: 'prompt-2', title: 'Two' }),
      createPromptItem({ id: 'prompt-3', title: 'Three' }),
      createPromptItem({ id: 'prompt-4', title: 'Four' }),
    ]);
    const settingsStore = createSettingsStoreStub();
    const backupStore = createBackupStoreStub(undefined);
    const manager = new PromptManager({
      store,
      settingsStore,
      backupStore,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: () => 'generated-id',
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();
    await manager.reorder('prompt-2', 1);

    expect(manager.getItems().map((item) => item.id)).toEqual([
      'prompt-1',
      'prompt-2',
      'prompt-3',
      'prompt-4',
    ]);
  });

  it('deletes the targeted item', async () => {
    const store = createStoreStub([
      createPromptItem({ id: 'prompt-1' }),
      createPromptItem({ id: 'prompt-2' }),
    ]);
    const settingsStore = createSettingsStoreStub();
    const backupStore = createBackupStoreStub(undefined);
    const manager = new PromptManager({
      store,
      settingsStore,
      backupStore,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: () => 'generated-id',
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();
    await manager.deleteItem('prompt-1');

    expect(manager.getItems().map((item) => item.id)).toEqual(['prompt-2']);
  });

  it('backs up current items before deleting all prompts', async () => {
    const store = createStoreStub([
      createPromptItem({ id: 'prompt-1' }),
      createPromptItem({ id: 'prompt-2' }),
    ]);
    const settingsStore = createSettingsStoreStub();
    const backupStore = createBackupStoreStub(undefined);
    const manager = new PromptManager({
      store,
      settingsStore,
      backupStore,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: () => 'generated-id',
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();
    await manager.deleteAll();

    expect(manager.getItems()).toEqual([]);
    expect(backupStore.getStoredItems()).toEqual([
      createPromptItem({ id: 'prompt-1' }),
      createPromptItem({ id: 'prompt-2' }),
    ]);
  });

  it('restores the last deleted backup by replacing current items', async () => {
    const store = createStoreStub([createPromptItem({ id: 'current' })]);
    const settingsStore = createSettingsStoreStub();
    const backupStore = createBackupStoreStub([
      createPromptItem({ id: 'restored-1', title: 'Restored one' }),
      createPromptItem({ id: 'restored-2', title: 'Restored two' }),
    ]);
    const manager = new PromptManager({
      store,
      settingsStore,
      backupStore,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: () => 'generated-id',
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();
    await manager.restoreLastDeleted();

    expect(manager.getItems().map((item) => item.id)).toEqual([
      'restored-1',
      'restored-2',
    ]);
    expect(store.getStoredItems().map((item) => item.id)).toEqual([
      'restored-1',
      'restored-2',
    ]);
  });

  it('resets all items back to unused', async () => {
    const store = createStoreStub([
      createPromptItem({ id: 'prompt-1', used: true }),
      createPromptItem({ id: 'prompt-2', used: true }),
    ]);
    const settingsStore = createSettingsStoreStub();
    const backupStore = createBackupStoreStub(undefined);
    const manager = new PromptManager({
      store,
      settingsStore,
      backupStore,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: () => 'generated-id',
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();
    await manager.resetAllUsed();

    expect(manager.getItems().every((item) => item.used === false)).toBe(
      true,
    );
  });

  it('appends imported items to the existing list', async () => {
    const store = createStoreStub([
      createPromptItem({ id: 'prompt-1', title: 'Existing' }),
    ]);
    const settingsStore = createSettingsStoreStub();
    const backupStore = createBackupStoreStub(undefined);
    const manager = new PromptManager({
      store,
      settingsStore,
      backupStore,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: (() => {
        let counter = 1;
        return () => `generated-${counter++}`;
      })(),
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();
    await manager.importText('new body\n-*- Imported\nsecond body', 'append');

    expect(
      manager.getItems().map((item) => ({
        id: item.id,
        title: item.title,
        content: item.content,
      })),
    ).toEqual([
      { id: 'prompt-1', title: 'Existing', content: 'Prompt body' },
      { id: 'generated-1', title: undefined, content: 'new body' },
      { id: 'generated-2', title: 'Imported', content: 'second body' },
    ]);
  });

  it('replaces existing items when import mode is replace', async () => {
    const store = createStoreStub([
      createPromptItem({ id: 'prompt-1', title: 'Existing' }),
    ]);
    const settingsStore = createSettingsStoreStub();
    const backupStore = createBackupStoreStub(undefined);
    const manager = new PromptManager({
      store,
      settingsStore,
      backupStore,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: () => 'generated-1',
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();
    await manager.importText('-*- Fresh\nreplacement body', 'replace');

    expect(
      manager.getItems().map((item) => ({
        id: item.id,
        title: item.title,
        content: item.content,
      })),
    ).toEqual([
      { id: 'generated-1', title: 'Fresh', content: 'replacement body' },
    ]);
    expect(store.getStoredItems()).toHaveLength(1);
  });

  it('creates a new item from a prompt draft', async () => {
    const store = createStoreStub([]);
    const settingsStore = createSettingsStoreStub();
    const backupStore = createBackupStoreStub(undefined);
    const manager = new PromptManager({
      store,
      settingsStore,
      backupStore,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: () => 'generated-1',
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();
    await manager.createItem({
      title: 'Created title',
      content: 'Created content',
    });

    expect(manager.getItems()).toEqual([
      {
        id: 'generated-1',
        title: 'Created title',
        content: 'Created content',
        used: false,
        createdAt: '2026-03-16T01:00:00.000Z',
        updatedAt: '2026-03-16T01:00:00.000Z',
      },
    ]);
  });

  it('updates an existing item from a prompt draft', async () => {
    const store = createStoreStub([
      createPromptItem({
        id: 'prompt-1',
        title: 'Old title',
        content: 'Old content',
        used: true,
        createdAt: '2026-03-16T00:00:00.000Z',
        updatedAt: '2026-03-16T00:00:00.000Z',
      }),
    ]);
    const settingsStore = createSettingsStoreStub();
    const backupStore = createBackupStoreStub(undefined);
    const manager = new PromptManager({
      store,
      settingsStore,
      backupStore,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: () => 'generated-1',
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();
    await manager.updateItem('prompt-1', {
      title: undefined,
      content: 'Updated content',
    });

    expect(manager.getItems()).toEqual([
      {
        id: 'prompt-1',
        title: undefined,
        content: 'Updated content',
        used: true,
        createdAt: '2026-03-16T00:00:00.000Z',
        updatedAt: '2026-03-16T01:00:00.000Z',
      },
    ]);
  });

  it('invalidates the current task marker when that prompt is edited', async () => {
    const store = createStoreStub([
      createPromptItem({ activeTask: true, used: true }),
    ]);
    const manager = new PromptManager({
      store,
      settingsStore: createSettingsStoreStub(),
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
    });

    await manager.initialize();
    await manager.updateItem('prompt-1', {
      title: 'Edited',
      content: 'Edited body',
    });

    expect(manager.getItems()[0]).toMatchObject({
      activeTask: false,
      used: false,
      content: 'Edited body',
    });
  });

  it('omits empty prefix and suffix blocks from templated copy output', async () => {
    const store = createStoreStub([createPromptItem()]);
    const settingsStore = createSettingsStoreStub({
      prefix: '   ',
      suffix: '',
    });
    const backupStore = createBackupStoreStub(undefined);
    const writeClipboard = vi.fn(async () => undefined);
    const manager = new PromptManager({
      store,
      settingsStore,
      backupStore,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: () => 'generated-id',
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();
    await manager.copyItem('prompt-1', 'templated', writeClipboard);

    expect(writeClipboard).toHaveBeenCalledWith('Prompt body');
  });

  it('auto-completes a closing markdown fence when only the prefix fence is set', async () => {
    const store = createStoreStub([createPromptItem()]);
    const settingsStore = createSettingsStoreStub({
      prefix: '```ts',
      suffix: '',
    });
    const backupStore = createBackupStoreStub(undefined);
    const writeClipboard = vi.fn(async () => undefined);
    const manager = new PromptManager({
      store,
      settingsStore,
      backupStore,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: () => 'generated-id',
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();
    await manager.copyItem('prompt-1', 'templated', writeClipboard);

    expect(writeClipboard).toHaveBeenCalledWith('```ts\nPrompt body\n```');
  });

  it('auto-completes an opening markdown fence when only the suffix fence is set', async () => {
    const store = createStoreStub([createPromptItem()]);
    const settingsStore = createSettingsStoreStub({
      prefix: '',
      suffix: '~~~',
    });
    const backupStore = createBackupStoreStub(undefined);
    const writeClipboard = vi.fn(async () => undefined);
    const manager = new PromptManager({
      store,
      settingsStore,
      backupStore,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: () => 'generated-id',
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();
    await manager.copyItem('prompt-1', 'templated', writeClipboard);

    expect(writeClipboard).toHaveBeenCalledWith('~~~\nPrompt body\n~~~');
  });

  it('copies only the current item content in raw mode and still marks it as used', async () => {
    const store = createStoreStub([createPromptItem()]);
    const settingsStore = createSettingsStoreStub({
      prefix: '前提示词',
      suffix: '后提示词',
    });
    const backupStore = createBackupStoreStub(undefined);
    const writeClipboard = vi.fn(async () => undefined);
    const manager = new PromptManager({
      store,
      settingsStore,
      backupStore,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: () => 'generated-id',
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();
    await manager.copyItem('prompt-1', 'raw', writeClipboard);

    expect(writeClipboard).toHaveBeenCalledWith('Prompt body');
    expect(manager.getItems()[0]).toMatchObject({
      id: 'prompt-1',
      lastCopiedAt: '2026-03-16T01:00:00.000Z',
      used: true,
      updatedAt: '2026-03-16T01:00:00.000Z',
    });
  });

  it('normalizes blank quick-run commands back to /new', async () => {
    const store = createStoreStub([createPromptItem()]);
    const settingsStore = createSettingsStoreStub();
    const backupStore = createBackupStoreStub(undefined);
    const manager = new PromptManager({
      store,
      settingsStore,
      backupStore,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: () => 'generated-id',
      now: () => '2026-05-05T01:00:00.000Z',
    });

    await manager.initialize();
    await manager.updateCopySettings({
      includeTemplateOnClick: true,
      prefix: '',
      suffix: '',
      quickRunEnabled: true,
      quickRunCommand: '   ',
    } as PromptCopySettings);

    expect(
      (manager.getCopySettings() as PromptCopySettings & {
        quickRunCommand?: string;
        quickRunEnabled?: boolean;
      }).quickRunEnabled,
    ).toBe(true);
    expect(
      (manager.getCopySettings() as PromptCopySettings & {
        quickRunCommand?: string;
      }).quickRunCommand,
    ).toBe('/new');
    expect(
      (settingsStore.getStoredSettings() as PromptCopySettings & {
        quickRunCommand?: string;
      }).quickRunCommand,
    ).toBe('/new');
  });
});
