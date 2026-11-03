(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.PromptQueueInputParser = api;
  }
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const MODEL_LEVEL_ALIASES = {
    low: new Set(['低', '低级', '低档', 'low', 'l', 'lite', 'mini', 'fast']),
    medium: new Set(['中', '中级', '中等', '中档', 'medium', 'mid', 'm', 'standard']),
    high: new Set(['高', '高级', '高档', 'high', 'h', 'pro', 'max', 'strong']),
  };

  function parseModelLevelFromTitle(title) {
    const bracketPattern = /\[([^\]]*)\]|【([^】]*)】/gu;
    let level;
    let match;

    while ((match = bracketPattern.exec(String(title || ''))) !== null) {
      const alias = String(match[1] === undefined ? match[2] : match[1])
        .trim()
        .toLowerCase();

      if (MODEL_LEVEL_ALIASES.low.has(alias)) {
        level = 'low';
      } else if (MODEL_LEVEL_ALIASES.medium.has(alias)) {
        level = 'medium';
      } else if (MODEL_LEVEL_ALIASES.high.has(alias)) {
        level = 'high';
      }
    }

    return level;
  }

  function withModelLevel(title, content) {
    const item = { title: title, content: content };
    const modelLevel = parseModelLevelFromTitle(title);

    if (modelLevel) {
      item.modelLevel = modelLevel;
    }

    return item;
  }

  function trimBlankLines(lines) {
    let start = 0;
    let end = lines.length;

    while (start < end && /^\s*$/u.test(lines[start])) {
      start += 1;
    }

    while (end > start && /^\s*$/u.test(lines[end - 1])) {
      end -= 1;
    }

    return lines.slice(start, end);
  }

  function getOpeningFence(line) {
    const match = String(line).trim().match(/^(`{3,})([^`]*)$/u);
    return match ? match[1] : undefined;
  }

  function findNextNonemptyLine(lines, startIndex) {
    for (let index = startIndex; index < lines.length; index += 1) {
      if (lines[index].trim().length > 0) {
        return index;
      }
    }

    return -1;
  }

  function findOpeningFence(lines, startIndex) {
    for (let index = startIndex; index < lines.length; index += 1) {
      const fence = getOpeningFence(lines[index]);

      if (fence) {
        return { fence: fence, index: index };
      }
    }

    return undefined;
  }

  function findNearestHeading(lines, startIndex, openingIndex) {
    for (let index = openingIndex - 1; index >= startIndex; index -= 1) {
      const line = lines[index].trim();

      if (line.startsWith('#')) {
        return line;
      }
    }

    return undefined;
  }

  function parseStructuredPromptText(text) {
    const normalized = String(text || '').replace(/\r\n?/gu, '\n');
    const lines = normalized.split('\n');
    const firstContentIndex = findNextNonemptyLine(lines, 0);

    if (firstContentIndex === -1 || lines[firstContentIndex].trim().startsWith('-*-')) {
      return undefined;
    }

    let opening = findOpeningFence(lines, firstContentIndex);

    if (!opening) {
      return undefined;
    }

    const items = [];
    let contextStart = firstContentIndex;

    while (opening) {
      const itemNumber = items.length + 1;
      const title = findNearestHeading(lines, contextStart, opening.index);

      let closingIndex = -1;

      for (let index = opening.index + 1; index < lines.length; index += 1) {
        if (lines[index].trim() === opening.fence) {
          closingIndex = index;
          break;
        }
      }

      if (closingIndex === -1) {
        throw new Error(`第 ${itemNumber} 条提示词未找到结束围栏。`);
      }

      const bodyLines = trimBlankLines(lines.slice(opening.index + 1, closingIndex));

      if (bodyLines.length === 0) {
        throw new Error(`第 ${itemNumber} 条提示词正文不能为空。`);
      }

      items.push(withModelLevel(title, bodyLines.join('\n')));
      contextStart = closingIndex + 1;
      opening = findOpeningFence(lines, contextStart);
    }

    return items;
  }

  function createLegacyItem(title, lines) {
    const content = lines.join('\n').trim();

    if (!content) {
      return undefined;
    }

    return withModelLevel(title, content);
  }

  function parseLegacyImportText(text) {
    const items = [];
    const lines = String(text || '').replace(/\r\n?/gu, '\n').split('\n');
    let currentTitle;
    let currentLines = [];

    lines.forEach(function (line) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('-*-')) {
        const parsedItem = createLegacyItem(currentTitle, currentLines);

        if (parsedItem) {
          items.push(parsedItem);
        }

        const nextTitle = trimmedLine.slice(3).trim();
        currentTitle = nextTitle.length > 0 ? nextTitle : undefined;
        currentLines = [];
        return;
      }

      currentLines.push(line);
    });

    const finalItem = createLegacyItem(currentTitle, currentLines);

    if (finalItem) {
      items.push(finalItem);
    }

    return items;
  }

  function parseImportText(text) {
    return parseStructuredPromptText(text) || parseLegacyImportText(text);
  }

  return {
    parseImportText: parseImportText,
    parseLegacyImportText: parseLegacyImportText,
    parseModelLevelFromTitle: parseModelLevelFromTitle,
    parseStructuredPromptText: parseStructuredPromptText,
  };
});
