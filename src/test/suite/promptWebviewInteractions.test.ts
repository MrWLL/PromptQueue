import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { JSDOM, VirtualConsole } from 'jsdom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { getPromptQueueStrings } from '../../prompt/promptLocalization';

let script: string;
let parserScript: string;
let reorderScript: string;
let dom: JSDOM;
let domErrors: unknown[];

beforeAll(async () => {
  [script, parserScript, reorderScript] = await Promise.all([
    fs.readFile(path.resolve(__dirname, '../../../media/promptqueue-view.js'), 'utf8'),
    fs.readFile(path.resolve(__dirname, '../../../media/promptqueue-input-parser.js'), 'utf8'),
    fs.readFile(path.resolve(__dirname, '../../../media/promptqueue-reorder-math.js'), 'utf8'),
  ]);
});

afterEach(() => {
  dom?.window.close();
  vi.restoreAllMocks();
  vi.useRealTimers();
  expect(domErrors).toEqual([]);
});

function createWebview(locale = 'zh-CN') {
  domErrors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => domErrors.push(error));
  dom = new JSDOM('<div id="promptqueue-app"></div>', {
    pretendToBeVisual: true,
    runScripts: 'outside-only',
    url: 'https://promptqueue.test',
    virtualConsole,
  });
  const { window } = dom;
  const { document } = window;
  const messages: Record<string, unknown>[] = [];
  Object.assign(window, {
    acquireVsCodeApi: () => ({
      postMessage: (message: Record<string, unknown>) => messages.push(message),
    }),
  });
  window.HTMLElement.prototype.scrollIntoView = () => undefined;
  window.eval(parserScript);
  window.eval(reorderScript);
  window.eval(script);

  const state = {
    canRestoreLastDeleted: false,
    copySettings: {
      copyMode: 'direct',
      includeTemplateOnClick: true,
      prefix: '',
      quickRunCommand: '/new',
      quickRunEnabled: false,
      suffix: '',
    },
    dataReady: true,
    items: [
      { id: 'first', title: 'First', content: 'First body', used: false },
      { id: 'second', title: 'Second', content: 'Second body', used: false },
    ],
    quickRunAvailability: 'disabled-in-settings',
    storageLabel: 'Test/PromptQueue',
    strings: getPromptQueueStrings(locale),
    workspaceReady: true,
  };

  function receive(message: object) {
    window.dispatchEvent(new window.MessageEvent('message', { data: message }));
  }

  function element(selector: string) {
    const result = document.querySelector<HTMLElement>(selector);
    expect(result, selector).not.toBeNull();
    return result!;
  }

  function click(selector: string) {
    element(selector).click();
  }

  function input(name: string, value: string) {
    const field = element(`[name="${name}"]`) as HTMLInputElement;
    field.value = value;
    field.dispatchEvent(new window.Event('input', { bubbles: true }));
  }

  function value(name: string) {
    return (element(`[name="${name}"]`) as HTMLInputElement).value;
  }

  function submit(type: string) {
    element(`[data-form="${type}"]`).dispatchEvent(
      new window.Event('submit', { bubbles: true, cancelable: true }),
    );
  }

  function contextMenu(id: string, options: MouseEventInit = {}) {
    element(`[data-card-id="${id}"] .pq-card-title`).dispatchEvent(
      new window.MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        button: 2,
        clientX: 100,
        clientY: 200,
        ...options,
      }),
    );
  }

  receive({ type: 'state', state });
  messages.length = 0;
  return { window, document, messages, state, receive, element, click, input, value, submit, contextMenu };
}

describe('PromptQueue add and import interactions', () => {
  it.each([
    ['add', 'content', 'resetAddForm'],
    ['import', 'importText', 'finishImport'],
  ])('preserves text typed while %s is awaiting a success response', (form, field, command) => {
    const view = createWebview();
    view.click('[data-action="open-add"]');
    view.input(field, 'Submitted text');
    view.submit(form);
    const requestId = view.messages.at(-1)?.requestId;
    view.input(field, 'Newer text');
    view.receive({ type: 'panelCommand', command, requestId });
    expect(view.value(field)).toBe('Newer text');
    expect(view.document.querySelectorAll('.pq-drawer [type="submit"]:disabled')).toHaveLength(0);
  });

  it('does not clear a reopened Add panel when an earlier request finishes', () => {
    const view = createWebview();
    view.click('[data-action="open-add"]');
    view.input('content', 'First submission');
    view.submit('add');
    const requestId = view.messages.at(-1)?.requestId;
    view.click('[data-action="close-panel"]');
    view.click('[data-action="open-add"]');
    view.input('content', 'New submission');
    view.submit('add');
    view.receive({ type: 'panelCommand', command: 'resetAddForm', requestId });
    expect(view.value('content')).toBe('New submission');
    expect(view.document.querySelectorAll('.pq-drawer [type="submit"]:disabled')).toHaveLength(2);
  });

  it('does not close a different edit panel when the previous save finishes', () => {
    const view = createWebview();
    view.contextMenu('first');
    view.click('[data-menu-action="edit"]');
    view.submit('edit');
    const requestId = view.messages.at(-1)?.requestId;
    view.click('[data-action="close-panel"]');
    view.contextMenu('second');
    view.click('[data-menu-action="edit"]');
    view.submit('edit');
    view.receive({ type: 'panelCommand', command: 'closeEditPanel', requestId });
    expect(view.value('content')).toBe('Second body');
  });

  it('does not unlock an in-flight save when an unrelated action reports an error', () => {
    const view = createWebview();
    view.click('[data-action="open-add"]');
    view.input('content', 'Submitted text');
    view.submit('add');
    view.receive({ type: 'error', message: 'An earlier copy failed' });
    view.submit('add');
    expect(view.messages).toHaveLength(1);
  });

  it.each([
    ['edit', 'content', 'closeEditPanel'],
    ['settings-config', 'prefix', 'closeSettingsPanel'],
  ])('retains newer %s edits when their own earlier save finishes', (form, field, command) => {
    const view = createWebview();
    if (form === 'edit') {
      view.contextMenu('first');
      view.click('[data-menu-action="edit"]');
    } else {
      view.click('[data-action="open-settings"]');
    }
    view.submit(form);
    const requestId = view.messages.at(-1)?.requestId;
    view.input(field, 'Unsaved newer text');
    view.receive({ type: 'panelCommand', command, requestId });
    expect(view.value(field)).toBe('Unsaved newer text');
    expect(view.document.querySelectorAll('.pq-drawer [type="submit"]:disabled')).toHaveLength(0);
    view.submit(form);
    view.receive({ type: 'panelCommand', command, requestId: view.messages.at(-1)?.requestId });
    expect(view.document.querySelector('.pq-drawer')).toBeNull();
  });

  it('places independent add and import forms in Add, with a Back action and no Save button', () => {
    const view = createWebview();
    view.click('[data-action="open-add"]');

    const forms = view.document.querySelectorAll('.pq-drawer form');
    expect(Array.from(forms, (form) => form.getAttribute('data-form'))).toEqual(['add', 'import']);
    expect(view.element('[data-form="add"] [type="submit"]').textContent).toBe('新增');
    expect(view.element('[data-form="import"] [type="submit"]').textContent).toBe('批量导入');
    expect(view.element('.pq-drawer').textContent).not.toContain('保存');
    expect(view.element('[data-action="close-panel"]').textContent).toBe('返回');
    view.click('[data-action="close-panel"]');
    expect(view.document.querySelector('.pq-drawer')).toBeNull();
  });

  it('keeps Save for settings and editing and removes import from settings', () => {
    const view = createWebview();
    view.click('[data-action="open-settings"]');
    expect(view.document.querySelector('[name="importText"]')).toBeNull();
    expect(view.element('[data-form="settings-config"] [type="submit"]').textContent).toBe('保存');
    view.click('[data-action="close-panel"]');
    view.contextMenu('first');
    view.click('[data-menu-action="edit"]');
    expect(view.element('[data-form="edit"] [type="submit"]').textContent).toBe('保存');
  });

  it('clears only the added prompt after success and blocks both forms while waiting', () => {
    const view = createWebview();
    view.click('[data-action="open-add"]');
    view.input('title', 'Draft title');
    view.input('content', 'Draft body');
    view.input('importText', '-*- Batch\nBatch body');
    view.submit('add');
    view.submit('add');
    view.submit('import');
    expect(view.messages).toEqual([{
      type: 'createPrompt',
      requestId: expect.any(Number),
      draft: { title: 'Draft title', modelLevel: null, content: 'Draft body' },
    }]);
    expect(view.document.querySelectorAll('.pq-drawer [type="submit"]:disabled')).toHaveLength(2);

    view.receive({ type: 'panelCommand', command: 'resetAddForm' });
    view.receive({ type: 'toast', message: '已新增' });
    view.receive({ type: 'state', state: view.state });
    expect(view.value('title')).toBe('');
    expect(view.value('content')).toBe('');
    expect(view.value('importText')).toBe('-*- Batch\nBatch body');
    expect(view.document.querySelectorAll('.pq-drawer [type="submit"]:disabled')).toHaveLength(0);
  });

  it('imports as append, preserves the single prompt draft, and clears only the batch after success', () => {
    const view = createWebview();
    view.click('[data-action="open-add"]');
    view.input('title', 'Keep title');
    view.input('content', 'Keep body');
    view.input('importText', '-*- One\nFirst\n-*- Two\nSecond');
    view.submit('import');
    view.submit('import');
    view.submit('add');
    expect(view.messages).toEqual([{
      type: 'importPrompts', requestId: expect.any(Number), mode: 'append', text: '-*- One\nFirst\n-*- Two\nSecond',
    }]);
    expect(view.value('importText')).toContain('First');

    view.receive({ type: 'panelCommand', command: 'finishImport' });
    view.receive({ type: 'toast', message: '已导入' });
    view.receive({ type: 'state', state: view.state });
    expect(view.value('importText')).toBe('');
    expect(view.value('title')).toBe('Keep title');
    expect(view.value('content')).toBe('Keep body');
    expect(view.document.querySelectorAll('.pq-drawer [type="submit"]:disabled')).toHaveLength(0);
  });

  it('validates each form independently and retains both drafts for retry after an error', () => {
    const view = createWebview();
    view.click('[data-action="open-add"]');
    view.submit('add');
    view.submit('import');
    expect(view.messages).toEqual([]);
    view.input('content', 'Keep prompt');
    view.input('importText', '-*- Batch\nKeep batch');
    view.submit('import');
    view.receive({ type: 'error', message: 'Write failed', requestId: view.messages.at(-1)?.requestId });
    expect(view.value('content')).toBe('Keep prompt');
    expect(view.value('importText')).toBe('-*- Batch\nKeep batch');
    view.submit('import');
    expect(view.messages).toHaveLength(2);
  });

  it('uses the English labels when the UI language is English', () => {
    const view = createWebview('en');
    view.click('[data-action="open-add"]');
    expect(view.element('[data-action="close-panel"]').textContent).toBe('Back');
    expect(view.element('[data-form="add"] [type="submit"]').textContent).toBe('Add');
    expect(view.element('[data-form="import"] [type="submit"]').textContent).toBe(view.state.strings.actions.bulkImport);
  });

  it.each([
    ['组说明\n# 组标题【低】\n## 最近的标题【高】\n中间说明', '## 最近的标题【高】', 'high'],
    ['普通文字标题【低】\n中间说明', '', null],
  ])('uses the shared fenced-title rule when pasting %s into Add', (preamble, title, modelLevel) => {
    const view = createWebview();
    view.click('[data-action="open-add"]');
    const event = new view.window.Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: { getData: () => `${preamble}\n\`\`\`\n本条正文\n\`\`\`` },
    });
    view.element('[name="content"]').dispatchEvent(event);

    expect(view.value('title')).toBe(title);
    expect(view.value('content')).toBe('本条正文');
    view.submit('add');
    expect(view.messages).toEqual([{
      type: 'createPrompt',
      requestId: expect.any(Number),
      draft: { title: title || undefined, modelLevel, content: '本条正文' },
    }]);
  });
});

describe('PromptQueue context menu interactions', () => {
  it('can scroll to a valid loaded ID containing quotes and selector characters', () => {
    vi.useFakeTimers();
    const view = createWebview();
    const scrollIntoView = vi.spyOn(view.window.HTMLElement.prototype, 'scrollIntoView');
    view.state.items[0].id = 'task"[one]\\';
    view.receive({ type: 'state', state: view.state });
    vi.advanceTimersByTime(20);
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('does not copy a card while changes in Modify are being saved', () => {
    const view = createWebview();
    view.click('[data-action="toggle-settings-mode"]');
    view.click('[data-action="finish-prompt-mode"]');
    view.click('[data-card-id="first"]');
    expect(view.messages.map((message) => message.type)).toEqual(['applyPromptModeChanges']);
  });

  it('discards old workspace sessions when a new workspace state arrives', () => {
    const view = createWebview();
    view.receive({ type: 'state', state: { ...view.state, contextId: 1 } });
    view.click('[data-action="toggle-settings-mode"]');
    view.click('[data-card-id="first"]');
    view.input('content', 'Previous workspace draft');
    view.receive({ type: 'state', state: { ...view.state, contextId: 2 } });
    expect(view.document.querySelector('.pq-drawer')).toBeNull();
    expect(view.document.querySelector('[data-action="finish-prompt-mode"]')).toBeNull();
  });

  it('opens and closes after scrolling without replacing the list or its cards', () => {
    const view = createWebview();
    const list = view.element('.pq-list');
    const card = view.element('[data-card-id="first"]');
    list.scrollTop = 420;
    view.contextMenu('first');
    expect(view.document.querySelector('.pq-list')).toBe(list);
    expect(view.document.querySelector('[data-card-id="first"]')).toBe(card);
    expect(list.scrollTop).toBe(420);
    expect(view.document.querySelector('.pq-menu-open')).not.toBeNull();

    view.window.dispatchEvent(new view.window.KeyboardEvent('keydown', { key: 'Escape' }));
    expect(view.document.querySelector('.pq-menu-open')).toBeNull();
    expect(view.document.querySelector('.pq-list')).toBe(list);
  });

  it('allows another right click to switch the menu target without a blocking overlay', () => {
    const view = createWebview();
    view.contextMenu('first');
    expect(view.document.querySelector('.pq-menu-dismiss')).toBeNull();
    view.contextMenu('second');
    view.click('[data-menu-action="copy-raw"]');
    expect(view.messages).toEqual([{ type: 'copyPromptRaw', promptId: 'second' }]);
  });

  it('survives restored scroll events after refresh, then closes on real list scrolling', () => {
    const view = createWebview();
    view.element('.pq-list').scrollTop = 420;
    view.contextMenu('first');
    view.receive({ type: 'toast', message: 'Previous copy finished' });
    view.receive({ type: 'state', state: view.state });
    const list = view.element('.pq-list');
    expect(list.scrollTop).toBe(420);
    list.dispatchEvent(new view.window.Event('scroll'));
    expect(view.document.querySelector('.pq-menu-open')).not.toBeNull();

    view.element('.pq-menu-open').dispatchEvent(new view.window.Event('scroll'));
    expect(view.document.querySelector('.pq-menu-open')).not.toBeNull();
    list.scrollTop = 460;
    list.dispatchEvent(new view.window.Event('scroll'));
    expect(view.document.querySelector('.pq-menu-open')).toBeNull();
  });

  it('dismisses an outside click without copying or toggling the underlying card', () => {
    const view = createWebview();
    view.contextMenu('first');
    view.click('[data-card-id="second"]');
    expect(view.document.querySelector('.pq-menu-open')).toBeNull();
    expect(view.messages).toEqual([]);
    view.click('[data-card-id="second"]');
    expect(view.messages).toEqual([{ type: 'copyPrompt', promptId: 'second' }]);
  });

  it.each(['toggle-sort-mode', 'toggle-settings-mode'])('keeps the menu disabled during %s', (action) => {
    const view = createWebview();
    view.click(`[data-action="${action}"]`);
    view.contextMenu('first');
    expect(view.document.querySelector('.pq-menu-open')).toBeNull();
    expect(view.messages).toEqual([]);
  });

  it('accepts keyboard context menu events without a right mouse button', () => {
    const view = createWebview();
    view.contextMenu('first', { button: 0, detail: 0 });
    expect(view.document.querySelector('.pq-menu-open')).not.toBeNull();
  });
});

describe('PromptQueue drag auto-scroll', () => {
  it.each(['direction change', 'state refresh'])('keeps scrolling the current list after a %s', (scenario) => {
    vi.useFakeTimers();
    const view = createWebview();
    vi.spyOn(view.window.HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const top = this.classList.contains('pq-list') ? 0 : this.getAttribute('data-card-id') === 'first' ? 100 : 200;
      const height = this.classList.contains('pq-list') ? 400 : 50;
      return { top, bottom: top + height, left: 0, right: 300, width: 300, height, x: 0, y: top, toJSON() {} };
    });
    function pointer(type: string, target: EventTarget, clientY: number) {
      const event = new view.window.Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, { button: 0, isPrimary: true, pointerId: 1, clientY });
      target.dispatchEvent(event);
    }
    view.click('[data-action="toggle-sort-mode"]');
    view.element('.pq-list').scrollTop = 200;
    pointer('pointerdown', view.element('[data-card-id="first"]'), 125);
    pointer('pointermove', view.window, 5);
    vi.advanceTimersByTime(20);
    const previousTop = view.element('.pq-list').scrollTop;
    expect(previousTop).toBeLessThan(200);
    pointer('pointermove', view.window, 395);
    if (scenario === 'state refresh') {
      view.receive({ type: 'state', state: view.state });
    }
    vi.advanceTimersByTime(20);
    expect(view.element('.pq-list').scrollTop).toBeGreaterThan(previousTop);
    pointer('pointerup', view.window, 395);
  });
});
