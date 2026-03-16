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
        views?: Record<
          string,
          Array<{ id: string; name: string; type?: string }>
        >;
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
        type: 'webview',
      },
    ]);
    expect(manifest.contributes?.views?.explorer).toBeUndefined();
    expect(manifest.categories).toEqual(['Other']);

    expect(manifest.contributes?.menus?.['view/title']).toBeUndefined();
    expect(manifest.contributes?.menus?.['view/item/context']).toBeUndefined();
    expect(manifest.contributes?.configuration).toMatchObject({
      title: 'PromptQueue',
      properties: {
        'promptQueue.storagePath': {
          default: 'WorkSpace/PromptQueue',
          scope: 'resource',
          type: 'string',
        },
        'promptQueue.uiLanguage': {
          default: 'zh-CN',
          enum: ['zh-CN', 'en'],
          scope: 'resource',
          type: 'string',
        },
      },
    });
  });
});
