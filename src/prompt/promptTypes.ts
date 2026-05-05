export interface PromptItem {
  id: string;
  title?: string;
  content: string;
  used: boolean;
  createdAt: string;
  lastCopiedAt?: string;
  updatedAt: string;
}

export interface PromptDraft {
  title?: string;
  content: string;
}

export interface ParsedImportItem extends PromptDraft {}

export interface PromptCopySettings {
  includeTemplateOnClick: boolean;
  prefix: string;
  quickRunCommand: string;
  quickRunEnabled: boolean;
  suffix: string;
}

export type PromptUiLanguage = 'zh-CN' | 'en';
