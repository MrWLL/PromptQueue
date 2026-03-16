import * as path from 'node:path';

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
): {
  rootDir: string;
  dataDir: string;
  dataFile: string;
  settingsFile: string;
  settingsTempFile: string;
  tempFile: string;
} {
  const rootDir = workspaceFolder?.uri.fsPath;

  if (!rootDir) {
    throw new MissingWorkspaceError();
  }

  const dataDir = path.join(rootDir, 'WorkSpace', 'PromptQueue');
  const dataFile = path.join(dataDir, 'prompts.json');
  const settingsFile = path.join(dataDir, 'settings.json');
  const settingsTempFile = `${settingsFile}.tmp`;
  const tempFile = `${dataFile}.tmp`;

  return {
    rootDir,
    dataDir,
    dataFile,
    settingsFile,
    settingsTempFile,
    tempFile,
  };
}
