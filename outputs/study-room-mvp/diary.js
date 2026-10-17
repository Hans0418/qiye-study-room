(() => {
  const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const entry = document.createElement('button'); entry.id = 'openDiary'; entry.textContent = '记日记';
  document.querySelector('.nav-links').append(entry);
  const room = document.createElement('dialog'); room.id = 'diaryRoom'; room.setAttribute('aria-label','日记书房');
  room.innerHTML = `<header class="diary-room-header"><div><span>栖页 / 日记</span><strong id="diarySceneName"></strong></div><button id="leaveDiary" aria-label="离开日记" title="离开日记">×</button></header>
    <button id="diaryHistory">往期日记</button><button id="deskPaper" aria-label="打开日记" title="打开日记"></button><div id="diaryHint" aria-hidden="true"><p>记录下今天发生的小故事</p><span>↓</span></div>
    <div class="diary-room-caption"><span id="diaryToday"></span><p>今天有什么想记下来的？</p></div>`;
  document.body.append(room);
  const sheet = document.createElement('dialog'); sheet.id = 'diarySheet'; sheet.setAttribute('aria-labelledby','diaryTitle');
  sheet.innerHTML = `<div class="diary-paper"><header><div><span class="diary-eyebrow">栖页 · 私人日记</span><h2 id="diaryTitle">今天，想写些什么？</h2></div><button id="foldDiary" aria-label="收起日记" title="收起日记">×</button></header>
    <div class="diary-date-row"><input id="diaryDate" type="date" aria-label="日记日期" /><span id="diarySaveStatus" role="status"></span></div>
    <textarea id="diaryText" maxlength="30000" aria-label="日记正文" placeholder="从一句话开始，也很好。" spellcheck="false"></textarea>
    <footer><span id="diaryWordCount">0 字</span><button id="saveDiary">保存日记</button></footer><div id="diarySavedToast" role="status" hidden><strong>已保存</strong><span>今天的小故事，已经收好了。</span></div></div>`;
  document.body.append(sheet);
  const archive = document.createElement('dialog'); archive.id='diaryArchive'; archive.setAttribute('aria-label','往期日记');
  archive.innerHTML='<header><h2>往期日记</h2><button aria-label="关闭往期日记">×</button></header><div id="diaryEntries" role="status"></div>';
  document.body.append(archive); archive.querySelector('button').onclick=()=>archive.close();
  const surfaces={snow:{x:.32,y:.71,w:.27,h:.20,type:'computer'},sea:{x:.29,y:.88,w:.36,h:.17,type:'book'},garden:{x:.27,y:.79,w:.37,h:.15,type:'book'},night:{x:.30,y:.84,w:.31,h:.13,type:'book'},forest:{x:.40,y:.65,w:.12,h:.045,type:'book'},wild:{x:.55,y:.71,w:.24,h:.22,type:'computer'}};
  let sceneId, backdropImage;
  function positionObject(){
    if(!backdropImage?.naturalWidth)return;
    const point=surfaces[sceneId], w=room.clientWidth,h=room.clientHeight;
    const scale=Math.max(w/backdropImage.naturalWidth,h/backdropImage.naturalHeight);
    const iw=backdropImage.naturalWidth*scale,ih=backdropImage.naturalHeight*scale;
    const offsetX=Math.max(w-iw,Math.min(0,w/2-point.x*iw)),offsetY=(h-ih)/2;
    room.style.backgroundPosition=`${offsetX}px ${offsetY}px`;
    const target=room.querySelector('#deskPaper'); target.style.left=`${offsetX+point.x*iw}px`;target.style.top=`${offsetY+point.y*ih}px`;
    target.style.width=`${point.w*iw}px`;target.style.height=`${point.h*ih}px`;
    const hint=room.querySelector('#diaryHint');hint.style.left=`${offsetX+point.x*iw}px`;hint.style.top=`${offsetY+(point.y-point.h/2)*ih-12}px`;
  }
  function showScene(id){
    const scene=scenes.find(s=>s.id===id)||selectedScene(); sceneId=scene.id;
    room.dataset.scene=sceneId; sheet.dataset.scene=sceneId; sheet.dataset.surface=surfaces[sceneId].type;
    room.querySelector('#deskPaper').setAttribute('aria-label',surfaces[sceneId].type==='computer'?'打开电脑日记':'打开书本日记');
    room.style.setProperty('--diary-scene',`url("${scene.image}")`);
    room.querySelector('#diarySceneName').textContent=scene.name;
    $('#diaryTitle').textContent=surfaces[sceneId].type==='computer'?'我的日记':'今天，想写些什么？';
    backdropImage=new Image();backdropImage.onload=positionObject;backdropImage.src=scene.image;
  }
  window.addEventListener('resize',positionObject);
  const $ = s => sheet.querySelector(s);
  let owner, date, revision = 0, timer, saving = null, loading = false, savedText = '', sound;
  let toastTimer;
  function readingState(){
    const readonly=date!==dayKey(); $('#diaryText').readOnly=readonly; $('#saveDiary').hidden=readonly;
    $('#diaryDate').max=dayKey();
    $('#diaryText').placeholder=readonly?`${Number(date.slice(5,7))}月${Number(date.slice(8))}日，没有留下记录哦。`:'从一句话开始，也很好。';
    if(readonly && !loading && revision!==null) $('#diarySaveStatus').textContent='只读';
    return readonly;
  }
  setInterval(()=>{if(sheet.open)readingState();},1000);
  const draftKey = () => `qiyeDiaryDraft:${owner}:${date}`;
  function scratch() {
    try {
      sound ||= new (window.AudioContext || window.webkitAudioContext)(); sound.resume().catch(()=>{});
      const computer=surfaces[sceneId].type==='computer';
      const buffer = sound.createBuffer(1, sound.sampleRate * (computer?.055:.38), sound.sampleRate), samples = buffer.getChannelData(0);
      for (let i=0;i<samples.length;i++) samples[i]=(Math.random()*2-1)*.18;
      const source = sound.createBufferSource(), filter = sound.createBiquadFilter(), gain = sound.createGain();
      source.buffer=buffer; filter.type='bandpass'; filter.frequency.value=computer?1100:2700; filter.Q.value=.8;
      const now=sound.currentTime; gain.gain.setValueAtTime(0,now);
      if(computer){gain.gain.linearRampToValueAtTime(.55,now+.002);gain.gain.exponentialRampToValueAtTime(.001,now+.05);}
      else {gain.gain.linearRampToValueAtTime(.35,now+.02); gain.gain.linearRampToValueAtTime(.05,now+.14); gain.gain.linearRampToValueAtTime(.3,now+.19); gain.gain.linearRampToValueAtTime(0,now+.36);}
      source.connect(filter).connect(gain).connect(sound.destination); source.start(); source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
    } catch { /* Writing remains available when audio is unavailable. */ }
  }
  async function load(nextDate, restoreScene = false) {
    loading = true; date = nextDate; $('#diaryText').disabled = true; $('#saveDiary').disabled = true; $('#diaryDate').disabled = true;
    $('#diarySaveStatus').textContent='正在翻开这一页…'; $('#diaryText').value='';
    try {
      const result=await qiyePersonal.api(`diary-${date}`);
      if (result.account !== owner) throw new Error('账号已变化，请重新打开日记');
      revision=result.revision; savedText=result.data?.text || '';
      // Only explicit history navigation restores a saved scene, never today's entry point.
      if(restoreScene) showScene(result.data?.scene || selectedScene().id);
      $('#diaryText').value=date===dayKey()?(localStorage.getItem(draftKey()) ?? savedText):savedText;
      $('#diarySaveStatus').textContent=$('#diaryText').value===savedText ? (revision ? '已保存' : '') : '有未保存的草稿';
    } catch (e) { $('#diaryText').value=date===dayKey()?(localStorage.getItem(draftKey()) || ''):''; $('#diarySaveStatus').textContent='暂未连接，请稍后重试'; revision=null; savedText=null; }
    finally { loading=false; $('#diaryText').disabled=false; $('#saveDiary').disabled=false; $('#diaryDate').disabled=false; $('#diaryDate').value=date; count(); readingState(); }
  }
  function count(){ $('#diaryWordCount').textContent=`${$('#diaryText').value.length} 字`; }
  async function save(manual = false) {
    clearTimeout(timer); if(loading) return false;
    if(readingState()) return $('#diaryText').value===savedText;
    if(saving) { await saving; return save(manual); }
    const text=$('#diaryText').value; if(text===savedText && !manual) return true;
    try { localStorage.setItem(draftKey(),text); } catch { $('#diarySaveStatus').textContent='本机空间不足，请保持页面打开'; return false; }
    if(revision===null){ $('#diarySaveStatus').textContent='未同步，草稿已留在本机'; return false; }
    $('#diarySaveStatus').textContent='正在保存…'; $('#saveDiary').disabled=true;
    saving=(async()=>{
      try {
        const result=await qiyePersonal.api(`diary-${date}`,{account:owner,revision,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,data:{text,scene:sceneId}});
        revision=result.revision; savedText=text;
        if($('#diaryText').value===text) localStorage.removeItem(draftKey());
        $('#diarySaveStatus').textContent='已保存';
        if(manual){clearTimeout(toastTimer);$('#diarySavedToast').hidden=false;toastTimer=setTimeout(()=>{$('#diarySavedToast').hidden=true;},2200);}
        return true;
      } catch(e){ $('#diarySaveStatus').textContent=e.message; return false; }
      finally { $('#saveDiary').disabled=false; }
    })();
    const result=await saving; saving=null; return result;
  }
  entry.onclick=async()=>{
    if(!await window.inookAccount.requireLogin())return;
    const auth=await fetch('/api/auth/me').then(r=>r.json()); owner=auth.user?.id; if(!owner)return;
    showScene(selectedScene().id); room.querySelector('#diaryToday').textContent=dayKey().replaceAll('-',' / ');
    room.showModal();
    positionObject();
  };
  room.querySelector('#deskPaper').onclick=async()=>{ scratch(); sheet.showModal(); await load(dayKey()); };
  let archiveEntries=[], archiveDate=dayKey(), archiveMonth=dayKey().slice(0,7);
  function renderArchive(){
    const list=archive.querySelector('#diaryEntries');list.replaceChildren();
    const nav=document.createElement('div');nav.className='diary-month-nav';
    const prev=document.createElement('button'),next=document.createElement('button'),year=document.createElement('select'),month=document.createElement('select');
    const prevYear=document.createElement('button'),nextYear=document.createElement('button'),title=document.createElement('div');title.className='diary-month-title';
    prevYear.textContent='«';nextYear.textContent='»';prevYear.setAttribute('aria-label','上一年');nextYear.setAttribute('aria-label','下一年');
    prev.textContent='‹';next.textContent='›';prev.setAttribute('aria-label','上个月');next.setAttribute('aria-label','下个月');year.setAttribute('aria-label','日记年份');month.setAttribute('aria-label','日记月份');
    const [y,m]=archiveMonth.split('-').map(Number), currentYear=new Date().getFullYear();
    const firstYear=Math.min(y,currentYear-10,...archiveEntries.map(e=>Number(e.date.slice(0,4))));
    for(let n=firstYear;n<=currentYear;n++){const option=document.createElement('option');option.value=String(n);option.textContent=`${n}年`;year.append(option);}year.value=String(y);
    for(let n=1;n<=12;n++){const option=document.createElement('option');option.value=String(n);option.textContent=`${n}月`;month.append(option);}month.value=String(m);
    const change=(yy,mm)=>{const d=new Date(yy,mm-1,1);archiveMonth=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;archiveDate=archiveMonth===dayKey().slice(0,7)?dayKey():`${archiveMonth}-01`;renderArchive();};
    prev.onclick=()=>change(y,m-1);next.onclick=()=>change(y,m+1);next.disabled=archiveMonth>=dayKey().slice(0,7);year.onchange=month.onchange=()=>change(Number(year.value),Number(month.value));
    prevYear.onclick=()=>change(y-1,m);nextYear.onclick=()=>change(y+1,m);nextYear.disabled=y>=currentYear;
    title.append(year,month);nav.append(prevYear,prev,title,next,nextYear);list.append(nav);
    const caption=document.createElement('div');caption.className='diary-calendar-caption';const captionText=document.createElement('span');captionText.textContent=`${archiveEntries.filter(e=>e.date.startsWith(archiveMonth)).length} 天有记录`;
    const today=document.createElement('button');today.textContent='今天';today.onclick=()=>{archiveDate=dayKey();archiveMonth=archiveDate.slice(0,7);renderArchive();};caption.append(captionText,today);list.append(caption);
    const grid=document.createElement('div');grid.className='diary-month-grid';
    for(const label of ['一','二','三','四','五','六','日']){const cell=document.createElement('span');cell.textContent=label;grid.append(cell);}
    const offset=(new Date(y,m-1,1).getDay()+6)%7;
    for(let n=0;n<offset;n++)grid.append(document.createElement('span'));
    for(let n=1;n<=new Date(y,m,0).getDate();n++){
      const key=`${archiveMonth}-${String(n).padStart(2,'0')}`,button=document.createElement('button');button.textContent=String(n);button.disabled=key>dayKey();button.setAttribute('aria-label',key);
      button.setAttribute('aria-pressed',String(key===archiveDate));button.dataset.today=String(key===dayKey());button.dataset.record=String(archiveEntries.some(e=>e.date===key));button.onclick=()=>{archiveDate=key;renderArchive();};grid.append(button);
    }list.append(grid);
    const preview=document.createElement('section');preview.className='diary-day-preview';const heading=document.createElement('h3');heading.textContent=`${Number(archiveDate.slice(5,7))}月${Number(archiveDate.slice(8))}日${archiveDate===dayKey()?' · 今天':''}`;preview.append(heading);
    const item=archiveEntries.find(e=>e.date===archiveDate),summary=document.createElement('p');
    summary.textContent=item?item.preview:`${Number(archiveDate.slice(5,7))}月${Number(archiveDate.slice(8))}日，没有留下记录哦。`;preview.append(summary);
    if(item){const scene=document.createElement('span');scene.textContent=scenes.find(s=>s.id===item.scene)?.name||'日记';const open=document.createElement('button');open.textContent='翻开这一天 →';open.onclick=async()=>{archive.close();showScene(item.scene);scratch();sheet.showModal();await load(item.date,true);};preview.append(scene,open);}list.append(preview);
  }
  room.querySelector('#diaryHistory').onclick=async()=>{
    archive.showModal();const list=archive.querySelector('#diaryEntries');list.textContent='正在读取日记…';
    try{
      const result=await qiyePersonal.api('diaries');if(result.account!==owner)throw new Error('账号已变化');
      archiveEntries=result.entries;archiveDate=dayKey();archiveMonth=archiveDate.slice(0,7);renderArchive();
    }catch{list.textContent='暂时无法读取日记，请稍后重试。';}
  };
  room.querySelector('#leaveDiary').onclick=()=>room.close();
  $('#diaryText').oninput=()=>{
    if(readingState())return;
    count(); clearTimeout(timer); $('#diarySaveStatus').textContent='未保存';
    try { localStorage.setItem(draftKey(),$('#diaryText').value); } catch { $('#diarySaveStatus').textContent='本机草稿未能保存，请勿关闭页面'; }
    timer=setTimeout(save,1000);
  };
  $('#saveDiary').onclick=()=>save(true);
  $('#foldDiary').onclick=async()=>{await save();sheet.close();$('#diarySavedToast').hidden=true;};
  sheet.addEventListener('cancel',event=>{event.preventDefault();$('#foldDiary').click();});
  $('#diaryDate').onchange=async()=>{const next=$('#diaryDate').value;if(!next||next>dayKey()){$('#diaryDate').value=date;return;}if(!await save()){$('#diaryDate').value=date;return;}await load(next,true);};
  window.addEventListener('beforeunload',event=>{if(sheet.open && $('#diaryText').value!==savedText){event.preventDefault();event.returnValue='';}});
  window.addEventListener('inook:account-profile',event=>{if(owner && event.detail?.id!==owner){clearTimeout(timer);if(sheet.open)sheet.close();if(room.open)room.close();if(archive.open)archive.close();}});
})();
