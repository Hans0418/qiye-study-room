import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('./outputs/study-room-mvp/app.js', import.meta.url), 'utf8');
const reorder = source.slice(source.indexOf('function reorderSessionTask('), source.indexOf('\nrenderSessionTasks();', source.indexOf('function reorderSessionTask(')));
test('reordering preserves task identity, completion and time; synchronizes accepted plan order', () => {
  const a = { id: 'a', text: 'A', minutes: 10, done: true }, b = { id: 'b', text: 'B', minutes: 15, done: false };
  const context = { sessionTasks: [a, b], state: { agentTodos: [a, b], remaining: 123 }, unconfirmedPlan: false, renderAgentTodos() {}, renderSessionTasks() {} };
  vm.createContext(context); vm.runInContext(reorder + '\nreorderSessionTask(0,1)', context);
  assert.equal(context.sessionTasks[1], a); assert.equal(a.done, true); assert.equal(a.minutes, 10);
  assert.equal(context.state.agentTodos[0], b); assert.equal(context.state.remaining, 123);
  context.unconfirmedPlan = true;
  vm.runInContext('reorderSessionTask(1,0)', context);
  assert.equal(context.sessionTasks[0], a); assert.equal(context.state.agentTodos[0], b);
  vm.runInContext('reorderSessionTask(-1,0)', context);
  assert.equal(context.sessionTasks[0], a);
});
