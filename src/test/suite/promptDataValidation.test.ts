import { describe, expect, it } from 'vitest';

import { parseJsonRecord, parsePromptItems } from '../../prompt/promptDataValidation';

describe('Windows UTF-8 JSON files', () => {
  it('loads settings with a UTF-8 byte-order mark', () => {
    expect(parseJsonRecord('\uFEFF{"prefix":"Keep"}', 'settings.json')).toEqual({ prefix: 'Keep' });
  });

  it('loads prompt and backup data with a UTF-8 byte-order mark', () => {
    expect(parsePromptItems('\uFEFF[]', 'prompts.json')).toEqual([]);
    expect(parsePromptItems('\uFEFF[]', 'last-deleted.json')).toEqual([]);
  });
});
