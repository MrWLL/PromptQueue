import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { PromptSettingsStore } from '../../prompt/promptSettingsStore';
import type { PromptCopySettings } from '../../prompt/promptTypes';
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

describe('PromptSettingsStore', () => {
  it('throws a typed error when no workspace is open', async () => {
    const store = new PromptSettingsStore();

    await expect(store.load(undefined)).rejects.toBeInstanceOf(
      MissingWorkspaceError,
    );
    await expect(
      store.save(undefined, {
        includeTemplateOnClick: true,
        prefix: '',
        suffix: '',
      }),
    ).rejects.toBeInstanceOf(MissingWorkspaceError);
  });

  it('returns empty settings with left-click templating enabled by default when the settings file does not exist', async () => {
    const store = new PromptSettingsStore();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptqueue-'));
    const workspaceFolder = createWorkspaceFolder(tempDir);

    tempDirs.push(tempDir);

    await expect(store.load(workspaceFolder)).resolves.toEqual({
      includeTemplateOnClick: true,
      prefix: '',
      suffix: '',
    } satisfies PromptCopySettings);
  });

  it('saves prefix, suffix, and left-click copy mode into the PromptQueue settings file', async () => {
    const store = new PromptSettingsStore();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptqueue-'));
    const workspaceFolder = createWorkspaceFolder(tempDir);
    const { dataDir, settingsFile } = getPromptQueuePaths(workspaceFolder);

    tempDirs.push(tempDir);

    await store.save(workspaceFolder, {
      includeTemplateOnClick: false,
      prefix: '前提示词',
      suffix: '后提示词',
    });

    await expect(fs.stat(dataDir)).resolves.toMatchObject({
      isDirectory: expect.any(Function),
    });
    await expect(fs.readFile(settingsFile, 'utf8')).resolves.toContain(
      '"includeTemplateOnClick": false',
    );
    await expect(fs.readFile(settingsFile, 'utf8')).resolves.toContain(
      '"prefix": "前提示词"',
    );
    await expect(fs.readFile(settingsFile, 'utf8')).resolves.toContain(
      '"suffix": "后提示词"',
    );
  });

  it('uses the configured storage path when one is provided', async () => {
    const store = new PromptSettingsStore('Custom/PromptQueue');
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptqueue-'));
    const workspaceFolder = createWorkspaceFolder(tempDir);
    const { settingsFile } = getPromptQueuePaths(
      workspaceFolder,
      'Custom/PromptQueue',
    );

    tempDirs.push(tempDir);

    await store.save(workspaceFolder, {
      includeTemplateOnClick: true,
      prefix: 'Prefix',
      suffix: 'Suffix',
    });

    await expect(fs.readFile(settingsFile, 'utf8')).resolves.toContain(
      '"prefix": "Prefix"',
    );
    await expect(fs.readFile(settingsFile, 'utf8')).resolves.toContain(
      '"includeTemplateOnClick": true',
    );
  });
});
