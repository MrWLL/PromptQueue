# PromptQueue Icon Design

## Status

Approved in conversation on 2026-05-05.

## Scope

This change defines a dedicated icon system for PromptQueue covering two surfaces:

- the extension marketplace icon
- the VS Code activity bar sidebar icon

The work is limited to icon design direction, asset structure, and implementation constraints for those two surfaces. It does not change sidebar UI layout, prompt management behavior, extension commands, storage, or localization.

## Goals

- Give PromptQueue a clearer and more intentional product identity.
- Make the marketplace icon read as a distinct brand mark rather than a screenshot-like UI symbol.
- Make the activity bar icon more legible at small sizes and under VS Code theme tinting.
- Keep both icons recognizably part of the same product system without forcing them to be visually identical.
- Preserve continuity with the extension's existing blue color recognition where it still helps.

## Non-Goals

- Do not redesign the sidebar webview itself as part of this change.
- Do not introduce mascot-style branding, gradients, or illustrative detail.
- Do not create multiple alternate icon themes in this pass.
- Do not optimize for social media or website branding outside VS Code surfaces.

## Design Direction

The approved icon metaphor is `stacked cards`.

This metaphor is the closest match to PromptQueue's core workflow: prepared prompt items arranged in sequence, with one current item in focus and additional items waiting behind it.

The approved relationship between the two deliverables is `split responsibility`:

- the marketplace icon carries more brand character
- the activity bar icon carries more functional clarity

The approved visual style is `modern flat`.

That means the icon system should feel clean, sharp, and deliberate, with restrained geometry, moderate corner radii, no 3D treatment, and no decorative noise.

## Concept Options Considered

Three concept families were considered:

- `stacked cards + focus card`
- `stacked cards + queue progress markers`
- `stacked cards + prompt cursor`

The selected concept is `stacked cards + focus card`.

Reasons for selecting it:

- it maps most directly to the name `PromptQueue`
- it is easier to recognize quickly in both Marketplace and Activity Bar contexts
- it avoids drifting into generic workflow, task-list, or terminal-tool semantics
- it gives enough structure for a branded icon without needing extra symbolic complexity

## Icon System

The final icon system should be treated as one semantic family with different complexity levels.

### Marketplace Icon

The marketplace icon should communicate product identity first.

Structure:

- rounded square background plate
- three slightly offset cards stacked in depth order
- only the front card contains content detail
- the front card shows two to three horizontal content lines
- the first line is longer or brighter to establish focal priority

Interpretation:

- the front card represents the current prompt in focus
- the rear cards represent queued prompts waiting in sequence

The icon should feel like a compact product mark, not like a miniature screenshot of the extension UI.

### Activity Bar Icon

The activity bar icon should communicate function first.

Structure:

- monochrome icon using `currentColor`
- simplified stacked-card silhouette
- preserve the sense of layered cards plus list content
- remove background plate, color fills, and decorative detail

The activity bar icon must remain readable at small sizes, especially in the typical 16px to 24px range and under both dark and light themes.

## Visual Language

The icon system should use a modern flat visual language.

Rules:

- moderate corner radius
- solid forms or heavy outlines rather than thin strokes
- no gradients
- no soft shadows that are required for readability
- no perspective distortion beyond a slight card offset
- no tiny status dots, sparkles, cursors, or extra adornments unless they survive small-size testing clearly

The overall feel should be controlled and product-like rather than playful or illustrative.

## Color Strategy

The approved palette for the marketplace icon is:

- primary blue: `#2563EB`
- deep blue shadow: `#173A8F`
- bright cyan accent: `#7DD3FC`
- pale blue content lines: `#DBEAFE`

Usage guidance:

- the blue family preserves continuity with the current PromptQueue identity
- the deep blue should provide depth between stacked layers
- the cyan accent should be limited to focal emphasis, not spread across every element
- the pale blue should keep content-line detail visible without overwhelming the card silhouette

The activity bar icon should remain theme-tinted and therefore use `currentColor` only.

## Composition Rules

### Marketplace Icon Composition

- artboard size should be designed in vector form first, then exported for raster output
- internal content should remain centered with visible safety margins
- the background plate should provide a stable silhouette against different marketplace surroundings
- the stacked cards should be visually balanced and not lean too far into diagonal motion
- the front card should carry the clearest contour and content lines
- the rear cards should establish depth without competing for attention

### Activity Bar Icon Composition

- composition should privilege silhouette over internal detail
- layered-card meaning should be preserved with as few shapes as possible
- any list lines must be large enough to remain legible at small sizes
- no reliance on opacity, gradients, or subtle hue differences
- the icon should remain clear when rendered as a single flat theme color

## File Strategy

Current package references should remain the integration targets:

- marketplace icon: [package.json](C:/Users/82624/Desktop/workspace/BaiduSyncdisk/LL_Core_Repository/00_Research/vscode插件1/工作区/package.json:9) -> `media/promptqueue-marketplace.png`
- activity bar icon: [package.json](C:/Users/82624/Desktop/workspace/BaiduSyncdisk/LL_Core_Repository/00_Research/vscode插件1/工作区/package.json:68) -> `media/promptqueue.svg`

Implementation expectations:

- the marketplace icon should be authored from a vector source, then exported to PNG
- the activity bar icon should remain an SVG optimized for monochrome theme tinting
- the vector source should be kept maintainable so future revisions do not require redrawing from scratch

## Better Icons Reference Use

`better-icons` should be used as a reference library for shape logic, not as a source of directly reused final artwork.

Relevant reference families include:

- `cards`
- `queue`
- `layers`

Specific references reviewed during design discussion included icons equivalent in spirit to:

- `ph:cards-bold`
- `heroicons:queue-list-solid`
- `tabler:cards-filled`

These references are useful for calibrating:

- stacked-card proportions
- list rhythm
- filled versus outlined shape balance

The final PromptQueue assets should be custom-composed so they read as product-specific rather than as a borrowed stock glyph.

## Acceptance Criteria

The icon redesign is complete when:

- the marketplace icon reads as a deliberate PromptQueue brand mark
- the activity bar icon remains clear in both dark and light VS Code themes
- both icons obviously belong to the same product family
- the marketplace icon expresses `queue of prompt cards` more clearly than the current asset
- the activity bar icon reads clearly at small sizes without relying on color detail
- neither icon is easily confused with a task app, Kanban board, terminal, or generic workflow automation logo

## Validation Plan

Validation should include:

- visual check of the marketplace PNG at its native asset size and at reduced preview sizes
- visual check of the activity bar SVG inside VS Code or an equivalent monochrome preview context
- comparison against the current PromptQueue assets for recognizability and small-size clarity
- dark-theme and light-theme checks for the activity bar icon

## Implementation Boundaries

This design spec only defines the icon system and implementation constraints.

The subsequent implementation work may update:

- `media/promptqueue-marketplace.png`
- `media/promptqueue.svg`
- any intermediate vector source file added to support maintainability

No changes are expected to extension runtime logic, storage behavior, commands, or view structure.
