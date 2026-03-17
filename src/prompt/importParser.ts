import type { ParsedImportItem } from './promptTypes';

function createParsedItem(
  title: string | undefined,
  lines: string[],
): ParsedImportItem | undefined {
  const content = lines.join('\n').trim();

  if (content.length === 0) {
    return undefined;
  }

  return {
    title,
    content,
  };
}

export function parseImportText(text: string): ParsedImportItem[] {
  const items: ParsedImportItem[] = [];
  const lines = text.split(/\r?\n/u);

  let currentTitle: string | undefined;
  let currentLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('-*-')) {
      const parsedItem = createParsedItem(currentTitle, currentLines);

      if (parsedItem) {
        items.push(parsedItem);
      }

      const nextTitle = trimmedLine.slice(3).trim();
      currentTitle = nextTitle.length > 0 ? nextTitle : undefined;
      currentLines = [];
      continue;
    }

    currentLines.push(line);
  }

  const finalItem = createParsedItem(currentTitle, currentLines);

  if (finalItem) {
    items.push(finalItem);
  }

  return items;
}
