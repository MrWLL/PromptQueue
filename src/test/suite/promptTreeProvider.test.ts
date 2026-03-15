import { describe, expect, it, vi } from 'vitest';

import {
  PROMPT_QUEUE_TREE_MIME,
  PromptTreeProvider,
} from '../../prompt/promptTreeProvider';
import type { PromptItem } from '../../prompt/promptTypes';

function createPromptItem(
  overrides: Partial<PromptItem> = {},
): PromptItem {
  return {
    id: overrides.id ?? 'prompt-1',
    title: overrides.title,
    content: overrides.content ?? 'Prompt body content',
    used: overrides.used ?? false,
    createdAt: overrides.createdAt ?? '2026-03-16T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-16T00:00:00.000Z',
  };
}

function createManagerStub(items: PromptItem[]) {
  return {
    getItems: vi.fn(() => structuredClone(items)),
    reorder: vi.fn(async () => undefined),
  };
}

function createDataTransferStub() {
  const values = new Map<string, { value: string; asString: () => Promise<string> }>();

  return {
    get: (key: string) => values.get(key),
    set: (key: string, item: { value: string; asString: () => Promise<string> }) => {
      values.set(key, item);
    },
  };
}

describe('PromptTreeProvider', () => {
  it('numbers items and prefers title over content preview', async () => {
    const provider = new PromptTreeProvider(
      createManagerStub([
        createPromptItem({ id: 'prompt-1', title: 'First title' }),
        createPromptItem({
          id: 'prompt-2',
          title: undefined,
          content: 'Second prompt content that is long enough to preview',
        }),
      ]),
    );

    const items = await provider.getChildren();

    expect(items.map((item) => item.label)).toEqual([
      '01. First title',
      '02. Second prompt content t',
    ]);
  });

  it('shows used and unused descriptions', async () => {
    const provider = new PromptTreeProvider(
      createManagerStub([
        createPromptItem({ id: 'prompt-1', used: false }),
        createPromptItem({ id: 'prompt-2', used: true }),
      ]),
    );

    const items = await provider.getChildren();

    expect(items.map((item) => item.description)).toEqual(['未使用', '已使用']);
  });

  it('includes the full content in the tooltip', async () => {
    const provider = new PromptTreeProvider(
      createManagerStub([
        createPromptItem({
          id: 'prompt-1',
          title: 'Tooltip title',
          content: 'Full tooltip content',
          used: true,
        }),
      ]),
    );

    const [item] = await provider.getChildren();

    expect(String(item.tooltip)).toContain('Tooltip title');
    expect(String(item.tooltip)).toContain('Full tooltip content');
    expect(String(item.tooltip)).toContain('已使用');
  });

  it('stores dragged item ids under the custom mime type', async () => {
    const provider = new PromptTreeProvider(
      createManagerStub([createPromptItem({ id: 'prompt-1' })]),
    );
    const [item] = await provider.getChildren();
    const dataTransfer = createDataTransferStub();

    await provider.handleDrag([item], dataTransfer as never);

    const transferItem = dataTransfer.get(PROMPT_QUEUE_TREE_MIME);

    expect(transferItem).toBeDefined();
    await expect(transferItem?.asString()).resolves.toBe('["prompt-1"]');
  });

  it('reorders the dragged item onto the drop target', async () => {
    const manager = createManagerStub([
      createPromptItem({ id: 'prompt-1' }),
      createPromptItem({ id: 'prompt-2' }),
    ]);
    const provider = new PromptTreeProvider(manager);
    const items = await provider.getChildren();
    const dataTransfer = {
      get: (_key: string) => ({
        asString: async () => '["prompt-1"]',
      }),
    };

    await provider.handleDrop(items[1], dataTransfer as never);

    expect(manager.reorder).toHaveBeenCalledWith('prompt-1', 'prompt-2');
  });
});
