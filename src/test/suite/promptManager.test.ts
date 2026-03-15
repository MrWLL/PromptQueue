import { describe, expect, it, vi } from 'vitest';

import { PromptManager } from '../../prompt/promptManager';
import type { PromptItem } from '../../prompt/promptTypes';
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
    save: vi.fn(async (_workspaceFolder: WorkspaceFolderLike | undefined, items: PromptItem[]) => {
      storedItems = structuredClone(items);
    }),
    getStoredItems: () => structuredClone(storedItems),
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
  it('marks an item as used after a successful copy', async () => {
    const store = createStoreStub([createPromptItem()]);
    const manager = new PromptManager({
      store,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: () => 'generated-id',
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();
    await manager.copyItem('prompt-1', vi.fn(async () => undefined));

    expect(manager.getItems()[0]).toMatchObject({
      id: 'prompt-1',
      used: true,
      updatedAt: '2026-03-16T01:00:00.000Z',
    });
  });

  it('leaves an item unchanged when copy fails', async () => {
    const store = createStoreStub([createPromptItem()]);
    const manager = new PromptManager({
      store,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: () => 'generated-id',
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();

    await expect(
      manager.copyItem('prompt-1', async () => {
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
    const manager = new PromptManager({
      store,
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
    const manager = new PromptManager({
      store,
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
    const manager = new PromptManager({
      store,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: () => 'generated-id',
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();
    await manager.deleteItem('prompt-1');

    expect(manager.getItems().map((item) => item.id)).toEqual(['prompt-2']);
  });

  it('resets all items back to unused', async () => {
    const store = createStoreStub([
      createPromptItem({ id: 'prompt-1', used: true }),
      createPromptItem({ id: 'prompt-2', used: true }),
    ]);
    const manager = new PromptManager({
      store,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: () => 'generated-id',
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();
    await manager.resetAllUsed();

    expect(manager.getItems().every((item) => item.used === false)).toBe(true);
  });

  it('appends imported items to the existing list', async () => {
    const store = createStoreStub([createPromptItem({ id: 'prompt-1', title: 'Existing' })]);
    const manager = new PromptManager({
      store,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: (() => {
        let counter = 1;
        return () => `generated-${counter++}`;
      })(),
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();
    await manager.importText('new body\n-*- Imported\nsecond body', 'append');

    expect(manager.getItems().map((item) => ({ id: item.id, title: item.title, content: item.content }))).toEqual([
      { id: 'prompt-1', title: 'Existing', content: 'Prompt body' },
      { id: 'generated-1', title: undefined, content: 'new body' },
      { id: 'generated-2', title: 'Imported', content: 'second body' },
    ]);
  });

  it('replaces existing items when import mode is replace', async () => {
    const store = createStoreStub([createPromptItem({ id: 'prompt-1', title: 'Existing' })]);
    const manager = new PromptManager({
      store,
      workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
      idFactory: () => 'generated-1',
      now: () => '2026-03-16T01:00:00.000Z',
    });

    await manager.initialize();
    await manager.importText('-*- Fresh\nreplacement body', 'replace');

    expect(manager.getItems().map((item) => ({ id: item.id, title: item.title, content: item.content }))).toEqual([
      { id: 'generated-1', title: 'Fresh', content: 'replacement body' },
    ]);
    expect(store.getStoredItems()).toHaveLength(1);
  });
});
