import { describe, expect, it } from 'vitest';

import { PromptSeparatorOutlineProvider } from '../../editor/promptSeparatorOutlineProvider';

function createDocument(text: string) {
  return {
    getText: () => text,
    languageId: 'plaintext',
  };
}

describe('PromptSeparatorOutlineProvider', () => {
  it('returns one flat DocumentSymbol per parsed separator section', () => {
    const provider = new PromptSeparatorOutlineProvider({
      getEnabled: () => true,
      getUntitledLabel: () => '<无标题>',
    });

    const symbols = provider.provideDocumentSymbols(
      createDocument('-*- One\nBody\n-*-\n\nNext line') as never,
      {} as never,
    );

    expect(symbols?.map((symbol) => symbol.name)).toEqual([
      'One',
      'Next line',
    ]);
  });

  it('returns no symbols when the Outline setting is disabled', () => {
    const provider = new PromptSeparatorOutlineProvider({
      getEnabled: () => false,
      getUntitledLabel: () => '<无标题>',
    });

    expect(
      provider.provideDocumentSymbols(
        createDocument('-*- One\nBody') as never,
        {} as never,
      ),
    ).toEqual([]);
  });
});
