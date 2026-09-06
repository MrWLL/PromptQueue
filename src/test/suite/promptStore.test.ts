import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { PromptStore } from '../../prompt/promptStore';
import {
  PromptDataConflictError,
  PromptDataFormatError,
} from '../../prompt/promptDataValidation';
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

function createPromptItem(): PromptItem {
  return {
    id: 'prompt-1',
    title: 'Title',
    content: 'Body',
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

describe('PromptStore', () => {
  it('throws a typed error when no workspace is open', async () => {
    const store = new PromptStore();

    await expect(store.load(undefined)).rejects.toBeInstanceOf(
      MissingWorkspaceError,
    );
    await expect(store.save(undefined, [])).rejects.toBeInstanceOf(
      MissingWorkspaceError,
    );
  });

  it('returns an empty list when the data file does not exist', async () => {
    const store = new PromptStore();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptqueue-'));
    const workspaceFolder = createWorkspaceFolder(tempDir);

    tempDirs.push(tempDir);

    await expect(store.load(workspaceFolder)).resolves.toEqual([]);
  });

  it('creates the PromptQueue workspace directory on save', async () => {
    const store = new PromptStore();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptqueue-'));
    const workspaceFolder = createWorkspaceFolder(tempDir);
    const { dataDir, dataFile } = getPromptQueuePaths(workspaceFolder);

    tempDirs.push(tempDir);

    await store.save(workspaceFolder, [createPromptItem()]);

    await expect(fs.stat(dataDir)).resolves.toMatchObject({ isDirectory: expect.any(Function) });
    await expect(fs.readFile(dataFile, 'utf8')).resolves.toContain('"id": "prompt-1"');
  });

  it('renames a unique temp file into the data file during save', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptqueue-'));
    const workspaceFolder = createWorkspaceFolder(tempDir);
    const { dataFile } = getPromptQueuePaths(workspaceFolder);
    const renameSpy = vi.fn(fs.rename.bind(fs));
    const store = new PromptStore({
      mkdir: fs.mkdir.bind(fs),
      readFile: fs.readFile.bind(fs),
      rename: renameSpy,
      writeFile: fs.writeFile.bind(fs),
    });

    tempDirs.push(tempDir);

    await store.save(workspaceFolder, [createPromptItem()]);

    expect(renameSpy).toHaveBeenCalledWith(
      expect.stringMatching(/prompts\.json\.[0-9a-f-]+\.tmp$/u),
      dataFile,
    );
  });

  it('rejects malformed persisted prompt data instead of treating it as an empty queue', async () => {
    const store = new PromptStore();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptqueue-'));
    const workspaceFolder = createWorkspaceFolder(tempDir);
    const { dataDir, dataFile } = getPromptQueuePaths(workspaceFolder);

    tempDirs.push(tempDir);
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(dataFile, '{not json', 'utf8');

    await expect(store.load(workspaceFolder)).rejects.toBeInstanceOf(
      PromptDataFormatError,
    );
  });

  it('rejects saves when another window changed the loaded prompt data', async () => {
    const store = new PromptStore();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptqueue-'));
    const workspaceFolder = createWorkspaceFolder(tempDir);
    const { dataFile } = getPromptQueuePaths(workspaceFolder);

    tempDirs.push(tempDir);
    await store.save(workspaceFolder, [createPromptItem()]);
    await store.load(workspaceFolder);
    await fs.writeFile(dataFile, '[]\n', 'utf8');

    await expect(store.save(workspaceFolder, [createPromptItem()])).rejects.toBeInstanceOf(
      PromptDataConflictError,
    );
  });

  it('uses the configured storage path when one is provided', async () => {
    const store = new PromptStore('Custom/PromptQueue');
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptqueue-'));
    const workspaceFolder = createWorkspaceFolder(tempDir);
    const { dataFile } = getPromptQueuePaths(
      workspaceFolder,
      'Custom/PromptQueue',
    );

    tempDirs.push(tempDir);

    await store.save(workspaceFolder, [createPromptItem()]);

    await expect(fs.readFile(dataFile, 'utf8')).resolves.toContain(
      '"id": "prompt-1"',
    );
  });
});
