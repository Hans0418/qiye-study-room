import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require('/Users/pangjh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root='outputs/study-room-mvp/';
const app=fs.readFileSync(root+'app.js','utf8');
const scenes=vm.runInNewContext(app.slice(0,app.indexOf('const soundStyles'))+';scenes');
const loaded=new Map();
const sharp=require('/Users/pangjh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
for(const path of [...scenes.map(s=>s.image),'./assets/sheep-walk.png']) loaded.set(path,await loadImage(await sharp(fs.readFileSync(root+path)).png().toBuffer()));
class Image {set src(path){this.inner=loaded.get(path);this.complete=true;this.naturalWidth=this.inner.width;this.naturalHeight=this.inner.height;} }
const context={window:{},Image,scenes};
vm.runInNewContext(fs.readFileSync(root+'scene-effects.js','utf8'),context);
for(const scene of scenes.filter(s=>s.id!=='forest')) test(`${scene.id}: moving nonblank canvas at desktop and mobile sizes`,async()=>{
  for(const [cw,ch] of [[1440,900],[390,844]]) {
    const [w,h]=['forest','wild'].includes(scene.id)?[1586,992]:[1672,941];
    const c=createCanvas(cw,ch),ctx=c.getContext('2d'),scale=Math.max(cw/w,ch/h);
    const original=ctx.drawImage.bind(ctx);ctx.drawImage=(img,...args)=>original(img.inner||img,...args);
    function render(t){ctx.resetTransform();ctx.clearRect(0,0,cw,ch);ctx.translate((cw-w*scale)/2,(ch-h*scale)/2);ctx.scale(scale,scale);context.window.sceneEffects.draw(ctx,scene.id,t);return Buffer.from(ctx.getImageData(0,0,cw,ch).data);}
    const a=render(10),b=render(11);
    assert.ok(a.some((v,i)=>i%4===3&&v>0));assert.notDeepEqual(a,b);
  }
});
test('forest and morning foliage stay static; sea rocks receive no deformation',()=>{
  const c=createCanvas(1672,992),ctx=c.getContext('2d');
  const original=ctx.drawImage.bind(ctx);ctx.drawImage=(img,...args)=>original(img.inner||img,...args);
  for(const t of [0,1,3,7,13,25]) {
    for(const [id,regions] of [
      ['forest',[[0,0,1586,992]]],
      ['garden',[[708,0,682,450]]],
      ['sea',[[790,440,310,50],[1100,450,160,60],[1445,420,25,250],[738,0,30,600],[300,0,90,620],[410,680,300,20]]]
    ]) {
      ctx.clearRect(0,0,1672,992);context.window.sceneEffects.draw(ctx,id,t);
      for(const region of regions) assert.ok(!ctx.getImageData(...region).data.some((v,i)=>i%4===3&&v>0),`${id}: unexpected animation in ${region}`);
    }
  }
});
test('wild: pot remains in front of the passing sheep',()=>{
  const c=createCanvas(1586,992),ctx=c.getContext('2d');
  const original=ctx.drawImage.bind(ctx);ctx.drawImage=(img,...args)=>original(img.inner||img,...args);
  const bg=loaded.get(scenes.find(s=>s.id==='wild').image);
  const reference=createCanvas(1586,992).getContext('2d'); reference.drawImage(bg,0,0);
  for(const t of [26,27,28,29,30,31,32,33,34,35]) {
    ctx.clearRect(0,0,1586,992);ctx.drawImage(bg,0,0);context.window.sceneEffects.draw(ctx,'wild',t);
    // Lid/body edge is outside the vapor plume but lies in the sheep's route.
    assert.deepEqual(ctx.getImageData(1253,668,6,8).data,reference.getImageData(1253,668,6,8).data);
  }
});
