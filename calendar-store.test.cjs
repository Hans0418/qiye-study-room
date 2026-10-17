const test = require('node:test');
const assert = require('node:assert/strict');
const createStore = require('./outputs/study-room-mvp/calendar-store.js');
for (const view of ['home', 'setup', 'focus']) {
  test(`check-in study action preserves ${view} context and only navigates from home`, () => {
    const source = require('node:fs').readFileSync('./outputs/study-room-mvp/calendar.js', 'utf8');
    const handler = source.slice(source.indexOf("  cheer.querySelector('#cheerStudy').onclick"), source.indexOf('  const $ = selector'));
    const button = {}, app = { dataset: { view } };
    let cheerClosed = 0, calendarClosed = 0, setupClicks = 0;
    require('node:vm').runInNewContext(handler, {
      cheer: { close() { cheerClosed++; }, querySelector: () => button },
      dialog: { close() { calendarClosed++; } },
      document: { querySelector: selector => selector === '.app' ? app : { click() { setupClicks++; } } },
    });
    button.onclick();
    assert.equal(cheerClosed, 1); assert.equal(calendarClosed, 1);
    assert.equal(setupClicks, view === 'home' ? 1 : 0);
    assert.equal(app.dataset.view, view);
  });
}
test('calendar retains legacy history, successive days, stale tabs and undo', () => {
  const map = new Map();
  const storage = { get length() { return map.size; }, key: i => [...map.keys()][i], getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
  storage.setItem('inookCalendarV1', JSON.stringify({ '2026-10-05': { manual: true, sessions: [] } }));
  const a = createStore(storage), b = createStore(storage);
  a.update('2026-10-06', entry => ({ ...entry, manual: true }));
  b.update('2026-10-07', entry => ({ ...entry, manual: true }));
  assert.deepEqual(Object.keys(a.read()).sort(), ['2026-10-05', '2026-10-06', '2026-10-07']);
  b.update('2026-10-07', entry => ({ ...entry, sessions: [{ minutes: 25 }] }));
  a.update('2026-10-07', entry => ({ ...entry, sessions: [...entry.sessions, { minutes: 10 }] }));
  assert.equal(createStore(storage).read()['2026-10-07'].sessions.length, 2);
  a.update('2026-10-05', entry => ({ ...entry, manual: false }));
  assert.equal(createStore(storage).read()['2026-10-05'].manual, false);
  assert.equal(createStore(storage).read()['2026-10-06'].manual, true);
  storage.setItem('inookCalendarV1', 'broken');
  assert.equal(createStore(storage).read()['2026-10-06'].manual, true);
});
