import type {
  PromptCopySettings,
  PromptDraft,
  PromptItem,
} from './promptTypes';
import type { PromptQueueStrings } from './promptLocalization';

export interface PromptWebviewState {
  canRestoreLastDeleted: boolean;
  copySettings: PromptCopySettings;
  items: PromptItem[];
  storageLabel: string;
  strings: PromptQueueStrings;
}

export type PromptWebviewIncomingMessage =
  | { type: 'copyPrompt'; promptId: string }
  | { type: 'copyPromptRaw'; promptId: string }
  | { type: 'createPrompt'; draft: PromptDraft }
  | { type: 'deleteAllPrompts' }
  | { type: 'deletePrompt'; promptId: string }
  | { type: 'importPrompts'; mode: 'append' | 'replace'; text: string }
  | { type: 'movePrompt'; direction: 'up' | 'down'; promptId: string }
  | { type: 'reorderPrompts'; sourceId: string; targetId: string }
  | { type: 'requestState' }
  | { type: 'restoreLastDeleted' }
  | { type: 'toggleUsed'; promptId: string }
  | { type: 'updateCopySettings'; settings: PromptCopySettings }
  | { type: 'updatePrompt'; draft: PromptDraft; promptId: string };

export type PromptWebviewOutgoingMessage =
  | {
      state: PromptWebviewState;
      type: 'state';
    }
  | {
      message: string;
      type: 'error' | 'toast';
    };
