import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PROMPT_QUEUE_STORAGE_PATH,
  DEFAULT_PROMPT_QUEUE_UI_LANGUAGE,
  normalizePromptQueueUiLanguage,
  resolvePromptQueueStoragePath,
} from '../../prompt/promptConfig';
import type { WorkspaceFolderLike } from '../../prompt/workspacePaths';

function createWorkspaceFolder(rootPath: string): WorkspaceFolderLike {
  return {
    uri: {
      fsPath: rootPath,
    },
  };
}

describe('promptConfig', () => {
  it('resolves the default storage path under the workspace root', () => {
    const workspaceFolder = createWorkspaceFolder('/tmp/workspace');

    expect(resolvePromptQueueStoragePath(workspaceFolder)).toBe(
      path.join('/tmp/workspace', DEFAULT_PROMPT_QUEUE_STORAGE_PATH),
    );
  });

  it('keeps absolute storage paths unchanged', () => {
    const workspaceFolder = createWorkspaceFolder('/tmp/workspace');
    const absolutePath = path.join('/tmp', 'PromptQueueData');

    expect(
      resolvePromptQueueStoragePath(workspaceFolder, absolutePath),
    ).toBe(absolutePath);
  });

  it('normalizes unknown ui languages back to the default', () => {
    expect(normalizePromptQueueUiLanguage('unexpected')).toBe(
      DEFAULT_PROMPT_QUEUE_UI_LANGUAGE,
    );
  });
});
