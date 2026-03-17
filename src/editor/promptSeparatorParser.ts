export interface PromptSeparatorParserOptions {
  maxFallbackTitleLength: number;
  untitledLabel: string;
}

export interface PromptSeparatorSection {
  displayTitle: string;
  endLine: number;
  separatorLineText: string;
  startLine: number;
}

export function parsePromptSeparatorSections(
  text: string,
  options: PromptSeparatorParserOptions,
): PromptSeparatorSection[] {
  const lines = text.split(/\r?\n/);
  const sections: PromptSeparatorSection[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';

    if (!line.startsWith('-*-')) {
      continue;
    }

    const rawTitle = line.slice(3).trim();
    const endLine = findSectionEndLine(lines, index);
    const displayTitle =
      rawTitle.length > 0
        ? rawTitle
        : buildFallbackTitle(lines, index, endLine, options);

    sections.push({
      displayTitle,
      endLine,
      separatorLineText: line,
      startLine: index,
    });
  }

  return sections;
}

function findSectionEndLine(lines: string[], startLine: number): number {
  for (let index = startLine + 1; index < lines.length; index += 1) {
    if ((lines[index] ?? '').startsWith('-*-')) {
      return index - 1;
    }
  }

  return Math.max(lines.length - 1, startLine);
}

function buildFallbackTitle(
  lines: string[],
  startLine: number,
  endLine: number,
  options: PromptSeparatorParserOptions,
): string {
  for (let index = startLine + 1; index <= endLine; index += 1) {
    const line = lines[index]?.trim() ?? '';

    if (line.length === 0) {
      continue;
    }

    return truncateTitle(line, options.maxFallbackTitleLength);
  }

  return options.untitledLabel;
}

function truncateTitle(title: string, maxLength: number): string {
  if (title.length <= maxLength) {
    return title;
  }

  if (maxLength <= 1) {
    return title.slice(0, Math.max(maxLength, 0));
  }

  return `${title.slice(0, maxLength - 1)}…`;
}
