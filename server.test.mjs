import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { server, validateResult, buildPayload } from './server.mjs';

test('quick output rejects missing, excessive and non-text steps', () => {
  assert.deepEqual(validateResult({answer:'',steps:['写出问题']},'quick').steps, ['写出问题']);
  for (const steps of [[], ['a','b'], [null], ['']]) assert.throws(() => validateResult({answer:'',steps},'quick'));
});
test('providers route quick and deep with distinct reasoning settings', () => {
  const cfg = {quick:'fast-model',deep:'reasoning-model'};
  const fast = buildPayload('openai',cfg,'quick','写论文',25);
  const deep = buildPayload('openai',cfg,'deep','写论文',25);
  assert.equal(fast.model,'fast-model'); assert.equal(fast.reasoning_effort,'none');
  assert.equal(deep.model,'reasoning-model'); assert.equal(deep.reasoning_effort,'medium');
  assert.equal(buildPayload('qwen',cfg,'quick','x',25).enable_thinking,false);
  assert.equal(buildPayload('seed',cfg,'deep','x',25).thinking.type,'enabled');
});
test('request handler rejects cross-origin, invalid input and private paths', async () => {
  const request = (path, body, origin) => new Promise((resolve,reject) => {
    const req = Readable.from(body ? [JSON.stringify(body)] : []);
    Object.assign(req,{url:path,method:body ? 'POST':'GET',headers:{host:'127.0.0.1:8766','content-type':'application/json',...(origin ? {origin}:{})}});
    const res = new EventEmitter();
    res.writeHead = code => { res.statusCode=code; res.headersSent=true; };
    res.end = text => { res.writableEnded=true; resolve({code:res.statusCode,text:String(text)}); };
    req.on('error',reject);
    server.emit('request',req,res);
  });
    assert.equal((await request('/api/assist',{mode:'quick'},'https://other.example')).code,403);
    assert.equal((await request('/api/assist',{mode:'invalid'})).code,400);
    assert.equal((await request('/.env')).code,404);
    assert.equal((await request('/../server.mjs')).code,404);
    assert.equal((await request('/api/status')).code,200);
    assert.equal((await request('/')).code,200);
});
