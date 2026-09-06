import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { PromptSettingsStore } from '../../prompt/promptSettingsStore';
import {
  PromptDataConflictError,
  PromptDataFormatError,
} from '../../prompt/promptDataValidation';
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
        copyMode: 'direct',
        includeTemplateOnClick: true,
        prefix: '',
        quickRunCommand: '/new',
        quickRunEnabled: false,
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
      copyMode: 'direct',
      includeTemplateOnClick: true,
      prefix: '',
      quickRunCommand: '/new',
      quickRunEnabled: false,
      suffix: '',
    } satisfies PromptCopySettings);
  });

  it('returns quick-run defaults when the settings file does not exist', async () => {
    const store = new PromptSettingsStore();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptqueue-'));
    const workspaceFolder = createWorkspaceFolder(tempDir);

    tempDirs.push(tempDir);

    await expect(store.load(workspaceFolder)).resolves.toEqual({
      copyMode: 'direct',
      includeTemplateOnClick: true,
      prefix: '',
      suffix: '',
      quickRunEnabled: false,
      quickRunCommand: '/new',
    });
  });

  it('treats legacy settings without a copy mode as direct copy', async () => {
    const store = new PromptSettingsStore();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptqueue-'));
    const workspaceFolder = createWorkspaceFolder(tempDir);
    const { dataDir, settingsFile } = getPromptQueuePaths(workspaceFolder);

    tempDirs.push(tempDir);
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(
      settingsFile,
      JSON.stringify({
        includeTemplateOnClick: true,
        prefix: 'Prefix',
        suffix: 'Suffix',
      }),
      'utf8',
    );

    await expect(store.load(workspaceFolder)).resolves.toMatchObject({
      copyMode: 'direct',
      prefix: 'Prefix',
      suffix: 'Suffix',
    });
  });

  it('saves prefix, suffix, and left-click copy mode into the PromptQueue settings file', async () => {
    const store = new PromptSettingsStore();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptqueue-'));
    const workspaceFolder = createWorkspaceFolder(tempDir);
    const { dataDir, settingsFile } = getPromptQueuePaths(workspaceFolder);

    tempDirs.push(tempDir);

    await store.save(workspaceFolder, {
      copyMode: 'indirect-file',
      includeTemplateOnClick: false,
      prefix: '前提示词',
      quickRunCommand: '/new',
      quickRunEnabled: false,
      suffix: '后提示词',
    });

    await expect(fs.stat(dataDir)).resolves.toMatchObject({
      isDirectory: expect.any(Function),
    });
    await expect(fs.readFile(settingsFile, 'utf8')).resolves.toContain(
      '"copyMode": "indirect-file"',
    );
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

  it('saves quick-run settings alongside copy settings', async () => {
    const store = new PromptSettingsStore();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptqueue-'));
    const workspaceFolder = createWorkspaceFolder(tempDir);
    const { settingsFile } = getPromptQueuePaths(workspaceFolder);

    tempDirs.push(tempDir);

    await store.save(
      workspaceFolder,
      {
        copyMode: 'direct',
        includeTemplateOnClick: false,
        prefix: '前提示词',
        suffix: '后提示词',
        quickRunEnabled: true,
        quickRunCommand: '/new',
      } as PromptCopySettings,
    );

    await expect(fs.readFile(settingsFile, 'utf8')).resolves.toContain(
      '"quickRunEnabled": true',
    );
    await expect(fs.readFile(settingsFile, 'utf8')).resolves.toContain(
      '"quickRunCommand": "/new"',
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
      copyMode: 'direct',
      includeTemplateOnClick: true,
      prefix: 'Prefix',
      quickRunCommand: '/new',
      quickRunEnabled: false,
      suffix: 'Suffix',
    });

    await expect(fs.readFile(settingsFile, 'utf8')).resolves.toContain(
      '"prefix": "Prefix"',
    );
    await expect(fs.readFile(settingsFile, 'utf8')).resolves.toContain(
      '"includeTemplateOnClick": true',
    );
  });

  it('rejects malformed settings instead of silently replacing them with defaults', async () => {
    const store = new PromptSettingsStore();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptqueue-'));
    const workspaceFolder = createWorkspaceFolder(tempDir);
    const { dataDir, settingsFile } = getPromptQueuePaths(workspaceFolder);

    tempDirs.push(tempDir);
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(settingsFile, '[]', 'utf8');

    await expect(store.load(workspaceFolder)).rejects.toBeInstanceOf(
      PromptDataFormatError,
    );
  });

  it('rejects saves when another window changed the loaded settings', async () => {
    const store = new PromptSettingsStore();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptqueue-'));
    const workspaceFolder = createWorkspaceFolder(tempDir);
    const { settingsFile } = getPromptQueuePaths(workspaceFolder);
    const settings: PromptCopySettings = {
      copyMode: 'direct',
      includeTemplateOnClick: true,
      prefix: '',
      quickRunCommand: '/new',
      quickRunEnabled: false,
      suffix: '',
    };

    tempDirs.push(tempDir);
    await store.save(workspaceFolder, settings);
    await store.load(workspaceFolder);
    await fs.writeFile(settingsFile, '{}\n', 'utf8');

    await expect(store.save(workspaceFolder, settings)).rejects.toBeInstanceOf(
      PromptDataConflictError,
    );
  });
});
