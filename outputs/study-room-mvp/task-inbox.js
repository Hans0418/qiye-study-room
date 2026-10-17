(() => {
  const dialog = document.querySelector('#taskInbox'), $ = s => dialog.querySelector(s);
  const status = $('#inboxStatus'), dayKey = QiyeTasks.dateKey;
  const taskEditors = new Map();
  let date = dayKey(), month = date.slice(0, 7), drafts = [], chosen = new Set(), undoId, undoDeadline = 0, undoTimer, importController, importTimer, composing = false;
  const message = e => { status.textContent = e.message || '暂时无法保存，请保留原文后重试。'; };
  const node = (tag, text = '', cls = '') => { const e = document.createElement(tag); e.textContent = text; e.className = cls; return e; };
  function button(text, action, label = text) { const e = node('button', text); e.type = 'button'; e.title = label; e.setAttribute('aria-label', label); e.onclick = action; return e; }
  function field(tag, label, value) { const e = node(tag); e.setAttribute('aria-label', label); e.value = value ?? ''; return e; }
  function dated() { return taskInboxStore.read().filter(t => (t.date || dayKey()) === date && !t.done); }
  function update(task, change) {
    taskInboxStore.update(task.id, change); Object.assign(task, change);
    const active = sessionTasks.find(t => t.id === task.id); if (active) Object.assign(active, change);
    renderSessionTasks(); if (!persistSessionTasks()) throw new Error('未能保存，请检查浏览器存储。');
    status.textContent = '';
  }
  function editor(task, save) {
    const details = node('details', '', 'agenda-editor'); details.append(node('summary', '详情与编辑'));
    const title = field('input', '事项名称', task.text); title.type = 'text'; title.maxLength = 300; title.placeholder = '例如：完成危机传播作业';
    const notes = field('textarea', '任务详情', task.notes); notes.rows = 4; notes.maxLength = 20000; notes.placeholder = '例如：查找案例、整理大纲、完成第一部分';
    const minutes = field('input', '预计分钟数', task.minutes); minutes.type = 'number'; minutes.min = '1'; minutes.max = '180'; minutes.placeholder = '可选';
    const scheduled = field('input', '事项日期', task.date || $('#importTaskDate').value || date); scheduled.type = 'date';
    const fields = node('div', '', 'agenda-toolbar'), timeLabel = node('label', '预计分钟 '), dateLabel = node('label', '日期 ');
    timeLabel.append(minutes); dateLabel.append(scheduled); fields.append(timeLabel, dateLabel);
    const titleLabel = node('label', '事项名称', 'agenda-field-label'); titleLabel.append(title);
    const notesLabel = node('label', '任务详情', 'agenda-field-label'); notesLabel.append(notes);
    const readChange = () => {
      if (!title.value.trim() || !minutes.reportValidity() || !QiyeTasks.validDate(scheduled.value)) {
        details.open = true;
        throw new Error('请检查事项名称、日期与时长');
      }
      return { text: title.value.trim(), notes: notes.value, minutes: minutes.value ? Number(minutes.value) : null, date: scheduled.value };
    };
    if (task.id) taskEditors.set(task.id, readChange);
    details.append(titleLabel, notesLabel, fields, button('保存修改', () => {
      try { save(readChange()); details.open = false; } catch (e) { message(e); }
    }));
    if (task.original) { const original = node('details'); original.append(node('summary', '查看原始计划'), node('pre', task.original)); details.append(original); }
    return details;
  }
  function calendar() {
    const tasks = taskInboxStore.read(), grid = $('#taskCalendar'); grid.replaceChildren();
    const [y, m] = month.split('-').map(Number);
    const years = $('#taskYearPicker'); years.replaceChildren();
    for (let year = Math.min(new Date().getFullYear() - 20, y); year <= Math.max(new Date().getFullYear() + 20, y); year++) { const option = node('option', `${year}年`); option.value = year; years.append(option); }
    years.value = y;
    const months = $('#taskMonthPicker'); months.replaceChildren();
    for (let n = 1; n <= 12; n++) { const option = node('option', `${n}月`); option.value = n; months.append(option); } months.value = m;
    $('#selectedTaskDate').textContent = `${date.replace('-', '年').replace('-', '月')}日${date === dayKey() ? ' · 今天' : ''}`;
    $('#taskToday').hidden = date === dayKey();
    for (const d of ['一','二','三','四','五','六','日']) grid.append(node('span', d, 'weekday'));
    for (let i = 0; i < (new Date(y, m - 1, 1).getDay() + 6) % 7; i++) grid.append(node('span'));
    for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) {
      const key = `${month}-${String(d).padStart(2, '0')}`, count = tasks.filter(t => (t.date || dayKey()) === key && !t.done).length;
      const cell = button(String(d), () => { date = key; chosen.clear(); render(); }, `${key}${count ? `，${count}项未完成` : ''}`);
      cell.setAttribute('aria-pressed', String(key === date)); if (key === dayKey()) cell.setAttribute('aria-current', 'date');
      if (count) cell.classList.add('has-tasks'); grid.append(cell);
    }
  }
  function selection() {
    const tasks = dated().filter(t => !t.done), ids = new Set(tasks.map(t => t.id)); chosen = new Set([...chosen].filter(id => ids.has(id)));
    $('#selectAllTasks').disabled = !tasks.length; $('#selectAllTasks').textContent = tasks.length && chosen.size === tasks.length ? '取消全选' : '全选';
    $('#chooseInboxTasks').disabled = !chosen.size; $('#chooseInboxTasks').textContent = chosen.size ? `立即开始（${chosen.size}）` : '立即开始';
    $('#chooseInboxTasks').hidden = date !== dayKey();
    $('#selectAllTasks').hidden = date !== dayKey();
  }
  function render() {
    try {
      calendar(); taskEditors.clear(); $('#inboxList').replaceChildren(); $('#taskDayTitle').textContent = date === dayKey() ? '今日事项' : `${date.slice(5).replace('-', '月')}日事项`;
      const tasks = dated();
      for (const task of tasks) {
        const row = node('article', '', 'agenda-item'), select = field('input', `选择：${task.text}`, ''); select.type = 'checkbox'; select.checked = chosen.has(task.id); select.hidden = date !== dayKey();
        select.onchange = () => { if (select.checked) chosen.add(task.id); else chosen.delete(task.id); selection(); };
        const body = node('div', '', 'agenda-item-body'); body.append(node('div', task.text, 'agenda-title'));
        if (task.minutes) body.append(node('small', `${task.minutes} 分钟`));
        body.append(editor(task, change => { update(task, change); render(); }));
        const done = button('完成', async () => {
          done.disabled = true;
          try {
            const completedAt = Date.now(); update(task, { done: true, completedAt }); chosen.delete(task.id);
            clearInterval(undoTimer); undoId = task.id; undoDeadline = completedAt + 3000;
            tickUndo(); undoTimer = setInterval(tickUndo, 100);
            if (!matchMedia('(prefers-reduced-motion: reduce)').matches) await row.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-4px)' }], { duration: 240, fill: 'forwards' }).finished;
            render(); checkReminder();
          } catch (e) { done.disabled = false; message(e); }
        }, `完成：${task.text}`);
        row.append(select, body, done); $('#inboxList').append(row);
      }
      if (!tasks.length) $('#inboxList').append(node('p', '暂无事项', 'inbox-empty'));
      archive(); selection();
    } catch (e) { message(e); }
  }
  function mode(importing) { $('#inboxBrowse').hidden = importing; $('#inboxImport').hidden = !importing; $('#browseInbox').setAttribute('aria-selected', String(!importing)); $('#pasteInbox').setAttribute('aria-selected', String(importing)); }
  function open(importing = false) { date = dayKey(); month = date.slice(0, 7); chosen.clear(); $('#importTaskDate').value = date; status.textContent = ''; render(); mode(importing); dialog.showModal(); }
  async function start(tasks) {
    if (!tasks.length || tasks.some(t => t.date !== dayKey())) return false;
    if (state.view !== 'focus' && !await window.inookAccount.requireLogin()) return false;
    for (const task of tasks) {
      const existing = sessionTasks.find(t => t.id === task.id);
      if (existing) Object.assign(existing, task);
      else sessionTasks.push({ ...task });
    }
    if (!persistSessionTasks()) return false;
    renderSessionTasks(); dialog.close();
    if (state.view !== 'focus') {
      window.together?.solo(); previousStudyTasks = null;
      setupGoalInput.value = tasks.map(task => task.text).join('\n').slice(0, 300);
      syncGoal('setup'); setView('setup');
    }
    reminder.hidden = true;
    document.querySelector('#sessionTodos').open = true; return true;
  }
  function draftSelection() { $('#selectAllDrafts').textContent = drafts.every(t => t.keep) ? '取消全选' : '全选'; $('#startTaskImport').disabled = $('#saveTaskImport').disabled = !drafts.some(t => t.keep); $('#startTaskImport').hidden = !drafts.length || drafts.filter(t => t.keep).some(t => (t.date || $('#importTaskDate').value) !== dayKey()); }
  function renderDrafts() {
    $('#importPreview').replaceChildren();
    for (const task of drafts) {
      const row = node('article', '', 'agenda-item'), keep = field('input', `保留：${task.text}`, ''); keep.type = 'checkbox'; keep.checked = task.keep; keep.onchange = () => { task.keep = keep.checked; draftSelection(); };
      const body = node('div', '', 'agenda-item-body'); body.append(node('div', task.text, 'agenda-title'), editor(task, change => { Object.assign(task, change); renderDrafts(); })); row.append(keep, body); $('#importPreview').append(row);
    }
    for (const id of ['#saveTaskImport', '#startTaskImport', '#selectAllDrafts']) $(id).hidden = !drafts.length;
    draftSelection();
  }
  async function applyDrafts(begin) {
    if (!QiyeTasks.validDate($('#importTaskDate').value)) { status.textContent = '请选择有效日期'; return; }
    try {
      const selected = drafts.filter(t => t.keep).map(({ keep, ...t }) => ({ ...t, date: t.date || $('#importTaskDate').value })); if (!selected.length) return;
      if (begin && selected.some(t => t.date !== dayKey())) return;
      taskInboxStore.add(selected);
      const saved = taskInboxStore.read().filter(t => !t.done && selected.some(s => s.text === t.text && s.date === t.date));
      date = $('#importTaskDate').value; month = date.slice(0, 7); drafts = []; $('#taskPaste').value = ''; renderDrafts(); mode(false); render(); checkReminder();
      status.textContent = '已安排到所选日期'; if (begin) await start(saved);
    } catch (e) { message(e); }
  }
  document.querySelector('#openTaskInbox').onclick = () => open(); document.querySelector('#selectedTaskNotice').onclick = () => open(); document.querySelector('#pasteExistingPlan').onclick = () => open(true);
  $('#closeTaskInbox').onclick = () => dialog.close(); $('#browseInbox').onclick = () => { mode(false); render(); }; $('#pasteInbox').onclick = () => { $('#importTaskDate').value = date; mode(true); };
  $('#selectAllTasks').onclick = () => {
    const tasks = dated().filter(t => !t.done);
    chosen = chosen.size === tasks.length ? new Set() : new Set(tasks.map(t => t.id));
    for (const checkbox of $('#inboxList').querySelectorAll('input[type="checkbox"]')) checkbox.checked = chosen.size > 0;
    selection();
  };
  $('#selectAllDrafts').onclick = () => { const keep = !drafts.every(t => t.keep); drafts.forEach(t => { t.keep = keep; }); renderDrafts(); };
  async function startSelectedTasks() {
    const tasks = dated().filter(t => chosen.has(t.id));
    const changes = tasks.map(task => taskEditors.get(task.id)?.() || task);
    if (changes.some(change => change.date !== dayKey())) throw new Error('立即开始仅支持今天的事项，请调整日期或先保存修改。');
    tasks.forEach((task, index) => update(task, changes[index]));
    return start(tasks);
  }
  $('#chooseInboxTasks').onclick = () => startSelectedTasks().catch(message);
  async function organizeInput() {
    if (importController || composing) return;
    const source = $('#taskPaste').value.trim(); if (!source) { status.textContent = '请先输入想做的事情'; return; }
    const controller = new AbortController(); importController?.abort(); importController = controller;
    drafts = []; renderDrafts();
    $('#parseTaskPaste').disabled = true; $('#parseTaskPaste').textContent = 'AI 智能识别中…'; status.textContent = 'AI 智能识别中…'; status.setAttribute('aria-busy', 'true');
    const timeout = setTimeout(() => controller.abort(), 125000);
    try {
      const response = await fetch('/api/assist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ mode: 'organize', prompt: source, minutes: 25, provider: 'auto' }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'AI 整理失败，请重试');
      if (!Array.isArray(result.tasks)) throw new Error('AI 返回的事项格式不正确，请重试');
      if (importController !== controller) return;
      drafts = result.tasks.map(t => ({ ...t, original: source, keep: true })); renderDrafts(); status.textContent = drafts.length ? `已整理 ${drafts.length} 件事项` : '没有识别到明确事项，请补充想做的事情';
    } catch (e) { if (importController === controller) { message(e.name === 'AbortError' ? new Error('整理超时，请重试') : e); $('#parseTaskPaste').hidden = false; } }
    finally { clearTimeout(timeout); if (importController === controller) { importController = null; resetImportButton(); } }
  }
  function resetImportButton() {
    $('#parseTaskPaste').disabled = !$('#taskPaste').value.trim() || composing;
    $('#parseTaskPaste').textContent = 'AI 智能识别';
    status.setAttribute('aria-busy', 'false');
  }
  function cancelImport() {
    clearTimeout(importTimer);
    const controller = importController; importController = null; controller?.abort();
    resetImportButton();
  }
  function scheduleImport() {
    cancelImport(); drafts = []; renderDrafts(); status.textContent = '';
  }
  $('#parseTaskPaste').onclick = organizeInput;
  $('#importTaskDate').onchange = draftSelection;
  $('#taskPaste').oninput = scheduleImport;
  $('#taskPaste').oncompositionstart = () => { composing = true; cancelImport(); };
  $('#taskPaste').oncompositionend = () => { composing = false; scheduleImport(); };
  $('#saveTaskImport').onclick = () => applyDrafts(false); $('#startTaskImport').onclick = () => applyDrafts(true);
  $('#addDatedTask').onsubmit = event => { event.preventDefault(); const input = $('#addDatedTask input'); try { taskInboxStore.add([{ text: input.value, date, minutes: null }]); input.value = ''; render(); checkReminder(); } catch (e) { message(e); } };
  $('#undoInboxTask').onclick = () => { if (!undoId || Date.now() >= undoDeadline) { tickUndo(); return; } try { const task = taskInboxStore.read().find(t => t.id === undoId); if (task) update(task, { done: false, completedAt: null }); undoId = null; clearInterval(undoTimer); $('#undoInboxTask').hidden = true; render(); checkReminder(); } catch (e) { message(e); } };
  function tickUndo() {
    const left = Math.ceil((undoDeadline - Date.now()) / 1000);
    $('#undoInboxTask').hidden = !undoId || left <= 0;
    $('#undoInboxTask').textContent = `撤销完成 · ${Math.max(0, left)}秒`;
    if (left <= 0) { undoId = null; clearInterval(undoTimer); }
  }
  function archive() {
    const records = taskInboxStore.read().filter(t => t.done).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
    $('#completedArchiveTitle').textContent = `已完成记录 · ${records.length}`; $('#completedArchiveList').replaceChildren();
    if (!records.length) $('#completedArchiveList').append(node('p', '暂无完成记录'));
    for (const task of records) {
      const item = node('article', '', 'archive-item');
      item.append(node('strong', task.text), node('small', task.completedAt ? `${new Date(task.completedAt).toLocaleString('zh-CN')} 完成` : `计划日期 ${task.date}`));
      if (task.notes) { const details = node('details'); details.append(node('summary', '查看详情'), node('p', task.notes)); item.append(details); }
      $('#completedArchiveList').append(item);
    }
  }
  function jumpMonth(y, m) {
    const d = Math.min(Number(date.slice(8)), new Date(y, m, 0).getDate());
    date = dayKey(new Date(y, m - 1, d)); month = date.slice(0, 7); chosen.clear(); render();
  }
  function moveMonth(delta) { const [y, m] = month.split('-').map(Number), next = new Date(y, m - 1 + delta, 1); jumpMonth(next.getFullYear(), next.getMonth() + 1); }
  $('#taskYearPicker').onchange = () => jumpMonth(Number($('#taskYearPicker').value), Number($('#taskMonthPicker').value));
  $('#taskMonthPicker').onchange = () => jumpMonth(Number($('#taskYearPicker').value), Number($('#taskMonthPicker').value));
  $('#prevTaskYear').onclick = () => moveMonth(-12); $('#nextTaskYear').onclick = () => moveMonth(12);
  $('#prevTaskMonth').onclick = () => moveMonth(-1); $('#nextTaskMonth').onclick = () => moveMonth(1); $('#taskToday').onclick = () => { date = dayKey(); month = date.slice(0, 7); chosen.clear(); render(); };
  dialog.addEventListener('close', cancelImport);
  // In-page reminders only; no background push subscription or permission request.
  const reminder = node('aside', '', 'agenda-reminder'), reminderText = node('span'); let dismissed = '';
  reminder.setAttribute('aria-label', '今日事项提醒');
  const reminderStart = button('立即开始', () => start(taskInboxStore.read().filter(t => !t.done && t.date === dayKey())).then(ok => { if (ok) dismissReminder(); }).catch(message));
  const reminderClose = button('', dismissReminder, '关闭今日提醒'); reminderClose.className = 'reminder-close';
  reminderClose.append(node('span', '', 'reminder-close-icon'));
  reminder.append(reminderText, reminderStart, reminderClose);
  reminder.hidden = true; document.body.append(reminder);
  const dailyDialog = node('dialog', '', 'today-tasks-dialog');
  dailyDialog.setAttribute('aria-labelledby', 'todayTasksTitle');
  const dailyTitle = node('h2', '今天的待办'); dailyTitle.id = 'todayTasksTitle';
  const dailySummary = node('p'), dailyPreview = node('ul'), dailyActions = node('div', '', 'today-tasks-actions');
  dailyActions.append(button('暂时不用', () => dailyDialog.close()), button('查看今日待办', () => { dailyDialog.close(); open(); }));
  dailyDialog.append(dailyTitle, dailySummary, dailyPreview, dailyActions); document.body.append(dailyDialog);
  let reminderAccount = 'guest';
  const seenThisPage = new Map();
  window.addEventListener('inook:account-profile', event => { reminderAccount = event.detail?.id || 'guest'; dismissed = ''; checkReminder(); });
  function dismissReminder() {
    dismissed = dayKey(); reminder.hidden = true;
    try { localStorage.setItem(`qiye:today-reminder-dismissed:${reminderAccount}`, dismissed); } catch { /* Retain the in-page dismissal. */ }
  }
  dailyDialog.addEventListener('click', dismissReminder);
  dailyDialog.addEventListener('cancel', dismissReminder);
  window.addEventListener('inook:fresh-start', dismissReminder);
  function showTodayTasks() {
    const key = `qiye:today-tasks-seen:${reminderAccount}`, today = dayKey();
    if (seenThisPage.get(key) === today) return;
    try { if (localStorage.getItem(key) === today) return; } catch { /* In-memory guard still prevents repeat prompts. */ }
    const tasks = taskInboxStore.read().filter(task => !task.done && task.date === today);
    if (!tasks.length || dailyDialog.open) return;
    dailySummary.textContent = `今天有 ${tasks.length} 件待办，看看想先做哪一件？`;
    dailyPreview.replaceChildren(...tasks.slice(0, 3).map(task => node('li', task.text)));
    dailyDialog.showModal();
    seenThisPage.set(key, today);
    try { localStorage.setItem(key, today); } catch { /* Keep the reminder usable when storage is unavailable. */ }
  }
  window.addEventListener('inook:view-change', event => {
    checkReminder();
    if (event.detail.view === 'focus') showTodayTasks();
    else if (dailyDialog.open) dailyDialog.close();
  });
  function checkReminder() { try { const tasks = taskInboxStore.read().filter(t => !t.done && t.date === dayKey()); const storedDismissal = localStorage.getItem(`qiye:today-reminder-dismissed:${reminderAccount}`); reminder.hidden = !tasks.length || dismissed === dayKey() || storedDismissal === dayKey() || state.view !== 'home'; reminderText.textContent = tasks.length ? `今天想做：${tasks[0].text}${tasks.length > 1 ? `，还有 ${tasks.length - 1} 件事` : ''}` : ''; } catch { reminder.hidden = true; } }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminder(); }); setInterval(checkReminder, 60000); checkReminder();
})();
