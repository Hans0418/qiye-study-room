import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudConfig } from './cloud-config.mjs';
const env = { APP_RUNTIME: 'cloud', APP_ORIGIN: 'https://demo.example', DATABASE_URL: 'postgresql://demo:password@db.example:6543/postgres', ARK_API_KEY: 'test-only-not-a-real-key' };

test('local remains the default; cloud requires explicit credentials', () => {
  assert.equal(cloudConfig({}), null);
  for (const key of ['APP_ORIGIN', 'DATABASE_URL', 'ARK_API_KEY']) {
    assert.throws(() => cloudConfig({ ...env, [key]: '' }), new RegExp(key));
  }
});
test('cloud uses only the approved Ark model and bounded request limits', () => {
  const config = cloudConfig({ ...env, OPENAI_API_KEY: 'unused', AI_PROVIDER: 'openai' });
  assert.equal(config.provider, 'seed');
  assert.equal(config.model, 'doubao-seed-2-1-lite-260915');
  assert.equal(config.dailyCalls, 20);
  assert.equal(config.userDailyCalls, 3);
  for (const value of ['0', '-1', 'NaN', '1.5', '101']) assert.throws(() => cloudConfig({ ...env, AI_DAILY_CALL_LIMIT: value }));
});
test('reject unsafe origins, malformed database URLs and TLS overrides without revealing secrets', () => {
  for (const origin of ['http://demo.example', 'https://user:pass@demo.example', 'https://demo.example/path', 'https://demo.example?x=1']) assert.throws(() => cloudConfig({ ...env, APP_ORIGIN: origin }));
  for (const url of ['broken-password-secret', 'https://db.example', env.DATABASE_URL + '?sslmode=disable', env.DATABASE_URL + '?SSLMode=no-verify']) {
    assert.throws(() => cloudConfig({ ...env, DATABASE_URL: url }), error => !error.message.includes('password-secret') && !error.message.includes('demo:password'));
  }
});
