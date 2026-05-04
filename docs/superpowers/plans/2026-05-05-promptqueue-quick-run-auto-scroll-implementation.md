# PromptQueue Quick Run And Auto Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add next-unused auto-scroll and a configurable quick-run toolbar action to the PromptQueue sidebar without changing prompt copy semantics.

**Architecture:** Keep persistence changes limited to `PromptCopySettings`, add a small terminal quick-run helper on the extension side for safe terminal execution, and keep auto-scroll entirely inside the static webview script so no extra view-state protocol is needed. The webview provider only needs to bridge the new `quickRun` message and map localized success and error feedback.

**Tech Stack:** TypeScript, Vitest, VS Code extension API, plain browser JavaScript, CSS

---

## File Structure

- Modify `src/prompt/promptTypes.ts` to extend the saved PromptQueue settings shape with quick-run fields.
- Modify `src/prompt/promptSettingsStore.ts` to load and save quick-run defaults from the workspace settings file.
- Modify `src/prompt/promptManager.ts` to normalize quick-run settings before the rest of the extension consumes them.
- Modify `src/prompt/promptSettingsPanel.ts` so the legacy settings panel stays type-correct after the settings shape expands.
- Create `src/prompt/promptTerminalQuickRunner.ts` to isolate terminal ambiguity probing and command execution from the provider.
- Modify `src/prompt/promptWebviewProtocol.ts` to add the `quickRun` incoming message.
- Modify `src/prompt/promptWebviewViewProvider.ts` to dispatch `quickRun`, emit localized toasts, and map quick-run errors.
- Modify `src/extension.ts` to construct the terminal quick runner and inject it into the provider.
- Modify `src/prompt/promptLocalization.ts` to add toolbar, settings, helper, placeholder, and quick-run status strings in both locales.
- Modify `media/promptqueue-view.js` to render the new settings controls, conditionally render the toolbar button, submit `quickRun`, and auto-scroll to the next unfinished prompt.
- Modify `media/promptqueue-view.css` to add a small layout helper for the quick-run toggle row in the settings drawer.
- Modify `src/test/suite/promptSettingsStore.test.ts` for load/save coverage of the new settings fields.
- Modify `src/test/suite/promptManager.test.ts` so stubs include the new settings fields and to verify quick-run normalization.
- Modify `src/test/suite/registerPromptCommands.test.ts` so its settings stubs remain type-correct after the settings shape expands.
- Create `src/test/suite/promptTerminalQuickRunner.test.ts` for terminal ambiguity and execution behavior.
- Modify `src/test/suite/promptWebviewViewProvider.test.ts` to cover the new `quickRun` message path and error mapping.
- Modify `src/test/suite/promptLocalization.test.ts` to assert the new strings in both locales.
- Modify `src/test/suite/promptWebviewAssets.test.ts` to lock in quick-run UI rendering and auto-scroll hooks in the static asset.

## Chunk 1: Settings Model And Normalization

### Task 1: Persist quick-run settings and normalize them at the manager boundary

**Files:**
- Modify: `src/prompt/promptTypes.ts`
- Modify: `src/prompt/promptSettingsStore.ts`
- Modify: `src/prompt/promptManager.ts`
- Modify: `src/prompt/promptSettingsPanel.ts`
- Test: `src/test/suite/promptSettingsStore.test.ts`
- Test: `src/test/suite/promptManager.test.ts`
- Test: `src/test/suite/registerPromptCommands.test.ts`

- [ ] **Step 1: Write the failing settings-store and manager tests**

Add the following assertions to `src/test/suite/promptSettingsStore.test.ts`:

```ts
  it('returns quick-run defaults when the settings file does not exist', async () => {
    const store = new PromptSettingsStore();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptqueue-'));
    const workspaceFolder = createWorkspaceFolder(tempDir);

    tempDirs.push(tempDir);

    await expect(store.load(workspaceFolder)).resolves.toEqual({
      includeTemplateOnClick: true,
      prefix: '',
      suffix: '',
      quickRunEnabled: false,
      quickRunCommand: '/new',
    } satisfies PromptCopySettings);
  });

  it('saves quick-run settings alongside copy settings', async () => {
    const store = new PromptSettingsStore();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'promptqueue-'));
    const workspaceFolder = createWorkspaceFolder(tempDir);
    const { settingsFile } = getPromptQueuePaths(workspaceFolder);

    tempDirs.push(tempDir);

    await store.save(workspaceFolder, {
      includeTemplateOnClick: false,
      prefix: '前提示词',
      suffix: '后提示词',
      quickRunEnabled: true,
      quickRunCommand: '/new',
    });

    await expect(fs.readFile(settingsFile, 'utf8')).resolves.toContain(
      '"quickRunEnabled": true',
    );
    await expect(fs.readFile(settingsFile, 'utf8')).resolves.toContain(
      '"quickRunCommand": "/new"',
    );
  });
```

Update `createSettingsStoreStub` and add this case in `src/test/suite/promptManager.test.ts`:

```ts
function createSettingsStoreStub(
  initialSettings: PromptCopySettings = {
    includeTemplateOnClick: true,
    prefix: '',
    suffix: '',
    quickRunEnabled: false,
    quickRunCommand: '/new',
  },
) {
  let storedSettings = structuredClone(initialSettings);

  return {
    load: vi.fn(async () => structuredClone(storedSettings)),
    save: vi.fn(
      async (
        _workspaceFolder: WorkspaceFolderLike | undefined,
        settings: PromptCopySettings,
      ) => {
        storedSettings = structuredClone(settings);
      },
    ),
    getStoredSettings: () => structuredClone(storedSettings),
  };
}

it('normalizes blank quick-run commands back to /new', async () => {
  const store = createStoreStub([createPromptItem()]);
  const settingsStore = createSettingsStoreStub();
  const backupStore = createBackupStoreStub(undefined);
  const manager = new PromptManager({
    store,
    settingsStore,
    backupStore,
    workspaceFolder: createWorkspaceFolder('/tmp/workspace'),
    idFactory: () => 'generated-id',
    now: () => '2026-05-05T01:00:00.000Z',
  });

  await manager.initialize();
  await manager.updateCopySettings({
    includeTemplateOnClick: true,
    prefix: '',
    suffix: '',
    quickRunEnabled: true,
    quickRunCommand: '   ',
  });

  expect(manager.getCopySettings()).toMatchObject({
    quickRunEnabled: true,
    quickRunCommand: '/new',
  });
  expect(settingsStore.getStoredSettings()).toMatchObject({
    quickRunEnabled: true,
    quickRunCommand: '/new',
  });
});
```

Adjust the settings literal helper in `src/test/suite/registerPromptCommands.test.ts`:

```ts
    getCopySettings: vi.fn(
      overrides.getCopySettings ??
        (() => ({
          includeTemplateOnClick: true,
          prefix: '',
          suffix: '',
          quickRunEnabled: false,
          quickRunCommand: '/new',
        })),
    ),
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptSettingsStore.test.ts src/test/suite/promptManager.test.ts
```

Expected:
- FAIL because `PromptCopySettings` does not yet include `quickRunEnabled` or `quickRunCommand`
- FAIL because the settings store and manager normalization do not yet know about `/new`

- [ ] **Step 3: Write the minimal settings implementation**

Update `src/prompt/promptTypes.ts`:

```ts
export interface PromptCopySettings {
  includeTemplateOnClick: boolean;
  prefix: string;
  suffix: string;
  quickRunEnabled: boolean;
  quickRunCommand: string;
}
```

Update the default settings and load path in `src/prompt/promptSettingsStore.ts`:

```ts
const EMPTY_SETTINGS: PromptCopySettings = {
  includeTemplateOnClick: true,
  prefix: '',
  suffix: '',
  quickRunEnabled: false,
  quickRunCommand: '/new',
};

return {
  includeTemplateOnClick:
    typeof parsed.includeTemplateOnClick === 'boolean'
      ? parsed.includeTemplateOnClick
      : true,
  prefix: typeof parsed.prefix === 'string' ? parsed.prefix : '',
  suffix: typeof parsed.suffix === 'string' ? parsed.suffix : '',
  quickRunEnabled:
    typeof parsed.quickRunEnabled === 'boolean'
      ? parsed.quickRunEnabled
      : false,
  quickRunCommand:
    typeof parsed.quickRunCommand === 'string' &&
    parsed.quickRunCommand.trim().length > 0
      ? parsed.quickRunCommand.replace(/\r\n/g, '\n')
      : '/new',
};
```

Extend the in-memory defaults and normalization in `src/prompt/promptManager.ts`:

```ts
  private copySettings: PromptCopySettings = {
    includeTemplateOnClick: true,
    prefix: '',
    suffix: '',
    quickRunEnabled: false,
    quickRunCommand: '/new',
  };

    return {
      includeTemplateOnClick:
        typeof settings.includeTemplateOnClick === 'boolean'
          ? settings.includeTemplateOnClick
          : true,
      prefix: normalize(settings.prefix),
      suffix: normalize(settings.suffix),
      quickRunEnabled:
        typeof settings.quickRunEnabled === 'boolean'
          ? settings.quickRunEnabled
          : false,
      quickRunCommand: normalize(settings.quickRunCommand || '') || '/new',
    };
```

Keep the legacy panel type-correct in `src/prompt/promptSettingsPanel.ts`:

```ts
          finish({
            includeTemplateOnClick:
              options.initialSettings.includeTemplateOnClick,
            prefix:
              typeof message.value?.prefix === 'string'
                ? message.value.prefix
                : '',
            suffix:
              typeof message.value?.suffix === 'string'
                ? message.value.suffix
                : '',
            quickRunEnabled: options.initialSettings.quickRunEnabled,
            quickRunCommand: options.initialSettings.quickRunCommand,
          });
```

- [ ] **Step 4: Re-run the focused tests and verify GREEN**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptSettingsStore.test.ts src/test/suite/promptManager.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit the settings-model slice**

Run:

```bash
git add src/prompt/promptTypes.ts src/prompt/promptSettingsStore.ts src/prompt/promptManager.ts src/prompt/promptSettingsPanel.ts src/test/suite/promptSettingsStore.test.ts src/test/suite/promptManager.test.ts src/test/suite/registerPromptCommands.test.ts
git commit -m "feat: persist promptqueue quick run settings"
```

Expected:
- Commit succeeds with only the settings-model files staged

## Chunk 2: Extension-Side Quick Run Execution

### Task 2: Add a terminal quick-run helper and wire it through the webview provider

**Files:**
- Create: `src/prompt/promptTerminalQuickRunner.ts`
- Modify: `src/prompt/promptWebviewProtocol.ts`
- Modify: `src/prompt/promptWebviewViewProvider.ts`
- Modify: `src/prompt/promptLocalization.ts`
- Modify: `src/extension.ts`
- Test: `src/test/suite/promptTerminalQuickRunner.test.ts`
- Test: `src/test/suite/promptWebviewViewProvider.test.ts`
- Test: `src/test/suite/promptLocalization.test.ts`

- [ ] **Step 1: Write the failing quick-run runtime tests**

Create `src/test/suite/promptTerminalQuickRunner.test.ts` with:

```ts
import { describe, expect, it, vi } from 'vitest';

import {
  PromptQuickRunError,
  PromptTerminalQuickRunner,
} from '../../prompt/promptTerminalQuickRunner';

describe('PromptTerminalQuickRunner', () => {
  it('sends the configured command to the active terminal when no split pane is detected', async () => {
    const terminal = {
      sendText: vi.fn(),
      show: vi.fn(),
    };
    const executeCommand = vi.fn(async () => undefined);
    const runner = new PromptTerminalQuickRunner({
      executeCommand,
      getActiveTerminal: () => terminal as never,
    });

    await runner.run('/new');

    expect(executeCommand).toHaveBeenCalledWith(
      'workbench.action.terminal.focusNextPane',
    );
    expect(terminal.sendText).toHaveBeenCalledWith('/new', true);
  });

  it('throws a typed error when there is no active terminal', async () => {
    const runner = new PromptTerminalQuickRunner({
      executeCommand: vi.fn(async () => undefined),
      getActiveTerminal: () => undefined,
    });

    await expect(runner.run('/new')).rejects.toMatchObject({
      code: 'no-active-terminal',
    } satisfies Partial<PromptQuickRunError>);
  });

  it('rejects ambiguous split panes and restores the original terminal', async () => {
    const firstTerminal = {
      sendText: vi.fn(),
      show: vi.fn(),
    };
    const secondTerminal = {
      sendText: vi.fn(),
      show: vi.fn(),
    };
    let activeTerminal: typeof firstTerminal | typeof secondTerminal | undefined =
      firstTerminal;
    const executeCommand = vi.fn(async (command: string) => {
      if (command === 'workbench.action.terminal.focusNextPane') {
        activeTerminal = secondTerminal;
      }

      if (command === 'workbench.action.terminal.focusPreviousPane') {
        activeTerminal = firstTerminal;
      }
    });
    const runner = new PromptTerminalQuickRunner({
      executeCommand,
      getActiveTerminal: () => activeTerminal as never,
    });

    await expect(runner.run('/new')).rejects.toMatchObject({
      code: 'ambiguous-terminal',
    } satisfies Partial<PromptQuickRunError>);
    expect(executeCommand).toHaveBeenCalledWith(
      'workbench.action.terminal.focusPreviousPane',
    );
    expect(firstTerminal.show).toHaveBeenCalledWith(false);
    expect(firstTerminal.sendText).not.toHaveBeenCalled();
  });
});
```

Extend `src/test/suite/promptWebviewViewProvider.test.ts`:

```ts
  const copySettings: PromptCopySettings = {
    includeTemplateOnClick: true,
    prefix: 'Prefix',
    suffix: 'Suffix',
    quickRunEnabled: true,
    quickRunCommand: '/new',
  };

  const quickRunner = {
    run: vi.fn(async (_command: string) => undefined),
  };

  const provider = new PromptWebviewViewProvider({
    manager,
    quickRunner,
    getStorageLabel: () => 'WorkSpace/PromptQueue',
    getUiLanguage: () => 'zh-CN',
    writeClipboard,
  });

  await provider.resolveWebviewView(view as never);
  await view.fireMessage({ type: 'quickRun' });

  expect(quickRunner.run).toHaveBeenCalledWith('/new');
  expect(view.postedMessages).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: 'toast',
        message: '已执行快捷运行',
      }),
    ]),
  );
```

Add the error-mapping case in the same file:

```ts
  quickRunner.run.mockRejectedValueOnce(
    new PromptQuickRunError('ambiguous-terminal'),
  );

  await view.fireMessage({ type: 'quickRun' });

  expect(view.postedMessages).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: 'error',
        message: '当前同时显示了多个终端，不允许快捷运行。',
      }),
    ]),
  );
```

Extend `src/test/suite/promptLocalization.test.ts`:

```ts
    expect(strings.actions.quickRun).toBe('快捷运行');
    expect(strings.fields.quickRunCommand).toBe('快捷运行命令');
    expect(strings.messages.quickRunExecuted).toBe('已执行快捷运行');
```

```ts
    expect(strings.actions.quickRun).toBe('Quick Run');
    expect(strings.fields.quickRunCommand).toBe('Quick Run Command');
    expect(strings.messages.quickRunExecuted).toBe('Quick run executed');
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptTerminalQuickRunner.test.ts src/test/suite/promptWebviewViewProvider.test.ts src/test/suite/promptLocalization.test.ts
```

Expected:
- FAIL because `PromptTerminalQuickRunner` does not exist
- FAIL because the protocol/provider do not understand `quickRun`
- FAIL because the localization tables do not contain quick-run strings

- [ ] **Step 3: Write the minimal extension-side quick-run implementation**

Create `src/prompt/promptTerminalQuickRunner.ts`:

```ts
export type PromptQuickRunErrorCode =
  | 'ambiguous-terminal'
  | 'no-active-terminal';

export class PromptQuickRunError extends Error {
  constructor(public readonly code: PromptQuickRunErrorCode) {
    super(code);
  }
}

export interface PromptTerminalQuickRunnerDependencies {
  executeCommand: (command: string) => Promise<unknown>;
  getActiveTerminal: () => {
    sendText(text: string, shouldExecute?: boolean): void;
    show(preserveFocus?: boolean): void;
  } | undefined;
}

export class PromptTerminalQuickRunner {
  constructor(private readonly deps: PromptTerminalQuickRunnerDependencies) {}

  async run(command: string): Promise<void> {
    const normalizedCommand = command.trim() || '/new';
    const activeTerminal = this.deps.getActiveTerminal();

    if (!activeTerminal) {
      throw new PromptQuickRunError('no-active-terminal');
    }

    await this.deps.executeCommand('workbench.action.terminal.focusNextPane');

    const probedTerminal = this.deps.getActiveTerminal();

    if (probedTerminal && probedTerminal !== activeTerminal) {
      await this.deps.executeCommand('workbench.action.terminal.focusPreviousPane');
      activeTerminal.show(false);
      throw new PromptQuickRunError('ambiguous-terminal');
    }

    activeTerminal.sendText(normalizedCommand, true);
  }
}
```

Extend `src/prompt/promptWebviewProtocol.ts`:

```ts
export type PromptWebviewIncomingMessage =
  | { type: 'copyPrompt'; promptId: string }
  | { type: 'copyPromptRaw'; promptId: string }
  | { type: 'quickRun' }
  | { type: 'createPrompt'; draft: PromptDraft }
  | { type: 'deleteAllPrompts' }
  | { type: 'deletePrompt'; promptId: string }
  | { type: 'importPrompts'; mode: 'append' | 'replace'; text: string }
  | { type: 'movePrompt'; direction: 'up' | 'down'; promptId: string }
  | { type: 'reorderPrompts'; sourceId: string; targetId: string }
  | { type: 'requestState' }
  | { type: 'restoreLastDeleted' }
  | { type: 'toggleUsed'; promptId: string }
  | {
      silent?: boolean;
      type: 'updateCopySettings';
      settings: PromptCopySettings;
    }
  | { type: 'updatePrompt'; draft: PromptDraft; promptId: string };
```

Inject and use the runner in `src/prompt/promptWebviewViewProvider.ts`:

```ts
import { PromptQuickRunError } from './promptTerminalQuickRunner';

export interface PromptQuickRunner {
  run(command: string): Promise<void>;
}

export interface PromptWebviewViewProviderOptions {
  extensionUri?: vscode.Uri;
  hasWorkspace?: () => boolean;
  getStorageLabel: () => string;
  getUiLanguage: () => string;
  manager: PromptWebviewProviderManager;
  quickRunner: PromptQuickRunner;
  writeClipboard?: (text: string) => Promise<void>;
}

        case 'quickRun':
          await this.options.quickRunner.run(
            this.manager.getCopySettings().quickRunCommand,
          );
          await this.postToast(
            this.getCurrentStrings().messages.quickRunExecuted,
          );
          break;
```

Extend the catch block in the same file:

```ts
      await this.postMessage({
        type: 'error',
        message:
          error instanceof PromptQuickRunError &&
          error.code === 'no-active-terminal'
            ? strings.messages.quickRunNoActiveTerminal
            : error instanceof PromptQuickRunError &&
                error.code === 'ambiguous-terminal'
              ? strings.messages.quickRunAmbiguousTerminal
              : messageText === 'No deleted prompt backup available.'
                ? strings.messages.noLastDeletedBackup
                : messageText === 'PromptQueue requires an open workspace.'
                  ? strings.messages.noWorkspace
                  : messageText,
      });
```

Wire the runner in `src/extension.ts`:

```ts
import { PromptTerminalQuickRunner } from './prompt/promptTerminalQuickRunner';

  const provider = new PromptWebviewViewProvider({
    extensionUri: context.extensionUri,
    hasWorkspace: () => Boolean(getWorkspaceFolder()),
    getStorageLabel: () =>
      normalizePromptQueueStoragePath(getConfiguration().storagePath),
    getUiLanguage: () => getConfiguration().uiLanguage,
    manager,
    quickRunner: new PromptTerminalQuickRunner({
      executeCommand: (command) => vscode.commands.executeCommand(command),
      getActiveTerminal: () => vscode.window.activeTerminal,
    }),
    writeClipboard: (text) =>
      Promise.resolve(vscode.env.clipboard.writeText(text)),
  });
```

Extend the `PromptQueueStrings` interface members and both locale objects in `src/prompt/promptLocalization.ts`:

```ts
  actions: {
    add: string;
    bulkImport: string;
    copyRaw: string;
    delete: string;
    deleteAll: string;
    edit: string;
    moveDown: string;
    moveUp: string;
    quickRun: string;
    restoreLastDeleted: string;
    settings: string;
  },
  fields: {
    content: string;
    includeTemplateOnClick: string;
    prefix: string;
    quickRunCommand: string;
    quickRunEnabled: string;
    suffix: string;
    title: string;
  },
  helpers: {
    bulkImport: string;
    contentRequired: string;
    importRequired: string;
    includeTemplateOnClickHint: string;
    prefixHint: string;
    quickRunCommandHint: string;
    suffixHint: string;
    titleOptional: string;
  },
  messages: {
    created: string;
    copied: string;
    deleted: string;
    deletedAll: string;
    imported: string;
    noLastDeletedBackup: string;
    noWorkspace: string;
    quickRunAmbiguousTerminal: string;
    quickRunExecuted: string;
    quickRunNoActiveTerminal: string;
    restored: string;
    saved: string;
    updated: string;
  },
  placeholders: {
    content: string;
    import: string;
    prefix: string;
    quickRunCommand: string;
    suffix: string;
    title: string;
  },
```

Add the concrete values to the Chinese locale object:

```ts
  actions: {
    quickRun: '快捷运行',
  },
  fields: {
    quickRunCommand: '快捷运行命令',
    quickRunEnabled: '启用快捷运行',
  },
  helpers: {
    quickRunCommandHint: '发送到当前活动终端，并自动回车执行。',
  },
  messages: {
    quickRunAmbiguousTerminal: '当前同时显示了多个终端，不允许快捷运行。',
    quickRunExecuted: '已执行快捷运行',
    quickRunNoActiveTerminal: '当前没有可用终端。',
  },
  placeholders: {
    quickRunCommand: '/new',
  },
```

Mirror the same keys in the English locale object:

```ts
  actions: {
    quickRun: 'Quick Run',
  },
  fields: {
    quickRunCommand: 'Quick Run Command',
    quickRunEnabled: 'Enable Quick Run',
  },
  helpers: {
    quickRunCommandHint: 'Send this command to the active terminal and execute it immediately.',
  },
  messages: {
    quickRunAmbiguousTerminal: 'Multiple terminals are visible, so quick run is blocked.',
    quickRunExecuted: 'Quick run executed',
    quickRunNoActiveTerminal: 'There is no active terminal to run the command in.',
  },
  placeholders: {
    quickRunCommand: '/new',
  },
```

- [ ] **Step 4: Re-run the focused tests and verify GREEN**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptTerminalQuickRunner.test.ts src/test/suite/promptWebviewViewProvider.test.ts src/test/suite/promptLocalization.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit the quick-run runtime slice**

Run:

```bash
git add src/prompt/promptTerminalQuickRunner.ts src/prompt/promptWebviewProtocol.ts src/prompt/promptWebviewViewProvider.ts src/prompt/promptLocalization.ts src/extension.ts src/test/suite/promptTerminalQuickRunner.test.ts src/test/suite/promptWebviewViewProvider.test.ts src/test/suite/promptLocalization.test.ts
git commit -m "feat: add promptqueue quick run execution"
```

Expected:
- Commit succeeds with the quick-run runtime files staged

## Chunk 3: Webview UI And Auto Scroll

### Task 3: Render quick-run controls and auto-scroll to the next unfinished prompt

**Files:**
- Modify: `media/promptqueue-view.js`
- Modify: `media/promptqueue-view.css`
- Test: `src/test/suite/promptWebviewAssets.test.ts`

- [ ] **Step 1: Write the failing static-asset assertions**

Extend `src/test/suite/promptWebviewAssets.test.ts` with:

```ts
  it('renders quick-run controls in the toolbar and settings drawer', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain("buttonMarkup('quick-run'");
    expect(script).toContain("quickRunEnabled");
    expect(script).toContain("quickRunCommand");
    expect(script).toContain("type: 'quickRun'");
  });

  it('queues auto-scroll on state refresh and visibility changes', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain("document.addEventListener('visibilitychange'");
    expect(script).toContain("item.used === false");
    expect(script).toContain("scrollIntoView({ block: 'center' })");
    expect(script).toContain("scrollIntoView({ block: 'end' })");
    expect(script).toContain("window.requestAnimationFrame");
  });
```

- [ ] **Step 2: Run the focused asset test and verify RED**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptWebviewAssets.test.ts
```

Expected:
- FAIL because the current webview asset has no quick-run button, no quick-run settings fields, and no visibility-driven auto-scroll

- [ ] **Step 3: Write the minimal webview implementation**

Extend the initial state and settings helpers in `media/promptqueue-view.js`:

```js
      copySettings: {
        includeTemplateOnClick: true,
        prefix: '',
        suffix: '',
        quickRunEnabled: false,
        quickRunCommand: '/new',
      },
```

```js
  function renderDrawerToggle(label, name, checked) {
    return (
      '<div class="pq-field pq-field-toggle">' +
      '<span class="pq-label">' + escapeHtml(label || '') + '</span>' +
      '<label class="pq-chip pq-chip-toggle ' +
      (checked ? 'pq-chip-toggle-active' : '') +
      '">' +
      '<input class="pq-toggle-input" type="checkbox" name="' + escapeHtml(name) + '"' +
      (checked ? ' checked' : '') +
      ' />' +
      '<span class="pq-toggle-box" aria-hidden="true"></span>' +
      '<span class="pq-toggle-label">' + escapeHtml(label || '') + '</span>' +
      '</label>' +
      '</div>'
    );
  }
```

```js
    if (panel.type === 'settings') {
      return {
        includeTemplateOnClick: ui.state.copySettings.includeTemplateOnClick !== false,
        prefix: ui.state.copySettings.prefix,
        suffix: ui.state.copySettings.suffix,
        quickRunEnabled: ui.state.copySettings.quickRunEnabled === true,
        quickRunCommand: ui.state.copySettings.quickRunCommand || '/new',
      };
    }
```

Extend the payload helper and toolbar renderer:

```js
  function buildCopySettingsPayload(overrides) {
    return {
      includeTemplateOnClick:
        typeof overrides.includeTemplateOnClick === 'boolean'
          ? overrides.includeTemplateOnClick
          : ui.state.copySettings.includeTemplateOnClick !== false,
      prefix:
        typeof overrides.prefix === 'string'
          ? overrides.prefix
          : ui.state.copySettings.prefix,
      suffix:
        typeof overrides.suffix === 'string'
          ? overrides.suffix
          : ui.state.copySettings.suffix,
      quickRunEnabled:
        typeof overrides.quickRunEnabled === 'boolean'
          ? overrides.quickRunEnabled
          : ui.state.copySettings.quickRunEnabled === true,
      quickRunCommand:
        typeof overrides.quickRunCommand === 'string'
          ? overrides.quickRunCommand
          : ui.state.copySettings.quickRunCommand || '/new',
    };
  }
```

```js
  function renderToolbar() {
    const strings = ui.state.strings;
    const actions = [
      buttonMarkup('open-add', strings.actions.add, 'pq-chip pq-chip-solid'),
      buttonMarkup('open-import', strings.actions.bulkImport, 'pq-chip'),
      renderCopyModeToggle(),
      buttonMarkup('delete-all', strings.actions.deleteAll, 'pq-chip pq-chip-danger'),
      buttonMarkup(
        'restore-last-deleted',
        strings.actions.restoreLastDeleted,
        'pq-chip pq-chip-ghost',
        !ui.state.canRestoreLastDeleted,
      ),
    ];

    if (ui.state.copySettings.quickRunEnabled === true) {
      actions.push(
        buttonMarkup('quick-run', strings.actions.quickRun, 'pq-chip pq-chip-solid'),
      );
    }

    actions.push(buttonMarkup('open-settings', strings.actions.settings, 'pq-chip'));

    return actions.join('');
  }
```

Render the settings controls in the drawer form:

```js
      form =
        '<form class="pq-form" data-form="settings">' +
        renderDrawerToggle(
          strings.fields.quickRunEnabled,
          'quickRunEnabled',
          values.quickRunEnabled === true,
        ) +
        '<div class="pq-helper">' +
        escapeHtml(strings.helpers.quickRunCommandHint || '') +
        '</div>' +
        renderField(
          strings.fields.quickRunCommand,
          strings.placeholders.quickRunCommand,
          'quickRunCommand',
          values.quickRunCommand || '/new',
          false,
        ) +
        renderTextArea(strings.fields.prefix, strings.placeholders.prefix, 'prefix', values.prefix || '') +
        '<div class="pq-helper">' + escapeHtml(strings.helpers.prefixHint || '') + '</div>' +
        renderTextArea(strings.fields.suffix, strings.placeholders.suffix, 'suffix', values.suffix || '') +
        '<div class="pq-helper">' + escapeHtml(strings.helpers.suffixHint || '') + '</div>' +
        renderFormActions() +
        '</form>';
```

Add the new action and submit payload:

```js
    if (action === 'quick-run') {
      postMessage({ type: 'quickRun' });
      return;
    }
```

```js
      postMessage({
        type: 'updateCopySettings',
        settings: buildCopySettingsPayload({
          prefix: String(formData.get('prefix') || ''),
          suffix: String(formData.get('suffix') || ''),
          quickRunCommand: String(formData.get('quickRunCommand') || ''),
          quickRunEnabled: formData.get('quickRunEnabled') === 'on',
        }),
      });
```

Make drawer draft sync work for checkboxes:

```js
    ui.panelDraft = {
      ...ui.panelDraft,
      [target.name]: target instanceof HTMLInputElement && target.type === 'checkbox'
        ? target.checked
        : target.value,
    };
```

Add gated auto-scroll helpers near the render pipeline:

```js
  ui.pendingAutoScroll = false;
  ui.receivedState = false;

  function getNextUnusedPromptId(items) {
    const nextItem = items.find(function (item) {
      return item.used === false;
    });

    return nextItem ? nextItem.id : null;
  }

  function getUsageSignature(items) {
    return items
      .map(function (item) {
        return item.id + ':' + (item.used ? '1' : '0');
      })
      .join('|');
  }

  function queueAutoScroll() {
    ui.pendingAutoScroll = true;
  }

  function flushAutoScroll() {
    if (!ui.pendingAutoScroll) {
      return;
    }

    ui.pendingAutoScroll = false;
    window.requestAnimationFrame(function () {
      const targetId = getNextUnusedPromptId(ui.state.items);
      const targetCard = targetId
        ? root.querySelector('[data-card-id="' + targetId + '"]')
        : root.querySelector('[data-card-id]:last-of-type');

      if (targetCard instanceof HTMLElement) {
        targetCard.scrollIntoView({
          block: targetId ? 'center' : 'end',
        });
      }
    });
  }
```

Trigger auto-scroll only when needed:

```js
    if (message.type === 'state') {
      const previousSignature = getUsageSignature(ui.state.items);
      const nextSignature = getUsageSignature(message.state.items);

      ui.state = message.state;

      if (!ui.receivedState || previousSignature !== nextSignature) {
        queueAutoScroll();
      }

      ui.receivedState = true;
      render();
      return;
    }
```

```js
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      queueAutoScroll();
      flushAutoScroll();
    }
  });
```

Call `flushAutoScroll()` at the end of `render()` after `restorePanelFocus()` and `adjustMenuPosition()`.

Add this layout helper to `media/promptqueue-view.css`:

```css
.pq-field-toggle {
  display: grid;
  gap: 8px;
}
```

- [ ] **Step 4: Re-run the focused asset test and verify GREEN**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptWebviewAssets.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit the webview slice**

Run:

```bash
git add media/promptqueue-view.js media/promptqueue-view.css src/test/suite/promptWebviewAssets.test.ts
git commit -m "feat: add promptqueue auto scroll and quick run ui"
```

Expected:
- Commit succeeds with the asset files staged

## Chunk 4: Final Verification

### Task 4: Run the full verification pass

**Files:**
- Modify: `src/prompt/promptTypes.ts`
- Modify: `src/prompt/promptSettingsStore.ts`
- Modify: `src/prompt/promptManager.ts`
- Modify: `src/prompt/promptTerminalQuickRunner.ts`
- Modify: `src/prompt/promptWebviewProtocol.ts`
- Modify: `src/prompt/promptWebviewViewProvider.ts`
- Modify: `src/prompt/promptLocalization.ts`
- Modify: `src/extension.ts`
- Modify: `media/promptqueue-view.js`
- Modify: `media/promptqueue-view.css`
- Test: `src/test/suite/promptSettingsStore.test.ts`
- Test: `src/test/suite/promptManager.test.ts`
- Test: `src/test/suite/promptTerminalQuickRunner.test.ts`
- Test: `src/test/suite/promptWebviewViewProvider.test.ts`
- Test: `src/test/suite/promptLocalization.test.ts`
- Test: `src/test/suite/promptWebviewAssets.test.ts`

- [ ] **Step 1: Run the full unit suite**

Run:

```bash
npm run test:unit
```

Expected:
- PASS

- [ ] **Step 2: Run TypeScript compile**

Run:

```bash
npm run compile
```

Expected:
- PASS

- [ ] **Step 3: Run the full automated test command**

Run:

```bash
npm run test
```

Expected:
- PASS

- [ ] **Step 4: Check the worktree state before handoff**

Run:

```bash
git status --short
```

Expected:
- clean worktree if each task commit succeeded
- or only the intended implementation files remain if the commits were deferred on purpose
