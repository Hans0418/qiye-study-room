const test = require('node:test');
const assert = require('node:assert/strict');
const GoalClock = require('./outputs/study-room-mvp/goal-clock.js');
test('elapsed time, pause, resume, expiry and completion', () => {
  const c = new GoalClock(); c.start(1, true, 0);
  assert.equal(c.tick(20000), 40000);
  c.pause(20000); assert.equal(c.tick(100000), 40000);
  c.resume(100000); assert.equal(c.tick(140001), 0);
  c.start(5, false, 140001); assert.equal(c.tick(500000), 300000);
  c.resume(500000); assert.equal(c.tick(800001), 0);
  c.complete(); c.resume(900000); assert.equal(c.deadline, null); assert.equal(c.done, true);
  c.clear(); assert.equal(c.remaining, null);
});
test('background timer delay and replacement do not lose elapsed time', () => {
  const c = new GoalClock(); c.start(1, true, 0);
  assert.equal(c.tick(180000), 0);
  c.start(2, true, 180000); assert.equal(c.tick(181000), 119000);
  assert.throws(() => c.start(0, true));
  assert.throws(() => c.start(1.5, true));
});
