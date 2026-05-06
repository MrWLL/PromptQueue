# Changelog

All notable changes to PromptQueue will be documented in this file.

## 0.0.9

- Added manual `×` close buttons to sidebar toast notifications while preserving auto-dismiss
- Kept toast notifications clickable so users can dismiss them immediately when they block other controls

## 0.0.7

- Added automatic reopen positioning so the sidebar returns to the first unfinished prompt, or the bottom once all prompts are used
- Added a configurable quick-run action in the sidebar settings and toolbar
- Adjusted quick run to paste into the current terminal without auto-submitting, leaving Enter to the user
- Fixed auto-scroll so ordinary copy actions no longer yank the current reading position

## 0.0.6

- Added a persistent left-click copy mode toggle for including prefix and suffix
- Kept the add drawer open and cleared it after successful saves for faster consecutive entry
- Fixed drawer input rerender issues that could discard typed text
- Clamped context menus into the visible viewport near the bottom edge
- Moved toast notifications to the top-right to reduce obstruction
- Added local playgrounds for faster browser and VS Code development testing

## 0.0.5

- Fixed copy-template handling for standalone Markdown code fences such as ``` and ```ts
- Clarified copy settings helper text for automatic code-fence completion

## 0.0.3

- Initial Marketplace-ready release
- Added a dedicated sidebar Webview UI for prompt queue management
- Added card-based prompt list with copy, edit, delete, move, and reorder actions
- Added batch import using `-*-` separators with optional titles
- Added workspace-level prefix and suffix copy templates
- Added delete-all backup and restore of the most recent full deletion
- Added workspace settings for storage path and UI language
- Added interaction polish for compact cards, clearer used state, and explicit drawer dismissal
