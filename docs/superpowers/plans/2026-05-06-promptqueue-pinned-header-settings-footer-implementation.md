# PromptQueue Pinned Header And Settings Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the PromptQueue sidebar so the header stays pinned, the list is the only scrolling region, the footer shows only `used / total`, and every non-header global action moves into the settings drawer.

**Architecture:** Keep the change inside the existing webview-based sidebar. Add one small derived state field for quick-run availability, refresh that state from extension-side terminal events, and then restructure the static webview assets around a pinned `header + list + footer` shell with grouped settings sections.

**Tech Stack:** TypeScript, Vitest, VS Code extension API, plain browser JavaScript, CSS

---

## Preflight

- [ ] **Step 1: Create a dedicated worktree if you are still on the shared branch**

Run:

```bash
git worktree add .worktrees/promptqueue-pinned-shell -b feature/promptqueue-pinned-shell HEAD
```

Expected:
- a new worktree is created at `.worktrees/promptqueue-pinned-shell`

- [ ] **Step 2: Run all remaining commands from the new worktree root**

Run:

```bash
git rev-parse --show-toplevel
```

Expected:
- the printed path ends with `.worktrees/promptqueue-pinned-shell`

## File Structure

- Modify `src/prompt/promptWebviewProtocol.ts` to add a derived quick-run availability field to the webview state.
- Modify `src/prompt/promptWebviewViewProvider.ts` to compute quick-run availability from saved settings plus active-terminal presence.
- Modify `src/extension.ts` to inject terminal availability into the provider and refresh the provider when terminal activity changes.
- Modify `src/test/mocks/vscode.ts` to expose terminal mocks and terminal event registration used by activation tests.
- Modify `src/test/suite/promptWebviewViewProvider.test.ts` to lock in quick-run availability states.
- Modify `src/test/suite/extension.test.ts` to verify terminal refresh listeners are registered.
- Modify `src/prompt/promptLocalization.ts` to add grouped-settings section titles and rename the settings drawer title to a general settings label in both locales.
- Modify `src/test/suite/promptLocalization.test.ts` to cover the new section strings and settings title.
- Modify `media/promptqueue-view.js` to remove the action dock, pin the shell layout, render only three header buttons, render a read-only footer, and move import/copy behavior/quick-run/data actions into the settings drawer.
- Modify `media/promptqueue-view.css` to make the list the only scrolling main region and style the grouped settings sections plus footer.
- Modify `src/test/suite/promptWebviewAssets.test.ts` to lock in the new header/footer/settings-drawer structure.

## Chunk 1: Provider State And Terminal Refresh

### Task 1: Add quick-run availability to the webview state and refresh it from terminal events

**Files:**
- Modify: `src/prompt/promptWebviewProtocol.ts`
- Modify: `src/prompt/promptWebviewViewProvider.ts`
- Modify: `src/extension.ts`
- Modify: `src/test/mocks/vscode.ts`
- Test: `src/test/suite/promptWebviewViewProvider.test.ts`
- Test: `src/test/suite/extension.test.ts`

- [ ] **Step 1: Write the failing tests and test-mock support**

Extend `src/test/mocks/vscode.ts` so terminal APIs exist for the new activation assertions:

```ts
export const window = {
  activeTerminal: undefined as
    | {
        sendText(text: string, shouldExecute?: boolean): void;
        show(preserveFocus?: boolean): void;
      }
    | undefined,
  terminals: [] as Array<{
    sendText(text: string, shouldExecute?: boolean): void;
    show(preserveFocus?: boolean): void;
  }>,
  visibleTextEditors: [] as Array<{
    document: { languageId: string };
    setDecorations: (...args: unknown[]) => void;
  }>,
  __reset(): void {
    window.activeTerminal = undefined;
    window.terminals = [];
    window.onDidChangeActiveTerminal.mockClear();
    window.onDidOpenTerminal.mockClear();
    window.onDidCloseTerminal.mockClear();
    window.onDidChangeActiveTextEditor.mockClear();
    window.onDidChangeVisibleTextEditors.mockClear();
    window.registerWebviewViewProvider.mockClear();
  },
  onDidChangeActiveTerminal: vi.fn(() => new Disposable()),
  onDidOpenTerminal: vi.fn(() => new Disposable()),
  onDidCloseTerminal: vi.fn(() => new Disposable()),
  onDidChangeActiveTextEditor: vi.fn(() => new Disposable()),
  onDidChangeVisibleTextEditors: vi.fn(() => new Disposable()),
};
```

Add these cases to `src/test/suite/promptWebviewViewProvider.test.ts`:

```ts
  it('reports quick run as disabled when settings turn it off', async () => {
    const manager = createManagerStub();
    manager.getCopySettings.mockReturnValueOnce({
      includeTemplateOnClick: true,
      prefix: 'Prefix',
      quickRunCommand: '/new',
      quickRunEnabled: false,
      suffix: 'Suffix',
    });
    const view = createWebviewViewStub();
    const provider = new PromptWebviewViewProvider({
      manager,
      hasActiveTerminal: () => true,
      getStorageLabel: () => 'WorkSpace/PromptQueue',
      getUiLanguage: () => 'zh-CN',
      writeClipboard: vi.fn(async () => undefined),
    });

    await provider.resolveWebviewView(view as never);

    expect(view.postedMessages[0]).toMatchObject({
      type: 'state',
      state: {
        quickRunAvailability: 'disabled-in-settings',
      },
    });
  });

  it('reports quick run as unavailable when there is no active terminal', async () => {
    const manager = createManagerStub();
    const view = createWebviewViewStub();
    const provider = new PromptWebviewViewProvider({
      manager,
      hasActiveTerminal: () => false,
      getStorageLabel: () => 'WorkSpace/PromptQueue',
      getUiLanguage: () => 'zh-CN',
      writeClipboard: vi.fn(async () => undefined),
    });

    await provider.resolveWebviewView(view as never);

    expect(view.postedMessages[0]).toMatchObject({
      type: 'state',
      state: {
        quickRunAvailability: 'no-active-terminal',
      },
    });
  });

  it('reports quick run as ready when settings are enabled and a terminal is active', async () => {
    const manager = createManagerStub();
    const view = createWebviewViewStub();
    const provider = new PromptWebviewViewProvider({
      manager,
      hasActiveTerminal: () => true,
      getStorageLabel: () => 'WorkSpace/PromptQueue',
      getUiLanguage: () => 'zh-CN',
      writeClipboard: vi.fn(async () => undefined),
    });

    await provider.resolveWebviewView(view as never);

    expect(view.postedMessages[0]).toMatchObject({
      type: 'state',
      state: {
        quickRunAvailability: 'ready',
      },
    });
  });
```

Add this assertion block to `src/test/suite/extension.test.ts` inside the first activation test:

```ts
    expect(vscode.window.onDidChangeActiveTerminal).toHaveBeenCalled();
    expect(vscode.window.onDidOpenTerminal).toHaveBeenCalled();
    expect(vscode.window.onDidCloseTerminal).toHaveBeenCalled();
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptWebviewViewProvider.test.ts src/test/suite/extension.test.ts
```

Expected:
- FAIL because `PromptWebviewState` does not yet contain `quickRunAvailability`
- FAIL because `PromptWebviewViewProvider` does not yet accept `hasActiveTerminal`
- FAIL because `activate()` does not yet register terminal listeners that refresh the provider

- [ ] **Step 3: Write the minimal provider and activation implementation**

Extend `src/prompt/promptWebviewProtocol.ts`:

```ts
export type PromptQuickRunAvailability =
  | 'disabled-in-settings'
  | 'no-active-terminal'
  | 'ready';

export interface PromptWebviewState {
  canRestoreLastDeleted: boolean;
  copySettings: PromptCopySettings;
  items: PromptWebviewItem[];
  quickRunAvailability: PromptQuickRunAvailability;
  storageLabel: string;
  strings: PromptQueueStrings;
  workspaceReady: boolean;
}
```

Update `src/prompt/promptWebviewViewProvider.ts` so the provider derives the state from settings plus terminal presence:

```ts
import type {
  PromptQuickRunAvailability,
  PromptWebviewIncomingMessage,
  PromptWebviewItem,
  PromptWebviewOutgoingMessage,
  PromptWebviewState,
} from './promptWebviewProtocol';
import type {
  PromptCopySettings,
  PromptDraft,
  PromptItem,
} from './promptTypes';
```

```ts
export interface PromptWebviewViewProviderOptions {
  extensionUri?: vscode.Uri;
  hasActiveTerminal?: () => boolean;
  hasWorkspace?: () => boolean;
  getStorageLabel: () => string;
  getUiLanguage: () => string;
  manager: PromptWebviewProviderManager;
  quickRunner?: {
    run(command: string): Promise<void>;
  };
  writeClipboard?: (text: string) => Promise<void>;
}
```

```ts
  private async postState(): Promise<void> {
    const strings = this.getCurrentStrings();
    const copySettings = this.manager.getCopySettings();
    const items = this.buildWebviewItems();
    const state: PromptWebviewState = {
      canRestoreLastDeleted:
        (await this.manager.hasLastDeletedBackup?.()) ?? false,
      copySettings,
      items,
      quickRunAvailability: this.getQuickRunAvailability(copySettings),
      storageLabel: this.options.getStorageLabel(),
      strings,
      workspaceReady: this.isWorkspaceReady(),
    };

    await this.postMessage({
      type: 'state',
      state,
    });
  }

  private getQuickRunAvailability(
    copySettings: PromptCopySettings,
  ): PromptQuickRunAvailability {
    if (copySettings.quickRunEnabled !== true) {
      return 'disabled-in-settings';
    }

    if (!(this.options.hasActiveTerminal?.() ?? false)) {
      return 'no-active-terminal';
    }

    return 'ready';
  }
```

Update `src/extension.ts` so the provider can evaluate terminal presence and refresh when terminals change:

```ts
  const provider = new PromptWebviewViewProvider({
    extensionUri: context.extensionUri,
    hasActiveTerminal: () => Boolean(vscode.window.activeTerminal),
    hasWorkspace: () => Boolean(getWorkspaceFolder()),
    getStorageLabel: () =>
      normalizePromptQueueStoragePath(getConfiguration().storagePath),
    getUiLanguage: () => getConfiguration().uiLanguage,
    manager,
    quickRunner: new PromptTerminalQuickRunner({
      executeCommand: (command) => vscode.commands.executeCommand(command),
      getActiveTerminal: () => vscode.window.activeTerminal,
      getTerminalCount: () => vscode.window.terminals.length,
    }),
    writeClipboard: (text) => Promise.resolve(vscode.env.clipboard.writeText(text)),
  });
```

```ts
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTerminal(() => {
      void provider.refresh();
    }),
  );
  context.subscriptions.push(
    vscode.window.onDidOpenTerminal(() => {
      void provider.refresh();
    }),
  );
  context.subscriptions.push(
    vscode.window.onDidCloseTerminal(() => {
      void provider.refresh();
    }),
  );
```

- [ ] **Step 4: Re-run the focused tests and verify GREEN**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptWebviewViewProvider.test.ts src/test/suite/extension.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit the provider-state slice**

Run:

```bash
git add src/prompt/promptWebviewProtocol.ts src/prompt/promptWebviewViewProvider.ts src/extension.ts src/test/mocks/vscode.ts src/test/suite/promptWebviewViewProvider.test.ts src/test/suite/extension.test.ts
git commit -m "feat: add promptqueue quick-run availability state"
```

Expected:
- commit succeeds with only the provider-state files staged

## Chunk 2: Localization For Grouped Settings

### Task 2: Add section titles and rename the drawer title to general settings

**Files:**
- Modify: `src/prompt/promptLocalization.ts`
- Test: `src/test/suite/promptLocalization.test.ts`

- [ ] **Step 1: Write the failing localization tests**

Add these assertions to `src/test/suite/promptLocalization.test.ts`:

```ts
    expect(strings).toMatchObject({
      panels: {
        settings: '设置',
      },
      sections: {
        import: '导入',
        copyBehavior: '复制行为',
        quickRun: '快捷运行',
        dataManagement: '数据管理',
      },
    });
```

```ts
    expect(strings).toMatchObject({
      panels: {
        settings: 'Settings',
      },
      sections: {
        import: 'Import',
        copyBehavior: 'Copy Behavior',
        quickRun: 'Quick Run',
        dataManagement: 'Data Management',
      },
    });
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptLocalization.test.ts
```

Expected:
- FAIL because `PromptQueueStrings` has no `sections` object
- FAIL because the settings panel label is still `复制设置` / `Copy Settings`

- [ ] **Step 3: Write the minimal localization implementation**

Extend the interface in `src/prompt/promptLocalization.ts`:

```ts
  sections: {
    copyBehavior: string;
    dataManagement: string;
    import: string;
    quickRun: string;
  };
```

Update the Chinese locale object:

```ts
  panels: {
    add: '新增提示词',
    bulkImport: '批量导入',
    edit: '编辑提示词',
    settings: '设置',
  },
  sections: {
    copyBehavior: '复制行为',
    dataManagement: '数据管理',
    import: '导入',
    quickRun: '快捷运行',
  },
```

Update the English locale object:

```ts
  panels: {
    add: 'Add Prompt',
    bulkImport: 'Bulk Import',
    edit: 'Edit Prompt',
    settings: 'Settings',
  },
  sections: {
    copyBehavior: 'Copy Behavior',
    dataManagement: 'Data Management',
    import: 'Import',
    quickRun: 'Quick Run',
  },
```

- [ ] **Step 4: Re-run the focused test and verify GREEN**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptLocalization.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit the localization slice**

Run:

```bash
git add src/prompt/promptLocalization.ts src/test/suite/promptLocalization.test.ts
git commit -m "feat: localize promptqueue grouped settings"
```

Expected:
- commit succeeds with only the localization files staged

## Chunk 3: Webview Shell And Grouped Settings Drawer

### Task 3: Replace the action dock with a pinned header/footer shell and grouped settings content

**Files:**
- Modify: `media/promptqueue-view.js`
- Modify: `media/promptqueue-view.css`
- Test: `src/test/suite/promptWebviewAssets.test.ts`

- [ ] **Step 1: Write the failing static-asset assertions**

Replace the old dock-oriented assertions in `src/test/suite/promptWebviewAssets.test.ts` with these checks:

```ts
  it('renders a pinned header and footer instead of the old action dock', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('function renderHeader()');
    expect(script).toContain('function renderFooter()');
    expect(script).not.toContain('function renderActionDock()');
    expect(script).toContain("'<footer class=\"pq-footer\">'");
  });

  it('keeps only add, settings, and quick run in the header', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain("buttonMarkup('open-add'");
    expect(script).toContain("buttonMarkup('open-settings'");
    expect(script).toContain("buttonMarkup('quick-run'");
    expect(script).not.toContain("'open-import'");
    expect(script).not.toContain("'open-more-actions'");
  });

  it('drives the quick-run button from derived availability state', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain("quickRunAvailability: 'disabled-in-settings'");
    expect(script).toContain("ui.state.quickRunAvailability !== 'ready'");
  });

  it('renders grouped settings sections for import, copy behavior, quick run, and data management', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('function renderSettingsSection(');
    expect(script).toContain('strings.sections.import');
    expect(script).toContain('strings.sections.copyBehavior');
    expect(script).toContain('strings.sections.quickRun');
    expect(script).toContain('strings.sections.dataManagement');
  });

  it('renders a read-only footer summary in used-over-total form', async () => {
    const script = await readAsset('media/promptqueue-view.js');

    expect(script).toContain('function renderFooter()');
    expect(script).toContain('getUsedCount(ui.state.items)');
    expect(script).toContain("' / ' + ui.state.items.length");
  });

  it('makes the list the only scrollable main region', async () => {
    const css = await readAsset('media/promptqueue-view.css');

    expect(css).toContain('.pq-shell');
    expect(css).toContain('height: 100vh');
    expect(css).toContain('overflow: hidden');
    expect(css).toContain('.pq-list');
    expect(css).toContain('overflow-y: auto');
    expect(css).toContain('.pq-footer');
  });
```

- [ ] **Step 2: Run the focused asset test and verify RED**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptWebviewAssets.test.ts
```

Expected:
- FAIL because the script still renders `renderActionDock()`
- FAIL because the footer does not exist
- FAIL because import and data-management actions still live outside the settings drawer
- FAIL because `.pq-list` is not yet the only scrolling region

- [ ] **Step 3: Write the minimal webview implementation**

Update the initial state in `media/promptqueue-view.js`:

```js
    return {
      canRestoreLastDeleted: false,
      copySettings: {
        includeTemplateOnClick: true,
        prefix: '',
        quickRunCommand: '/new',
        quickRunEnabled: false,
        suffix: '',
      },
      items: [],
      quickRunAvailability: 'disabled-in-settings',
      storageLabel: '',
      workspaceReady: true,
      strings: {
        actions: {},
        buttons: {},
        confirmations: {},
        emptyState: {},
        fields: {},
        helpers: {},
        labels: {},
        messages: {},
        panels: {},
        placeholders: {},
        sections: {},
        status: {},
      },
    };
```

Replace the old queue summary helper and action dock with a pinned header/footer pair:

```js
  function renderHeader() {
    const strings = ui.state.strings;

    return (
      '<section class="pq-header">' +
      '<div class="pq-header-actions">' +
      buttonMarkup('open-add', strings.actions.add, 'pq-btn pq-btn-primary') +
      buttonMarkup(
        'open-settings',
        strings.actions.settings,
        'pq-btn pq-btn-secondary',
      ) +
      buttonMarkup(
        'quick-run',
        strings.actions.quickRun,
        'pq-btn pq-btn-secondary',
        ui.state.quickRunAvailability !== 'ready',
      ) +
      '</div>' +
      '</section>'
    );
  }

  function renderFooter() {
    return (
      '<footer class="pq-footer">' +
      '<div class="pq-footer-summary">' +
      getUsedCount(ui.state.items) +
      ' / ' +
      ui.state.items.length +
      '</div>' +
      '</footer>'
    );
  }
```

Add a grouped-settings helper:

```js
  function renderSettingsSection(title, content, actionMarkup) {
    return (
      '<section class="pq-settings-section">' +
      '<div class="pq-settings-section-title">' +
      escapeHtml(title || '') +
      '</div>' +
      '<div class="pq-settings-section-body">' +
      content +
      '</div>' +
      (actionMarkup
        ? '<div class="pq-settings-section-actions">' + actionMarkup + '</div>'
        : '') +
      '</section>'
    );
  }
```

Change the settings draft in `createPanelDraft(panel)` so the settings drawer owns import plus all global config:

```js
    if (panel.type === 'settings') {
      return {
        importText: '',
        includeTemplateOnClick:
          ui.state.copySettings.includeTemplateOnClick !== false,
        prefix: ui.state.copySettings.prefix,
        quickRunCommand: ui.state.copySettings.quickRunCommand || '/new',
        quickRunEnabled: ui.state.copySettings.quickRunEnabled === true,
        suffix: ui.state.copySettings.suffix,
      };
    }
```

Render the settings drawer as two forms plus one action section:

```js
    if (ui.panel.type === 'settings') {
      title = strings.panels.settings;
      form =
        '<div class="pq-settings-stack">' +
        '<form class="pq-form" data-form="settings-import">' +
        renderSettingsSection(
          strings.sections.import,
          renderTextArea(
            strings.actions.bulkImport,
            strings.placeholders.import,
            'importText',
            values.importText || '',
          ) +
            '<div class="pq-helper">' +
            escapeHtml(strings.helpers.bulkImport || '') +
            '</div>',
          '<button class="pq-btn pq-btn-secondary" type="submit">' +
            escapeHtml(strings.actions.bulkImport || '') +
            '</button>',
        ) +
        '</form>' +
        '<form class="pq-form" data-form="settings-config">' +
        renderSettingsSection(
          strings.sections.copyBehavior,
          renderDrawerToggle(
            strings.fields.includeTemplateOnClick,
            'includeTemplateOnClick',
            values.includeTemplateOnClick !== false,
          ) +
            renderTextArea(
              strings.fields.prefix,
              strings.placeholders.prefix,
              'prefix',
              values.prefix || '',
            ) +
            '<div class="pq-helper">' +
            escapeHtml(strings.helpers.prefixHint || '') +
            '</div>' +
            renderTextArea(
              strings.fields.suffix,
              strings.placeholders.suffix,
              'suffix',
              values.suffix || '',
            ) +
            '<div class="pq-helper">' +
            escapeHtml(strings.helpers.suffixHint || '') +
            '</div>',
        ) +
        renderSettingsSection(
          strings.sections.quickRun,
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
            ),
        ) +
        renderFormActions() +
        '</form>' +
        renderSettingsSection(
          strings.sections.dataManagement,
          '',
          buttonMarkup(
            'restore-last-deleted',
            strings.actions.restoreLastDeleted,
            'pq-btn pq-btn-secondary',
            !ui.state.canRestoreLastDeleted,
          ) +
            buttonMarkup(
              'delete-all',
              strings.actions.deleteAll,
              'pq-btn pq-btn-ghost pq-btn-danger',
            ),
        ) +
        '</div>';
    }
```

Remove the now-obsolete global branches from `handleAction(action, promptId)` and keep only the new header buttons:

```js
    if (action === 'open-add') {
      openPanel({ type: 'add' });
      return;
    }

    if (action === 'open-settings') {
      openPanel({ type: 'settings' });
      return;
    }

    if (action === 'quick-run') {
      postMessage({ type: 'quickRun' });
      return;
    }
```

Handle the new settings forms in the submit listener:

```js
    if (formType === 'settings-import') {
      const text = String(formData.get('importText') || '').trim();

      if (!text) {
        pushToast(strings.helpers.importRequired || '', 'error');
        return;
      }

      postMessage({
        type: 'importPrompts',
        mode: 'append',
        text: text,
      });
      ui.panelDraft = {
        ...ui.panelDraft,
        importText: '',
      };
      ui.skipDraftSyncOnce = true;
      render();
      return;
    }

    if (formType === 'settings-config') {
      postMessage({
        type: 'updateCopySettings',
        settings: buildCopySettingsPayload({
          includeTemplateOnClick:
            formData.get('includeTemplateOnClick') === 'on',
          prefix: String(formData.get('prefix') || ''),
          quickRunCommand: String(formData.get('quickRunCommand') || ''),
          quickRunEnabled: formData.get('quickRunEnabled') === 'on',
          suffix: String(formData.get('suffix') || ''),
        }),
      });
      closePanel();
      return;
    }
```

Make the render pipeline use the new shell:

```js
    root.innerHTML =
      '<div class="pq-shell">' +
      renderHeader() +
      '<section class="pq-list">' +
      renderCards() +
      '</section>' +
      renderFooter() +
      '</div>' +
      renderDrawer() +
      renderMenu() +
      renderToasts();
```

Update `media/promptqueue-view.css` so the shell pins header/footer and the list scrolls:

```css
html,
body,
#promptqueue-app {
  height: 100%;
}

.pq-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  height: 100vh;
  gap: 10px;
  padding: 12px;
  overflow: hidden;
}

.pq-header {
  display: flex;
  justify-content: flex-end;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--pq-border-subtle);
}

.pq-header-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.pq-list {
  display: grid;
  gap: 8px;
  align-content: start;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}

.pq-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid var(--pq-border-subtle);
  color: var(--pq-text-muted);
  font-size: 12px;
  font-weight: 600;
}

.pq-settings-stack {
  display: grid;
  gap: 14px;
}

.pq-settings-section {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--pq-border-subtle);
  border-radius: 14px;
  background: var(--pq-surface-panel);
}

.pq-settings-section-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--pq-text-muted);
}

.pq-settings-section-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pq-btn-danger {
  border-color: rgba(239, 68, 68, 0.24);
  color: var(--pq-danger);
}
```

- [ ] **Step 4: Re-run the focused asset test and verify GREEN**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptWebviewAssets.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit the shell-layout slice**

Run:

```bash
git add media/promptqueue-view.js media/promptqueue-view.css src/test/suite/promptWebviewAssets.test.ts
git commit -m "feat: consolidate promptqueue sidebar controls"
```

Expected:
- commit succeeds with only the asset files staged

## Chunk 4: Final Verification

### Task 4: Run the full verification pass and do one manual sidebar smoke check

**Files:**
- Modify: `src/prompt/promptWebviewProtocol.ts`
- Modify: `src/prompt/promptWebviewViewProvider.ts`
- Modify: `src/extension.ts`
- Modify: `src/prompt/promptLocalization.ts`
- Modify: `media/promptqueue-view.js`
- Modify: `media/promptqueue-view.css`
- Modify: `src/test/mocks/vscode.ts`
- Test: `src/test/suite/promptWebviewViewProvider.test.ts`
- Test: `src/test/suite/extension.test.ts`
- Test: `src/test/suite/promptLocalization.test.ts`
- Test: `src/test/suite/promptWebviewAssets.test.ts`

- [ ] **Step 1: Run the focused regression suite**

Run:

```bash
npx vitest run --config vitest.config.ts src/test/suite/promptWebviewViewProvider.test.ts src/test/suite/extension.test.ts src/test/suite/promptLocalization.test.ts src/test/suite/promptWebviewAssets.test.ts
```

Expected:
- PASS

- [ ] **Step 2: Run the full unit suite**

Run:

```bash
npm run test:unit
```

Expected:
- PASS

- [ ] **Step 3: Run TypeScript compile**

Run:

```bash
npm run compile
```

Expected:
- PASS

- [ ] **Step 4: Launch the extension host and verify the pinned layout manually**

Run:

```bash
code --extensionDevelopmentPath="." "."
```

Expected manual checks:
- the header stays visible while a long prompt list scrolls
- the footer stays visible and shows only `used / total`
- the header shows only `新增 / 设置 / 快捷运行` in Chinese UI
- `快捷运行` is disabled when no active terminal exists
- `设置` contains `导入 / 复制行为 / 快捷运行 / 数据管理`
- `恢复上次删除` and `全部删除` are available only inside settings

- [ ] **Step 5: Check worktree state before handoff**

Run:

```bash
git status --short
```

Expected:
- clean worktree if each task commit succeeded
- or only the intended implementation files remain if commits were intentionally deferred
