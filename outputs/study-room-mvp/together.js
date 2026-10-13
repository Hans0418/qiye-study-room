(() => {
  let mode = false, id = new URL(location.href).searchParams.get('room'), room, credentials = {}, timer, entered = false, busy = false;
  let ownGoal = '';
  let checkingEntry = false, loginDeclined = false;
  let revision = 0, polling = false;
  let lastSharedGoal = '', personalDraft = '';
  let composingGoal = false, goalEditedAt = 0, lastTimerSignature = '', sharedTimer, sharedDone = false;
  let lastTaskSignature = '', receivedTaskSignature = '';
  function taskSnapshot() {
    return sessionTasks.map(task => { task.id ||= crypto.randomUUID(); return { id: task.id, text: task.text, minutes: task.minutes || 15 }; });
  }
  function receiveTasks() {
    const signature = JSON.stringify(room.tasks || []);
    if (signature !== receivedTaskSignature) { receivedTaskSignature = signature; renderSessionTasks(); }
  }
  document.addEventListener('compositionstart', () => { composingGoal = true; });
  document.addEventListener('compositionend', () => { composingGoal = false; goalEditedAt = Date.now(); });
  document.addEventListener('input', () => { goalEditedAt = Date.now(); });
  goalInput.addEventListener('compositionstart', () => { composingGoal = true; });
  goalInput.addEventListener('compositionend', () => { composingGoal = false; goalEditedAt = Date.now(); });
  goalInput.addEventListener('input', () => { goalEditedAt = Date.now(); });
  function timerSnapshot() {
    return goalClock.remaining === null ? null : { remaining: goalClock.tick(), running: goalClock.deadline !== null };
  }
  function timerSignature() { return JSON.stringify([goalClock.deadline, goalClock.deadline === null ? goalClock.remaining : null]); }
  function receiveTimer() {
    const t = room.goalTimer;
    sharedTimer = !t ? null : { remaining: t.remaining, deadline: t.deadline === null ? null : Date.now() + Math.max(0, t.deadline - room.serverNow) };
  }
  const goalControl = document.createElement('button');
  goalControl.id = 'sharedGoalMode'; goalControl.type = 'button'; goalControl.hidden = true;
  const goalField = document.createElement('div'); goalField.className = 'shared-goal-field';
  goalInput.before(goalField); goalField.append(goalInput, goalControl);
  const goalEditor = document.createElement('dialog'); goalEditor.id = 'sharedGoalDialog';
  goalEditor.innerHTML = '<form method="dialog"><h2>目标安排</h2><p id="sharedGoalHint"></p><textarea maxlength="300" aria-label="个人目标"></textarea><p role="status"></p><footer><button value="cancel">取消</button><button type="button" id="saveSharedMode">确认</button></footer></form>';
  document.body.append(goalEditor);
  function following() { return Boolean(credentials.memberToken && credentials.goalMode !== 'own'); }
  function renderGoalMode() {
    goalControl.hidden = !credentials.memberToken || !entered;
    goalInput.readOnly = following() && entered;
    goalInput.placeholder = following() && entered ? '等待房主设置目标' : '自由专注';
    goalControl.textContent = following() ? '跟随房主 · 改用自己的目标' : '个人目标 · 重新跟随房主';
    document.querySelector('#goalTimeSettings').hidden = following() && entered;
  }
  function applySharedGoal(value) {
    if (value !== lastSharedGoal) sharedDone = false;
    state.goal = value; goalInput.value = value; setupGoalInput.value = value;
    lastSharedGoal = value;
  }
  function editGoalMode() {
    const toOwn = following();
    goalEditor.dataset.toOwn = String(toOwn);
    goalEditor.querySelector('#sharedGoalHint').textContent = toOwn ? '修改只影响你自己，不需要房主同意。' : `将使用房主当前目标：${room.goal || '等待房主设置目标'}。你的个人目标草稿会保留。`;
    const input = goalEditor.querySelector('textarea'); input.hidden = !toOwn; input.value = personalDraft || state.goal;
    goalEditor.querySelector('[role="status"]').textContent = '';
    goalEditor.showModal();
  }
  goalControl.onclick = editGoalMode;
  goalInput.addEventListener('input', () => {
    if (entered && credentials.memberToken && !following()) {
      personalDraft = goalInput.value; credentials.goal = personalDraft; remember();
    }
  });
  goalEditor.querySelector('#saveSharedMode').onclick = async () => {
    const button = goalEditor.querySelector('#saveSharedMode'), version = revision;
    button.disabled = true;
    try {
      const toOwn = goalEditor.dataset.toOwn === 'true';
      const draft = goalEditor.querySelector('textarea').value.trim();
      await api(`/${id}/goal-mode`, { ...credentials, goalMode: toOwn ? 'own' : 'follow' });
      if (version !== revision) return;
      if (!toOwn) personalDraft = state.goal;
      else personalDraft = draft;
      credentials.goalMode = toOwn ? 'own' : 'follow'; credentials.goal = personalDraft; remember();
      applySharedGoal(toOwn ? personalDraft : room.goal); receiveTimer(); renderGoalMode(); renderGoalClock(); renderSessionTasks(); goalEditor.close();
    } catch (error) { goalEditor.querySelector('[role="status"]').textContent = error.message; }
    finally { button.disabled = false; }
  };
  const enter = document.querySelector('#enterRoomButton');
  const originalEnter = enter.innerHTML;
  const dialog = document.createElement('dialog'); dialog.id = 'togetherDialog';
  dialog.setAttribute('aria-labelledby', 'togetherTitle');
  dialog.innerHTML = `<header><div><small>栖页 · 一起自习</small><h2 id="togetherTitle">准备一个共同的书房</h2></div><button id="hideTogether" title="收起" aria-label="收起邀请面板">×</button></header>
    <p id="roomOverview"></p>
    <section id="inviteSection" hidden><label>邀请链接<input id="inviteUrl" readonly /></label><button id="copyInvite">复制邀请链接</button><p class="room-note">本地预览链接仅供这台电脑体验；异地邀请需先部署公网。</p></section>
    <fieldset id="joinOptions" hidden><legend>这一轮，想怎样学习？</legend><label><input type="radio" name="goalMode" value="follow" checked />跟随房主目标</label><label id="ownOption"><input type="radio" name="goalMode" value="own" />使用自己的目标</label><input id="friendGoal" maxlength="300" placeholder="写下你想推进的事情" hidden /></fieldset>
    <section id="roomMembers" hidden><h3>一起自习的人</h3><p id="memberNames"></p></section>
    <button id="roomAction">创建邀请</button><button id="leaveRoom" hidden>离开房间</button><p id="roomStatus" role="status"></p>`;
  document.body.append(dialog);
  const $ = s => dialog.querySelector(s);
  const badge = document.createElement('details'); badge.id = 'togetherBadge'; badge.hidden = true;
  badge.innerHTML = '<summary aria-label="展开自习室成员"><span class="room-presence-dot"></span><span id="roomBadgeLabel">自习室</span></summary><section class="room-mini"><header><strong>一起自习</strong><span id="roomConnection">已加入</span></header><ul id="roomMiniMembers"></ul><button id="roomManage" type="button">邀请与房间设置</button></section>';
  document.body.append(badge);
  badge.querySelector('#roomManage').onclick = () => { badge.open = false; show(); };
  const show = () => { if (!dialog.open) dialog.showModal(); };
  function renderMembers() {
    badge.querySelector('#roomBadgeLabel').textContent = `自习室 · ${room.members.length + 1} 人`;
    badge.querySelector('#roomConnection').textContent = room.closed ? '已结束' : room.startedAt ? '专注中' : '等待开始';
    const list = badge.querySelector('#roomMiniMembers'); list.replaceChildren();
    for (const [index, member] of [room.host || { name: room.name }, ...room.members].entries()) {
      const li = document.createElement('li'), avatar = document.createElement('span'), name = document.createElement('strong'), role = document.createElement('small');
      avatar.className = 'room-member-avatar';
      const ownProfile = member.isSelf || (index === 0 && credentials.hostToken) ? window.inookAccount?.profile() : null;
      window.inookAccount?.paintAvatar(avatar, ownProfile?.avatar || member.avatar);
      name.textContent = member.name; role.textContent = index === 0 ? '房主' : member.goalMode === 'own' ? '个人目标' : '跟随目标';
      li.append(avatar, name, role); list.append(li);
    }
  }
  window.addEventListener('inook:account-profile', () => { if (room) renderMembers(); });
  document.addEventListener('click', event => { if (!badge.contains(event.target)) badge.open = false; });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') badge.open = false; });
  async function api(path = '', body) {
    let response;
    try {
      response = await fetch(`/api/rooms${path}`, { ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) });
    } catch { throw new Error('暂时连接不上书房，请检查网络后重试。'); }
    const data = await response.json();
    if (response.status === 404 && /\/(goal|goal-mode)$/.test(path)) throw new Error('目标同步服务需要更新，请重启网站服务后重试。');
    if (!response.ok) throw Object.assign(new Error(data.error === '接口不存在' ? '房间服务尚未启动，请重启本地服务后再试。' : data.error || '房间暂时无法连接'), { status: response.status });
    return data;
  }
  function resetRoom(message = '') {
    revision++; clearInterval(timer);
    if (id) sessionStorage.removeItem(`inookRoom:${id}`);
    id = null; room = null; credentials = {}; entered = false; checkingEntry = false; loginDeclined = false;
    mode = false; ownGoal = ''; enter.innerHTML = originalEnter;
    personalDraft = ''; lastSharedGoal = ''; goalEditor.close(); renderGoalMode();
    sharedTimer = undefined; sharedDone = false; lastTimerSignature = ''; composingGoal = false;
    lastTaskSignature = ''; receivedTaskSignature = ''; renderSessionTasks();
    const url = new URL(location.href); url.searchParams.delete('room'); history.replaceState(null, '', url);
    badge.hidden = true; badge.open = false;
    badge.querySelector('#roomMiniMembers').replaceChildren();
    $('#togetherTitle').textContent = message ? '这次邀请已结束' : '准备一个共同的书房';
    $('#roomOverview').textContent = ''; $('#inviteUrl').value = '';
    for (const selector of ['#inviteSection', '#joinOptions', '#roomMembers', '#leaveRoom']) $(selector).hidden = true;
    $('#roomAction').disabled = false; $('#roomAction').textContent = '重新创建自习室';
    $('#roomStatus').textContent = message;
  }
  function handleError(error) {
    if (id && [404, 410].includes(error.status)) {
      resetRoom('这间书房已失效。你可以创建新的自习室，或向朋友索取新邀请。');
    } else {
      $('#roomStatus').textContent = error.message;
      badge.querySelector('#roomConnection').textContent = '连接中断';
      if (id) { $('#roomAction').disabled = false; $('#roomAction').textContent = '重新连接'; }
    }
  }
  function configure() {
    dialog.close(); mode = true; enter.querySelector('span').textContent = '创建自习邀请'; setView('setup');
  }
  function remember() { sessionStorage.setItem(`inookRoom:${id}`, JSON.stringify(credentials)); }
  async function leave() {
    if (!id) return;
    const currentId = id, version = ++revision;
    clearInterval(timer);
    try {
      if (credentials.hostToken || credentials.memberToken) {
        await api(`/${currentId}/${credentials.hostToken ? 'close' : 'leave'}`, credentials);
      }
    } catch (error) {
      if (version !== revision) return;
      if (![404, 410].includes(error.status)) { beginPolling(); throw error; }
    }
    if (version !== revision) return;
    resetRoom(); dialog.close();
  }
  function applySettings(goal) {
    state.sceneIndex = Math.max(0, scenes.findIndex(s => s.id === room.scene));
    renderScenes(); updateBackdrop(); applySceneSound(); setDuration(room.minutes);
    setupGoalInput.value = goal; goalInput.value = goal; state.goal = goal;
  }
  async function poll() {
    if (!id || polling) return;
    const currentId = id, version = revision;
    polling = true;
    try {
      const tasks = entered && credentials.hostToken ? taskSnapshot() : [];
      const taskSignature = JSON.stringify(tasks);
      if (entered && credentials.hostToken && !composingGoal && Date.now() - goalEditedAt >= 500 && (state.goal !== lastSharedGoal || timerSignature() !== lastTimerSignature || taskSignature !== lastTaskSignature)) {
        const goal = state.goal;
        const signature = timerSignature();
        await api(`/${currentId}/goal`, { ...credentials, goal, goalTimer: timerSnapshot(), tasks });
        if (version !== revision) return;
        lastSharedGoal = goal;
        lastTimerSignature = signature;
        lastTaskSignature = taskSignature;
      }
      const result = await api(`/${currentId}`);
      if (version !== revision || currentId !== id) return;
      room = result;
      if (entered && following()) { receiveTimer(); receiveTasks(); }
      if (entered && credentials.memberToken && !following() && credentials.goal !== state.goal) {
        personalDraft = state.goal; credentials.goal = personalDraft; remember();
      }
      if (entered && following() && room.goal !== lastSharedGoal) {
        applySharedGoal(room.goal);
        goalControl.textContent = '房主更新了目标 · 改用自己的目标';
      }
      if (room.closed || (room.startedAt && room.serverNow >= room.startedAt + room.minutes * 60000)) {
        const wasEntered = entered;
        resetRoom('本轮自习已结束，可以重新创建自习室。');
        if (wasEntered) { endStudyAndReset(); dialog.close(); setView('home'); }
        return;
      }
      renderMembers();
      const host = Boolean(credentials.hostToken), joined = host || Boolean(credentials.memberToken);
      badge.hidden = !joined;
      $('#togetherTitle').textContent = host ? '邀请朋友，坐进同一间书房' : `${room.name} 邀请你一起自习`;
      $('#roomOverview').textContent = `${scenes.find(s => s.id === room.scene)?.name || '书房'} · ${room.minutes} 分钟 · ${room.goal}`;
      $('#roomMembers').hidden = false;
      $('#memberNames').textContent = `${room.name}（房主）${room.members.length ? '、' + room.members.map(m => m.name).join('、') : ' · 等待朋友加入'}`;
      $('#inviteSection').hidden = !host;
      $('#joinOptions').hidden = joined;
      $('#ownOption').hidden = !room.allowOwn;
      $('#roomAction').disabled = joined && (!host || Boolean(room.startedAt));
      $('#roomAction').textContent = room.startedAt ? joined ? '本轮自习进行中' : '加入正在进行的自习' : host ? '开始本轮自习' : joined ? '已准备，等待房主开始' : '确认加入，等待房主开始';
      if (loginDeclined) { $('#roomAction').disabled = false; $('#roomAction').textContent = '登录继续自习'; }
      $('#leaveRoom').hidden = false;
      $('#leaveRoom').textContent = host ? '结束房间' : '离开房间';
      if ($('#roomStatus').textContent !== '邀请链接已复制') $('#roomStatus').textContent = '';
      if (room.startedAt && joined && !entered && !checkingEntry && !loginDeclined) {
        checkingEntry = true; dialog.close();
        const authenticated = await window.inookAccount.requireLogin();
        if (version !== revision || currentId !== id) return;
        checkingEntry = false;
        if (!authenticated) { loginDeclined = true; show(); return; }
        personalDraft = credentials.goal || '';
        const goal = host || following() ? room.goal : personalDraft;
        applySettings(goal); enterFocus();
        state.remaining = Math.max(0, Math.ceil((room.startedAt + room.minutes * 60000 - room.serverNow) / 1000)); renderTimer();
        entered = true; lastSharedGoal = room.goal; receiveTimer(); renderGoalMode(); renderGoalClock(); renderSessionTasks(); dialog.close();
      }
    } catch (error) { if (version === revision) handleError(error); }
    finally { polling = false; }
  }
  function beginPolling() { clearInterval(timer); if (id) timer = setInterval(poll, 2000); }
  async function create() {
    show();
    $('#roomStatus').textContent = '正在准备书房…'; $('#roomAction').disabled = true;
    try {
      const result = await api('', { scene: selectedScene().id, minutes: Math.round(state.minutes), goal: setupGoalInput.value, allowOwn: true });
      id = result.id; credentials = { hostToken: result.hostToken }; remember(); mode = false; enter.innerHTML = originalEnter;
      const url = new URL(location.href); url.search = ''; url.searchParams.set('room', id); history.replaceState(null, '', url);
      $('#inviteUrl').value = url.href; await poll(); beginPolling();
    } catch (error) { $('#roomStatus').textContent = error.message; $('#roomAction').disabled = false; $('#roomAction').textContent = '重试创建'; }
  }
  $('#roomAction').onclick = async () => {
    if (busy) return;
    if (!id && !mode) { configure(); return; }
    if (id && (!room || $('#roomAction').textContent === '重新连接')) { await poll(); beginPolling(); return; }
    busy = true; $('#roomAction').disabled = true;
    try {
      dialog.close();
      if (!await window.inookAccount.requireLogin()) { show(); return; }
      loginDeclined = false;
      show();
      if (!id) {
        await create();
      } else if (credentials.hostToken) { await api(`/${id}/start`, credentials); await poll(); }
      else {
        ownGoal = room.allowOwn && $('input[name="goalMode"]:checked').value === 'own' ? $('#friendGoal').value.trim() : room.goal;
        const goalMode = room.allowOwn && $('input[name="goalMode"]:checked').value === 'own' ? 'own' : 'follow';
        if (goalMode === 'own' && !ownGoal) { $('#friendGoal').focus(); throw new Error('请写下自己的目标'); }
        const result = await api(`/${id}/join`, { goalMode });
        credentials = { memberToken: result.memberToken, goal: goalMode === 'own' ? ownGoal : '', goalMode }; remember(); await poll();
      }
    } catch (error) { handleError(error); }
    finally { busy = false; if (!room?.startedAt && !credentials.memberToken) $('#roomAction').disabled = false; }
  };
  $('#copyInvite').onclick = async () => {
    try { await navigator.clipboard.writeText($('#inviteUrl').value); $('#roomStatus').textContent = '邀请链接已复制'; }
    catch { $('#inviteUrl').focus(); $('#inviteUrl').select(); $('#roomStatus').textContent = '请复制选中的邀请链接'; }
  };
  $('#joinOptions').onchange = () => { $('#friendGoal').hidden = $('input[name="goalMode"]:checked').value !== 'own'; };
  $('#hideTogether').onclick = () => dialog.close();
  $('#leaveRoom').onclick = async () => {
    const button = $('#leaveRoom'); button.disabled = true;
    try { await leave(); endStudyAndReset(); setView('home'); }
    catch (error) { handleError(error); }
    finally { button.disabled = false; }
  };
  document.querySelector('#startTogether').onclick = () => {
    if (id) { show(); return; }
    configure();
  };
  window.together = { configuring: () => mode, create, leave,
    sharedTasks: () => following() && entered ? (room?.tasks || []).map(task => ({ ...task, done: Boolean(credentials.completedTasks?.[task.id]) })) : undefined,
    completeSharedTask: (taskId, done) => { if (!following() || !room?.tasks?.some(task => task.id === taskId)) return; credentials.completedTasks ||= {}; credentials.completedTasks[taskId] = Boolean(done); remember(); renderSessionTasks(); },
    sharedTiming: () => following() && entered ? { remaining: sharedTimer ? sharedTimer.deadline === null ? sharedTimer.remaining : Math.max(0, sharedTimer.deadline - Date.now()) : null, done: sharedDone } : undefined,
    completeSharedGoal: () => { if (!following() || !entered) return false; sharedDone = true; return true; },
    canEditGoal: () => { if (following() && entered) { editGoalMode(); return false; } return true; }, solo: () => { mode = false; enter.innerHTML = originalEnter; } };
  if (id) {
    try { credentials = JSON.parse(sessionStorage.getItem(`inookRoom:${id}`) || '{}'); } catch { credentials = {}; }
    $('#inviteUrl').value = location.href; $('#roomAction').disabled = true; $('#roomAction').textContent = '正在连接…'; show(); poll(); beginPolling();
  }
})();
