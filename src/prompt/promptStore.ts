import * as fs from 'node:fs/promises';

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
  constructor(
    private readonly fileSystem: PromptStoreFileSystem = fs,
  ) {}

  async load(
    workspaceFolder: WorkspaceFolderLike | undefined,
  ): Promise<PromptItem[]> {
    const { dataFile } = getPromptQueuePaths(workspaceFolder);

    try {
      const raw = await this.fileSystem.readFile(dataFile, 'utf8');
      return JSON.parse(raw) as PromptItem[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }

      throw error;
    }
  }

  async save(
    workspaceFolder: WorkspaceFolderLike | undefined,
    items: PromptItem[],
  ): Promise<void> {
    const { dataDir, dataFile, tempFile } = getPromptQueuePaths(workspaceFolder);
    const serialized = `${JSON.stringify(items, null, 2)}\n`;

    await this.fileSystem.mkdir(dataDir, { recursive: true });
    await this.fileSystem.writeFile(tempFile, serialized, 'utf8');
    await this.fileSystem.rename(tempFile, dataFile);
  }
}
