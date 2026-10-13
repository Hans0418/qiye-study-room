import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthStore } from './auth.mjs';
test('email/phone accounts, validation, session rotation and logout', async () => {
  const store = createAuthStore(':memory:');
  async function call(path, body, cookie = '', ip = 'test') {
    let result; const headers = {};
    const req = { method: body ? 'POST' : 'GET', socket: { remoteAddress: ip }, headers: { cookie, 'content-type': 'application/json' }, async *[Symbol.asyncIterator]() { yield JSON.stringify(body); } };
    await store.handle(req, { setHeader: (k,v) => { headers[k] = v; } }, new URL('/api/auth/' + path, 'http://localhost'), (_, status, data) => { result = { status, data, cookie: headers['Set-Cookie'] }; });
    return result;
  }
  try {
    const body = { kind: 'email', identity: 'Test@example.com', name: '测试', password: 'sample-test-password' };
    assert.equal((await call('register', { ...body, password: 'short' })).status, 400);
    const signed = await call('register', body);
    assert.equal(signed.status, 200); assert.equal(signed.data.user.identity, 'test@example.com');
    assert.equal(signed.data.user.hash, undefined); assert.equal(signed.data.user.verified, false);
    assert.match(signed.cookie, /HttpOnly; SameSite=Strict/);
    const cookie = signed.cookie.split(';')[0];
    assert.equal((await call('avatar', { avatar: 'bear' })).status, 401);
    assert.equal((await call('avatar', { avatar: '<script>' }, cookie)).status, 400);
    assert.equal((await call('avatar', { avatar: 'cat' }, cookie)).data.user.avatar, 'cat');
    assert.equal((await call('me', undefined, cookie)).data.user.avatar, 'cat');
    assert.equal((await call('me', undefined, cookie)).data.user.name, '测试');
    assert.equal((await call('register', body)).status, 409);
    assert.equal((await call('login', { ...body, password: 'incorrect-password' })).status, 401);
    const login = await call('login', body, cookie); assert.equal(login.status, 200);
    assert.equal(login.data.user.avatar, 'cat');
    assert.equal((await call('me', undefined, cookie)).data.user, null);
    const newCookie = login.cookie.split(';')[0];
    await call('logout', {}, newCookie);
    assert.equal((await call('me', undefined, newCookie)).data.user, null);
    const phone = await call('register', { ...body, kind: 'phone', identity: '13800000000' });
    assert.equal(phone.status, 200); assert.equal(phone.data.user.identity, '+8613800000000');
    assert.equal((await call('login', { ...body, kind: 'phone', identity: '+86 13800000000' })).status, 200);
    assert.equal((await call('register', { ...body, identity: 'bad' })).status, 400);
    for (let i = 0; i < 20; i++) await call('login', { ...body, password: 'short' }, '', 'rate-test');
    assert.equal((await call('login', body, '', 'rate-test')).status, 429);
  } finally { store.close(); }
});
