const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeHistory } = require('./outputs/study-room-mvp/history-backup.js');
const companion = require('./outputs/study-room-mvp/companion-store.js');
test('history recovery merges old dates, preserves sessions and is idempotent', () => {
  const session = { goal: '读书', minutes: 25, completedAt: '2020-01-01' };
  const a = { version: 1, calendar: { '2020-01-01': { manual: true, sessions: [session] } }, companion: null };
  const b = { version: 1, calendar: { '2026-10-16': { manual: true, sessions: [] }, '2020-01-01': { manual: false, sessions: [session] } }, companion: null };
  const merged = mergeHistory(a, b);
  assert.equal(Object.keys(merged.calendar).length, 2);
  assert.equal(merged.calendar['2020-01-01'].sessions.length, 1);
  assert.equal(merged.calendar['2020-01-01'].manual, true);
  assert.deepEqual(mergeHistory(merged, b), merged);
});
test('growth and food do not expire years later or duplicate on repeated restore', () => {
  const old = { ...companion.fresh(Date.parse('2020-01-01T12:00:00Z')), feeds: 8, food: 2, days: { '2020-01-01': { seconds: 3600, earned: 2, target: 60 } } };
  delete old.pets; delete old.activePet;
  const a = { version: 1, calendar: {}, companion: companion.fresh() };
  const b = { version: 1, calendar: {}, companion: old };
  const merged = mergeHistory(a, b);
  assert.equal(merged.companion.feeds, 8); assert.equal(merged.companion.food, 2);
  assert.equal(companion.progress(merged.companion, Date.parse('2040-01-01')).growth, 80);
  assert.deepEqual(mergeHistory(merged, b), merged);
});
test('invalid backup is rejected before any data is written', () => {
  const a = { version: 1, calendar: {}, companion: null };
  assert.throws(() => mergeHistory(a, { version: 2, calendar: {} }));
  assert.throws(() => mergeHistory(a, { ...a, companion: { days: {}, feeds: -1, food: 0 } }));
});
