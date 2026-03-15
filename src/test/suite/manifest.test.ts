import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('extension manifest', () => {
  it('registers PromptQueue as an activity bar container', async () => {
    const manifestPath = path.resolve(__dirname, '../../../package.json');
    const raw = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(raw) as {
      contributes?: {
        views?: Record<string, Array<{ id: string; name: string }>>;
        viewsContainers?: {
          activitybar?: Array<{ id: string; title: string; icon: string }>;
        };
      };
    };

    expect(manifest.contributes?.viewsContainers?.activitybar).toEqual([
      {
        id: 'promptQueue',
        title: '提示词队列',
        icon: 'media/promptqueue.svg',
      },
    ]);
    expect(manifest.contributes?.views?.promptQueue).toEqual([
      {
        id: 'promptQueue.sidebar',
        name: '提示词队列',
      },
    ]);
    expect(manifest.contributes?.views?.explorer).toBeUndefined();
  });
});
