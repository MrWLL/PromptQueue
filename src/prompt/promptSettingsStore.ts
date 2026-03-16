import * as fs from 'node:fs/promises';

import type { PromptCopySettings } from './promptTypes';
import {
  getPromptQueuePaths,
  type WorkspaceFolderLike,
} from './workspacePaths';

export interface PromptSettingsStoreFileSystem {
  mkdir: typeof fs.mkdir;
  readFile: typeof fs.readFile;
  rename: typeof fs.rename;
  writeFile: typeof fs.writeFile;
}

const EMPTY_SETTINGS: PromptCopySettings = {
  prefix: '',
  suffix: '',
};

export class PromptSettingsStore {
  constructor(
    private readonly fileSystem: PromptSettingsStoreFileSystem = fs,
  ) {}

  async load(
    workspaceFolder: WorkspaceFolderLike | undefined,
  ): Promise<PromptCopySettings> {
    const { settingsFile } = getPromptQueuePaths(workspaceFolder);

    try {
      const raw = await this.fileSystem.readFile(settingsFile, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PromptCopySettings>;

      return {
        prefix: typeof parsed.prefix === 'string' ? parsed.prefix : '',
        suffix: typeof parsed.suffix === 'string' ? parsed.suffix : '',
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return structuredClone(EMPTY_SETTINGS);
      }

      throw error;
    }
  }

  async save(
    workspaceFolder: WorkspaceFolderLike | undefined,
    settings: PromptCopySettings,
  ): Promise<void> {
    const { dataDir, settingsFile, settingsTempFile } = getPromptQueuePaths(
      workspaceFolder,
    );
    const serialized = `${JSON.stringify(settings, null, 2)}\n`;

    await this.fileSystem.mkdir(dataDir, { recursive: true });
    await this.fileSystem.writeFile(settingsTempFile, serialized, 'utf8');
    await this.fileSystem.rename(settingsTempFile, settingsFile);
  }
}
