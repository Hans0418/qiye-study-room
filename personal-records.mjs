import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function createPersonalRecords(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records(account TEXT, name TEXT, revision INTEGER, body TEXT, PRIMARY KEY(account,name)); CREATE TABLE IF NOT EXISTS record_versions(account TEXT, name TEXT, revision INTEGER, body TEXT, saved_at INTEGER, PRIMARY KEY(account,name,revision));');
  return {
    async list(account) { return db.prepare("SELECT name,body FROM records WHERE account=? AND name LIKE 'diary-%' ORDER BY name DESC").all(account).map(row => ({date:row.name.slice(6), ...JSON.parse(row.body)})).filter(row => row.text?.trim()).map(({date,scene,text}) => ({date,scene,preview:text.slice(0,80)})); },
    async get(account, name) { const row = db.prepare('SELECT revision,body FROM records WHERE account=? AND name=?').get(account, name); return row ? { revision: row.revision, data: JSON.parse(row.body) } : { revision: 0, data: null }; },
    async put(account, name, revision, data) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const current = db.prepare('SELECT revision FROM records WHERE account=? AND name=?').get(account, name)?.revision || 0;
        if (current !== revision) { db.exec('ROLLBACK'); return false; }
        const body = JSON.stringify(data), next = current + 1;
        db.prepare('INSERT INTO records VALUES(?,?,?,?) ON CONFLICT(account,name) DO UPDATE SET revision=excluded.revision,body=excluded.body').run(account, name, next, body);
        db.prepare('INSERT INTO record_versions VALUES(?,?,?,?,?)').run(account, name, next, body, Date.now());
        db.exec('COMMIT'); return next;
      } catch (e) { db.exec('ROLLBACK'); throw e; }
    }, close() { db.close(); }
  };
}

export function createCloudPersonalRecords(database) {
  return {
    async list(account) { return (await database.query("SELECT name,body FROM qiye_private.personal_records WHERE account=$1 AND name LIKE 'diary-%' ORDER BY name DESC", [account])).rows.map(row => ({date:row.name.slice(6), ...row.body})).filter(row => row.text?.trim()).map(({date,scene,text}) => ({date,scene,preview:text.slice(0,80)})); },
    async get(account, name) { const row = (await database.query('SELECT revision,body FROM qiye_private.personal_records WHERE account=$1 AND name=$2', [account,name])).rows[0]; return row ? { revision: Number(row.revision), data: row.body } : { revision: 0, data: null }; },
    async put(account, name, revision, data) {
      return database.transaction(async tx => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${account}:${name}`]);
        const row = (await tx.query('SELECT revision FROM qiye_private.personal_records WHERE account=$1 AND name=$2', [account,name])).rows[0];
        if (Number(row?.revision || 0) !== revision) return false;
        const next = revision + 1;
        await tx.query('INSERT INTO qiye_private.personal_records(account,name,revision,body) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(account,name) DO UPDATE SET revision=excluded.revision,body=excluded.body', [account,name,next,JSON.stringify(data)]);
        await tx.query('INSERT INTO qiye_private.personal_record_versions(account,name,revision,body,saved_at) VALUES($1,$2,$3,$4::jsonb,$5)', [account,name,next,JSON.stringify(data),Date.now()]);
        return next;
      });
    }
  };
}

export async function handlePersonalRecords(req, res, url, json, user, store) {
  if (!user) return json(res, 401, { error: '请登录后保存记录' });
  const name = url.pathname.slice('/api/personal/'.length);
  if (name === 'diaries' && req.method === 'GET') return json(res, 200, {entries:await store.list(user.id),account:user.id});
  if (!/^(history|diary-\d{4}-\d{2}-\d{2})$/.test(name)) return json(res, 400, { error: '记录名称无效' });
  if (req.method === 'GET') return json(res, 200, { ...await store.get(user.id, name), account: user.id });
  if (req.method !== 'PUT') return json(res, 405, { error: '不支持的操作' });
  let body = ''; for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 2000000) return json(res, 413, { error: '记录过大' }); }
  let input; try { input = JSON.parse(body); } catch { return json(res, 400, { error: '记录格式错误' }); }
  if (input.account !== user.id) return json(res, 409, { error: '账号已变化，请重新打开页面' });
  if (!Number.isSafeInteger(input.revision) || input.revision < 0 || !input.data || typeof input.data !== 'object' || Array.isArray(input.data)) return json(res, 400, { error: '记录格式错误' });
  if (name.startsWith('diary-') && (typeof input.data.text !== 'string' || input.data.text.length > 30000)) return json(res, 400, { error: '日记最多三万字' });
  if (name.startsWith('diary-')) {
    let today;
    try {
      const parts=new Intl.DateTimeFormat('en-US',{timeZone:input.timeZone || 'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
      const value=type=>parts.find(part=>part.type===type).value;
      today=`${value('year')}-${value('month')}-${value('day')}`;
    } catch { return json(res,400,{error:'时区无效，请刷新后重试'}); }
    if(name!==`diary-${today}`) return json(res,403,{error:'仅可保存今天的日记，过去的记录为只读'});
  }
  if (name === 'history' && (input.data.version !== 1 || !input.data.calendar || typeof input.data.calendar !== 'object')) return json(res, 400, { error: '历史格式错误' });
  const revision = await store.put(user.id, name, input.revision, input.data);
  return revision ? json(res, 200, { revision }) : json(res, 409, { error: '记录已在其他页面更新，请重新载入后再保存' });
}
