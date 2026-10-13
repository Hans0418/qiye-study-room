import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const model = createRequire(import.meta.url)('./outputs/study-room-mvp/companion-store.js');

test('hidden companion can be restored, including after reload, without losing progress', async () => {
  let saved = { visible: false, food: 3, feeds: 2, target: 60, days: {} };
  function boot() {
    const nodes = new Map();
    function element() {
      return { hidden: false, classList: { add() {}, remove() {} }, setAttribute(name, value) { this[name] = value; }, getAttribute(name) { return this[name]; }, append() {},
        querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, element()); return nodes.get(selector); },
        showModal() { this.open = true; }, close() { this.open = false; } };
    }
    const created = [];
    const document = { body: element(), createElement() { const el = element(); created.push(el); return el; },
      querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, element()); return nodes.get(selector); }, addEventListener() {} };
    const window = { addEventListener() {}, InookCompanionStore: {
      ...model,
      read: () => structuredClone(saved), dayKey: () => 'today', key: 'pet',
      reduce: (state, action) => action.type === 'visible' ? ({ ...state, visible: action.value }) : state
    } };
    vm.runInNewContext(fs.readFileSync('outputs/study-room-mvp/companion.js', 'utf8'), {
      window, document, localStorage: { setItem(key, value) { saved = JSON.parse(value); } },
      navigator: { locks: { request: async (name, update) => update() } }, setInterval() {}, setTimeout() {}, clearTimeout() {},
    });
    return { launcher: created.find(el => el.id === 'companionLauncher'), restore: created.find(el => el.id === 'restoreCompanion'), nodes };
  }
  let ui = boot();
  assert.equal(ui.launcher.hidden, true); assert.equal(ui.restore.hidden, false);
  await ui.restore.onclick();
  assert.equal(ui.launcher.hidden, false); assert.equal(ui.restore.hidden, true);
  assert.equal(saved.food, 3); assert.equal(saved.feeds, 2);
  ui.nodes.get('#companionVisible').checked = false;
  await ui.nodes.get('#companionVisible').onchange();
  ui = boot();
  assert.equal(ui.restore.hidden, false);
  await ui.restore.onclick(); assert.equal(saved.visible, true);
  saved.feeds = 10;
  ui = boot();
  assert.equal(ui.nodes.get('img').src, './assets/study-companion-adult.png');
  assert.equal(ui.nodes.get('.companion-portrait img').src, './assets/study-companion-adult.png');
  assert.equal(ui.nodes.get('#companionStage').textContent, '成年猫');
});

test('leave dialog has no floating-window entry or loaded feature', () => {
  const app = fs.readFileSync('outputs/study-room-mvp/app.js', 'utf8');
  const html = fs.readFileSync('outputs/study-room-mvp/index.html', 'utf8');
  assert.doesNotMatch(app, /leaveStudyFloat|taskWindow|小窗继续/);
  assert.doesNotMatch(html, /task-window\.js/);
  assert.match(app, /留在书房/); assert.match(app, /结束并返回/);
});
