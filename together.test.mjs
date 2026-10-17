import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./outputs/study-room-mvp/together.js', import.meta.url), 'utf8');
const roomId = 'a'.repeat(36);
function harness(responses, credentials = {}) {
  const elements = new Map(), storage = new Map([[`inookRoom:${roomId}`, JSON.stringify(credentials)]]);
  const element = key => {
    if (!elements.has(key)) elements.set(key, {
      hidden: false, textContent: '', innerHTML: '', value: '', disabled: false, dataset: {}, before() {},
      listeners: {}, setAttribute() {}, append() {}, replaceChildren() {}, addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); },
      querySelector: element, showModal() { this.open = true; }, close() { this.open = false; },
    });
    return elements.get(key);
  };
  const location = { href: `http://localhost/?room=${roomId}&keep=yes` };
  const calls = []; let interval, view;
  const context = {
    URL, AbortSignal, location, console, crypto: { randomUUID: () => 'test-id' }, sessionTasks: [], renderSessionTasks() {},
    history: { replaceState(_, __, url) { location.href = url.href; } },
    sessionStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    document: { querySelector: element, createElement: element, body: { append() {} }, addEventListener() {} },
    window: { addEventListener() {}, inookAccount: { requireLogin: async () => true, profile: () => null, paintAvatar() {} } },
    setInterval(fn) { interval = fn; return 1; }, clearInterval() { interval = null; },
    setView(v) { view = v; }, endStudyAndReset() { context.ended = true; }, scenes: [{ id: 'snow', name: '雪山' }],
    renderScenes() {}, updateBackdrop() {}, applySceneSound() {}, setDuration() {}, enterFocus() {}, renderTimer() {}, renderGoalClock() {},
    goalClock: { remaining: null, deadline: null, tick() { return this.remaining; }, clear() { this.remaining = null; this.deadline = null; } },
    state: { minutes: 50 }, goalInput: element('goalInput'), selectedScene: () => ({ id: 'snow' }), setupGoalInput: { value: '学习' },
    fetch: async (url, options) => {
      calls.push({ url, options });
      const result = responses.shift();
      if (result instanceof Error) throw result;
      return { ok: result.status < 400, status: result.status, json: async () => result.data };
    },
  };
  vm.runInNewContext(source, context);
  return { element, location, storage, calls, context, get view() { return view; }, get interval() { return interval; } };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
test('goal edits require a scope confirmation before private or shared writes', async () => {
  for (const share of [false, true]) {
    const now = Date.now();
    const base = { startedAt: now, serverNow: now, minutes: 50, goal: 'Original', name: 'Host', scene: 'snow', members: [], tasks: [] };
    const h = harness([{ status: 200, data: base }, { status: 200, data: {} }], { memberToken: 'guest' });
    await settle();
    assert.equal(h.element('button').textContent, '改用自己的目标');
    h.element('button').onclick();
    h.element('textarea').value = 'My new goal';
    await h.element('#saveSharedMode').onclick();
    assert.equal(h.calls.length, 1);
    assert.equal(h.context.state.goal, 'Original');
    assert.equal(h.element('h2').textContent, '同步这个目标？');
    await h.element(share ? '#shareEditedGoal' : '#saveSharedMode').onclick();
    assert.equal(h.calls[1].url, `/api/rooms/${roomId}/${share ? 'share-goal' : 'goal-mode'}`);
    assert.equal(h.context.state.goal, 'My new goal');
    assert.equal(h.context.window.together.sharedTiming() === undefined, !share);
  }
});
test('host accepts a remotely shared goal without retaining its old goal timer', async () => {
  const now = Date.now();
  const base = { startedAt: now, serverNow: now, minutes: 50, goal: 'Original', name: 'Host', scene: 'snow', members: [], tasks: [] };
  const h = harness([{ status: 200, data: base }, { status: 200, data: {} }, { status: 200, data: { ...base, goal: 'Member goal' } }], { hostToken: 'host' });
  await settle();
  h.context.goalClock.remaining = 60000;
  await h.interval();
  assert.equal(h.context.state.goal, 'Member goal');
  assert.equal(h.context.goalClock.remaining, null);
  assert.equal(JSON.parse(h.calls[1].options.body).updateGoal, false);
});
test('ending a room closes it for hosts, while guests only leave; both clear local state', async () => {
  for (const credentials of [{ hostToken: 'host' }, { memberToken: 'guest' }]) {
    const base = { name: 'Host', scene: 'snow', minutes: 50, members: [] };
    const h = harness([{ status: 200, data: base }, { status: 200, data: {} }], credentials);
    await settle();
    await h.context.window.together.leave();
    assert.equal(h.calls[1].url, `/api/rooms/${roomId}/${credentials.hostToken ? 'close' : 'leave'}`);
    assert.equal(h.element('details').hidden, true);
    assert.equal(h.storage.has(`inookRoom:${roomId}`), false);
    assert.equal(new URL(h.location.href).searchParams.has('room'), false);
    assert.equal(h.interval, null);
  }
});
test('failed close retains credentials for retry instead of silently leaving a live room', async () => {
  const h = harness([{ status: 200, data: { name: 'Host', minutes: 50, members: [] } }, new Error('offline'), { status: 200, data: {} }], { hostToken: 'host' });
  await settle();
  await assert.rejects(h.context.window.together.leave());
  assert.equal(h.storage.has(`inookRoom:${roomId}`), true);
  assert.ok(h.interval);
  await h.context.window.together.leave();
  assert.equal(h.element('details').hidden, true);
});
test('guest receiving host closure resets study and returns home without a room badge', async () => {
  const base = { startedAt: 1000, serverNow: 2000, minutes: 50, goal: 'Read', name: 'Host', scene: 'snow', members: [] };
  const h = harness([{ status: 200, data: base }, { status: 200, data: { ...base, closed: true } }], { memberToken: 'guest' });
  await settle();
  await h.interval();
  assert.equal(h.context.ended, true);
  assert.equal(h.view, 'home');
  assert.equal(h.element('details').hidden, true);
  assert.equal(h.context.window.together.sharedTasks(), undefined);
  assert.equal(h.interval, null);
});
test('expired host and guest invitations clear stale state and can create a fresh room', async () => {
  for (const credentials of [{ hostToken: 'old' }, { memberToken: 'old' }, {}]) {
    const newId = 'b'.repeat(36);
    const h = harness([
      { status: 404, data: { error: '已过期' } },
      { status: 201, data: { id: newId, hostToken: 'new-host' } },
      { status: 200, data: { id: newId, name: '测试', scene: 'snow', minutes: 50, goal: '学习', members: [], allowOwn: true } },
    ], credentials);
    await settle();
    assert.equal(h.element('details').hidden, true);
    assert.equal(h.storage.has(`inookRoom:${roomId}`), false);
    assert.equal(new URL(h.location.href).searchParams.has('room'), false);
    assert.equal(new URL(h.location.href).searchParams.get('keep'), 'yes');
    assert.equal(h.interval, null);
    await h.element('#roomAction').onclick();
    assert.equal(h.view, 'setup');
    assert.equal(h.context.window.together.configuring(), true);
    assert.equal(h.calls.length, 1);
    await h.context.window.together.create();
    assert.equal(h.calls[1].url, '/api/rooms');
    assert.equal(h.calls[1].options.method, 'POST');
    assert.equal(h.calls[2].url, `/api/rooms/${newId}`);
    assert.equal(new URL(h.location.href).searchParams.get('room'), newId);
    assert.equal(h.element('details').hidden, false);
    assert.equal(h.element('#roomAction').textContent, '开始本轮自习');
  }
});
test('temporary outage retains invitation and retries instead of treating it as expired', async () => {
  const h = harness([new Error('offline'), { status: 404, data: { error: 'expired' } }], { hostToken: 'old' });
  await settle();
  assert.equal(h.element('details').hidden, true);
  assert.equal(h.storage.has(`inookRoom:${roomId}`), true);
  assert.equal(h.element('#roomAction').textContent, '重新连接');
  await h.element('#roomAction').onclick();
  assert.equal(h.storage.has(`inookRoom:${roomId}`), false);
  assert.equal(h.interval, null);
});
test('closed rooms clear the badge and offer a new setup', async () => {
  const h = harness([{ status: 200, data: { closed: true } }], { hostToken: 'old' });
  await settle();
  assert.equal(h.element('details').hidden, true);
  assert.equal(h.element('#roomAction').disabled, false);
  assert.equal(h.interval, null);
});
test('following a late host goal does not reset session time; personal mode stays independent', async () => {
  for (const goalMode of ['follow', 'own']) {
    const base = { startedAt: 1000, serverNow: 2000, minutes: 50, goal: '', name: 'Host', scene: 'snow', members: [], allowOwn: true };
    const h = harness([{ status: 200, data: base }, { status: 200, data: { ...base, goal: 'New goal' } }], { memberToken: 'guest', goalMode, goal: 'My goal' });
    await settle();
    const remaining = h.context.state.remaining;
    await h.interval();
    assert.equal(h.context.state.goal, goalMode === 'follow' ? 'New goal' : 'My goal');
    assert.equal(h.context.state.remaining, remaining);
    assert.equal(h.context.goalInput.readOnly, true);
  }
});
test('host does not publish input-method composition; publishes committed text and goal timer', async () => {
  const base = { startedAt: 1000, serverNow: 2000, minutes: 50, goal: '', name: 'Host', scene: 'snow', members: [], allowOwn: true };
  const h = harness([{ status: 200, data: base }, { status: 200, data: base }, { status: 200, data: {} }, { status: 200, data: base }], { hostToken: 'host' });
  await settle();
  h.context.goalInput.listeners.compositionstart[0](); h.context.state.goal = 'xie zuo ye';
  await h.interval();
  assert.equal(h.calls.filter(c => c.options.method === 'POST').length, 0);
  h.context.goalInput.listeners.compositionend[0](); h.context.state.goal = '写作业';
  h.context.Date = { now: () => Date.now() + 600 };
  h.context.goalClock.remaining = 60000; h.context.goalClock.deadline = Date.now() + 60000;
  await h.interval();
  const posted = JSON.parse(h.calls.find(c => c.options.method === 'POST').options.body);
  assert.equal(posted.goal, '写作业');
  assert.deepEqual(posted.goalTimer, { remaining: 60000, running: true });
});
test('follower receives running and paused goal timer without changing personal completion or session', async () => {
  const now = Date.now();
  const base = { startedAt: now, serverNow: now, minutes: 50, goal: 'Read', name: 'Host', scene: 'snow', members: [], allowOwn: true };
  const h = harness([{ status: 200, data: { ...base, goalTimer: { deadline: now + 60000, remaining: 60000 } } }, { status: 200, data: { ...base, goalTimer: { deadline: null, remaining: 30000 } } }], { memberToken: 'guest', goalMode: 'follow' });
  await settle();
  assert.ok(h.context.window.together.sharedTiming().remaining > 59000);
  const remaining = h.context.state.remaining;
  h.context.window.together.completeSharedGoal();
  await h.interval();
  assert.equal(h.context.window.together.sharedTiming().remaining, 30000);
  assert.equal(h.context.window.together.sharedTiming().done, true);
  assert.equal(h.context.state.remaining, remaining);
  assert.equal(h.context.goalClock.remaining, null);
});
test('shared checklist preserves personal completion and remains visible in personal goal mode', async () => {
  const now = Date.now();
  const task = { id: 'step-1', text: 'Read', minutes: 15 };
  const base = { startedAt: now, serverNow: now, minutes: 50, goal: 'Read', name: 'Host', scene: 'snow', members: [], allowOwn: true, tasks: [task] };
  const h = harness([{ status: 200, data: base }, { status: 200, data: { ...base, tasks: [{ ...task, text: 'Read chapter 1', minutes: 20 }] } }], { memberToken: 'guest', goalMode: 'follow' });
  await settle();
  assert.equal(h.context.window.together.sharedTasks()[0].done, false);
  h.context.window.together.completeSharedTask('step-1', true);
  await h.interval();
  const updated = h.context.window.together.sharedTasks()[0];
  assert.equal(updated.done, true); assert.equal(updated.text, 'Read chapter 1'); assert.equal(updated.minutes, 20);
  assert.equal(h.calls.some(c => c.options.method === 'POST'), false);
  const personal = harness([{ status: 200, data: base }], { memberToken: 'guest', goalMode: 'own', goal: 'My goal' });
  await settle();
  assert.equal(personal.context.window.together.sharedTasks()[0].text, 'Read');
  assert.equal(personal.context.state.goal, 'My goal');
});

test('guest confirms sharing or keeps a task private without a server write', async () => {
  const now = Date.now();
  const base = { startedAt: now, serverNow: now, minutes: 50, goal: 'Read', name: 'Host', scene: 'snow', members: [], tasks: [] };
  const task = { id: 'new-task', text: 'Write notes', minutes: 10 };
  const h = harness([{ status: 200, data: base }, { status: 200, data: {} }, { status: 200, data: { ...base, tasks: [task] } }], { memberToken: 'guest' });
  await settle();
  let choice = h.context.window.together.confirmTask(task);
  h.element('#keepTaskPrivate').onclick();
  assert.equal(await choice, true);
  assert.equal(h.calls.length, 1);
  choice = h.context.window.together.confirmTask(task);
  await h.element('#shareTask').onclick();
  assert.equal(await choice, false);
  assert.equal(h.calls[1].url, `/api/rooms/${roomId}/tasks`);
  assert.equal(h.context.window.together.sharedTasks()[0].id, task.id);
});

test('host receives member additions and includes them in subsequent shared snapshots', async () => {
  const now = Date.now();
  const base = { startedAt: now, serverNow: now, minutes: 50, goal: '', name: 'Host', scene: 'snow', members: [], tasks: [] };
  const task = { id: 'member-task', text: 'Discuss notes', minutes: 10 };
  const h = harness([{ status: 200, data: base }, { status: 200, data: {} }, { status: 200, data: { ...base, tasks: [task] } }, { status: 200, data: {} }, { status: 200, data: { ...base, tasks: [task] } }], { hostToken: 'host' });
  await settle();
  await h.interval();
  assert.equal(h.context.sessionTasks[0].id, task.id);
  await h.interval();
  const lastWrite = h.calls.filter(c => c.options.method === 'POST').at(-1);
  const payload = JSON.parse(lastWrite.options.body);
  assert.equal(payload.tasks[0].id, task.id);
  assert.deepEqual(payload.baseTaskIds, [task.id]);
});

test('failed sharing retains the dialog for retry; cancellation does not add a task', async () => {
  const now = Date.now();
  const base = { startedAt: now, serverNow: now, minutes: 50, name: 'Host', scene: 'snow', members: [], tasks: [] };
  const h = harness([{ status: 200, data: base }, new Error('offline')], { memberToken: 'guest' });
  await settle();
  const choice = h.context.window.together.confirmTask({ id: 'task', text: 'Read', minutes: 10 });
  await h.element('#shareTask').onclick();
  assert.equal(h.element('#shareTask').disabled, false);
  assert.match(h.element('[role="status"]').textContent, /重试/);
  h.element('dialog').onclose();
  assert.equal(await choice, false);
  assert.equal(h.context.sessionTasks.length, 0);
});
