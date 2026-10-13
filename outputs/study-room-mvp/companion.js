(() => {
  const model = window.InookCompanionStore;
  const app = document.querySelector('.app');
  const launcher = document.createElement('button');
  launcher.id = 'companionLauncher'; launcher.type = 'button'; launcher.title = '学习伙伴'; launcher.setAttribute('aria-label', '打开学习伙伴');
  launcher.innerHTML = '<img src="./assets/study-companion.png" alt="" /><span>小栖 <b></b></span>';
  app.append(launcher);
  const restore = document.createElement('button');
  restore.id = 'restoreCompanion'; restore.type = 'button'; restore.textContent = '显示小栖';
  restore.title = '重新显示学习伙伴'; restore.hidden = true;
  app.append(restore);
  const dialog = document.createElement('dialog'); dialog.id = 'companionDialog'; dialog.setAttribute('aria-labelledby', 'companionTitle');
  dialog.innerHTML = `<header><div><small>一起慢慢长大</small><h2 id="companionTitle">你的学习伙伴</h2></div><button class="companion-close" aria-label="关闭学习伙伴" title="关闭">×</button></header>
    <div class="companion-portrait"><img src="./assets/study-companion.png" alt="安静趴着的小猫，小栖" /><span class="companion-heart" aria-hidden="true">♥</span></div>
    <div class="companion-name"><h3>小栖</h3><p id="companionGreeting">你专注，我陪你。</p></div>
    <section class="companion-growth" aria-label="伙伴成长"><div><span id="companionDays"></span><strong id="companionStage"></strong></div><div><label for="companionGrowth">成长值</label><span id="companionGrowthValue"></span></div><progress id="companionGrowth" max="100" value="0"></progress><p id="companionGrowthNote"></p></section>
    <div class="companion-food"><span>积攒的食物 <strong id="companionFood">0</strong> 份</span><button id="feedCompanion">喂食一份</button></div>
    <section class="companion-progress"><div><h3>今天的专注</h3><strong id="companionMinutes">0 分钟</strong></div><progress id="companionProgress" max="60" value="0" aria-label="今日学习目标进度"></progress>
    <p id="companionFirst"></p><p id="companionBonus"></p></section>
    <form id="companionTargetForm"><label for="companionTarget">每日目标</label><div><input id="companionTarget" type="number" min="30" max="240" step="1" value="60" required /> <span>分钟</span><button type="submit">保存</button></div><small id="companionTargetNote"></small></form>
    <footer><label><input id="companionVisible" type="checkbox" checked />显示学习伙伴</label><span id="companionFeeds"></span></footer><p class="companion-note">食物不会过期，偶尔休息也没关系。</p><p id="companionMessage" role="status" aria-live="polite"></p>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  let snapshot, queue = Promise.resolve(), celebrating = 0, targetDirty = false;
  function render() {
    try { snapshot = model.read(localStorage); }
    catch { $('#companionMessage').textContent = '暂时无法读取伙伴记录，请稍后再试。'; launcher.hidden = true; restore.hidden = false; return; }
    const entry = snapshot.days[model.dayKey(Date.now())] || { seconds: 0, target: snapshot.target, earned: 0 };
    launcher.hidden = !snapshot.visible;
    restore.hidden = snapshot.visible;
    const growth = model.progress(snapshot);
    const portrait = growth.adult ? './assets/study-companion-adult.png' : './assets/study-companion.png';
    for (const img of [launcher.querySelector('img'), $('.companion-portrait img')]) {
      if (img.getAttribute('src') !== portrait) img.setAttribute('src', portrait);
    }
    $('.companion-portrait img').alt = growth.adult ? '成年小栖，银白色大猫' : '幼年小栖，银白色小猫';
    $('#companionDays').textContent = `已陪伴 ${growth.days} 天`;
    $('#companionStage').textContent = growth.adult ? '成年猫' : '幼猫';
    $('#companionGrowth').max = model.adultGrowth;
    $('#companionGrowth').value = Math.min(growth.growth, model.adultGrowth);
    $('#companionGrowthValue').textContent = growth.adult ? `${growth.growth} 点` : `${growth.growth} / ${model.adultGrowth}`;
    $('#companionGrowthNote').textContent = growth.adult ? `小栖已经长大了 · 每次喂食 +${model.growthPerFeed} 成长值` : `每次喂食 +${model.growthPerFeed} · 再喂 ${Math.ceil(growth.remaining / model.growthPerFeed)} 次长成大猫`;
    launcher.querySelector('b').textContent = snapshot.food ? `${snapshot.food} 份食物` : '';
    $('#companionFood').textContent = snapshot.food;
    $('#feedCompanion').disabled = snapshot.food < 1;
    $('#companionMinutes').textContent = `${Math.floor(entry.seconds / 60)} 分钟`;
    $('#companionProgress').max = entry.target; $('#companionProgress').value = entry.seconds / 60;
    $('#companionFirst').textContent = entry.earned >= 1 ? '✓ 首次奖励已获得 · 1 份' : `累计专注 25 分钟 · 还差 ${Math.ceil(Math.max(0, 1500 - entry.seconds) / 60)} 分钟`;
    $('#companionBonus').textContent = entry.earned >= 2 ? '✓ 每日目标已达成 · 额外 1 份' : `达成 ${entry.target} 分钟目标 · 额外 1 份`;
    if (!targetDirty && document.activeElement !== $('#companionTarget')) $('#companionTarget').value = snapshot.target;
    $('#companionTargetNote').textContent = entry.earned >= 2 ? '今天的奖励已领满，调整目标从明天生效。' : '每天最多获得两份食物。';
    $('#companionVisible').checked = snapshot.visible;
    $('#companionFeeds').textContent = `已投喂 ${snapshot.feeds} 次`;
  }
  function commit(action) {
    const update = () => {
      const before = model.read(localStorage);
      const next = model.reduce(before, action);
      localStorage.setItem(model.key, JSON.stringify(next));
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
  function open() { render(); $('#companionMessage').textContent = ''; launcher.classList.remove('has-reward'); if (!dialog.open) dialog.showModal(); }
  launcher.onclick = open;
  restore.onclick = async () => {
    restore.disabled = true;
    try { await commit({ type: 'visible', value: true }); }
    catch { if (!dialog.open) dialog.showModal(); }
    finally { restore.disabled = false; }
  };
  const calendarEntry = document.createElement('button'); calendarEntry.id = 'calendarCompanion'; calendarEntry.textContent = '学习伙伴'; calendarEntry.type = 'button';
  document.querySelector('#focusCalendar header > div').append(calendarEntry);
  calendarEntry.onclick = () => { document.querySelector('#focusCalendar').close(); open(); };
  $('.companion-close').onclick = () => dialog.close();
  $('#feedCompanion').onclick = async () => {
    $('#feedCompanion').disabled = true;
    try {
      const wasAdult = model.progress(snapshot).adult;
      const next = await commit({ type: 'feed' });
      const grewUp = !wasAdult && model.progress(next).adult;
      clearTimeout(celebrating); dialog.classList.add('is-fed'); launcher.classList.add('is-fed');
      $('#companionGreeting').textContent = grewUp ? '在你的陪伴下，我长大了。' : '收到了，今天也有好好陪着你。';
      $('#companionMessage').textContent = grewUp ? `成长值 +${model.growthPerFeed}，小栖长成大猫了！` : `已喂食一份，成长值 +${model.growthPerFeed}。`;
      celebrating = setTimeout(() => { dialog.classList.remove('is-fed'); launcher.classList.remove('is-fed'); $('#companionGreeting').textContent = '你专注，我陪你。'; }, 2600);
    } catch { render(); }
  };
  $('#companionTarget').oninput = () => { targetDirty = true; };
  $('#companionTargetForm').onsubmit = async event => {
    event.preventDefault();
    try { await commit({ type: 'target', minutes: Number($('#companionTarget').value) }); targetDirty = false; $('#companionMessage').textContent = '每日目标已保存。'; } catch {}
  };
  $('#companionVisible').onchange = () => commit({ type: 'visible', value: $('#companionVisible').checked }).catch(() => render());
  window.addEventListener('inook:focus-tick', event => commit({ type: 'tick', ...event.detail }).catch(() => {}));
  window.addEventListener('storage', event => { if (event.key === model.key) render(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  setInterval(() => { if (dialog.open) render(); }, 1000);
  render();
  // Persist the first encounter even before the first study session or feeding.
  commit({ type: 'adopt' }).catch(() => {});
})();
