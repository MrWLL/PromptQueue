import * as fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

import {
  PromptDataConflictError,
  parsePromptItems,
} from './promptDataValidation';
import type { PromptItem } from './promptTypes';
import {
  getPromptQueuePaths,
  type WorkspaceFolderLike,
} from './workspacePaths';

export interface PromptStoreFileSystem {
  mkdir: typeof fs.mkdir;
  readFile: typeof fs.readFile;
  rename: typeof fs.rename;
  writeFile: typeof fs.writeFile;
}

export class PromptStore {
  private expectedDataFileContent: string | undefined;
  private hasLoaded = false;
  private readonly fileSystem: PromptStoreFileSystem;
  private readonly storagePath: string | undefined;

  constructor(
    storagePathOrFileSystem?: string | PromptStoreFileSystem,
    fileSystem: PromptStoreFileSystem = fs,
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
  ): Promise<PromptItem[]> {
    const { dataFile } = getPromptQueuePaths(workspaceFolder, this.storagePath);

    try {
      const raw = await this.fileSystem.readFile(dataFile, 'utf8');
      const items = parsePromptItems(raw, dataFile);

      this.expectedDataFileContent = raw;
      this.hasLoaded = true;
      return items;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.expectedDataFileContent = undefined;
        this.hasLoaded = true;
        return [];
      }

      throw error;
    }
  }

  async save(
    workspaceFolder: WorkspaceFolderLike | undefined,
    items: PromptItem[],
  ): Promise<void> {
    const { dataDir, dataFile } = getPromptQueuePaths(
      workspaceFolder,
      this.storagePath,
    );
    const serialized = `${JSON.stringify(items, null, 2)}\n`;
    const tempFile = `${dataFile}.${randomUUID()}.tmp`;

    if (this.hasLoaded) {
      const currentContent = await this.readCurrentDataFile(dataFile);

      if (currentContent !== this.expectedDataFileContent) {
        throw new PromptDataConflictError(dataFile);
      }
    }

    await this.fileSystem.mkdir(dataDir, { recursive: true });
    await this.fileSystem.writeFile(tempFile, serialized, 'utf8');
    await this.fileSystem.rename(tempFile, dataFile);
    this.expectedDataFileContent = serialized;
    this.hasLoaded = true;
  }

  private async readCurrentDataFile(filePath: string): Promise<string | undefined> {
    try {
      return await this.fileSystem.readFile(filePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined;
      }

      throw error;
    }
  }
}
