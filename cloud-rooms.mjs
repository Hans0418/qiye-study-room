import { Readable } from 'node:stream';
import { handleRooms } from './rooms.mjs';

export async function handleCloudRooms(database, req, res, url, json, user) {
  // Consume bounded input before taking a database lock.
  let raw = '';
  if (req.method === 'POST') {
    if (!user) return json(res, 401, { error: '请先登录，再一起自习。' });
    for await (const chunk of req) {
      raw += chunk;
      if (Buffer.byteLength(raw) > 65536) return json(res, 413, { error: '输入太长' });
    }
  }
  const result = await database.transaction(async tx => {
    // The existing product caps rooms at 100. Serialize writes across instances
    // to preserve that cap and prevent concurrent joins from losing members.
    if (req.method === 'POST') await tx.query('SELECT pg_advisory_xact_lock(716913, 1)');
    const cutoff = Date.now() - 86400000;
    let rows;
    if (req.method === 'POST') {
      await tx.query('DELETE FROM qiye_private.rooms WHERE created<$1', [cutoff]);
      rows = (await tx.query('SELECT id,data FROM qiye_private.rooms')).rows;
    } else {
      const id = url.pathname.match(/^\/api\/rooms\/([a-f0-9]{36})$/)?.[1] || '';
      rows = (await tx.query('SELECT id,data FROM qiye_private.rooms WHERE id=$1 AND created>=$2', [id, cutoff])).rows;
    }
    const rooms = new Map(rows.map(row => [row.id, row.data]));
    const before = new Map(rows.map(row => [row.id, JSON.stringify(row.data)]));
    const ids = [...new Set(rows.flatMap(row => [row.data.hostId, ...row.data.members.map(m => m.userId)]))];
    const profiles = new Map();
    if (req.method === 'GET' && ids.length) {
      const records = await tx.query(`SELECT a.id,a.name,COALESCE(v.value,'') AS avatar FROM qiye_private.accounts a
        LEFT JOIN qiye_private.avatars v ON v.account=a.id WHERE a.id=ANY($1::text[])`, [ids]);
      for (const record of records.rows) profiles.set(record.id, record);
    }
    const request = Object.assign(Readable.from(raw ? [raw] : []), { method: req.method, headers: req.headers });
    let response;
    await handleRooms(request, null, url, (_, status, data) => { response = { status, data }; }, user, id => profiles.get(id), rooms);
    if (req.method === 'POST' && response.status < 400) {
      for (const [id, room] of rooms) {
        const encoded = JSON.stringify(room);
        if (before.get(id) !== encoded) await tx.query(`INSERT INTO qiye_private.rooms VALUES($1,$2,$3)
          ON CONFLICT(id) DO UPDATE SET data=excluded.data`, [id, room.created, encoded]);
      }
    }
    return response;
  });
  // Never acknowledge a mutation before its transaction commits.
  return json(res, result.status, result.data);
}
