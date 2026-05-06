# PromptQueue Pinned Header And Settings Consolidation

## Status

Approved in conversation on 2026-05-06.

## Scope

This change restructures the PromptQueue sidebar webview so the global controls stay stable while the prompt list scrolls independently.

The scope includes:

- a pinned header with exactly three global buttons
- a scrollable prompt list region
- a pinned footer that shows queue usage only
- consolidation of non-header global actions into the settings drawer
- the minimum webview state and provider updates needed to drive quick-run button enablement correctly

The scope does not include prompt storage changes, prompt card interaction redesign, or changes to add/edit drawer behavior beyond keeping them compatible with the new shell layout.

## Goals

- Keep the header visible at the top instead of letting it scroll away with the prompt list.
- Reduce top-level clutter so the only persistent global actions are `Add`, `Settings`, and `Quick Run`.
- Move all other global actions that are not in the header into the settings drawer.
- Turn the footer into a pure status area that shows queue usage as `used / total`.
- Make the quick-run button state predictable: visible at all times, clickable only when enabled in settings and an active terminal exists.

## Non-Goals

- Do not redesign prompt card copy, drag, reorder, or item-menu behavior.
- Do not change prompt import parsing or prompt storage format.
- Do not add new VS Code contributed settings for this UI change.
- Do not attempt to pre-disable quick run for ambiguous split-terminal layouts.
- Do not replace the existing add or edit drawers with a different interaction model.

## Recommended Approach

Use one pinned shell with three stable regions plus a grouped settings drawer:

1. `Header`
2. `Queue List`
3. `Footer`
4. `Settings Drawer`

This keeps the interaction model simple and preserves the current single-drawer pattern while still cleaning up the information architecture.

## Information Architecture

### Header

The header is fixed at the top of the webview and does not scroll with the list.

It contains exactly three buttons in this order:

1. `Add`
2. `Settings`
3. `Quick Run`

Rules:

- No other global buttons appear in the header.
- The quick-run button is always rendered in place so the layout does not jump.
- The header no longer carries queue-count text. Usage feedback moves to the footer.

### Queue List

The middle region is the only scrollable area in the main shell.

Rules:

- prompt cards keep their existing behaviors for copy, toggle-used, reorder, and per-item menu access
- the list owns scrolling; the full page shell should no longer scroll as one document
- empty state and no-workspace state render inside the list region

### Footer

The footer is fixed at the bottom of the webview and is informational only.

Contents:

- a single usage summary in `used / total` form, for example `5 / 12`

Rules:

- no buttons, toggles, or menus appear in the footer
- the footer does not duplicate header actions
- the footer should remain visible while the list scrolls

### Settings Drawer

The settings drawer remains a right-side drawer, but it becomes the single home for global controls that are not in the header.

The drawer is organized into four sections in this order:

1. `Import`
2. `Copy Behavior`
3. `Quick Run`
4. `Data Management`

## Settings Drawer Content

### Import

This section holds batch import UI:

- import textarea
- import action button

This is an immediate-action section. Import executes when its button is pressed and does not wait for a general save action.

### Copy Behavior

This section holds copy-template configuration:

- `includeTemplateOnClick` toggle
- `prefix`
- `suffix`

This replaces the copy-mode toggle currently shown in the bottom dock.

### Quick Run

This section holds quick-run configuration:

- `quickRunEnabled` toggle
- `quickRunCommand`

The header `Quick Run` button is execution-only. All quick-run configuration stays here.

### Data Management

This section holds low-frequency and destructive global actions:

- `Restore Last Deleted`
- `Delete All`

Rules:

- `Delete All` keeps its destructive treatment and modal confirmation
- these actions move out of the current global overflow path and into settings

## Quick-Run Availability Model

The quick-run button should be driven by extension-side state, not inferred ad hoc in the webview.

Recommended state shape:

- `ready`
- `disabled-in-settings`
- `no-active-terminal`

The webview uses this derived availability state to decide whether the header quick-run button is enabled.

Rules:

- `ready`: button is enabled
- `disabled-in-settings`: button is disabled
- `no-active-terminal`: button is disabled

If the button is enabled and the user clicks it, the existing runtime ambiguity guard still applies. A split-terminal ambiguity remains a click-time error, not a precomputed disabled state.

## State And Refresh Rules

This change needs live button-state updates rather than a one-time snapshot.

The provider should refresh webview state when:

- the PromptQueue webview resolves
- the PromptQueue webview becomes visible again
- copy settings are updated
- the active terminal changes
- the terminal collection changes

This ensures the quick-run button reacts when the user opens or closes terminals without requiring a manual refresh.

## Error Handling

No new backend error semantics are introduced.

Behavior remains:

- settings-disabled quick run does not execute because the button is disabled
- no-active-terminal quick run does not execute because the button is disabled
- ambiguous split-terminal quick run is still blocked at execution time through the existing `PromptQuickRunError` flow
- destructive actions in data management keep their existing confirmation behavior

## Localization Impact

Localized copy must stay in Chinese and English parity for:

- header button labels where needed
- footer usage summary format
- settings section titles
- any helper text introduced by regrouping settings content

The summary format should match the approved `used / total` reading in both languages rather than restoring the old `total · used` phrasing.

## Implementation Boundaries

### `media/promptqueue-view.css`

Main responsibilities:

- change the shell so header and footer are pinned
- make the list region independently scrollable
- remove the current bottom action dock styling from the primary layout
- style the footer as a compact read-only status strip
- style grouped settings sections inside the drawer

### `media/promptqueue-view.js`

Main responsibilities:

- replace the current header and action-dock rendering with the new three-region shell
- render exactly three header actions
- render the footer usage summary with no controls
- move global import, copy-behavior, quick-run configuration, and data-management UI into the settings drawer
- consume the derived quick-run availability state for button enablement

### `src/prompt/promptWebviewProtocol.ts`

Expected impact:

- extend `PromptWebviewState` with a derived quick-run availability field

### `src/prompt/promptWebviewViewProvider.ts`

Expected impact:

- compute quick-run availability from saved settings plus terminal state
- include that availability in posted webview state
- refresh when terminal activity changes

### `src/extension.ts`

Expected impact:

- wire terminal-change events to `provider.refresh()` so the webview stays in sync with active-terminal availability

## Testing Impact

Follow test-first discipline for each changed behavior.

Regression coverage should include:

- the webview state includes the new quick-run availability field
- the header renders only `Add`, `Settings`, and `Quick Run`
- the quick-run button is disabled when quick run is off in settings
- the quick-run button is disabled when quick run is enabled but no active terminal exists
- the quick-run button is enabled when quick run is enabled and an active terminal exists
- the footer renders only the `used / total` summary and no action controls
- the settings drawer renders the four grouped sections: `Import`, `Copy Behavior`, `Quick Run`, and `Data Management`
- import and data-management actions remain reachable from settings after being removed from the main shell
- the list remains the only scrollable main region
- existing ambiguous-terminal quick-run error mapping still works after the UI restructure

## Acceptance Criteria

The redesign is complete when:

- the header stays pinned at the top while the prompt list scrolls independently
- the footer stays pinned at the bottom and only shows `used / total`
- the header always shows exactly three buttons: `Add`, `Settings`, and `Quick Run`
- all global actions not present in the header are available from the settings drawer
- the quick-run button is visible at all times but is only clickable when settings enable it and an active terminal exists
- prompt card core behaviors continue to work unchanged
- the settings drawer is clearly grouped into `Import`, `Copy Behavior`, `Quick Run`, and `Data Management`
