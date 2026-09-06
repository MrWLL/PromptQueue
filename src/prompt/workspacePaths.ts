import * as path from 'node:path';

import { resolvePromptQueueStoragePath } from './promptConfig';

export interface WorkspaceFolderLike {
  uri: {
    fsPath: string;
  };
}

export class MissingWorkspaceError extends Error {
  constructor() {
    super('PromptQueue requires an open workspace.');
    this.name = 'MissingWorkspaceError';
  }
}

export function getPromptQueuePaths(
  workspaceFolder: WorkspaceFolderLike | undefined,
  storagePath?: string,
): {
  rootDir: string;
  dataDir: string;
  dataFile: string;
  backupFile: string;
  settingsFile: string;
} {
  const rootDir = workspaceFolder?.uri.fsPath;

  if (!rootDir) {
    throw new MissingWorkspaceError();
  }

  const dataDir = resolvePromptQueueStoragePath(workspaceFolder, storagePath);
  const dataFile = path.join(dataDir, 'prompts.json');
  const backupFile = path.join(dataDir, 'last-deleted.json');
  const settingsFile = path.join(dataDir, 'settings.json');

  return {
    rootDir,
    dataDir,
    dataFile,
    backupFile,
    settingsFile,
  };
}
