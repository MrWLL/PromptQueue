import { describe, expect, it, vi } from 'vitest';

import { PromptSeparatorHighlighter } from '../../editor/promptSeparatorHighlighter';

function createTextEditor(text: string, languageId = 'plaintext') {
  return {
    document: {
      getText: () => text,
      languageId,
    },
    setDecorations: vi.fn(),
  };
}

describe('PromptSeparatorHighlighter', () => {
  it('uses a strong yellow whole-line highlight style for separator rows', () => {
    const editor = createTextEditor('-*- One\nBody');
    const highlighter = new PromptSeparatorHighlighter({
      getEnabled: () => true,
    });

    highlighter.refreshVisibleEditors([editor] as never);

    const decorationType = editor.setDecorations.mock.calls[0]?.[0] as {
      options?: Record<string, unknown>;
    };

    expect(decorationType.options).toMatchObject({
      backgroundColor: 'rgba(255, 221, 87, 0.45)',
      borderColor: 'rgba(214, 158, 46, 0.95)',
      borderStyle: 'solid',
      borderWidth: '0 0 0 2px',
      isWholeLine: true,
    });
  });

  it('decorates only separator lines in visible editors when highlighting is enabled', () => {
    const editor = createTextEditor('-*- One\nBody\n-*- Two\nMore');
    const highlighter = new PromptSeparatorHighlighter({
      getEnabled: () => true,
    });

    highlighter.refreshVisibleEditors([editor] as never);

    expect(editor.setDecorations).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([
        expect.objectContaining({
          range: expect.objectContaining({
            start: expect.objectContaining({ line: 0 }),
          }),
        }),
        expect.objectContaining({
          range: expect.objectContaining({
            start: expect.objectContaining({ line: 2 }),
          }),
        }),
      ]),
    );
  });

  it('clears decorations when highlighting is disabled', () => {
    const editor = createTextEditor('-*- One\nBody');
    const highlighter = new PromptSeparatorHighlighter({
      getEnabled: () => false,
    });

    highlighter.refreshVisibleEditors([editor] as never);

    expect(editor.setDecorations).toHaveBeenCalledWith(expect.anything(), []);
  });
});
