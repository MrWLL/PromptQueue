import type {
  PromptCopySettings,
  PromptDraft,
  PromptItem,
  PromptModeItemDraft,
} from './promptTypes';
import type { PromptQueueStrings } from './promptLocalization';

export interface PromptWebviewItem extends PromptItem {
  copyAgeLabel?: string;
  isAdjacentDuplicate?: boolean;
}

export type PromptQuickRunAvailability =
  | 'disabled-in-settings'
  | 'no-active-terminal'
  | 'ready';

export interface PromptWebviewState {
  contextId?: number;
  canRestoreLastDeleted: boolean;
  copySettings: PromptCopySettings;
  dataError?: string;
  dataReady: boolean;
  items: PromptWebviewItem[];
  quickRunAvailability: PromptQuickRunAvailability;
  storageLabel: string;
  strings: PromptQueueStrings;
  workspaceReady: boolean;
}

export type PromptWebviewIncomingMessage = (
  | { type: 'copyPrompt'; promptId: string }
  | { type: 'copyPromptRaw'; promptId: string }
  | { type: 'applyPromptModeChanges'; items: PromptModeItemDraft[] }
  | { type: 'createPrompt'; draft: PromptDraft }
  | { type: 'deleteAllPrompts' }
  | { type: 'deletePrompt'; promptId: string }
  | { type: 'importPrompts'; mode: 'append' | 'replace'; text: string }
  | { type: 'movePrompt'; direction: 'up' | 'down'; promptId: string }
  | { type: 'quickRun' }
  | { type: 'reorderPrompts'; sourceId: string; targetIndex: number }
  | { type: 'requestState' }
  | { type: 'restoreLastDeleted' }
  | { type: 'toggleUsed'; promptId: string }
  | {
      silent?: boolean;
      type: 'updateCopySettings';
      settings: PromptCopySettings;
    }
  | { type: 'updatePrompt'; draft: PromptDraft; promptId: string }
) & { contextId?: number; requestId?: number };

export type PromptWebviewOutgoingMessage = (
  | {
      state: PromptWebviewState;
      type: 'state';
    }
  | {
      command:
        | 'closeEditPanel'
        | 'closeSettingsPanel'
        | 'finishPromptMode'
        | 'finishImport'
        | 'resetAddForm';
      type: 'panelCommand';
    }
  | {
      message: string;
      type: 'error' | 'toast';
    }
) & { requestId?: number };
