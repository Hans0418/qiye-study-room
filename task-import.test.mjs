import test from 'node:test';
import assert from 'node:assert/strict';
import { validateImport } from './task-import.mjs';
import { buildPayload } from './server.mjs';

test('AI import validates items, rejects invented times, and removes exact duplicates', () => {
  const item = { text: '制作 PPT', notes: '列大纲\n检查视觉设计', minutes: null };
  assert.equal(validateImport({ tasks: [item, item] }).tasks.length, 1);
  assert.equal(validateImport({ tasks: [{ text: item.text, notes: item.notes }] }).tasks[0].minutes, null);
  assert.deepEqual(validateImport({ tasks: [] }), { tasks: [] });
  for (const task of [{ ...item, minutes: 15 }, { ...item, text: '' }, { ...item, notes: null }, { ...item, text: 'a'.repeat(121) }]) assert.throws(() => validateImport({ tasks: [task] }));
  assert.throws(() => validateImport({ tasks: Array(21).fill(item) }));
});
test('organizing uses a distinct extraction prompt and the configured local model', () => {
  const payload = buildPayload('local', { organize: 'local-model' }, 'organize', '写作业', 25);
  assert.equal(payload.model, 'local-model');
  assert.match(payload.messages[0].content, /不扩写新任务/);
  assert.match(payload.messages[0].content, /minutes一律null/);
  assert.match(payload.messages[0].content, /我想拉屎/);
  assert.match(payload.messages[0].content, /上厕所/);
  assert.deepEqual(JSON.parse(payload.messages[1].content), { source: '写作业' });
});
