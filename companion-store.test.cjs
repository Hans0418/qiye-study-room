const test = require('node:test');
const assert = require('node:assert/strict');
const pet = require('./outputs/study-room-mvp/companion-store.js');
const start = new Date(2026, 9, 10, 10).getTime();
const adopted = () => pet.reduce(pet.fresh(start), { type: 'choose', pet: 'qi' }, start);
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
  let state = study(adopted(), 1500);
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
  let state = { ...adopted(), food: 51 };
  for (let i = 0; i < 49; i++) state = pet.reduce(state, { type: 'feed' }, start);
  assert.equal(pet.progress(state, start).growth, 98);
  assert.equal(pet.progress(state, start).adult, false);
  state = pet.reduce(state, { type: 'feed' }, start);
  assert.equal(pet.progress(state, start).adult, true);
  assert.equal(pet.progress(state, start).growth, 100);
  state = pet.reduce(state, { type: 'feed' }, start);
  assert.equal(pet.progress(state, start).growth, 102);
  assert.throws(() => pet.reduce(state, { type: 'feed' }, start));
  assert.equal(pet.progress(state, start).growth, 102);
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
test('first adoption chooses freely; 30 nonconsecutive checkins unlock a second pet', () => {
  let state = pet.reduce(pet.fresh(start), { type: 'choose', pet: 'mimo' }, start);
  assert.throws(() => pet.reduce(state, { type: 'choose', pet: 'beagle', calendar: {} }, start));
  const calendar = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [pet.dayKey(start - i * 2 * 86400000), { manual: true, sessions: [] }]));
  state = pet.reduce(state, { type: 'choose', pet: 'beagle', calendar }, start);
  state.food = 2;
  state = pet.reduce(state, { type: 'feed' }, start);
  assert.equal(state.pets.beagle.growth, 2);
  assert.equal(state.pets.mimo.growth, 0);
  state = pet.reduce(state, { type: 'choose', pet: 'mimo' }, start);
  state = pet.reduce(state, { type: 'feed' }, start);
  assert.equal(state.pets.mimo.growth, 2);
  assert.equal(state.food, 0);
  assert.throws(() => pet.reduce(state, { type: 'choose', pet: 'qi', calendar }, start));
  assert.deepEqual(pet.read({ getItem: () => JSON.stringify(state) }, start), state);
});
test('legacy growth is retained and subsequent feeding adds only two', () => {
  const state = pet.read({ getItem: () => JSON.stringify({ days: {}, feeds: 8, food: 1, adoptedOn: '2026-10-01' }) }, start);
  const next = pet.reduce(state, { type: 'feed' }, start);
  assert.equal(next.pets.qi.growth, 82);
});
test('sync preserves independent pet progress and does not invent an adoption', () => {
  const { mergeHistory } = require('./outputs/study-room-mvp/history-backup.js');
  const s = pet.reduce(pet.fresh(start), { type: 'choose', pet: 'mimo' }, start);
  const merged = mergeHistory({ calendar: {}, companion: null }, { version: 1, calendar: {}, companion: s });
  assert.deepEqual(Object.keys(merged.companion.pets), ['mimo']);
  assert.equal(merged.companion.activePet, 'mimo');
});
test('adoption stays in backpack; birthday, zodiac and weight follow that pet', () => {
  let state = pet.reduce(pet.fresh(start), { type: 'adopt-pet', pet: 'beagle' }, start);
  assert.equal(state.activePet, null);
  assert.deepEqual(pet.profile(state, 'beagle'), { birthday: '2026-10-10', zodiac: '天秤座', weight: '1.50' });
  state.food = 1;
  state = pet.reduce(state, { type: 'feed', pet: 'beagle' }, start);
  assert.equal(pet.profile(state, 'beagle').weight, '1.67');
  assert.equal(state.activePet, null);
  const { mergeHistory } = require('./outputs/study-room-mvp/history-backup.js');
  const merged = mergeHistory({ calendar: {}, companion: state }, { version: 1, calendar: {}, companion: state });
  assert.equal(merged.companion.activePet, null);
});
