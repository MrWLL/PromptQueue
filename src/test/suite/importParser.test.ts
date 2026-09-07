import { describe, expect, it } from 'vitest';

import {
  parseImportText,
  parseModelLevelFromTitle,
  parseStructuredPromptText,
} from '../../prompt/importParser';

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

  it('accepts a separator title without a space after -*-', () => {
    const result = parseImportText('first prompt\n-*-new\nsecond prompt');

    expect(result.map((item) => ({ title: item.title, content: item.content }))).toEqual([
      { title: undefined, content: 'first prompt' },
      { title: 'new', content: 'second prompt' },
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

  it('parses a fenced prompt while preserving its complete title and body indentation', () => {
    const result = parseImportText([
      '标题行[低]',
      '',
      '这行说明应被忽略',
      '```text',
      '',
      '  第一行',
      '',
      '第二行  ',
      '',
      '```',
    ].join('\n'));

    expect(result).toEqual([{
      title: '标题行[低]',
      modelLevel: 'low',
      content: '  第一行\n\n第二行  ',
    }]);
  });

  it('parses consecutive fenced prompts without legacy separators', () => {
    const result = parseImportText([
      '第一条【中等】',
      '```',
      '正文一',
      '```',
      '',
      '第二条 [PRO]',
      '这里也会被忽略',
      '```md',
      '正文二',
      '```',
    ].join('\n'));

    expect(result).toEqual([
      { title: '第一条【中等】', modelLevel: 'medium', content: '正文一' },
      { title: '第二条 [PRO]', modelLevel: 'high', content: '正文二' },
    ]);
  });

  it('allows inner triple-backtick lines when the outer fence has four backticks', () => {
    const result = parseImportText([
      '代码示例[max]',
      '````markdown',
      '```ts',
      'const value = 1;',
      '```',
      '````',
    ].join('\n'));

    expect(result[0].content).toBe('```ts\nconst value = 1;\n```');
    expect(result[0].modelLevel).toBe('high');
  });

  it('requires an exact, language-free closing fence', () => {
    expect(() => parseImportText('标题\n```md\n正文\n```md')).toThrow(
      '第 1 条提示词未找到结束围栏。',
    );
  });

  it('fails the entire structured batch when an item has no closing fence', () => {
    const input = [
      '第一条[低]',
      '```',
      '正文一',
      '```',
      '第二条[高]',
      '```',
      '正文二',
    ].join('\n');

    expect(() => parseImportText(input)).toThrow('第 2 条提示词未找到结束围栏。');
  });

  it('rejects a dangling title and an empty fenced body', () => {
    expect(() => parseImportText('标题\n```\n正文\n```\n悬空标题')).toThrow(
      '第 2 条提示词缺少正文围栏。',
    );
    expect(() => parseImportText('标题\n```\n \n```')).toThrow(
      '第 1 条提示词正文不能为空。',
    );
  });

  it('falls back to legacy parsing when no valid title-plus-opening-fence exists', () => {
    expect(parseStructuredPromptText('```\nplain code\n```')).toBeUndefined();
    expect(parseImportText('```\nplain code\n```')).toEqual([{
      title: undefined,
      content: '```\nplain code\n```',
    }]);
  });
});

describe('parseModelLevelFromTitle', () => {
  it.each([
    ['低', 'low'], ['低级', 'low'], ['低档', 'low'], ['LOW', 'low'],
    ['l', 'low'], ['lite', 'low'], ['mini', 'low'], ['fast', 'low'],
    ['中', 'medium'], ['中级', 'medium'], ['中等', 'medium'], ['中档', 'medium'],
    ['MEDIUM', 'medium'], ['mid', 'medium'], ['m', 'medium'], ['standard', 'medium'],
    ['高', 'high'], ['高级', 'high'], ['高档', 'high'], ['HIGH', 'high'],
    ['h', 'high'], ['pro', 'high'], ['max', 'high'], ['strong', 'high'],
  ])('recognizes model-level alias %s', (alias, expected) => {
    expect(parseModelLevelFromTitle(`标题[ ${alias} ]`)).toBe(expected);
  });

  it('uses the rightmost recognized tag across ASCII and full-width brackets', () => {
    expect(parseModelLevelFromTitle('标题[low]【未知】[中][HIGH]')).toBe('high');
  });

  it('requires the complete bracket content to match an alias', () => {
    expect(parseModelLevelFromTitle('标题[高模型][low cost]')).toBeUndefined();
  });
});
