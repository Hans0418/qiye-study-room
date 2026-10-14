import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { cloudConfig } from './cloud-config.mjs';
import { createDatabase } from './database.mjs';
import { createRequestHandler } from './server.mjs';

let database, stage = 'connect';
const rollback = new Error('ROLLBACK_WORKFLOW');
const originalFetch = globalThis.fetch;
try {
  const cloud = cloudConfig();
  if (!cloud) throw new Error('Cloud configuration required');
  database = await createDatabase(cloud);
  const nonce = randomUUID();
  try {
    await database.transaction(async tx => {
      let sequence = 0;
      const scoped = {
        query: tx.query,
        transaction: async action => {
          const name = `workflow_${++sequence}`;
          await tx.query(`SAVEPOINT ${name}`);
          try {
            const result = await action(tx);
            await tx.query(`RELEASE SAVEPOINT ${name}`);
            return result;
          } catch (error) {
            await tx.query(`ROLLBACK TO SAVEPOINT ${name}`);
            await tx.query(`RELEASE SAVEPOINT ${name}`);
            throw error;
          }
        }
      };
      const options = { cloud: { ...cloud, userDailyCalls: 1 }, databaseFactory: async () => scoped };
      const first = createRequestHandler(options), second = createRequestHandler(options);
      async function call(handler, path, body, cookie = '', origin = cloud.origin) {
        const req = Object.assign(Readable.from(body === undefined ? [] : [JSON.stringify(body)]), {
          url: path, method: body === undefined ? 'GET' : 'POST',
          socket: { remoteAddress: nonce },
          headers: { host: new URL(cloud.origin).host, origin, cookie, 'content-type': 'application/json' }
        });
        const res = new EventEmitter();
        const headers = {};
        let result;
        res.setHeader = (key, value) => { headers[key] = value; };
        res.writeHead = status => { res.statusCode = status; res.headersSent = true; };
        res.end = text => { res.writableEnded = true; result = { status: res.statusCode, body: JSON.parse(String(text)), cookie: headers['Set-Cookie']?.split(';')[0], headers }; };
        await handler(req, res);
        return result;
      }
      stage = 'origin and authentication';
      assert.equal((await call(first, '/api/auth/register', {}, '', 'https://untrusted.example')).status, 403);
      const credentials = { kind: 'email', identity: `${nonce}@example.invalid`, password: randomUUID(), name: 'Test host' };
      const host = await call(first, '/api/auth/register', credentials);
      assert.equal(host.status, 200);
      assert.match(host.headers['Set-Cookie'], /; Secure/);
      assert.equal(host.body.user.hash, undefined);
      assert.equal((await call(second, '/api/auth/me', undefined, host.cookie)).body.user.name, 'Test host');
      assert.equal((await call(second, '/api/auth/login', { ...credentials, password: 'incorrect-password' })).status, 401);
      const login = await call(second, '/api/auth/login', credentials, host.cookie);
      assert.equal(login.status, 200);
      assert.equal((await call(first, '/api/auth/me', undefined, host.cookie)).body.user, null);
      const cookie = login.cookie;
      assert.equal((await call(first, '/api/auth/avatar', { avatar: 'cat' }, cookie)).body.user.avatar, 'cat');
      const guest = await call(second, '/api/auth/register', { ...credentials, identity: `guest-${nonce}@example.invalid`, name: 'Test guest' });
      assert.equal(guest.status, 200);
      stage = 'persistent room workflow';
      const room = await call(first, '/api/rooms', { scene: 'night', minutes: 25, goal: 'Test' }, cookie);
      assert.equal(room.status, 201);
      const path = `/api/rooms/${room.body.id}`;
      const joined = await call(second, path + '/join', {}, guest.cookie);
      assert.equal(joined.status, 200);
      const snapshot = await call(first, path);
      assert.equal(snapshot.body.members.length, 1);
      assert.equal(snapshot.body.hostToken, undefined);
      assert.equal(snapshot.body.members[0].token, undefined);
      assert.equal(snapshot.body.host.avatar, 'cat');
      assert.equal((await call(second, path + '/start', { hostToken: room.body.hostToken }, guest.cookie)).status, 403);
      assert.equal((await call(first, path + '/start', { hostToken: room.body.hostToken }, cookie)).status, 200);
      assert.ok((await call(second, path)).body.startedAt);
      assert.equal((await call(first, path + '/goal', { hostToken: room.body.hostToken, goal: 'Updated', tasks: [{ id: 'task-1', text: 'Read', minutes: 25 }] }, cookie)).status, 200);
      assert.equal((await call(second, path)).body.tasks.length, 1);
      stage = 'AI authorization and daily limit';
      const task = { mode: 'quick', prompt: 'Read chapter one', minutes: 25 };
      assert.equal((await call(first, '/api/assist', task)).status, 401);
      let upstreamCalls = 0;
      globalThis.fetch = async (url, init) => {
        upstreamCalls++;
        assert.equal(url, cloud.base + '/chat/completions');
        assert.equal(JSON.parse(init.body).model, cloud.model);
        return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ answer: 'Read', question: '', assumptions: [], steps: [{ action: 'Read chapter one', deliverable: 'Notes', weight: 1 }] }) } }] }) };
      };
      const planned = await call(first, '/api/assist', task, cookie);
      assert.equal(planned.status, 200);
      assert.equal(planned.body.plan[0].minutes, 25);
      assert.equal((await call(second, '/api/assist', task, cookie)).status, 429);
      assert.equal(upstreamCalls, 1);
      stage = 'logout and room close';
      assert.equal((await call(second, path + '/close', { hostToken: room.body.hostToken }, cookie)).status, 200);
      assert.equal((await call(first, path + '/join', {}, guest.cookie)).status, 410);
      assert.equal((await call(first, '/api/auth/logout', {}, cookie)).status, 200);
      assert.equal((await call(second, '/api/auth/me', undefined, cookie)).body.user, null);
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  console.log('PASS: cloud auth, session rotation, avatar, cross-instance room state, authorization, AI routing and shared quota.');
  console.log('All fixtures rolled back. Model response was mocked; no model credits consumed.');
} catch {
  console.error(`Cloud workflow check failed at: ${stage}. Details suppressed to protect credentials.`);
  process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch;
  await database?.close();
}
