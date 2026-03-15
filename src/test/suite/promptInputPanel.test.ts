import { describe, expect, it } from 'vitest';

import {
  formatPromptInputText,
  parseSinglePromptInputText,
} from '../../prompt/promptInputPanel';

describe('prompt input text formatting', () => {
  it('parses a single untitled prompt without a separator', () => {
    expect(parseSinglePromptInputText('提示词正文')).toEqual({
      title: undefined,
      content: '提示词正文',
    });
  });

  it('parses a titled prompt that starts with a separator line', () => {
    expect(parseSinglePromptInputText('-*- 需求分析\n第一行\n第二行')).toEqual({
      title: '需求分析',
      content: '第一行\n第二行',
    });
  });

  it('treats a separator with only spaces as no title', () => {
    expect(parseSinglePromptInputText('-*-   \n没有标题')).toEqual({
      title: undefined,
      content: '没有标题',
    });
  });

  it('accepts CRLF line endings from Windows input', () => {
    expect(parseSinglePromptInputText('-*- 标题\r\n正文第一行\r\n正文第二行')).toEqual({
      title: '标题',
      content: '正文第一行\n正文第二行',
    });
  });

  it('rejects empty content', () => {
    expect(() => parseSinglePromptInputText('   \n  ')).toThrow('请输入提示词内容。');
  });

  it('rejects multiple prompts in the single-item panel', () => {
    expect(() => parseSinglePromptInputText('第一条\n-*- 第二条\n第二条正文')).toThrow(
      '新增或编辑时一次只能保存一条提示词。',
    );
  });

  it('formats a titled prompt back into the input syntax', () => {
    expect(
      formatPromptInputText({
        title: '远程调试',
        content: '这里是正文',
      }),
    ).toBe('-*- 远程调试\n这里是正文');
  });

  it('formats an untitled prompt without adding a separator', () => {
    expect(
      formatPromptInputText({
        title: undefined,
        content: '只有正文',
      }),
    ).toBe('只有正文');
  });
});
