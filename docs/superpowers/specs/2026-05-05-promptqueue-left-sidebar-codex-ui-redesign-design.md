# PromptQueue Left Sidebar Codex-Inspired UI Redesign

## Status

Approved in conversation on 2026-05-05.

## Scope

This change redesigns the PromptQueue sidebar webview to feel closer to the OpenAI Codex VS Code extension UI language while staying inside the existing left sidebar activity view.

The redesign is limited to the PromptQueue webview presentation layer and related localized copy. It does not change prompt storage, prompt ordering semantics, copy templating behavior, import parsing, quick run behavior, or extension-side message protocol.

## Goals

- Make the left sidebar look calmer, more intentional, and more professional.
- Shift the interface from a "button strip plus cards" feel to a "workflow panel" feel.
- Improve scanability of prompt items in narrow sidebar widths.
- Preserve all current core actions while reducing visual clutter.
- Keep the design strongly compatible with VS Code theming and side-panel constraints.

## Non-Goals

- Do not move PromptQueue to a right-side chat layout.
- Do not introduce new core prompt-management features.
- Do not change the underlying webview message contract unless a purely presentational need makes it unavoidable.
- Do not turn the sidebar into a rich editor or multi-pane application.

## Design Direction

The target aesthetic is inspired by the OpenAI Codex IDE extension: restrained, dark-biased but theme-aware, low-contrast, workflow-oriented, and quietly premium.

The key adaptation is that PromptQueue remains a left sidebar tool, so the redesign should borrow Codex's information hierarchy and control restraint rather than copy its right-panel composition directly.

This redesign should feel:

- quieter than the current chip-heavy toolbar
- denser without feeling cramped
- more systematic across cards, drawers, menus, and feedback
- more focused on one primary next action at a time

## Information Architecture

The webview is reorganized into four consistent regions:

1. `Queue Header`
2. `Queue List`
3. `Action Dock`
4. `Unified Drawer`

This replaces the current emphasis on a multi-action top toolbar.

### Queue Header

The top area becomes a slim panel header instead of a command strip.

Contents:

- primary title: `Prompt Queue`
- secondary queue status line: for example `12 prompts · 4 used`
- one high-priority action button: `New`

The header establishes identity and current state first, then exposes the most common action. It should not compete visually with the list content.

### Queue List

The list remains the core content area, but prompt cards are redesigned into quieter list-style items.

Each prompt item should behave more like a workflow row than a standalone note card.

### Action Dock

A fixed bottom dock becomes the primary home for queue actions. This is the major structural shift in the redesign.

Contents:

- primary action: `Add Prompt`
- secondary actions: `Import`, `Settings`
- conditional action: `Quick Run` when enabled
- overflow action: `More`

This gives the sidebar a stable "next action" zone similar in spirit to Codex's composer-like control area.

### Unified Drawer

Add, edit, import, and settings continue to use a drawer, but they share one visual shell and one interaction model.

## Component Design

### Header

The header should use:

- minimal vertical space
- muted metadata text
- one clear primary button on the right
- a subtle divider or surface transition beneath it

The current row of many chips should be removed from the header area.

### Prompt Item

Each item is redesigned into a three-part structure:

- a narrow left status rail
- a central content column
- a right-side hover action affordance

#### Unused State

- low-contrast neutral rail or dot
- strong title
- short preview body

#### Used State

- rail shifts to a muted warning or used color
- title drops in emphasis
- body preview becomes weaker or hidden depending on density
- the full row remains in place to preserve queue order and history

Used state should be obvious, but not loud or destructive-looking.

#### Hover State

- subtle surface lift through background and border change
- no exaggerated movement
- optional lightweight `...` affordance appears for discoverability of item actions

#### Content Density

- title prioritized on one line where possible
- body preview limited to two lines
- tighter spacing than the current card design
- long text should read as a summary, not as a block note

### Action Dock

The bottom dock should be visually denser and slightly more solid than the list area, but still theme-aware and low contrast.

It should feel like a persistent control base, not a floating toolbar.

Rules:

- main action visually leads
- secondary actions remain clearly available
- destructive actions are excluded from the main dock surface
- layout remains usable in narrow widths

### More Menu

The `More` entry contains low-frequency and dangerous actions:

- `Restore Last Deleted`
- `Delete All`

If needed, `Delete All` can also appear inside the settings drawer as a danger-zone action, but it should not return to top-level prominence.

### Drawer

All drawer variants should share:

- a stable header
- a scrollable form body
- a fixed footer with actions
- consistent field spacing and helper text treatment

This applies to:

- add prompt
- edit prompt
- bulk import
- settings

The goal is for drawers to feel like one system with different content, not four separate mini-pages.

### Toast

Toasts should become lighter and shorter-lived.

Rules:

- minimal color usage
- theme-aware surfaces
- compact copy
- small visual separation between success and error, without dramatic tint blocks

### Context Menu

The menu should feel closer to an embedded editor menu:

- tighter padding
- steadier radius
- restrained hover treatment
- dangerous item differentiated subtly

## Motion And Interaction

Animation should support orientation and confidence, not decoration.

Recommended timing:

- hover transitions: `120ms` to `140ms`
- press feedback: `80ms` to `100ms`
- drawer open/close: `160ms` to `180ms`
- toast enter/exit: about `140ms`
- menu appearance: light fade plus slight scale

Behavior rules:

- prompt items should not visibly jump upward on hover
- action buttons should feel pressable but not bouncy
- drawer overlay should stay light
- reorder feedback should emphasize insertion targeting over whole-card flashing
- auto-scroll should briefly highlight the destination item once after scroll completion

## Theme And Token Strategy

The redesign should stay rooted in VS Code theme tokens, but PromptQueue should introduce a more semantic variable layer.

Recommended variable groups:

### Surface

- `--pq-surface-base`
- `--pq-surface-panel`
- `--pq-surface-elevated`
- `--pq-surface-dock`

### Text

- `--pq-text-strong`
- `--pq-text-muted`
- `--pq-text-faint`

### Border

- `--pq-border-subtle`
- `--pq-border-strong`
- `--pq-focus-ring`

### State

- `--pq-accent`
- `--pq-accent-soft`
- `--pq-used`
- `--pq-danger-soft`

The current bright cyan emphasis should be reduced in prominence. The redesign should derive its quality from hierarchy, spacing, and surface control more than from accent color.

## Implementation Boundaries

The redesign should be delivered primarily through the existing webview assets.

### `media/promptqueue-view.js`

Main responsibilities:

- replace `renderToolbar()` with `renderHeader()` plus `renderActionDock()`
- redesign prompt item markup
- move low-frequency and dangerous actions out of the top-level primary region
- add item action affordance behavior where appropriate
- preserve existing message types and action semantics

### `media/promptqueue-view.css`

Main responsibilities:

- replace the current chip-heavy and card-heavy look with a panel-plus-list-plus-dock system
- reduce shadow reliance
- unify drawer, menu, and toast surface language
- standardize spacing values and component rhythm

### `src/prompt/promptLocalization.ts`

Main responsibilities:

- add header status copy
- add `More` menu labels
- add any new tooltip or helper strings needed for the redesigned controls
- keep Chinese and English parity

### `src/prompt/promptWebviewViewProvider.ts`

Expected impact:

- ideally no protocol changes
- only adjust state shape if a new presentational field becomes necessary and cannot be derived in-webview

### `playground/*`

Use the playground as the main fast-feedback surface for:

- density checks
- narrow sidebar behavior
- dock placement
- hover affordances
- used-state clarity

## Accessibility And Usability

The redesign must preserve or improve usability in narrow sidebars.

Requirements:

- all primary actions remain keyboard reachable
- hover-only affordances must not hide essential actions from keyboard users
- focus states remain visible against low-contrast surfaces
- used versus unused items remain distinguishable without relying on a single color cue
- drawers remain stable during rerender and preserve focus correctly

## Error Handling

No backend error semantics change in this redesign.

Existing flows remain:

- webview posts action messages
- provider performs manager action
- provider posts updated state and toast or error feedback

Visual treatment of errors may change, but error meaning and routing should not.

## Testing Impact

Regression coverage should focus on behavior stability through the structural redesign.

Key areas:

- header rendering replaces the old toolbar structure correctly
- action dock renders the correct buttons for quick-run enabled and disabled states
- low-frequency actions remain reachable through the new `More` path
- prompt item markup still supports copy, toggle-used, reorder, and menu behavior
- drawer focus preservation remains intact
- menu dismiss behavior still works on outside click, escape, and scroll
- auto-scroll still lands on the next unused item and highlights it without fighting normal rerenders
- empty state and no-workspace state still read correctly in the new layout
- localization coverage includes any new labels and helper text

## Acceptance Criteria

The redesign is complete when:

- the sidebar clearly reads as `Header + Queue List + Action Dock + Unified Drawer`
- the UI feels visually closer to Codex's restrained panel language without abandoning the left sidebar context
- top-level clutter is reduced compared with the current implementation
- all existing core prompt operations remain available
- the queue is easier to scan and operate in narrow widths
- the experience feels smoother through restrained motion and clearer hierarchy rather than through added ornament
