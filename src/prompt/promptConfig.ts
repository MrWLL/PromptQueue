import * as path from 'node:path';

import type { WorkspaceFolderLike } from './workspacePaths';

export const DEFAULT_PROMPT_QUEUE_STORAGE_PATH = path.join(
  'WorkSpace',
  'PromptQueue',
);

export const DEFAULT_PROMPT_QUEUE_UI_LANGUAGE = 'zh-CN' as const;
export const DEFAULT_PROMPT_QUEUE_SEPARATOR_HIGHLIGHT_ENABLED = true;
export const DEFAULT_PROMPT_QUEUE_SEPARATOR_OUTLINE_ENABLED = true;

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

export function normalizePromptQueueSeparatorHighlightEnabled(
  enabled: boolean | undefined,
): boolean {
  return enabled ?? DEFAULT_PROMPT_QUEUE_SEPARATOR_HIGHLIGHT_ENABLED;
}

export function normalizePromptQueueSeparatorOutlineEnabled(
  enabled: boolean | undefined,
): boolean {
  return enabled ?? DEFAULT_PROMPT_QUEUE_SEPARATOR_OUTLINE_ENABLED;
}
