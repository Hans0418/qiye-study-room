import { randomBytes, scrypt as derive, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { reserveUsage } from './database.mjs';

const scrypt = promisify(derive);
const digest = value => createHash('sha256').update(value).digest('hex');
const cookieName = 'inook_session';
const sessionToken = req => digest((req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(cookieName + '='))?.slice(cookieName.length + 1) || '');
function normalizeIdentity(kind, value) {
  if (typeof value !== 'string') return null;
  value = value.trim();
  if (kind === 'email') {
    value = value.toLowerCase();
    return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
  }
  if (kind === 'phone') {
    value = value.replace(/[\s()-]/g, '');
    if (/^1[3-9]\d{9}$/.test(value)) value = '+86' + value;
    return /^\+[1-9]\d{7,14}$/.test(value) ? value : null;
  }
  return null;
}

// Only trust this header on Vercel, which overwrites it at the edge.
export function requestAddress(req) {
  return process.env.VERCEL === '1'
    ? String(req.headers['x-vercel-forwarded-for'] || 'unknown').split(',')[0].trim()
    : req.socket?.remoteAddress || 'unknown';
}

export function createCloudAuthStore(database) {
  const one = async (sql, args) => (await database.query(sql, args)).rows[0];
  const publicUser = row => row ? { id: row.id, kind: row.kind, identity: row.identity, name: row.name, avatar: row.avatar || '', verified: false } : null;
  async function getUser(req) {
    return publicUser(await one(`SELECT a.id,a.kind,a.identity,a.name,COALESCE(v.value,'') AS avatar
      FROM qiye_private.accounts a JOIN qiye_private.sessions s ON s.account=a.id
      LEFT JOIN qiye_private.avatars v ON v.account=a.id WHERE s.token=$1 AND s.expires>$2`, [sessionToken(req), Date.now()]));
  }
  return {
    getUser,
    async getRoomProfile(id) {
      return await one(`SELECT a.name,COALESCE(v.value,'') AS avatar FROM qiye_private.accounts a
        LEFT JOIN qiye_private.avatars v ON v.account=a.id WHERE a.id=$1`, [id]) || null;
    },
    async handle(req, res, url, json) {
      if (req.method === 'GET' && url.pathname === '/api/auth/me') return json(res, 200, { user: await getUser(req) });
      if (req.method !== 'POST') return json(res, 405, { error: '不支持的操作' });
      if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: '请求格式错误' });
      const action = url.pathname.slice('/api/auth/'.length);
      if (!['logout', 'avatar', 'login', 'register'].includes(action)) return json(res, 404, { error: '接口不存在' });
      if (action === 'logout') {
        await database.query('DELETE FROM qiye_private.sessions WHERE token=$1', [sessionToken(req)]);
        res.setHeader('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=0`);
        return json(res, 200, { ok: true });
      }
      if (action === 'login' || action === 'register') {
        const now = Date.now(), windowStart = Math.floor(now / 900000) * 900000;
        const allowed = await reserveUsage(database, [{ key: `auth:${digest(requestAddress(req))}`, windowStart, expires: windowStart + 900000, limit: 20 }]);
        if (!allowed) return json(res, 429, { error: '尝试次数较多，请15分钟后再试。' });
      }
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (Buffer.byteLength(raw) > (action === 'avatar' ? 100000 : 4096)) return json(res, 413, { error: '输入过长' });
      }
      let body;
      try { body = JSON.parse(raw); } catch { return json(res, 400, { error: '请求格式错误' }); }
      if (action === 'avatar') {
        const user = await getUser(req);
        if (!user) return json(res, 401, { error: '请先登录。' });
        const value = body?.avatar;
        if (typeof value !== 'string' || (!['bear', 'dog', 'cat', 'mouse', 'rabbit', 'panda'].includes(value) && !/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/=]+$/.test(value))) return json(res, 400, { error: '请选择头像或上传有效图片。' });
        await database.query('INSERT INTO qiye_private.avatars VALUES($1,$2) ON CONFLICT(account) DO UPDATE SET value=excluded.value', [user.id, value]);
        return json(res, 200, { user: { ...user, avatar: value } });
      }
      const identity = normalizeIdentity(body?.kind, body?.identity);
      if (!identity || typeof body?.password !== 'string' || body.password.length < 10 || body.password.length > 128) return json(res, 400, { error: '请检查手机号或邮箱，密码需为10至128个字符。' });
      let account = await one('SELECT * FROM qiye_private.accounts WHERE identity=$1', [identity]);
      if (action === 'register') {
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (!name || name.length > 24) return json(res, 400, { error: '昵称需为1至24个字符。' });
        if (account) return json(res, 409, { error: '此账号无法注册，请尝试登录。' });
        const salt = randomBytes(16).toString('hex');
        account = { id: randomBytes(16).toString('hex'), kind: body.kind, identity, name, salt, hash: (await scrypt(body.password, salt, 64)).toString('hex') };
      } else {
        const derived = await scrypt(body.password, account?.salt || 'inook-missing-account', 64);
        if (!account || !timingSafeEqual(derived, Buffer.from(account.hash, 'hex'))) return json(res, 401, { error: '账号或密码不正确。' });
      }
      const token = randomBytes(32).toString('hex');
      const maxAge = body.remember === false ? 86400 : 7 * 86400;
      try {
        await database.transaction(async tx => {
          if (action === 'register') await tx.query('INSERT INTO qiye_private.accounts VALUES($1,$2,$3,$4,$5,$6)', [account.id, account.kind, identity, account.name, account.salt, account.hash]);
          await tx.query('DELETE FROM qiye_private.sessions WHERE token=$1 OR expires<=$2', [sessionToken(req), Date.now()]);
          await tx.query('INSERT INTO qiye_private.sessions VALUES($1,$2,$3)', [digest(token), account.id, Date.now() + maxAge * 1000]);
        });
      } catch (error) {
        if (action === 'register' && error.code === '23505') return json(res, 409, { error: '此账号无法注册，请尝试登录。' });
        throw error;
      }
      res.setHeader('Set-Cookie', `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Secure${body.remember === false ? '' : `; Max-Age=${maxAge}`}`);
      const avatar = await one('SELECT value FROM qiye_private.avatars WHERE account=$1', [account.id]);
      return json(res, 200, { user: publicUser({ ...account, avatar: avatar?.value }) });
    }
  };
}
