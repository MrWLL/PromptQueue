import { describe, expect, it } from 'vitest';

import {
  buildPromptEditorText,
  parsePromptEditorText,
} from '../../prompt/promptEditor';

describe('prompt editor draft parsing', () => {
  it('treats an empty Title field as undefined', () => {
    const draft = parsePromptEditorText('Title: \n\n---\nPrompt body');

    expect(draft).toEqual({
      title: undefined,
      content: 'Prompt body',
    });
  });

  it('preserves multiline content below the separator', () => {
    const draft = parsePromptEditorText(
      'Title: Remote work\n\n---\nline 1\nline 2\nline 3',
    );

    expect(draft).toEqual({
      title: 'Remote work',
      content: 'line 1\nline 2\nline 3',
    });
  });

  it('accepts CRLF line endings from Windows editors', () => {
    const draft = parsePromptEditorText(
      'Title: Remote work\r\n\r\n---\r\nline 1\r\nline 2',
    );

    expect(draft).toEqual({
      title: 'Remote work',
      content: 'line 1\nline 2',
    });
  });

  it('rejects empty content', () => {
    expect(() => parsePromptEditorText('Title: Empty\n\n---\n\n  \n')).toThrow(
      'Prompt content is required.',
    );
  });

  it('builds the editor template from an existing draft', () => {
    expect(
      buildPromptEditorText({
        title: 'Loaded title',
        content: 'Loaded content',
      }),
    ).toBe('Title: Loaded title\n\n---\nLoaded content');
  });
});
