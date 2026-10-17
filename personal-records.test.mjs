import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { createPersonalRecords, handlePersonalRecords } from './personal-records.mjs';
test('personal records survive restart, isolate users, and reject stale writes', async () => {
  const dir=mkdtempSync(join(tmpdir(),'qiye-records-')), path=join(dir,'records.sqlite');
  let store=createPersonalRecords(path);
  try {
    assert.equal(await store.put('a','diary-2026-10-16',0,{text:'今天很好'}),1);
    assert.equal(await store.put('a','diary-2026-10-16',0,{text:'旧内容'}),false);
    assert.equal((await store.get('b','diary-2026-10-16')).data,null);
    store.close(); store=createPersonalRecords(path);
    assert.equal((await store.get('a','diary-2026-10-16')).data.text,'今天很好');
    assert.equal(await store.put('a','diary-2026-10-15',0,{text:'旧日记',scene:'wild'}),1);
    assert.equal(await store.put('b','diary-2026-10-14',0,{text:'私人日记',scene:'sea'}),1);
    assert.deepEqual((await store.list('a')).map(x=>x.date),['2026-10-16','2026-10-15']);
    assert.equal((await store.list('a'))[1].scene,'wild');
    assert.equal(await store.put('a','history',0,{version:1,calendar:{'2020-01-01':{manual:true,sessions:[]}}}),1);
  } finally { store.close();rmSync(dir,{recursive:true}); }
});
test('record API requires login and rejects mismatched account ownership', async () => {
  const store=createPersonalRecords(':memory:'); let status;
  const json=(_res,code)=>{status=code;}; const url=new URL('http://localhost/api/personal/diary-2026-10-16');
  try {
    await handlePersonalRecords({method:'GET'}, {},url,json,null,store);assert.equal(status,401);
    const req=Readable.from([JSON.stringify({account:'b',revision:0,data:{text:'secret'}})]);req.method='PUT';
    await handlePersonalRecords(req,{},url,json,{id:'a'},store);assert.equal(status,409);
    assert.equal((await store.get('a','diary-2026-10-16')).data,null);
  } finally {store.close();}
});
test('diary archive returns only the current account entries and preserves writing scenes', async () => {
  const store=createPersonalRecords(':memory:'); let status, body;
  const json=(_res,code,data)=>{status=code;body=data;};
  const url=new URL('http://localhost/api/personal/diaries');
  try {
    await store.put('a','diary-2026-10-15',0,{text:'在书页上记录',scene:'garden'});
    await store.put('a','diary-2026-10-16',0,{text:'在电脑上记录',scene:'wild'});
    await store.put('a','diary-2026-10-14',0,{text:'  ',scene:'sea'});
    await store.put('b','diary-2026-10-17',0,{text:'不应出现在列表',scene:'snow'});
    await handlePersonalRecords({method:'GET'},{},url,json,null,store);
    assert.equal(status,401);
    await handlePersonalRecords({method:'GET'},{},url,json,{id:'a'},store);
    assert.equal(status,200); assert.equal(body.account,'a');
    assert.deepEqual(body.entries,[{date:'2026-10-16',scene:'wild',preview:'在电脑上记录'},{date:'2026-10-15',scene:'garden',preview:'在书页上记录'}]);
    assert.equal((await store.get('a','diary-2026-10-15')).data.scene,'garden');
  } finally { store.close(); }
});
test('API rejects writes to past and future diaries',async()=>{
  const store=createPersonalRecords(':memory:');let status;
  try {
    for(const day of ['2000-01-01','2099-01-01']){
      const req=Readable.from([JSON.stringify({account:'a',revision:0,timeZone:'America/New_York',data:{text:'不应保存',scene:'wild'}})]);req.method='PUT';
      await handlePersonalRecords(req,{},new URL(`http://localhost/api/personal/diary-${day}`),(_r,code)=>{status=code;},{id:'a'},store);
      assert.equal(status,403);assert.equal((await store.get('a',`diary-${day}`)).data,null);
    }
  } finally {store.close();}
});
