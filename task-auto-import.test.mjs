import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./outputs/study-room-mvp/task-inbox.js', import.meta.url), 'utf8');
test('start saves selected editor drafts before handing tasks to the study session', async () => {
  const tasks = [{ id: 'a', text: 'Old', date: '2026-10-17' }, { id: 'b', text: 'Other', date: '2026-10-17' }];
  const writes = [];
  const c = vm.createContext({
    chosen: new Set(['a']), dated: () => tasks, dayKey: () => '2026-10-17',
    taskEditors: new Map([['a', () => ({ text: 'New', notes: 'Unsaved details', minutes: null, date: '2026-10-17' })]]),
    update(task, change) { Object.assign(task, change); writes.push(task.id); },
    start(selected) { assert.deepEqual(writes, ['a']); assert.equal(selected[0].notes, 'Unsaved details'); return true; },
  });
  vm.runInContext(source.slice(source.indexOf('  async function startSelectedTasks()'), source.indexOf("  $('#chooseInboxTasks').onclick")), c);
  assert.equal(await c.startSelectedTasks(), true);
  assert.equal(tasks[0].text, 'New'); assert.equal(tasks[1].notes, undefined);
  writes.length = 0;
  c.taskEditors.set('a', () => ({ date: '2026-10-18' }));
  await assert.rejects(c.startSelectedTasks(), /今天/);
  assert.equal(writes.length, 0);
  c.taskEditors.set('a', () => { throw new Error('Invalid duration'); });
  await assert.rejects(c.startSelectedTasks(), /Invalid duration/);
  assert.equal(writes.length, 0);
});
test('today tasks enter setup with a prefilled goal and checklist instead of starting the timer', async () => {
  const tasks = [{ id: 'a', text: '读书', date: '2026-10-17' }, { id: 'b', text: '写笔记', date: '2026-10-17' }];
  const c = vm.createContext({
    state: { view: 'home' }, sessionTasks: [], previousStudyTasks: {}, setupGoalInput: {}, reminder: {},
    dayKey: () => '2026-10-17', window: { inookAccount: { requireLogin: async () => true }, together: { solo() {} } },
    persistSessionTasks: () => true, renderSessionTasks() {}, dialog: { close() {} },
    syncGoal() {}, setView(view) { c.state.view = view; }, document: { querySelector: () => ({}) },
  });
  vm.runInContext(source.slice(source.indexOf('  async function start(tasks)'), source.indexOf('  function draftSelection()')), c);
  assert.equal(await c.start(tasks), true);
  assert.equal(c.state.view, 'setup'); assert.equal(c.setupGoalInput.value, '读书\n写笔记');
  assert.equal(c.sessionTasks.length, 2); assert.equal(c.previousStudyTasks, null);
  await c.start(tasks); assert.equal(c.sessionTasks.length, 2);
  tasks[0].notes = '整理三个重点';
  await c.start(tasks);
  assert.equal(c.sessionTasks[0].notes, '整理三个重点');
  assert.equal(c.sessionTasks.length, 2);
  await c.start([{ id: 'c', text: '读书', notes: '另一项任务的详情', date: '2026-10-17' }]);
  assert.equal(c.sessionTasks.length, 3);
  assert.equal(c.sessionTasks[2].notes, '另一项任务的详情');
});

test('first-focus reminder survives reload, is account scoped and resets on the next date', () => {
  const saved = new Map(); let today = '2026-10-17', shown = 0;
  const c = vm.createContext({
    reminderAccount: 'user-a', seenThisPage: new Map(), dayKey: () => today,
    localStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) },
    taskInboxStore: { read: () => [{ text: '读书', date: today, done: false }] },
    dailyDialog: { open: false, showModal() { shown++; } }, dailySummary: {}, dailyPreview: { replaceChildren() {} }, node: () => ({}),
  });
  vm.runInContext(source.slice(source.indexOf('  function showTodayTasks()'), source.indexOf("  window.addEventListener('inook:view-change'")), c);
  c.showTodayTasks(); assert.equal(shown, 1);
  c.seenThisPage = new Map(); c.showTodayTasks(); assert.equal(shown, 1);
  c.reminderAccount = 'user-b'; c.showTodayTasks(); assert.equal(shown, 2);
  today = '2026-10-18'; c.showTodayTasks(); assert.equal(shown, 3);
  c.taskInboxStore.read = () => []; c.reminderAccount = 'user-c'; c.showTodayTasks(); assert.equal(shown, 3);
});
function harness() {
  const code = source.slice(source.indexOf('  function resetImportButton()'), source.indexOf("  $('#parseTaskPaste').onclick"));
  const timers = new Map(); let next = 0;
  const elements = { '#taskPaste': { value: '' }, '#parseTaskPaste': { hidden: false } };
  const context = vm.createContext({
    importTimer: undefined, importController: null, composing: false, drafts: [],
    status: { textContent: '', setAttribute() {} }, $: id => elements[id], renderDrafts() {},
    calls: 0, setTimeout(fn, delay) { assert.equal(delay, 1500); timers.set(++next, fn); return next; },
    clearTimeout(id) { timers.delete(id); },
  });
  vm.runInContext('function organizeInput() { calls++; }' + code, context);
  return { context, elements, timers };
}

test('home reminder dismissal persists across refresh without deleting tasks', () => {
  const saved = new Map(); let today = '2026-10-17';
  const c = vm.createContext({ reminderAccount: 'a', dismissed: '', dayKey: () => today,
    reminder: {}, reminderText: {}, state: { view: 'home' },
    taskInboxStore: { read: () => [{ text: '读书', date: today }] },
    localStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) },
  });
  vm.runInContext(source.slice(source.indexOf('  function dismissReminder()'), source.indexOf("  dailyDialog.addEventListener('click'")), c);
  vm.runInContext(source.slice(source.indexOf('  function checkReminder()'), source.indexOf("  document.addEventListener('visibilitychange'")), c);
  c.checkReminder(); assert.equal(c.reminder.hidden, false);
  c.dismissReminder(); c.dismissed = ''; c.checkReminder(); assert.equal(c.reminder.hidden, true);
  c.reminderAccount = 'b'; c.checkReminder(); assert.equal(c.reminder.hidden, false);
  c.reminderAccount = 'a'; today = '2026-10-18'; c.checkReminder(); assert.equal(c.reminder.hidden, false);
  assert.equal(c.taskInboxStore.read().length, 1);
});

test('typing only enables the explicit recognition button and never launches AI', () => {
  const { context: c, elements: e, timers } = harness();
  e['#taskPaste'].value = '制作PPT'; c.scheduleImport(); c.scheduleImport();
  assert.equal(timers.size, 0); assert.equal(c.calls, 0);
  assert.equal(e['#parseTaskPaste'].disabled, false);
  assert.equal(e['#parseTaskPaste'].textContent, 'AI 智能识别');
});

test('composition and empty input do not launch model requests', () => {
  const { context: c, elements: e, timers } = harness();
  e['#taskPaste'].value = '写'; c.composing = true; c.scheduleImport();
  assert.equal(timers.size, 0);
  assert.equal(e['#parseTaskPaste'].disabled, true);
  c.composing = false; c.scheduleImport(); assert.equal(timers.size, 0);
  e['#taskPaste'].value = ''; c.scheduleImport(); assert.equal(timers.size, 0);
  assert.equal(e['#parseTaskPaste'].disabled, true);
});

test('new input invalidates the old request before aborting and clears stale drafts', () => {
  const { context: c, elements: e, timers } = harness(); let aborted = false;
  c.importController = { abort() { assert.equal(c.importController, null); aborted = true; } };
  c.drafts = [{ text: '旧事项' }]; e['#taskPaste'].value = '新事项'; c.scheduleImport();
  assert.equal(aborted, true); assert.equal(c.drafts.length, 0);
  c.cancelImport(); assert.equal(timers.size, 0);
});
