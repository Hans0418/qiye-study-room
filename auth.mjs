import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scrypt as derive, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
const scrypt = promisify(derive);
const digest = value => createHash('sha256').update(value).digest('hex');
export function createAuthStore(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, kind TEXT NOT NULL, identity TEXT NOT NULL UNIQUE, name TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, account TEXT NOT NULL, expires INTEGER NOT NULL);`);
  const attempts = new Map();
  db.exec('CREATE TABLE IF NOT EXISTS avatars(account TEXT PRIMARY KEY, value TEXT NOT NULL)');
  const cookieName = 'inook_session';
  const publicUser = row => row ? { id: row.id, kind: row.kind, identity: row.identity, name: row.name, avatar: db.prepare('SELECT value FROM avatars WHERE account=?').get(row.id)?.value || '', verified: false } : null;
  function identity(kind, value) {
    if (typeof value !== 'string') return null;
    value = value.trim();
    if (kind === 'email') { value = value.toLowerCase(); return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null; }
    if (kind === 'phone') { value = value.replace(/[\s()-]/g, ''); if (/^1[3-9]\d{9}$/.test(value)) value = '+86' + value; return /^\+[1-9]\d{7,14}$/.test(value) ? value : null; }
    return null;
  }
  return {
    close: () => db.close(),
    getRoomProfile(id) {
      const row = db.prepare('SELECT id, name FROM accounts WHERE id=?').get(id);
      return row ? { name: row.name, avatar: db.prepare('SELECT value FROM avatars WHERE account=?').get(id)?.value || '' } : null;
    },
    getUser(req) {
      const cookie = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(cookieName + '='))?.slice(cookieName.length + 1) || '';
      return publicUser(db.prepare('SELECT accounts.* FROM accounts JOIN sessions ON accounts.id=sessions.account WHERE sessions.token=? AND sessions.expires>?').get(digest(cookie), Date.now()));
    },
    async handle(req, res, url, json) {
      const cookie = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(cookieName + '='))?.slice(cookieName.length + 1) || '';
      const now = Date.now();
      db.prepare('DELETE FROM sessions WHERE expires <= ?').run(now);
      if (req.method === 'GET' && url.pathname === '/api/auth/me') {
        const row = db.prepare('SELECT accounts.* FROM accounts JOIN sessions ON accounts.id=sessions.account WHERE sessions.token=? AND sessions.expires>?').get(digest(cookie), now);
        return json(res, 200, { user: publicUser(row) });
      }
      if (req.method !== 'POST') return json(res, 405, { error: '不支持的操作' });
      if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: '请求格式错误' });
      if (url.pathname === '/api/auth/logout') {
        db.prepare('DELETE FROM sessions WHERE token=?').run(digest(cookie));
        res.setHeader('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
        return json(res, 200, { ok: true });
      }
      if (url.pathname === '/api/auth/avatar') {
        const account = db.prepare('SELECT accounts.* FROM accounts JOIN sessions ON accounts.id=sessions.account WHERE sessions.token=? AND sessions.expires>?').get(digest(cookie), now);
        if (!account) return json(res, 401, { error: '请先登录。' });
        let raw = '';
        for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 100000) return json(res, 413, { error: '头像过大，请换一张图片。' }); }
        let value;
        try { value = JSON.parse(raw).avatar; } catch { return json(res, 400, { error: '请求格式错误' }); }
        if (typeof value !== 'string' || (!['bear', 'dog', 'cat', 'mouse', 'rabbit', 'panda'].includes(value) && !/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/=]+$/.test(value))) return json(res, 400, { error: '请选择头像或上传有效图片。' });
        db.prepare('INSERT INTO avatars VALUES(?,?) ON CONFLICT(account) DO UPDATE SET value=excluded.value').run(account.id, value);
        return json(res, 200, { user: publicUser(account) });
      }
      if (!['/api/auth/login', '/api/auth/register'].includes(url.pathname)) return json(res, 404, { error: '接口不存在' });
      for (const [key, record] of attempts) if (record.until <= now) attempts.delete(key);
      const ip = req.socket?.remoteAddress || 'local';
      const rate = attempts.get(ip) || { count: 0, until: now + 15 * 60000 };
      if (rate.count >= 20) return json(res, 429, { error: '尝试次数较多，请15分钟后再试。' });
      rate.count++; attempts.set(ip, rate);
      let raw = '';
      for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 4096) return json(res, 413, { error: '输入过长' }); }
      let body;
      try { body = JSON.parse(raw); } catch { return json(res, 400, { error: '请求格式错误' }); }
      const value = identity(body?.kind, body?.identity);
      if (!value || typeof body?.password !== 'string' || body.password.length < 10 || body.password.length > 128) return json(res, 400, { error: '请检查手机号或邮箱，密码需为10至128个字符。' });
      let account = db.prepare('SELECT * FROM accounts WHERE identity=?').get(value);
      if (url.pathname.endsWith('/register')) {
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (!name || name.length > 24) return json(res, 400, { error: '昵称需为1至24个字符。' });
        if (account) return json(res, 409, { error: '此账号无法注册，请尝试登录。' });
        const salt = randomBytes(16).toString('hex');
        const hash = (await scrypt(body.password, salt, 64)).toString('hex');
        account = { id: randomBytes(16).toString('hex'), kind: body.kind, identity: value, name, salt, hash };
        try { db.prepare('INSERT INTO accounts VALUES(?,?,?,?,?,?)').run(account.id, account.kind, value, name, salt, hash); }
        catch (error) { if (error.code?.includes('SQLITE') && db.prepare('SELECT id FROM accounts WHERE identity=?').get(value)) return json(res, 409, { error: '此账号无法注册，请尝试登录。' }); throw error; }
      } else {
        const derived = await scrypt(body.password, account?.salt || 'inook-missing-account', 64);
        if (!account || !timingSafeEqual(derived, Buffer.from(account.hash, 'hex'))) return json(res, 401, { error: '账号或密码不正确。' });
      }
      const token = randomBytes(32).toString('hex');
      db.prepare('DELETE FROM sessions WHERE token=?').run(digest(cookie));
      const maxAge = body.remember === false ? 86400 : 7 * 86400;
      db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token), account.id, now + maxAge * 1000);
      res.setHeader('Set-Cookie', `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict${body.remember === false ? '' : `; Max-Age=${maxAge}`}${req.socket?.encrypted ? '; Secure' : ''}`);
      return json(res, 200, { user: publicUser(account) });
    }
  };
}
