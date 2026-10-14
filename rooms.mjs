import { randomBytes } from 'node:crypto';
const rooms = new Map();
const token = () => randomBytes(18).toString('hex');
const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export async function handleRooms(req, res, url, json, user = null, getProfile = () => null, roomStore = rooms) {
  const rooms = roomStore;
  for (const [id, room] of rooms) if (Date.now() - room.created > 86400000) rooms.delete(id);
  let body = {};
  if (req.method === 'POST') {
    if (!user) return json(res, 401, { error: '请先登录，再一起自习。' });
    if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: '请求格式错误' });
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 65536) return json(res, 413, { error: '输入太长' }); }
    try { body = JSON.parse(raw); } catch { return json(res, 400, { error: '请求格式错误' }); }
    if (!body || typeof body !== 'object') return json(res, 400, { error: '请求格式错误' });
  }
  if (req.method === 'POST' && url.pathname === '/api/rooms') {
    if (rooms.size >= 100) return json(res, 429, { error: '房间较多，请稍后再试' });
    if (!['snow','sea','garden','night','forest','wild'].includes(body.scene) || !Number.isInteger(body.minutes) || body.minutes < 1 || body.minutes > 180) return json(res, 400, { error: '请设置有效场景和时长' });
    const id = token(), hostToken = token();
    rooms.set(id, { id, hostToken, hostId: user.id, created: Date.now(), name: user.name, scene: body.scene, minutes: body.minutes, goal: clean(body.goal, 300), allowOwn: body.allowOwn !== false, startedAt: null, closed: false, members: [] });
    return json(res, 201, { id, hostToken });
  }
  const match = url.pathname.match(/^\/api\/rooms\/([a-f0-9]{36})(?:\/(join|start|close|leave|goal|goal-mode))?$/);
  const room = match && rooms.get(match[1]);
  if (!room) return json(res, 404, { error: '房间不存在或已过期，请向朋友索取新邀请' });
  const action = match[2];
  if (req.method === 'GET' && !action) {
    const profile = (id, name) => { const value = getProfile(id); return { name: value?.name || name, avatar: value?.avatar || '', isSelf: user?.id === id }; };
    const host = profile(room.hostId, room.name);
    return json(res, 200, { id: room.id, name: host.name, host, scene: room.scene, minutes: room.minutes, goal: room.goal, tasks: room.tasks || [], goalTimer: room.goalTimer || null, allowOwn: room.allowOwn, startedAt: room.startedAt, closed: room.closed, serverNow: Date.now(), members: room.members.map(m => ({ ...profile(m.userId, m.name), goalMode: m.goalMode || 'follow' })) });
  }
  if (req.method !== 'POST') return json(res, 405, { error: '不支持的操作' });
  if (action === 'goal' || action === 'goal-mode') {
    if (room.closed || (room.startedAt && Date.now() >= room.startedAt + room.minutes * 60000)) return json(res, 410, { error: '本轮自习已结束' });
    if (action === 'goal') {
      if (user.id !== room.hostId || body.hostToken !== room.hostToken) return json(res, 403, { error: '只有房主可以修改共享目标' });
      if (typeof body.goal !== 'string' || body.goal.length > 300) return json(res, 400, { error: '目标最多300字' });
      if (body.tasks !== undefined && (!Array.isArray(body.tasks) || body.tasks.length > 50 || body.tasks.some(t => !t || typeof t.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(t.id) || typeof t.text !== 'string' || !t.text.trim() || t.text.length > 300 || !Number.isInteger(t.minutes) || t.minutes < 1 || t.minutes > 180) || new Set(body.tasks.map(t => t.id)).size !== body.tasks.length)) return json(res, 400, { error: '清单最多50项，每项需要有效内容和预计用时' });
      if (body.goalTimer !== undefined && body.goalTimer !== null) {
        const t = body.goalTimer;
        if (!Number.isFinite(t.remaining) || t.remaining < 0 || t.remaining > 10800000 || typeof t.running !== 'boolean') return json(res, 400, { error: '目标计时无效' });
      }
      room.goal = body.goal.trim();
      if (body.tasks !== undefined) room.tasks = body.tasks.map(({ id, text, minutes }) => ({ id, text: text.trim(), minutes }));
      if (body.goalTimer !== undefined) {
        const t = body.goalTimer;
        room.goalTimer = t === null ? null : { remaining: t.remaining, deadline: t.running ? Date.now() + t.remaining : null };
      }
    } else {
      const member = room.members.find(m => m.userId === user.id && m.token === body.memberToken);
      if (!member) return json(res, 403, { error: '请先加入书房' });
      if (!['own', 'follow'].includes(body.goalMode)) return json(res, 400, { error: '请选择目标模式' });
      member.goalMode = body.goalMode;
    }
    return json(res, 200, { ok: true });
  }
  if (action === 'close' || action === 'start') {
    if (body.hostToken !== room.hostToken || user.id !== room.hostId) return json(res, 403, { error: '只有房主可以操作' });
    if (action === 'close') room.closed = true;
    else { if (room.closed) return json(res, 410, { error: '房间已结束' }); room.startedAt ||= Date.now(); }
    return json(res, 200, { ok: true });
  }
  if (action === 'leave') { room.members = room.members.filter(m => !(m.token === body.memberToken && m.userId === user.id)); return json(res, 200, { ok: true }); }
  if (action === 'join') {
    if (room.closed || (room.startedAt && Date.now() >= room.startedAt + room.minutes * 60000)) return json(res, 410, { error: '本轮自习已结束' });
    if (room.hostId === user.id) return json(res, 409, { error: '你是这间书房的房主，请返回创建邀请的页面。' });
    const existing = room.members.find(m => m.userId === user.id);
    if (existing) return json(res, 200, { memberToken: existing.token });
    if (room.members.length >= 8) return json(res, 409, { error: '房间已满（最多8位好友）' });
    const memberToken = token(); room.members.push({ token: memberToken, userId: user.id, name: user.name, goalMode: body.goalMode === 'own' ? 'own' : 'follow' });
    return json(res, 200, { memberToken });
  }
  return json(res, 404, { error: '操作不存在' });
}
