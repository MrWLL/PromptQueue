# PromptQueue Webview Polish Design

## Status

Approved by user on 2026-03-16.

## Scope

This change polishes the PromptQueue sidebar webview without changing persistence, message protocol, or core prompt operations.

The scope is limited to five UX issues reported after the initial webview migration:

- remove the summary block that shows total, used, and storage
- make prompt cards more compact in the sidebar
- make used-state visuals much more obvious
- replace the heavy black copy toast with a theme-aware lightweight toast
- replace the heavy persistent context menu with a theme-aware auto-dismiss menu

## Goals

- Fit more prompt items into the sidebar at once.
- Make used items distinguishable at a glance.
- Keep the interface visually aligned with VS Code themes instead of hard-coded dark overlays.
- Make the context menu behave like a normal menu on desktop and touch devices.

## UI Changes

### Layout

The status summary block is removed entirely. The top toolbar remains, and the list starts immediately below it.

Prompt cards become denser:

- smaller vertical padding
- smaller gaps
- lighter shadow
- tighter corner radius
- reduced body preview length

This keeps cards easy to click without wasting as much vertical space.

### Used State

Used-state presentation changes from "slightly faded card" to an explicit completion treatment:

- the leading dot becomes red
- the title gains a strike-through
- the body preview is hidden
- the card remains visible in place so ordering and history are preserved

This makes used items easy to scan past while still keeping them in the queue.

### Toasts

Copy-success toasts remain in-webview, but they change to a lighter, theme-aware appearance:

- use VS Code theme variables instead of a hard-coded black background
- smaller visual weight
- short auto-dismiss duration

### Context Menu

The item context menu stays in-webview and still supports desktop right-click plus touch long-press.

Behavior changes:

- closes after any menu action
- closes when clicking outside
- closes when clicking another card
- closes on `Esc`
- closes on scroll

Visual changes:

- use VS Code theme variables instead of a hard-coded black block
- reduce visual heaviness to feel closer to a native editor menu

## Error Handling

No backend error semantics change in this polish pass. Existing error and toast flows stay intact, only the visuals and dismissal behavior change.

## Testing Impact

Add focused regression coverage for the frontend assets so the polish does not drift:

- summary section no longer rendered from the webview script
- used-state card treatment is encoded in CSS and JS
- context menu adds escape and outside-dismiss behavior
- toast and menu styling use theme-aware variables instead of pure black surfaces
