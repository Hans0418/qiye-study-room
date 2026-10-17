import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./outputs/study-room-mvp/diary.js',import.meta.url),'utf8');
function setup(selected) {
  const elements=new Map(), writes=[], audio=[];
  class Element {
    constructor(){this.dataset={};this.style={setProperty(){}};this.children=[];this.value='';this.clientWidth=1200;this.clientHeight=800;}
    set id(value){this._id=value;elements.set('#'+value,this);} get id(){return this._id;}
    set innerHTML(html){for(const match of html.matchAll(/id="([^"]+)"/g)){const element=new Element();element.id=match[1];}}
    querySelector(key){if(!elements.has(key))elements.set(key,new Element());return elements.get(key);}
    append(...children){this.children.push(...children);} replaceChildren(){this.children=[];}
    setAttribute(key,value){this[key]=value;} addEventListener(){} showModal(){this.open=true;} close(){this.open=false;}
  }
  const doc=new Element();doc.body=new Element();doc.createElement=()=>new Element();
  const scenes=['snow','sea','garden','night','forest','wild'].map(id=>({id,name:id,image:id+'.png'}));
  const storage=new Map();
  class Audio {
    sampleRate=1000; currentTime=0; destination={};
    resume(){return Promise.resolve();}
    createBuffer(_channels,length){audio.push(length);return {getChannelData:()=>new Float32Array(Math.floor(length))};}
    node(){return {connect(){return this;},disconnect(){},start(){},frequency:{},Q:{},gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}}};}
    createBufferSource(){return this.node();} createBiquadFilter(){return this.node();} createGain(){return this.node();}
  }
  class TestDate extends Date {constructor(...args){super(...(args.length?args:[2026,9,16,12]));}}
  const context={document:doc,scenes,selectedScene:()=>scenes.find(s=>s.id===selected),Image:class {naturalWidth=1600;naturalHeight=1000;},Date:TestDate,Math,Float32Array,
    window:{inookAccount:{requireLogin:async()=>true},AudioContext:Audio,addEventListener(){}},
    fetch:async()=>({json:async()=>({user:{id:'test'}})}),
    localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    setTimeout:()=>1,setInterval:()=>1,clearTimeout(){},
    qiyePersonal:{api:async(name,body)=>{if(body){writes.push(body);return {revision:2};}if(name==='diaries')return {account:'test',entries:[{date:'2026-10-15',scene:'sea',preview:'已有日记'}]};return {account:'test',revision:1,data:{text:'已有日记',scene:'sea'}};}}
  };
  vm.runInNewContext(source,context);
  return {get:key=>elements.get('#'+key),writes,audio};
}
for(const scene of ['snow','sea','garden','night','forest','wild']) {
  test(`today in ${scene} retains current scene despite a saved sea diary`,async()=>{
    const ui=setup(scene);await ui.get('openDiary').onclick();await ui.get('deskPaper').onclick();
    assert.equal(ui.get('diaryRoom').dataset.scene,scene);
    assert.equal(ui.get('diarySheet').dataset.surface,['snow','wild'].includes(scene)?'computer':'book');
    assert.equal(ui.get('diaryText').value,'已有日记');
    assert.equal(ui.audio[0],['snow','wild'].includes(scene)?55:380);
    assert.ok(parseFloat(ui.get('deskPaper').style.width)>100);
    ui.get('diaryText').value='新内容';await ui.get('saveDiary').onclick();
    assert.equal(ui.writes[0].data.scene,scene);
  });
}
test('only explicit archive navigation restores the original scene and editor',async()=>{
  const ui=setup('wild');await ui.get('openDiary').onclick();await ui.get('diaryHistory').onclick();
  ui.get('diaryDate').value='2026-10-15';await ui.get('deskPaper').onclick();ui.get('diaryDate').value='2026-10-15';await ui.get('diaryDate').onchange();
  assert.equal(ui.get('diaryRoom').dataset.scene,'sea');
  assert.equal(ui.get('diarySheet').dataset.surface,'book');
  assert.equal(ui.get('diaryText').readOnly,true);
});
test('manual save updates scene even with unchanged text and acknowledges success',async()=>{
  const ui=setup('wild');await ui.get('openDiary').onclick();await ui.get('deskPaper').onclick();await ui.get('saveDiary').onclick();
  assert.equal(ui.writes[0].data.scene,'wild');assert.equal(ui.get('diarySavedToast').hidden,false);
});
