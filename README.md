# PromptQueue

PromptQueue is a VS Code sidebar extension for managing reusable prompts in order and copying them quickly into coding agents or other tools.

It is designed for workflows where you prepare many prompts ahead of time, move through them one by one, and need a fast way to copy, mark, reorder, and restore them.

## Features

- Card-based sidebar UI in a dedicated activity bar view
- Left-click copy with workspace-level prefix and suffix templates
- Right-click or long-press actions for edit, delete, move, and copy-content-only
- Batch import with `-*-` separators and optional inline titles
- One-click used-state toggling
- Delete-all backup with restore of the most recent full deletion
- Workspace settings for storage path and UI language (`zh-CN` / `en`)
- Data stored locally in the workspace by default

## Prompt Import Format

Batch import accepts prompts separated by lines that start with `-*-`.

Examples:

```text
-*- Title 1
Prompt body 1
-*- Title 2
Prompt body 2
```

If a `-*-` line has no non-space text after it, the prompt is treated as untitled.

Single prompt entries without any `-*-` header are also allowed.

## Copy Behavior

By default, left-click copies:

```text
prefix
current prompt content
suffix
```

Empty prefix or suffix sections are automatically omitted.

If you need only the current prompt body, use `Copy Content Only` from the prompt menu.

## Storage

Default workspace-local storage path:

```text
WorkSpace/PromptQueue
```

Stored files:

- `prompts.json`
- `settings.json`
- `last-deleted.json`

You can override the storage directory with the workspace setting:

```json
"promptQueue.storagePath": "WorkSpace/PromptQueue"
```

Relative paths resolve against the current workspace root. Absolute paths are also supported.

## Settings

PromptQueue contributes these workspace settings:

- `promptQueue.storagePath`
- `promptQueue.uiLanguage`

## Development

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run compile
```

Unit tests:

```bash
npm run test:unit
```

Run the extension in a development host:

```bash
code --extensionDevelopmentPath="<workspace>" "<workspace>"
```

## Notes

- PromptQueue currently works as a workspace extension and requires a local filesystem-backed workspace.
- Virtual workspaces are not supported.

## 中文简介

PromptQueue 是一个用于 VS Code 侧边栏的提示词队列插件，适合给 Agent、Copilot 类工作流提前准备多条提示词，按顺序复制、标记、编辑、批量导入和恢复。

默认数据保存在工作区下的 `WorkSpace/PromptQueue`，也支持在工作区设置中改为相对路径或绝对路径。
