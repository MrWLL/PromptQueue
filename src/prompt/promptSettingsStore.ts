import * as fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

import {
  PromptDataConflictError,
  parseJsonRecord,
} from './promptDataValidation';
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
  copyMode: 'direct',
  includeTemplateOnClick: true,
  prefix: '',
  quickRunCommand: '/new',
  quickRunEnabled: false,
  suffix: '',
};

export class PromptSettingsStore {
  private expectedSettingsFileContent: string | undefined;
  private hasLoaded = false;
  private readonly fileSystem: PromptSettingsStoreFileSystem;
  private readonly storagePath: string | undefined;

  constructor(
    storagePathOrFileSystem?: string | PromptSettingsStoreFileSystem,
    fileSystem: PromptSettingsStoreFileSystem = fs,
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
  ): Promise<PromptCopySettings> {
    const { settingsFile } = getPromptQueuePaths(
      workspaceFolder,
      this.storagePath,
    );

    try {
      const raw = await this.fileSystem.readFile(settingsFile, 'utf8');
      const parsed = parseJsonRecord(raw, settingsFile) as Partial<PromptCopySettings>;

      this.expectedSettingsFileContent = raw;
      this.hasLoaded = true;

      return {
        copyMode:
          parsed.copyMode === 'indirect-file' ? 'indirect-file' : 'direct',
        includeTemplateOnClick:
          typeof parsed.includeTemplateOnClick === 'boolean'
            ? parsed.includeTemplateOnClick
            : true,
        prefix: typeof parsed.prefix === 'string' ? parsed.prefix : '',
        quickRunCommand:
          typeof parsed.quickRunCommand === 'string' &&
          parsed.quickRunCommand.trim().length > 0
            ? parsed.quickRunCommand.replace(/\r\n/g, '\n')
            : '/new',
        quickRunEnabled:
          typeof parsed.quickRunEnabled === 'boolean'
            ? parsed.quickRunEnabled
            : false,
        suffix: typeof parsed.suffix === 'string' ? parsed.suffix : '',
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.expectedSettingsFileContent = undefined;
        this.hasLoaded = true;
        return structuredClone(EMPTY_SETTINGS);
      }

      throw error;
    }
  }

  async save(
    workspaceFolder: WorkspaceFolderLike | undefined,
    settings: PromptCopySettings,
  ): Promise<void> {
    const { dataDir, settingsFile } = getPromptQueuePaths(
      workspaceFolder,
      this.storagePath,
    );
    const serialized = `${JSON.stringify(settings, null, 2)}\n`;
    const settingsTempFile = `${settingsFile}.${randomUUID()}.tmp`;

    if (this.hasLoaded) {
      const currentContent = await this.readCurrentSettingsFile(settingsFile);

      if (currentContent !== this.expectedSettingsFileContent) {
        throw new PromptDataConflictError(settingsFile);
      }
    }

    await this.fileSystem.mkdir(dataDir, { recursive: true });
    await this.fileSystem.writeFile(settingsTempFile, serialized, 'utf8');
    await this.fileSystem.rename(settingsTempFile, settingsFile);
    this.expectedSettingsFileContent = serialized;
    this.hasLoaded = true;
  }

  private async readCurrentSettingsFile(
    filePath: string,
  ): Promise<string | undefined> {
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
