import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('extension manifest', () => {
  it('registers PromptQueue as an activity bar container', async () => {
    const manifestPath = path.resolve(__dirname, '../../../package.json');
    const raw = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(raw) as {
      contributes?: {
        commands?: Array<{ command: string; title: string }>;
        menus?: Record<
          string,
          Array<{ command: string; group?: string; when?: string }>
        >;
        views?: Record<string, Array<{ id: string; name: string }>>;
        viewsContainers?: {
          activitybar?: Array<{ id: string; title: string; icon: string }>;
        };
      };
    };

    expect(manifest.contributes?.viewsContainers?.activitybar).toEqual([
      {
        id: 'promptQueue',
        title: '队列',
        icon: 'media/promptqueue.svg',
      },
    ]);
    expect(manifest.contributes?.views?.promptQueue).toEqual([
      {
        id: 'promptQueue.sidebar',
        name: '队列',
      },
    ]);
    expect(manifest.contributes?.views?.explorer).toBeUndefined();

    const commandTitles = new Map(
      (manifest.contributes?.commands ?? []).map((item) => [
        item.command,
        item.title,
      ]),
    );

    expect(commandTitles.get('promptQueue.addItem')).toBe('新增');
    expect(commandTitles.get('promptQueue.bulkImport')).toBe('批量导入');
    expect(commandTitles.get('promptQueue.deleteAllItems')).toBe('全部删除');

    const titleMenuCommands = (
      manifest.contributes?.menus?.['view/title'] ?? []
    ).map((item) => item.command);
    expect(titleMenuCommands).toContain('promptQueue.addItem');
    expect(titleMenuCommands).toContain('promptQueue.bulkImport');
    expect(titleMenuCommands).toContain('promptQueue.deleteAllItems');

    const itemMenuCommands = (
      manifest.contributes?.menus?.['view/item/context'] ?? []
    ).map((item) => ({ command: item.command, group: item.group }));

    expect(itemMenuCommands).toContainEqual({
      command: 'promptQueue.editItem',
      group: 'navigation',
    });
    expect(itemMenuCommands).toContainEqual({
      command: 'promptQueue.deleteItem',
      group: 'navigation',
    });
    expect(itemMenuCommands).not.toContainEqual({
      command: 'promptQueue.editItem',
      group: 'inline',
    });
    expect(itemMenuCommands).not.toContainEqual({
      command: 'promptQueue.deleteItem',
      group: 'inline',
    });
  });
});
