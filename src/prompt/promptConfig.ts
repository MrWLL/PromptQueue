import * as path from 'node:path';

import type { WorkspaceFolderLike } from './workspacePaths';

export const DEFAULT_PROMPT_QUEUE_STORAGE_PATH = path.join(
  'WorkSpace',
  'PromptQueue',
);

export const DEFAULT_PROMPT_QUEUE_UI_LANGUAGE = 'zh-CN' as const;

export type PromptQueueUiLanguage =
  | typeof DEFAULT_PROMPT_QUEUE_UI_LANGUAGE
  | 'en';

export function normalizePromptQueueStoragePath(
  storagePath: string | undefined,
): string {
  const normalized = storagePath?.trim();

  return normalized && normalized.length > 0
    ? normalized
    : DEFAULT_PROMPT_QUEUE_STORAGE_PATH;
}

export function resolvePromptQueueStoragePath(
  workspaceFolder: WorkspaceFolderLike | undefined,
  storagePath?: string,
): string {
  const normalizedStoragePath = normalizePromptQueueStoragePath(storagePath);

  if (path.isAbsolute(normalizedStoragePath)) {
    return path.normalize(normalizedStoragePath);
  }

  const rootDir = workspaceFolder?.uri.fsPath ?? '';

  return path.join(rootDir, normalizedStoragePath);
}

export function normalizePromptQueueUiLanguage(
  uiLanguage: string | undefined,
): PromptQueueUiLanguage {
  return uiLanguage === 'en'
    ? 'en'
    : DEFAULT_PROMPT_QUEUE_UI_LANGUAGE;
}
