import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { PromptBackupStore } from '../../prompt/promptBackupStore';
import type { PromptItem } from '../../prompt/promptTypes';
import {
  MissingWorkspaceError,
  getPromptQueuePaths,
  type WorkspaceFolderLike,
} from '../../prompt/workspacePaths';

function createWorkspaceFolder(rootPath: string): WorkspaceFolderLike {
  return {
    uri: {
      fsPath: rootPath,
    },
  };
}

function createPromptItem(id: string): PromptItem {
  return {
    id,
    title: `Title ${id}`,
    content: `Body ${id}`,
    used: false,
    createdAt: '2026-03-16T00:00:00.000Z',
    updatedAt: '2026-03-16T00:00:00.000Z',
  };
}

const tempDirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();

  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop();

    if (!tempDir) {
      continue;
    }

    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

describe('PromptBackupStore', () => {
  it('throws a typed error when no workspace is open', async () => {
    const store = new PromptBackupStore();

    await expect(store.load(undefined)).rejects.toBeInstanceOf(
      MissingWorkspaceError,
    );
    await expect(store.save(undefined, [])).rejects.toBeInstanceOf(
      MissingWorkspaceError,
    );
  });

  it('returns undefined when the backup file does not exist', async () => {
    const store = new PromptBackupStore();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptqueue-'));
    const workspaceFolder = createWorkspaceFolder(tempDir);

    tempDirs.push(tempDir);

    await expect(store.load(workspaceFolder)).resolves.toBeUndefined();
  });

  it('saves backup items into the last-deleted file', async () => {
    const store = new PromptBackupStore();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptqueue-'));
    const workspaceFolder = createWorkspaceFolder(tempDir);
    const { backupFile } = getPromptQueuePaths(workspaceFolder);

    tempDirs.push(tempDir);

    await store.save(workspaceFolder, [createPromptItem('prompt-1')]);

    await expect(fs.readFile(backupFile, 'utf8')).resolves.toContain(
      '"id": "prompt-1"',
    );
  });

  it('overwrites the previous last-deleted backup on save', async () => {
    const store = new PromptBackupStore();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptqueue-'));
    const workspaceFolder = createWorkspaceFolder(tempDir);

    tempDirs.push(tempDir);

    await store.save(workspaceFolder, [createPromptItem('prompt-1')]);
    await store.save(workspaceFolder, [createPromptItem('prompt-2')]);

    await expect(store.load(workspaceFolder)).resolves.toEqual([
      createPromptItem('prompt-2'),
    ]);
  });
});
