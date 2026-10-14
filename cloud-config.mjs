// Server-only configuration. Never serialize this object into an API response.
export function cloudConfig(env = process.env) {
  if (env.APP_RUNTIME !== 'cloud') return null;
  const required = ['APP_ORIGIN', 'DATABASE_URL', 'ARK_API_KEY'];
  for (const key of required) if (!env[key]?.trim()) throw new Error(`Missing ${key}`);
  let origin, database;
  try { origin = new URL(env.APP_ORIGIN); } catch { throw new Error('Invalid APP_ORIGIN'); }
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') throw new Error('APP_ORIGIN must be an HTTPS origin');
  try { database = new URL(env.DATABASE_URL); } catch { throw new Error('Invalid DATABASE_URL'); }
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !database.hostname || !database.username || !database.password) throw new Error('DATABASE_URL must include Postgres credentials');
  // URL-level SSL flags can override pg's explicit certificate verification.
  for (const key of database.searchParams.keys()) if (key.toLowerCase().startsWith('ssl')) throw new Error('Remove SSL query parameters; TLS verification is configured by the server');
  function limit(key, fallback, max) {
    const raw = env[key] ?? String(fallback);
    if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > max) throw new Error(`Invalid ${key}`);
    return Number(raw);
  }
  return {
    origin: origin.origin,
    databaseUrl: env.DATABASE_URL,
    databaseCa: env.DATABASE_CA_PEM || undefined,
    provider: 'seed',
    model: 'doubao-seed-2-1-lite-260915',
    base: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKey: env.ARK_API_KEY,
    dailyCalls: limit('AI_DAILY_CALL_LIMIT', 20, 100),
    userDailyCalls: limit('AI_USER_DAILY_CALL_LIMIT', 3, 10)
  };
}
