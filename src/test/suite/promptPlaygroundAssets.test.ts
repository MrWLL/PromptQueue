import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

async function readRepoFile(relativePath: string): Promise<string> {
  return fs.readFile(path.resolve(__dirname, '../../../', relativePath), 'utf8');
}

describe('PromptQueue playground assets', () => {
  it('provides a standalone playground html that loads the current webview assets', async () => {
    const html = await readRepoFile('playground/promptqueue-playground.html');

    expect(html).toContain('id="promptqueue-app"');
    expect(html).toContain('../media/promptqueue-view.css');
    expect(html).toContain('../media/promptqueue-view.js');
    expect(html).toContain('playground-clipboard');
  });

  it('provides a mock vscode host that responds to webview messages', async () => {
    const script = await readRepoFile('playground/promptqueue-playground.js');

    expect(script).toContain('window.acquireVsCodeApi');
    expect(script).toContain("type: 'panelCommand'");
    expect(script).toContain("type: 'state'");
    expect(script).toContain('createSeedItems(36)');
  });

  it('applies reorder messages by targetIndex in the playground host', async () => {
    const script = await readRepoFile('playground/promptqueue-playground.js');

    expect(script).toContain("if (message.type === 'reorderPrompts') {");
    expect(script).toContain('const targetIndex = Number(message.targetIndex);');
    expect(script).not.toContain('message.targetId');
    expect(script).toContain('state.items.splice(targetIndex, 0, moved);');
  });
});
