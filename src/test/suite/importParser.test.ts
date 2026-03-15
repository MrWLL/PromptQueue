import { describe, expect, it } from 'vitest';

import { parseImportText } from '../../prompt/importParser';

describe('parseImportText', () => {
  it('splits items on a plain separator line', () => {
    const result = parseImportText('first prompt\n-*-\nsecond prompt');

    expect(result.map((item) => ({ title: item.title, content: item.content }))).toEqual([
      { title: undefined, content: 'first prompt' },
      { title: undefined, content: 'second prompt' },
    ]);
  });

  it('assigns a separator title to the next item', () => {
    const result = parseImportText('first prompt\n-*- Analysis\nsecond prompt');

    expect(result.map((item) => ({ title: item.title, content: item.content }))).toEqual([
      { title: undefined, content: 'first prompt' },
      { title: 'Analysis', content: 'second prompt' },
    ]);
  });

  it('treats a separator with only spaces after it as no title', () => {
    const result = parseImportText('first prompt\n-*-    \nsecond prompt');

    expect(result.map((item) => ({ title: item.title, content: item.content }))).toEqual([
      { title: undefined, content: 'first prompt' },
      { title: undefined, content: 'second prompt' },
    ]);
  });

  it('ignores empty blocks created by repeated separators', () => {
    const result = parseImportText('first prompt\n-*-\n-*-\nthird prompt');

    expect(result.map((item) => ({ title: item.title, content: item.content }))).toEqual([
      { title: undefined, content: 'first prompt' },
      { title: undefined, content: 'third prompt' },
    ]);
  });

  it('trims surrounding whitespace from each content block', () => {
    const result = parseImportText('\n  -*- Setup\n\n   body line 1\nbody line 2   \n\n');

    expect(result.map((item) => ({ title: item.title, content: item.content }))).toEqual([
      { title: 'Setup', content: 'body line 1\nbody line 2' },
    ]);
  });

  it('parses a single prompt without a separator as an untitled item', () => {
    const result = parseImportText('just one prompt body');

    expect(result.map((item) => ({ title: item.title, content: item.content }))).toEqual([
      { title: undefined, content: 'just one prompt body' },
    ]);
  });
});
