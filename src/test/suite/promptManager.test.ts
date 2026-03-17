import { describe, expect, it, vi } from 'vitest';

import { PromptManager } from '../../prompt/promptManager';
import type { PromptCopySettings, PromptItem } from '../../prompt/promptTypes';
import type { WorkspaceFolderLike } from '../../prompt/workspacePaths';

function createPromptItem(
  overrides: Partial<PromptItem> = {},
): PromptItem {
  return {
    id: overrides.id ?? 'prompt-1',
    title: overrides.title,
    content: overrides.content ?? 'Prompt body',
    used: overrides.used ?? false,
    createdAt: overrides.createdAt ?? '2026-03-16T00:00:00.000Z',
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
  initialSettings: PromptCopySettings = { prefix: '', suffix: '' },
) {
  let storedSettings = structuredClone(initialSettings);

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
      used: false,
      updatedAt: '2026-03-16T00:00:00.000Z',
    });
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
      used: true,
      updatedAt: '2026-03-16T01:00:00.000Z',
    });
  });
});
