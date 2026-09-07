import type { ParsedImportItem, PromptModelLevel } from './promptTypes';

interface SharedInputParser {
  parseImportText(text: string): ParsedImportItem[];
  parseLegacyImportText(text: string): ParsedImportItem[];
  parseModelLevelFromTitle(title: string): PromptModelLevel | undefined;
  parseStructuredPromptText(text: string): ParsedImportItem[] | undefined;
}

// The sidebar loads this browser-safe parser directly so every input path uses
// exactly the same fence and model-level rules.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharedParser = require('../../media/promptqueue-input-parser.js') as SharedInputParser;

export const parseImportText = sharedParser.parseImportText;
export const parseLegacyImportText = sharedParser.parseLegacyImportText;
export const parseModelLevelFromTitle = sharedParser.parseModelLevelFromTitle;
export const parseStructuredPromptText = sharedParser.parseStructuredPromptText;
