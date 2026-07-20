import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { writePromptMainTaskFile } from '../../prompt/promptTaskFile';
import {
  MissingWorkspaceError,
  type WorkspaceFolderLike,
} from '../../prompt/workspacePaths';

const tempDirs: string[] = [];

function createWorkspaceFolder(rootPath: string): WorkspaceFolderLike {
  return {
    uri: {
      fsPath: rootPath,
    },
  };
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop();

    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
});

describe('writePromptMainTaskFile', () => {
  it('creates WorkSpace/main-task.md and overwrites existing content', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptqueue-task-'));
    const workspaceFolder = createWorkspaceFolder(tempDir);
    const taskFile = path.join(tempDir, 'WorkSpace', 'main-task.md');

    tempDirs.push(tempDir);

    await writePromptMainTaskFile(workspaceFolder, 'first prompt');
    await writePromptMainTaskFile(workspaceFolder, 'replacement prompt');

    await expect(fs.readFile(taskFile, 'utf8')).resolves.toBe(
      'replacement prompt',
    );
  });

  it('atomically replaces main-task.md through a temporary file', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptqueue-task-'));
    const workspaceFolder = createWorkspaceFolder(tempDir);
    const taskFile = path.join(tempDir, 'WorkSpace', 'main-task.md');
    const rename = vi.fn(fs.rename.bind(fs));

    tempDirs.push(tempDir);

    await writePromptMainTaskFile(workspaceFolder, 'prompt', {
      mkdir: fs.mkdir.bind(fs),
      rename,
      writeFile: fs.writeFile.bind(fs),
    });

    expect(rename).toHaveBeenCalledWith(
      expect.stringMatching(/main-task\.md\..+\.tmp$/),
      taskFile,
    );
    await expect(fs.readFile(taskFile, 'utf8')).resolves.toBe('prompt');
  });

  it('rejects writes when no workspace is open', async () => {
    await expect(
      writePromptMainTaskFile(undefined, 'prompt'),
    ).rejects.toBeInstanceOf(MissingWorkspaceError);
  });
});
