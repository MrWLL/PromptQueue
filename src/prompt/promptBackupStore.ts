import * as fs from 'node:fs/promises';

import type { PromptItem } from './promptTypes';
import {
  getPromptQueuePaths,
  type WorkspaceFolderLike,
} from './workspacePaths';

export interface PromptBackupStoreFileSystem {
  mkdir: typeof fs.mkdir;
  readFile: typeof fs.readFile;
  rename: typeof fs.rename;
  writeFile: typeof fs.writeFile;
}

export class PromptBackupStore {
  private readonly fileSystem: PromptBackupStoreFileSystem;
  private readonly storagePath: string | undefined;

  constructor(
    storagePathOrFileSystem?: string | PromptBackupStoreFileSystem,
    fileSystem: PromptBackupStoreFileSystem = fs,
  ) {
    if (typeof storagePathOrFileSystem === 'string') {
      this.storagePath = storagePathOrFileSystem;
      this.fileSystem = fileSystem;
      return;
    }

    this.storagePath = undefined;
    this.fileSystem = storagePathOrFileSystem ?? fs;
  }

  async load(
    workspaceFolder: WorkspaceFolderLike | undefined,
  ): Promise<PromptItem[] | undefined> {
    const { backupFile } = getPromptQueuePaths(
      workspaceFolder,
      this.storagePath,
    );

    try {
      const raw = await this.fileSystem.readFile(backupFile, 'utf8');
      return JSON.parse(raw) as PromptItem[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined;
      }

      throw error;
    }
  }

  async save(
    workspaceFolder: WorkspaceFolderLike | undefined,
    items: PromptItem[],
  ): Promise<void> {
    const { backupFile, backupTempFile, dataDir } = getPromptQueuePaths(
      workspaceFolder,
      this.storagePath,
    );
    const serialized = `${JSON.stringify(items, null, 2)}\n`;

    await this.fileSystem.mkdir(dataDir, { recursive: true });
    await this.fileSystem.writeFile(backupTempFile, serialized, 'utf8');
    await this.fileSystem.rename(backupTempFile, backupFile);
  }
}
