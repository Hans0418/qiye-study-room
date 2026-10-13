import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateTime, validatePlan, SYSTEM_PROMPT } from './focus-agent.mjs';
import { cases } from './agent-cases.mjs';
import { buildPayload } from './server.mjs';

for (const c of cases) test(`输入/时间预算回归 ${c.id}: ${c.input}`, () => {
  const payload = buildPayload('local', { quick: 'test-only' }, 'quick', c.input, c.minutes);
  assert.equal(payload.messages[0].content, SYSTEM_PROMPT);
  assert.deepEqual(JSON.parse(payload.messages[1].content), { task: c.input, sessionMinutes: c.minutes });
  // A fixture checks software contracts only, not model understanding.
  const result = validatePlan({ answer: '测试交付物', question: '', assumptions: [], steps: [
    { action: '整理要求', deliverable: '要求清单', weight: 1 },
    { action: '完成初稿', deliverable: '初稿', weight: 3 },
    { action: '核对', deliverable: '待改项', weight: 1 }
  ] }, c.minutes);
  assert.equal(result.plan.reduce((sum, s) => sum + s.minutes, 0), c.minutes);
});
test('预算边界和非法模型输出', () => {
  for (let m = 1; m <= 180; m++) {
    const result = allocateTime(Array(Math.min(5, m)).fill(3), m);
    assert.equal(result.reduce((a, b) => a + b, 0), m);
    assert.ok(result.every(n => n >= 1));
  }
  assert.throws(() => allocateTime([NaN], 25));
  assert.throws(() => allocateTime([1, 2], 1));
  assert.throws(() => validatePlan({ answer: 'x', question: '', assumptions: [], steps: [] }, 25));
  assert.equal(validatePlan({ answer: '需要确认主题', question: 'PPT是什么主题？', assumptions: [], steps: [] }, 25).plan.length, 0);
});
