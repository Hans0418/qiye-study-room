import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { cloudConfig } from './cloud-config.mjs';
import { databasePoolOptions } from './database.mjs';

if (!process.argv.includes('--apply')) {
  console.error('Pass --apply to create the private cloud tables. No local accounts are imported.');
  process.exitCode = 1;
} else {
  let client;
  try {
    const config = cloudConfig();
    if (!config) throw new Error('Cloud configuration required');
    const ca = config.databaseCa || await readFile(new URL('./supabase/prod-ca-2021.crt', import.meta.url), 'utf8');
    client = new Client(databasePoolOptions({ ...config, databaseCa: ca }));
    await client.connect();
    const sql = await readFile(new URL('./supabase/migrations/202610130001_qiye_private.sql', import.meta.url), 'utf8');
    // Keep the whole migration and any rollback on the same connection.
    await client.query(sql);
    console.log('Private cloud schema migration completed.');
  } catch {
    try { await client?.query('ROLLBACK'); } catch {}
    console.error('Cloud migration failed. Credentials and database details are not logged.');
    process.exitCode = 1;
  } finally {
    await client?.end();
  }
}
