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
      '# 标题行[低]',
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
      title: '# 标题行[低]',
      modelLevel: 'low',
      content: '  第一行\n\n第二行  ',
    }]);
  });

  it('parses consecutive fenced prompts without legacy separators', () => {
    const result = parseImportText([
      '# 第一条【中等】',
      '```',
      '正文一',
      '```',
      '',
      '# 第二条 [PRO]',
      '这里也会被忽略',
      '```md',
      '正文二',
      '```',
    ].join('\n'));

    expect(result).toEqual([
      { title: '# 第一条【中等】', modelLevel: 'medium', content: '正文一' },
      { title: '# 第二条 [PRO]', modelLevel: 'high', content: '正文二' },
    ]);
  });

  it('uses the nearest heading before the fence in the reported example and discards surrounding prose', () => {
    const result = parseImportText([
      '```',
      '上一个提示词',
      '```',
      '# 按发布会原则主动强化论文',
      '',
      '下面一组和全面校核那一组方向相反。校核那组是找错并清除问题，这组是主动进攻：先把这篇论文真正值得发表的价值找出来，判断主线是不是押在它上面，再围绕它重新组织标题、摘要、引言、结果编排和结论。',
      '',
      '## 1_诊断优势并生成叙事强化方案【高】',
      '',
      '第一段只出方案不动正文，把“只强化表达”“换比赛项目”“重构故事”几种做法的代价和风险摊开给你选；你选定后再进第二段改正文，第三段验收“是不是真的变强了”和“有没有在改写中动了不该动的东西”。',
      '',
      '建议先跑这组再跑校核组，两组不能互相替代：这组的第三段只验收本次改写本身，全稿的逐句普查仍然要交给校核组。',
      '',
      '```',
      '本条提示词',
      '```',
    ].join('\n'));

    expect(result).toEqual([
      { title: undefined, content: '上一个提示词' },
      { title: '## 1_诊断优势并生成叙事强化方案【高】', modelLevel: 'high', content: '本条提示词' },
    ]);
  });

  it.each([1, 2, 3, 6, 7, 12])('chooses the nearest heading with %i hash marks regardless of heading depth', (depth) => {
    const title = `${'#'.repeat(depth)} 最近的标题【中】`;
    const result = parseImportText([
      '开场说明',
      '### 更早的标题【高】',
      '中间的解释',
      `  ${title}  `,
      '说明里的 # 只是行内字符，不是标题',
      '',
      '更多说明',
      '```text',
      '  正文缩进',
      '',
      '结尾空格  ',
      '```',
    ].join('\r\n'));

    expect(result).toEqual([{
      title,
      modelLevel: 'medium',
      content: '  正文缩进\n\n结尾空格  ',
    }]);
  });

  it('ignores prose between blocks and trailing notes while keeping each heading local to its own body', () => {
    const result = parseImportText([
      '# 第一条【低】',
      '```',
      '# 这行属于正文【高】',
      '正文一',
      '```',
      '说明，不是标题',
      '## 第二条【中】',
      '更多说明',
      '```',
      '正文二',
      '```',
      '结尾说明',
      '# 后记，不对应任何正文',
    ].join('\n'));

    expect(result).toEqual([
      { title: '# 第一条【低】', modelLevel: 'low', content: '# 这行属于正文【高】\n正文一' },
      { title: '## 第二条【中】', modelLevel: 'medium', content: '正文二' },
    ]);
  });

  it('allows inner triple-backtick lines when the outer fence has four backticks', () => {
    const result = parseImportText([
      '# 代码示例[max]',
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

  it('ignores a dangling heading but rejects an empty fenced body', () => {
    expect(parseImportText('# 标题\n```\n正文\n```\n# 悬空标题')).toEqual([
      { title: '# 标题', content: '正文' },
    ]);
    expect(() => parseImportText('标题\n```\n \n```')).toThrow(
      '第 1 条提示词正文不能为空。',
    );
  });

  it('imports a standalone fenced body as untitled', () => {
    expect(parseStructuredPromptText('```\nplain code\n```')).toEqual([{
      title: undefined,
      content: 'plain code',
    }]);
    expect(parseImportText('```\nplain code\n```')).toEqual([{
      title: undefined,
      content: 'plain code',
    }]);
  });

  it('does not borrow earlier headings, body headings, or model levels for a block without a heading', () => {
    expect(parseImportText([
      '# 第一条【高】',
      '```',
      '# 正文中的标题【中】',
      '```',
      '普通文字【低】',
      '说明里的 # 不是行首标题',
      '```',
      '无标题正文',
      '```',
      '```',
      '另一段无标题正文',
      '```',
    ].join('\n'))).toEqual([
      { title: '# 第一条【高】', modelLevel: 'high', content: '# 正文中的标题【中】' },
      { title: undefined, content: '无标题正文' },
      { title: undefined, content: '另一段无标题正文' },
    ]);
  });

  it('falls back to legacy parsing when there is no opening fence', () => {
    expect(parseStructuredPromptText('# 普通 Markdown\n正文')).toBeUndefined();
    expect(parseImportText('# 普通 Markdown\n正文')).toEqual([{
      title: undefined,
      content: '# 普通 Markdown\n正文',
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
