import test from 'node:test';
import assert from 'node:assert/strict';
import { describeAIError } from './server.mjs';
test('AI failures distinguish connectivity, truncation, JSON and validation', () => {
  assert.equal(describeAIError(new TypeError('fetch failed')).code, 'MODEL_CONNECTION');
  assert.equal(describeAIError(new SyntaxError('private content')).code, 'MODEL_JSON');
  assert.equal(describeAIError(new Error('MODEL_TRUNCATED')).code, 'MODEL_TRUNCATED');
  assert.equal(describeAIError(new Error('INVALID_PLAN')).code, 'INVALID_PLAN');
  assert.equal(describeAIError(new Error('INVALID_BUDGET')).code, 'INVALID_BUDGET');
  assert.equal(describeAIError({ name: 'AbortError' }).code, 'MODEL_TIMEOUT');
  assert.ok(!JSON.stringify(describeAIError(new Error('private content'))).includes('private content'));
});
