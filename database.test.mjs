import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { databasePoolOptions, databaseFromPool, reserveUsage } from './database.mjs';

function fakePool({ deny = false, rollbackFails = false } = {}) {
  const calls = [];
  const client = {
    async query(text, values) {
      calls.push({ text, values });
      if (text === 'ROLLBACK' && rollbackFails) throw new Error('rollback failed');
      return { rowCount: deny && text.startsWith('INSERT') ? 0 : 1, rows: [] };
    },
    release(discard) { calls.push({ release: true, discard }); }
  };
  return { calls, connect: async () => client, query: client.query, end: async () => {} };
}
test('database verifies TLS, bounds connection count, and avoids named prepared queries', async () => {
  const options = databasePoolOptions({ databaseUrl: 'redacted', databaseCa: 'trusted-ca' });
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert.equal(options.ssl.ca, 'trusted-ca');
  assert.equal(options.max, 2);
  const pool = fakePool(), database = databaseFromPool(pool);
  await database.query('SELECT $1', ['test']);
  assert.deepEqual(pool.calls[0], { text: 'SELECT $1', values: ['test'] });
});
test('transactions commit and release the same checked-out connection', async () => {
  const pool = fakePool();
  assert.equal(await databaseFromPool(pool).transaction(async tx => { await tx.query('SELECT $1', [1]); return 42; }), 42);
  assert.deepEqual(pool.calls.map(c => c.text || 'release'), ['BEGIN', 'SELECT $1', 'COMMIT', 'release']);
});
test('transaction failures roll back; failed rollback discards the connection', async () => {
  for (const rollbackFails of [false, true]) {
    const pool = fakePool({ rollbackFails });
    const original = new Error('original failure');
    await assert.rejects(databaseFromPool(pool).transaction(async () => { throw original; }), error => error === original);
    assert.equal(pool.calls.at(-1).discard, rollbackFails);
    assert.equal(pool.calls.at(-2).text, 'ROLLBACK');
  }
});
test('usage reservation parameterizes values, orders locks, and rolls back denials', async () => {
  const buckets = [
    { key: 'user:test', windowStart: 1, expires: 100, limit: 3 },
    { key: 'global', windowStart: 1, expires: 100, limit: 20 }
  ];
  const allowed = fakePool();
  assert.equal(await reserveUsage(databaseFromPool(allowed), buckets), true);
  assert.equal(allowed.calls[1].values[0], 'global');
  assert.match(allowed.calls[1].text, /WHERE qiye_private\.usage_buckets\.used < \$4/);
  const denied = fakePool({ deny: true });
  assert.equal(await reserveUsage(databaseFromPool(denied), buckets), false);
  assert.ok(denied.calls.some(c => c.text === 'ROLLBACK'));
  assert.ok(!denied.calls.some(c => c.text === 'COMMIT'));
  await assert.rejects(reserveUsage(databaseFromPool(allowed), []), /INVALID_USAGE_BUCKETS/);
  await assert.rejects(reserveUsage(databaseFromPool(allowed), [buckets[0], buckets[0]]), /INVALID_USAGE_BUCKETS/);
  await assert.rejects(reserveUsage({ transaction() { throw new Error('database unavailable'); } }, buckets), /database unavailable/);
});
test('migration confines tables to a private schema with RLS and no browser grants', async () => {
  const sql = await readFile(new URL('./supabase/migrations/202610130001_qiye_private.sql', import.meta.url), 'utf8');
  for (const table of ['accounts', 'sessions', 'avatars', 'rooms', 'usage_buckets']) {
    assert.ok(sql.includes(`CREATE TABLE IF NOT EXISTS qiye_private.${table}`));
    assert.ok(sql.includes(`ALTER TABLE qiye_private.${table} ENABLE ROW LEVEL SECURITY`));
  }
  assert.match(sql, /REVOKE ALL ON SCHEMA qiye_private FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(sql, /CREATE POLICY|SECURITY DEFINER|DROP TABLE/i);
});
