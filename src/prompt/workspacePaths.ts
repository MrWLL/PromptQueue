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
  backupTempFile: string;
  settingsFile: string;
  settingsTempFile: string;
  tempFile: string;
} {
  const rootDir = workspaceFolder?.uri.fsPath;

  if (!rootDir) {
    throw new MissingWorkspaceError();
  }

  const dataDir = resolvePromptQueueStoragePath(workspaceFolder, storagePath);
  const dataFile = path.join(dataDir, 'prompts.json');
  const backupFile = path.join(dataDir, 'last-deleted.json');
  const backupTempFile = `${backupFile}.tmp`;
  const settingsFile = path.join(dataDir, 'settings.json');
  const settingsTempFile = `${settingsFile}.tmp`;
  const tempFile = `${dataFile}.tmp`;

  return {
    rootDir,
    dataDir,
    dataFile,
    backupFile,
    backupTempFile,
    settingsFile,
    settingsTempFile,
    tempFile,
  };
}
