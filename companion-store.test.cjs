const test = require('node:test');
const assert = require('node:assert/strict');
const pet = require('./outputs/study-room-mvp/companion-store.js');
const start = new Date(2026, 9, 10, 10).getTime();
function study(state, seconds, from = start) {
  for (let i = 0; i < seconds; i++) state = pet.reduce(state, { type: 'tick', start: from + i * 1000, end: from + (i + 1) * 1000 }, from + (i + 1) * 1000);
  return state;
}
test('25 minutes earns once; daily goal earns one additional serving, capped at two', () => {
  let state = study(pet.fresh(), 1499); assert.equal(state.food, 0);
  state = study(state, 1, start + 1499000); assert.equal(state.food, 1);
  state = study(state, 5700, start + 1500000); assert.equal(state.food, 2);
  assert.equal(state.days[pet.dayKey(start)].seconds, 7200);
});
test('overlapping tabs and duplicate ticks do not double credit; sleep gaps ignored', () => {
  const action = { type: 'tick', start, end: start + 1000 };
  let state = pet.reduce(pet.fresh(), action, start + 1000);
  state = pet.reduce(state, action, start + 1000);
  state = pet.reduce(state, { type: 'tick', start, end: start + 3600000 }, start + 3600000);
  assert.equal(state.days[pet.dayKey(start)].seconds, 1);
});
test('feed spends saved food, cannot go negative, reload retains history', () => {
  let state = study(pet.fresh(), 1500);
  state = pet.reduce(state, { type: 'feed' }, start + 1500000);
  assert.equal(state.food, 0); assert.equal(state.feeds, 1);
  assert.throws(() => pet.reduce(state, { type: 'feed' }));
  const saved = JSON.stringify(state);
  assert.deepEqual(pet.read({ getItem: () => saved }), state);
});
test('manual check-in does not earn food; changing target cannot farm extra rewards', () => {
  let state = pet.reduce(pet.fresh(), { type: 'manual' }, start); assert.equal(state.food, 0);
  state = study(state, 1800);
  state = pet.reduce(state, { type: 'target', minutes: 30 }, start + 1800000);
  assert.equal(state.food, 2);
  state = pet.reduce(state, { type: 'target', minutes: 120 }, start + 1800000);
  assert.equal(state.days[pet.dayKey(start)].target, 30); assert.equal(state.target, 120);
  state = pet.reduce(state, { type: 'target', minutes: 30 }, start + 1800000);
  assert.equal(state.food, 2);
  assert.throws(() => pet.reduce(state, { type: 'target', minutes: 0 }, start));
});
test('midnight splits credit and retains food and previous days without penalties', () => {
  const midnight = new Date(2026, 9, 11).getTime();
  let state = study(pet.fresh(), 1500);
  state = pet.reduce(state, { type: 'tick', start: midnight - 1000, end: midnight + 1000 }, midnight + 1000);
  assert.equal(state.days[pet.dayKey(midnight - 1000)].seconds, 1501);
  assert.equal(state.days[pet.dayKey(midnight)].seconds, 1);
  assert.equal(state.food, 1);
});
test('feeding grows the cat at the exact threshold and continues after adulthood', () => {
  let state = { ...pet.fresh(start), food: 11 };
  for (let i = 0; i < 9; i++) state = pet.reduce(state, { type: 'feed' }, start);
  assert.equal(pet.progress(state, start).growth, 90);
  assert.equal(pet.progress(state, start).adult, false);
  state = pet.reduce(state, { type: 'feed' }, start);
  assert.equal(pet.progress(state, start).adult, true);
  assert.equal(pet.progress(state, start).growth, 100);
  state = pet.reduce(state, { type: 'feed' }, start);
  assert.equal(pet.progress(state, start).growth, 110);
  assert.throws(() => pet.reduce(state, { type: 'feed' }, start));
  assert.equal(pet.progress(state, start).growth, 110);
});
test('legacy records keep historical feeding growth and earliest companionship day', () => {
  const legacy = { days: { '2026-10-05': { seconds: 1 }, '2026-10-08': { seconds: 2 } }, food: 2, feeds: 12, visible: false };
  const state = pet.read({ getItem: () => JSON.stringify(legacy) }, start);
  assert.equal(state.adoptedOn, '2026-10-05');
  assert.equal(pet.progress(state, start).days, 6);
  assert.equal(pet.progress(state, start).growth, 120);
  assert.equal(state.visible, false); assert.equal(state.food, 2);
});
test('companionship counts local calendar days across DST and survives reload', () => {
  const now = new Date(2026, 10, 1, 12).getTime();
  const state = pet.reduce(pet.fresh(now), { type: 'adopt' }, now);
  assert.equal(pet.progress(state, now).days, 1);
  const later = new Date(2026, 10, 3, 0, 1).getTime();
  const reloaded = pet.read({ getItem: () => JSON.stringify(state) }, later);
  assert.equal(pet.progress(reloaded, later).days, 3);
  assert.equal(pet.progress(reloaded, later).growth, 0);
});
