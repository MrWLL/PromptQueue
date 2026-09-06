import type { PromptItem } from './promptTypes';

export class PromptDataFormatError extends Error {
  constructor(fileName: string, detail: string) {
    super(
      `PromptQueue data in ${fileName} is invalid: ${detail}. Fix the file, then reload the VS Code window.`,
    );
    this.name = 'PromptDataFormatError';
  }
}

export class PromptDataConflictError extends Error {
  constructor(fileName: string) {
    super(
      `PromptQueue data in ${fileName} changed in another VS Code window. Reload the window before trying again.`,
    );
    this.name = 'PromptDataConflictError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseJsonRecord(raw: string, fileName: string): Record<string, unknown> {
  const parsed = parseJson(raw, fileName);

  if (!isRecord(parsed)) {
    throw new PromptDataFormatError(fileName, 'expected a JSON object');
  }

  return parsed;
}

export function parsePromptItems(raw: string, fileName: string): PromptItem[] {
  const parsed = parseJson(raw, fileName);

  if (!Array.isArray(parsed)) {
    throw new PromptDataFormatError(fileName, 'expected a JSON array');
  }

  const seenIds = new Set<string>();

  return parsed.map((value, index) => {
    if (!isRecord(value)) {
      throw new PromptDataFormatError(fileName, `item ${index + 1} is not an object`);
    }

    const id = value.id;
    const content = value.content;
    const used = value.used;
    const createdAt = value.createdAt;
    const updatedAt = value.updatedAt;

    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new PromptDataFormatError(fileName, `item ${index + 1} has no valid id`);
    }

    if (seenIds.has(id)) {
      throw new PromptDataFormatError(fileName, `item ${index + 1} duplicates id ${id}`);
    }

    if (
      typeof content !== 'string' ||
      typeof used !== 'boolean' ||
      typeof createdAt !== 'string' ||
      typeof updatedAt !== 'string'
    ) {
      throw new PromptDataFormatError(fileName, `item ${index + 1} has invalid fields`);
    }

    if (
      (typeof value.activeTask !== 'undefined' &&
        typeof value.activeTask !== 'boolean') ||
      (typeof value.lastCopiedAt !== 'undefined' &&
        typeof value.lastCopiedAt !== 'string') ||
      (typeof value.title !== 'undefined' && typeof value.title !== 'string')
    ) {
      throw new PromptDataFormatError(fileName, `item ${index + 1} has invalid fields`);
    }

    seenIds.add(id);

    return {
      activeTask: value.activeTask as boolean | undefined,
      content,
      createdAt,
      id,
      lastCopiedAt: value.lastCopiedAt as string | undefined,
      title: value.title as string | undefined,
      updatedAt,
      used,
    };
  });
}

function parseJson(raw: string, fileName: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new PromptDataFormatError(fileName, 'invalid JSON');
  }
}
