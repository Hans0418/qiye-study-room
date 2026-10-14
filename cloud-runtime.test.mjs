import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { createRequestHandler } from './server.mjs';

const cloud = { origin: 'https://demo.example', apiKey: 'private-test-key', base: 'https://model.invalid', model: 'approved-model', dailyCalls: 20, userDailyCalls: 3 };
async function request(handler, path, body, extra = {}) {
  const req = Object.assign(Readable.from(body === undefined ? [] : [JSON.stringify(body)]), {
    url: path, method: body === undefined ? 'GET' : 'POST',
    headers: { host: 'demo.example', origin: cloud.origin, 'content-type': 'application/json', ...extra }
  });
  const res = new EventEmitter();
  let result;
  res.writeHead = status => { res.statusCode = status; res.headersSent = true; };
  res.end = text => { res.writableEnded = true; result = { status: res.statusCode, body: JSON.parse(String(text)) }; };
  await handler(req, res);
  return result;
}
const task = { mode: 'quick', prompt: 'Read chapter one', minutes: 25 };

test('cloud checks host and origin before accessing the database', async () => {
  const handler = createRequestHandler({ cloud, databaseFactory: () => { throw new Error('must not connect'); } });
  assert.equal((await request(handler, '/api/assist', task, { host: 'other.example' })).status, 403);
  assert.equal((await request(handler, '/api/assist', task, { origin: 'https://other.example' })).status, 403);
  assert.equal((await request(handler, '/api/assist', task, { 'sec-fetch-site': 'cross-site' })).status, 403);
  const status = await request(handler, '/api/status');
  assert.equal(status.body.mode, 'cloud');
  assert.ok(!JSON.stringify(status).includes(cloud.apiKey));
});

test('cloud AI requires login and cannot switch to another provider', async () => {
  const handler = createRequestHandler({ cloud, databaseFactory: async () => ({ query: async () => ({ rows: [] }) }) });
  assert.equal((await request(handler, '/api/assist', task)).status, 401);
  assert.equal((await request(handler, '/api/assist', { ...task, provider: 'openai' })).status, 400);
});

test('cloud database failures are sanitized and do not fall back to SQLite', async () => {
  const handler = createRequestHandler({ cloud, databaseFactory: async () => { throw new Error('private-test-key database password'); } });
  const response = await request(handler, '/api/auth/me');
  assert.equal(response.status, 503);
  assert.ok(!JSON.stringify(response).includes('private-test-key'));
});

test('cloud quota denial prevents any upstream request', async () => {
  const db = {
    query: async () => ({ rows: [{ id: 'user', name: 'Test' }] }),
    transaction: action => action({ query: async () => ({ rowCount: 0 }) })
  };
  const handler = createRequestHandler({ cloud, databaseFactory: async () => db });
  const response = await request(handler, '/api/assist', task);
  assert.equal(response.status, 429);
  assert.equal(response.body.code, 'DEMO_DAILY_LIMIT');
});
