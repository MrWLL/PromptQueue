import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import {
  MissingWorkspaceError,
  type WorkspaceFolderLike,
} from './workspacePaths';

export const INDIRECT_COPY_INSTRUCTION =
  '完整阅读WorkSpace/main-task.md，并按照其中的要求和指引执行。';

export interface PromptTaskFileSystem {
  mkdir: typeof fs.mkdir;
  writeFile: typeof fs.writeFile;
}

export async function writePromptMainTaskFile(
  workspaceFolder: WorkspaceFolderLike | undefined,
  content: string,
  fileSystem: PromptTaskFileSystem = fs,
): Promise<void> {
  const rootDir = workspaceFolder?.uri.fsPath;

  if (!rootDir) {
    throw new MissingWorkspaceError();
  }

  const workspaceDir = path.join(rootDir, 'WorkSpace');
  const taskFile = path.join(workspaceDir, 'main-task.md');

  await fileSystem.mkdir(workspaceDir, { recursive: true });
  await fileSystem.writeFile(taskFile, content, 'utf8');
}
