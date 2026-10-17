(() => {
  const model = window.InookCompanionStore;
  const app = document.querySelector('.app');
  const launcher = document.createElement('button');
  launcher.id = 'companionLauncher'; launcher.type = 'button'; launcher.title = '学习伙伴'; launcher.setAttribute('aria-label', '打开学习伙伴');
  launcher.innerHTML = '<span class="pet-image"><img src="./assets/study-companion.png" alt="" /></span><span><em id="launcherPetName">小栖</em><b></b></span>';
  app.append(launcher);
  const restore = document.createElement('button');
  restore.id = 'restoreCompanion'; restore.type = 'button'; restore.innerHTML = '<img src="./assets/pet-backpack-soft.png" alt="" /><span>宠物背包</span>';
  restore.title = '打开宠物背包'; restore.setAttribute('aria-label', '打开宠物背包');
  app.append(restore);
  const dialog = document.createElement('dialog'); dialog.id = 'companionDialog'; dialog.setAttribute('aria-labelledby', 'companionTitle');
  dialog.innerHTML = `<header><div><small>陪你慢慢进步</small><h2 id="companionTitle">宠物背包</h2></div><button class="companion-close" aria-label="关闭学习伙伴" title="关闭"><span class="close-icon" aria-hidden="true"></span></button></header>
    <nav class="pet-tabs"><button id="petBagTab" aria-pressed="true">我的背包</button><button id="petShopTab" aria-pressed="false">宠物商城</button></nav>
    <div class="pet-backpack" role="group" aria-label="宠物背包"></div><p id="petUnlock"></p>
    <section id="petDetail" hidden><dl class="pet-profile"><div><dt>出生日期</dt><dd id="petBirthday"></dd></div><div><dt>星座</dt><dd id="petZodiac"></dd></div><div><dt>体重</dt><dd id="petWeight" aria-live="polite"></dd></div></dl>
    <div class="companion-portrait"><span class="pet-image"><img src="./assets/study-companion.png" alt="小栖" /></span><span class="companion-heart" aria-hidden="true">+2 ♥</span><span class="pet-paw" aria-hidden="true">🐾</span></div>
    <div class="companion-name"><h3>小栖</h3><p id="companionGreeting">你专注，我陪你。</p></div>
    <button id="petTakeOut">带出去溜溜</button>
    <section class="companion-growth" aria-label="伙伴成长"><div><span id="companionDays"></span><strong id="companionStage"></strong></div><div><label for="companionGrowth">成长值</label><span id="companionGrowthValue"></span></div><progress id="companionGrowth" max="100" value="0"></progress><p id="companionGrowthNote"></p></section>
    <div class="companion-food"><span>积攒的食物 <strong id="companionFood">0</strong> 份</span><button id="feedCompanion">喂食一份</button></div>
    <section class="companion-progress"><div><h3>今天的专注</h3><strong id="companionMinutes">0 分钟</strong></div><progress id="companionProgress" max="60" value="0" aria-label="今日学习目标进度"></progress>
    <p id="companionFirst"></p><p id="companionBonus"></p></section>
    <footer><button id="petPutAway">收回背包</button><span id="companionFeeds"></span></footer><p class="companion-note">食物不会过期，偶尔休息也没关系。</p></section><p id="companionMessage" role="status" aria-live="polite"></p>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  let snapshot, queue = Promise.resolve(), celebrating = 0, selectedPet = null, shop = false;
  function stopCelebration() { clearTimeout(celebrating); dialog.classList.remove('is-fed'); launcher.classList.remove('is-fed'); $('#companionGreeting').textContent = '你专注，我陪你。'; }
  const calendar = () => window.createCalendarStore ? window.createCalendarStore(localStorage).read() : {};
  let backpackKey = '';
  function backpack() {
    const owned = Object.keys(snapshot.pets), count = model.checkins(calendar());
    const key = JSON.stringify([snapshot.pets, selectedPet, snapshot.activePet, snapshot.visible, count, shop]);
    if (backpackKey === key) return;
    backpackKey = key;
    const bag = $('.pet-backpack'); bag.replaceChildren();
    for (const [id, pet] of Object.entries(model.catalog)) {
      if (shop ? owned.includes(id) : !owned.includes(id)) continue;
      const button = document.createElement('button');
      button.type = 'button'; button.setAttribute('aria-pressed', id === selectedPet);
      const image = document.createElement('span'); image.className = 'pet-image';
      const img = document.createElement('img'); img.src = id === 'qi' ? './assets/study-companion.png' : './assets/pet-family.png'; img.alt = '';
      img.setAttribute('data-pet', id); img.setAttribute('data-adult', String((snapshot.pets[id]?.growth || 0) >= 100));
      if (id === 'qi' && snapshot.pets[id]?.growth >= 100) img.src = './assets/study-companion-adult.png';
      image.append(img);
      const label = document.createElement('span'); label.textContent = pet.name;
      const status = document.createElement('small'); status.textContent = owned.includes(id) ? (id === snapshot.activePet && snapshot.visible ? '陪伴中 · 查看档案' : '查看档案') : owned.length < (count >= 30 ? 2 : 1) ? '领养' : '名额未解锁';
      button.append(image, label, status);
      button.disabled = !owned.includes(id) && owned.length >= (count >= 30 ? 2 : 1);
      button.title = owned.includes(id) ? `查看${pet.name}的档案` : `领养${pet.name}`;
      button.onclick = async () => {
        try {
          stopCelebration();
          if (!owned.includes(id)) await commit({ type: 'adopt-pet', pet: id, calendar: calendar() });
          selectedPet = id; shop = false; render();
          $('#companionMessage').textContent = owned.includes(id) ? '' : `${pet.name}加入了你的宠物背包。`;
        } catch {}
      };
      bag.append(button);
    }
    $('#petUnlock').textContent = !owned.length && !shop ? '背包还是空的，去商城认识一位伙伴吧。' : owned.length === 2 ? '已拥有 2 位伙伴' : count >= 30 ? '第二个领养名额已解锁' : `累计打卡 ${count} / 30 天 · 解锁第二个领养名额`;
  }
  let voice;
  function speak(species) {
    try {
      voice ||= new (window.AudioContext || window.webkitAudioContext)(); voice.resume();
      const now = voice.currentTime, osc = voice.createOscillator(), gain = voice.createGain();
      const filter = voice.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1800;
      osc.type = species === '犬' ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(species === '犬' ? 260 : 620, now);
      osc.frequency.exponentialRampToValueAtTime(species === '犬' ? 110 : 920, now + .12);
      osc.frequency.exponentialRampToValueAtTime(species === '犬' ? 90 : 380, now + .42);
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(.045, now + .04); gain.gain.exponentialRampToValueAtTime(.001, now + .46);
      osc.connect(filter); filter.connect(gain); gain.connect(voice.destination); osc.start(now); osc.stop(now + .48);
      osc.onended = () => { osc.disconnect(); filter.disconnect(); gain.disconnect(); };
    } catch { /* Feeding remains available when audio is disabled. */ }
  }
  function render() {
    try { snapshot = model.normalize(model.read(localStorage)); }
    catch { $('#companionMessage').textContent = '暂时无法读取伙伴记录，请稍后再试。'; launcher.hidden = true; restore.hidden = false; return; }
    const entry = snapshot.days[model.dayKey(Date.now())] || { seconds: 0, target: snapshot.target, earned: 0 };
    launcher.hidden = !snapshot.visible || !snapshot.activePet;
    restore.hidden = !launcher.hidden;
    if (!snapshot.pets[selectedPet]) selectedPet = snapshot.pets[snapshot.activePet] ? snapshot.activePet : Object.keys(snapshot.pets)[0] || null;
    $('#petDetail').hidden = shop || !selectedPet;
    $('#petBagTab').setAttribute('aria-pressed', String(!shop));
    $('#petShopTab').setAttribute('aria-pressed', String(shop));
    $('.pet-backpack').setAttribute('aria-label', shop ? '宠物商城' : '宠物背包');
    const growth = model.progress({ ...snapshot, activePet: selectedPet });
    const id = selectedPet || 'qi', pet = model.catalog[id];
    backpack();
    $('.companion-name h3').textContent = pet.name;
    launcher.querySelector('#launcherPetName').textContent = model.catalog[snapshot.activePet]?.name || '';
    const profile = model.profile(snapshot, selectedPet);
    $('#petBirthday').textContent = profile?.birthday || '';
    $('#petZodiac').textContent = profile?.zodiac || '';
    $('#petWeight').textContent = profile ? `${profile.weight} kg` : '';
    const portrait = id === 'qi' ? (growth.adult ? './assets/study-companion-adult.png' : './assets/study-companion.png') : './assets/pet-family.png';
    for (const img of [$('.companion-portrait img')]) {
      if (img.getAttribute('src') !== portrait) img.setAttribute('src', portrait);
      img.setAttribute('data-pet', id); img.setAttribute('data-adult', String(growth.adult));
    }
    const active = snapshot.activePet || 'qi', activeAdult = model.progress(snapshot).adult;
    const activeImage = launcher.querySelector('img');
    activeImage.setAttribute('src', active === 'qi' ? (activeAdult ? './assets/study-companion-adult.png' : './assets/study-companion.png') : './assets/pet-family.png');
    activeImage.setAttribute('data-pet', active); activeImage.setAttribute('data-adult', String(activeAdult));
    $('.companion-portrait img').alt = `${pet.name}，${pet.kind}`;
    $('#companionDays').textContent = `已陪伴 ${growth.days} 天`;
    $('#companionStage').textContent = growth.adult ? `成年${pet.species}` : `幼${pet.species}`;
    $('#companionGrowth').max = model.adultGrowth;
    $('#companionGrowth').value = Math.min(growth.growth, model.adultGrowth);
    $('#companionGrowthValue').textContent = growth.adult ? `${growth.growth} 点` : `${growth.growth} / ${model.adultGrowth}`;
    $('#companionGrowthNote').textContent = growth.adult ? `${pet.name}已经长大了 · 每次喂食 +2 成长值` : `每次喂食 +2 · 再喂 ${Math.ceil(growth.remaining / 2)} 次长大`;
    launcher.querySelector('b').textContent = snapshot.food ? `${snapshot.food} 份食物` : '';
    $('#companionFood').textContent = snapshot.food;
    $('#feedCompanion').disabled = snapshot.food < 1 || !selectedPet;
    $('#feedCompanion').textContent = `喂${pet.name}一份`;
    $('#companionMinutes').textContent = `${Math.floor(entry.seconds / 60)} 分钟`;
    $('#companionProgress').max = entry.target; $('#companionProgress').value = entry.seconds / 60;
    $('#companionFirst').textContent = entry.earned >= 1 ? '✓ 首次奖励已获得 · 1 份' : `累计专注 25 分钟 · 还差 ${Math.ceil(Math.max(0, 1500 - entry.seconds) / 60)} 分钟`;
    $('#companionBonus').textContent = entry.earned >= 2 ? '✓ 额外食物已获得 · 1 份' : `累计专注 ${entry.target} 分钟 · 再得 1 份`;
    $('#petPutAway').disabled = !snapshot.visible || snapshot.activePet !== selectedPet;
    $('#companionFeeds').textContent = `已投喂 ${snapshot.pets[id]?.feeds || 0} 次`;
  }
  function commit(action) {
    const update = () => {
      const before = model.read(localStorage);
      const next = model.reduce(before, action);
      localStorage.setItem(model.key, JSON.stringify(next));
      if (['feed','choose','adopt-pet','visible'].includes(action.type) || next.food > before.food) window.qiyePersonal?.sync();
      render();
      if (next.food > before.food) { launcher.classList.add('has-reward'); launcher.title = '获得了食物，打开学习伙伴'; }
      return next;
    };
    // Serialize writes across tabs so feeding and rewards cannot double-spend.
    queue = queue.catch(() => {}).then(() => {
      if (!navigator.locks) throw new Error('当前浏览器暂不支持保存伙伴进度，请使用新版浏览器。');
      return navigator.locks.request('inook-companion', update);
    });
    return queue.catch(error => { $('#companionMessage').textContent = error.message || '这次没能保存，请稍后再试。'; throw error; });
  }
  function open() { selectedPet = null; shop = false; stopCelebration(); render(); $('#companionMessage').textContent = ''; launcher.classList.remove('has-reward'); if (!dialog.open) dialog.showModal(); }
  launcher.onclick = open;
  restore.onclick = open;
  $('#petBagTab').onclick = () => { selectedPet = null; shop = false; stopCelebration(); render(); $('#companionMessage').textContent = ''; };
  $('#petShopTab').onclick = () => { selectedPet = null; shop = true; stopCelebration(); render(); $('#companionMessage').textContent = ''; };
  $('#petTakeOut').onclick = async () => {
    if (!selectedPet) return;
    try { await commit({ type: 'choose', pet: selectedPet }); await commit({ type: 'visible', value: true }); dialog.close(); } catch {}
  };
  $('#petPutAway').onclick = async () => {
    if (snapshot.activePet !== selectedPet) return;
    try { await commit({ type: 'visible', value: false }); $('#companionMessage').textContent = '已回到背包里休息。'; } catch {}
  };
  $('.companion-close').onclick = () => dialog.close();
  $('#feedCompanion').onclick = async () => {
    $('#feedCompanion').disabled = true;
    try {
      const feedingPet = selectedPet;
      if (!feedingPet) return;
      const wasAdult = model.progress({ ...snapshot, activePet: feedingPet }).adult;
      const next = await commit({ type: 'feed', pet: feedingPet });
      const grewUp = !wasAdult && model.progress({ ...next, activePet: feedingPet }).adult;
      speak(model.catalog[feedingPet].species);
      dialog.classList.remove('is-fed'); launcher.classList.remove('is-fed'); void dialog.offsetWidth;
      clearTimeout(celebrating); if (selectedPet === feedingPet) dialog.classList.add('is-fed');
      if (snapshot.activePet === feedingPet) launcher.classList.add('is-fed');
      $('#companionGreeting').textContent = grewUp ? '在你的陪伴下，我长大了。' : '收到了，今天也有好好陪着你。';
      $('#companionMessage').textContent = grewUp ? `成长值 +2，${model.catalog[feedingPet].name}长大了！` : '已喂食一份，成长值 +2。';
      celebrating = setTimeout(() => { dialog.classList.remove('is-fed'); launcher.classList.remove('is-fed'); $('#companionGreeting').textContent = '你专注，我陪你。'; }, 2600);
    } catch { render(); }
  };
  window.addEventListener('inook:focus-tick', event => commit({ type: 'tick', ...event.detail }).catch(() => {}));
  window.addEventListener('storage', event => { if (event.key === model.key) render(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  setInterval(() => { if (dialog.open) render(); }, 1000);
  render();
  // Persist the first encounter even before the first study session or feeding.
  commit({ type: 'adopt' }).catch(() => {});
})();
