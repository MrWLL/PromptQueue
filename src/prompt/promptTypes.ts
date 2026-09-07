export interface PromptItem {
  activeTask?: boolean;
  id: string;
  title?: string;
  modelLevel?: PromptModelLevel;
  content: string;
  used: boolean;
  createdAt: string;
  lastCopiedAt?: string;
  updatedAt: string;
}

export interface PromptDraft {
  title?: string;
  modelLevel?: PromptModelLevel | null;
  content: string;
}

/**
 * The editable fields sent when a sort or modify session is completed.
 * Item metadata stays owned by PromptManager so the webview cannot alter it.
 */
export interface PromptModeItemDraft {
  id: string;
  title?: string;
  modelLevel?: PromptModelLevel;
  content: string;
}

export interface ParsedImportItem extends PromptDraft {}

export interface PromptCopySettings {
  copyMode: PromptCopyDeliveryMode;
  includeTemplateOnClick: boolean;
  prefix: string;
  quickRunCommand: string;
  quickRunEnabled: boolean;
  suffix: string;
}

export type PromptCopyDeliveryMode = 'direct' | 'indirect-file';

export type PromptModelLevel = 'low' | 'medium' | 'high';

export type PromptUiLanguage = 'zh-CN' | 'en';
