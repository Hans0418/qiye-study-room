import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cloudConfig } from './cloud-config.mjs';
import { createDatabase, reserveUsage } from './database.mjs';

let database;
const rollback = new Error('ROLLBACK_TEST_FIXTURES');
try {
  const config = cloudConfig();
  if (!config) throw new Error('Cloud configuration required');
  database = await createDatabase(config);
  const tables = await database.query(`SELECT c.relname, c.relrowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='qiye_private' AND c.relkind='r'`);
  for (const name of ['accounts', 'sessions', 'avatars', 'rooms', 'usage_buckets']) {
    assert.equal(tables.rows.find(row => row.relname === name)?.relrowsecurity, true);
    for (const role of ['anon', 'authenticated']) {
      const result = await database.query(`SELECT
        has_schema_privilege($1, 'qiye_private', 'USAGE') AS schema_access,
        has_table_privilege($1, $2, 'SELECT,INSERT,UPDATE,DELETE') AS table_access`, [role, `qiye_private.${name}`]);
      assert.equal(result.rows[0].schema_access, false);
      assert.equal(result.rows[0].table_access, false);
    }
  }
  console.log('PASS: five private tables, RLS and browser-role restrictions.');
  const id = `integration-${randomUUID()}`;
  try {
    await database.transaction(async tx => {
      await tx.query('INSERT INTO qiye_private.accounts VALUES ($1,$2,$3,$4,$5,$6)', [id, 'email', `${id}@example.invalid`, 'Integration test', 'test-salt', 'test-hash']);
      await tx.query('INSERT INTO qiye_private.sessions VALUES ($1,$2,$3)', [id, id, Date.now() + 60000]);
      await tx.query('INSERT INTO qiye_private.rooms VALUES ($1,$2,$3)', [id, Date.now(), JSON.stringify({ members: [] })]);
      // Savepoints exercise reservation rollback inside an outer test transaction.
      const scoped = { transaction: async action => {
        await tx.query('SAVEPOINT usage_check');
        try {
          const result = await action(tx);
          await tx.query('RELEASE SAVEPOINT usage_check');
          return result;
        } catch (error) {
          await tx.query('ROLLBACK TO SAVEPOINT usage_check');
          await tx.query('RELEASE SAVEPOINT usage_check');
          throw error;
        }
      } };
      const buckets = [
        { key: `${id}-global`, windowStart: 1, expires: 2, limit: 5 },
        { key: `${id}-user`, windowStart: 1, expires: 2, limit: 1 }
      ];
      assert.equal(await reserveUsage(scoped, buckets), true);
      assert.equal(await reserveUsage(scoped, buckets), false);
      const usage = await tx.query('SELECT used FROM qiye_private.usage_buckets WHERE bucket = ANY($1::text[])', [buckets.map(b => b.key)]);
      assert.deepEqual(usage.rows.map(row => row.used), [1, 1]);
      await tx.query('DELETE FROM qiye_private.accounts WHERE id=$1', [id]);
      assert.equal((await tx.query('SELECT token FROM qiye_private.sessions WHERE account=$1', [id])).rowCount, 0);
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  assert.equal((await database.query('SELECT id FROM qiye_private.rooms WHERE id=$1', [id])).rowCount, 0);
  console.log('PASS: foreign keys, atomic usage denial and rollback. Test rows were not retained.');
} catch {
  console.error('Cloud integration check failed. No credentials or raw database errors are logged.');
  process.exitCode = 1;
} finally { await database?.close(); }
