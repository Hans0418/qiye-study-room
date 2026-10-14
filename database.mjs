import { readFileSync } from 'node:fs';

export function databasePoolOptions(config) {
  return {
    connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: true, ...(config.databaseCa ? { ca: config.databaseCa } : {}) },
    max: 2,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
    statement_timeout: 10000,
    idle_in_transaction_session_timeout: 15000,
    allowExitOnIdle: true
  };
}

export async function createDatabase(config) {
  const { Pool } = await import('pg');
  const databaseCa = config.databaseCa || readFileSync(new URL('./supabase/prod-ca-2021.crt', import.meta.url), 'utf8');
  const pool = new Pool(databasePoolOptions({ ...config, databaseCa }));
  // Do not log connection errors: drivers may include server or account details.
  pool.on('error', () => console.warn('[Qiye database] Idle connection failed'));
  return databaseFromPool(pool);
}

export function databaseFromPool(pool) {
  return {
    query: (text, values = []) => pool.query(text, values),
    close: () => pool.end(),
    async transaction(action) {
      const client = await pool.connect();
      let discard = false;
      try {
        await client.query('BEGIN');
        const result = await action({ query: (text, values = []) => client.query(text, values) });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch { discard = true; }
        throw error;
      } finally { client.release(discard); }
    }
  };
}

// Call inside a transaction with every applicable bucket. Denials roll back all
// increments so a failed per-user check does not consume the global allowance.
export async function reserveUsage(database, buckets) {
  if (!Array.isArray(buckets) || !buckets.length || buckets.some(b =>
    typeof b.key !== 'string' || !b.key || b.key.length > 200 ||
    !Number.isSafeInteger(b.windowStart) || b.windowStart < 0 ||
    !Number.isSafeInteger(b.expires) || b.expires <= b.windowStart ||
    !Number.isSafeInteger(b.limit) || b.limit < 1
  ) || new Set(buckets.map(b => `${b.key}:${b.windowStart}`)).size !== buckets.length) throw new Error('INVALID_USAGE_BUCKETS');
  const denied = new Error('USAGE_DENIED');
  try {
    await database.transaction(async tx => {
      // A consistent lock order prevents opposing multi-bucket requests deadlocking.
      for (const bucket of [...buckets].sort((a, b) => a.key.localeCompare(b.key) || a.windowStart - b.windowStart)) {
        const result = await tx.query(`INSERT INTO qiye_private.usage_buckets (bucket, window_start, expires, used)
          VALUES ($1, $2, $3, 1)
          ON CONFLICT (bucket, window_start) DO UPDATE SET used = qiye_private.usage_buckets.used + 1
          WHERE qiye_private.usage_buckets.used < $4
          RETURNING used`, [bucket.key, bucket.windowStart, bucket.expires, bucket.limit]);
        if (!result.rowCount) throw denied;
      }
    });
    return true;
  } catch (error) {
    if (error === denied) return false;
    throw error;
  }
}
