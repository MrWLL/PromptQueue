# PromptQueue Quick Run And Auto Scroll Design

## Status

Approved by user on 2026-05-05.

## Scope

This change extends the PromptQueue sidebar webview with two workflow features:

- automatically scroll the list to the next prompt that has not been copied yet
- add a configurable quick-run action in the existing settings drawer and toolbar

The scope is limited to the existing webview-based sidebar, the prompt settings persistence, and the extension-side terminal execution bridge. It does not change prompt storage format, copy templating semantics, or separator tooling.

## Goals

- Let users reopen or switch back to PromptQueue and continue copying from the next unfinished prompt without manually finding their place.
- Let users trigger a one-click terminal command from the toolbar using a command configured in the existing PromptQueue settings drawer.
- Keep the quick-run behavior safe by refusing to run when the current terminal target is ambiguous.

## Non-Goals

- Quick run does not send prompt body content. It only sends the configured command string, which defaults to `/new`.
- Quick run does not create a terminal automatically when no suitable terminal is available.
- This change does not add VS Code global settings. All new controls stay inside the PromptQueue sidebar settings drawer.

## Data Model Changes

`PromptCopySettings` grows with two new fields:

- `quickRunEnabled: boolean`
- `quickRunCommand: string`

Defaults:

- `quickRunEnabled` defaults to `false`
- `quickRunCommand` defaults to `/new`

Normalization rules:

- missing or non-boolean `quickRunEnabled` values load as `false`
- missing, empty, or whitespace-only `quickRunCommand` values normalize to `/new`
- line endings normalize the same way as existing prefix and suffix settings

## UI Changes

### Settings Drawer

The existing PromptQueue settings drawer gains:

- a checkbox toggle for enabling quick run
- a single-line text input for the quick-run command
- helper text explaining that the command is sent directly to the active terminal and executed immediately

The quick-run command field remains visible even when the feature is disabled so the user can preconfigure it before turning it on.

### Toolbar

When `quickRunEnabled` is `true`, the top toolbar shows a new button labeled `快捷运行` in Chinese UI and `Quick Run` in English UI.

When `quickRunEnabled` is `false`, the button is omitted entirely.

## Behavior Changes

### Auto Scroll

The prompt list auto-scrolls to the first item whose `used` flag is `false`.

If every item is already marked as used, the list auto-scrolls to the bottom.

Auto-scroll is triggered in these situations:

- when the sidebar webview receives a fresh state payload after resolving
- when the PromptQueue view becomes visible again after being hidden
- when a prompt copy or used-state change causes the next unfinished item to change

Auto-scroll is not intended to run on every render loop. It should be gated so normal rerenders caused by toasts, drawer changes, or menu interactions do not keep fighting the user's manual scroll position.

### Quick Run

When the toolbar button is pressed:

1. the webview posts a `quickRun` message to the extension
2. the extension resolves the normalized quick-run command from current settings
3. the extension verifies that an active terminal exists
4. the extension checks whether the terminal target is ambiguous because two terminal panes are visible at once
5. if safe, the extension sends the configured command to the active terminal and executes it immediately

Execution uses `Terminal.sendText(command, true)`.

## Terminal Ambiguity Guard

Public VS Code terminal APIs expose `window.activeTerminal` and the open terminal collection, but they do not expose a direct count of currently visible split terminal panes.

To preserve the requested behavior without guessing based on total terminal count, the extension will use a pane-focus probe:

1. remember the current `activeTerminal`
2. execute the built-in terminal pane navigation command to focus the next pane
3. compare the new `activeTerminal`
4. if focus moved to a different terminal, treat the layout as ambiguous, restore focus to the previous pane, and abort quick run with an error message
5. if focus did not move, proceed with the original active terminal

This keeps the guard aligned with the user-visible case of "two terminals shown at the same time" rather than blocking merely because multiple background terminals exist.

## Error Handling

Quick run must surface clear messages for these cases:

- existing no-workspace handling remains unchanged for operations that already depend on workspace storage
- no active terminal is available
- the terminal layout is ambiguous because two panes are visible
- the quick-run command fails validation after normalization, though normalization should normally prevent this

The error is delivered through the existing webview error/toast flow and should not leave terminal focus stuck on a different pane after a failed ambiguity check.

## Testing Impact

Add regression coverage for:

- settings store load/save defaults and persistence for quick-run fields
- prompt manager normalization of quick-run settings
- webview provider handling of the new `quickRun` message
- terminal ambiguity guard behavior for single-pane and split-pane probes
- localized strings and toolbar rendering for the quick-run button
- settings drawer rendering of the quick-run toggle and command field
- webview auto-scroll logic for first unused item and all-used fallback
