import { describe, expect, it } from 'vitest';

import { parsePromptSeparatorSections } from '../../editor/promptSeparatorParser';

describe('promptSeparatorParser', () => {
  it('parses explicit separator titles with and without a space', () => {
    const sections = parsePromptSeparatorSections('-*-One\nA\n-*- Two\nB', {
      untitledLabel: '<无标题>',
      maxFallbackTitleLength: 24,
    });

    expect(sections.map((section) => section.displayTitle)).toEqual([
      'One',
      'Two',
    ]);
  });

  it('uses the next non-empty line as the fallback title when the separator has no title', () => {
    const sections = parsePromptSeparatorSections('-*-\n\n正文第一行\n正文第二行', {
      untitledLabel: '<无标题>',
      maxFallbackTitleLength: 24,
    });

    expect(sections[0]?.displayTitle).toBe('正文第一行');
  });

  it('falls back to the untitled label when no content exists before the next separator or file end', () => {
    const sections = parsePromptSeparatorSections('-*-\n\n-*-Next\nBody', {
      untitledLabel: '<无标题>',
      maxFallbackTitleLength: 24,
    });

    expect(sections[0]?.displayTitle).toBe('<无标题>');
  });

  it('returns section line ranges that stop before the next separator', () => {
    const sections = parsePromptSeparatorSections('-*- First\nA\nB\n-*- Second\nC', {
      untitledLabel: '<无标题>',
      maxFallbackTitleLength: 24,
    });

    expect(sections.map(({ startLine, endLine }) => [startLine, endLine])).toEqual([
      [0, 2],
      [3, 4],
    ]);
  });
});
