(() => {
  const store = createCalendarStore(localStorage);
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  let days = store.read();
  let month = new Date(); month.setDate(1);
  let selected = dateKey(new Date());
  const dialog = document.createElement('dialog');
  dialog.id = 'focusCalendar'; dialog.setAttribute('aria-labelledby', 'calendarTitle');
  dialog.innerHTML = `<header><div><small>栖页 · 日积月累</small><h2 id="calendarTitle">专注日历</h2></div><button id="closeCalendar" aria-label="关闭日历" title="关闭">×</button></header>
    <div class="calendar-stats"><div><strong id="streakDays">0</strong><span>连续天数</span></div><div><strong id="totalDays">0</strong><span>累计打卡</span></div><div><strong id="monthDays">0</strong><span>本月打卡</span></div></div>
    <div class="calendar-month"><button id="previousYear" aria-label="上一年">«</button><button id="previousMonth" aria-label="上个月" title="上个月">‹</button><div id="monthTitle"><select id="focusYear" aria-label="选择年份"></select><select id="focusMonth" aria-label="选择月份"></select></div><button id="nextMonth" aria-label="下个月" title="下个月">›</button><button id="nextYear" aria-label="下一年">»</button></div><div class="calendar-caption"><span id="calendarSelection"></span><button id="calendarToday">回到今天</button></div>
    <div class="calendar-week" aria-hidden="true"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>
    <div id="calendarGrid" aria-label="选择日期"></div>
    <section class="calendar-day"><h3 id="selectedDate"></h3><p id="daySummary"></p><ul id="daySessions"></ul></section>
    <button id="checkInToday">为今天打卡</button><button id="undoCheckIn" hidden>撤销今日打卡</button><p id="calendarMessage" role="status"></p>`;
  document.body.append(dialog);
  const cheer = document.createElement('dialog'); cheer.id = 'checkInCheer'; cheer.setAttribute('aria-labelledby','cheerTitle');
  cheer.innerHTML = '<div class="cheer-motion" aria-hidden="true"><img src="./assets/study-companion.png" alt="" /><span>👏</span></div><h2 id="cheerTitle">今天又向前了一点点</h2><div class="cheer-actions"><button id="cheerStudy">开始今日学习</button><button id="cheerStay">留在日历</button></div>';
  document.body.append(cheer);
  cheer.querySelector('#cheerStay').onclick = () => cheer.close();
  cheer.querySelector('#cheerStudy').onclick = () => {
    cheer.close(); dialog.close();
    if (document.querySelector('.app').dataset.view === 'home') document.querySelector('#startSetupButton').click();
  };
  const $ = selector => dialog.querySelector(selector);
  const marked = day => Boolean(days[day]?.manual || days[day]?.sessions?.length);
  function save(day, change) {
    try { days = store.update(day, change); window.qiyePersonal?.sync(); return true; }
    catch { $('#calendarMessage').textContent = '这次没能记下，请稍后重试。'; return false; }
  }
  function streak() {
    const cursor = new Date(); cursor.setHours(12, 0, 0, 0);
    if (!marked(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    let count = 0;
    while (marked(dateKey(cursor))) { count++; cursor.setDate(cursor.getDate() - 1); }
    return count;
  }
  function render() {
    days = store.read();
    const today = dateKey(new Date());
    const currentMonth = today.slice(0, 7);
    $('#streakDays').textContent = streak();
    $('#totalDays').textContent = Object.keys(days).filter(marked).length;
    $('#monthDays').textContent = Object.keys(days).filter(day => day.startsWith(currentMonth) && marked(day)).length;
    const year = month.getFullYear();
    $('#focusYear').replaceChildren(...Array.from({ length: 41 }, (_, i) => new Option(`${year - 20 + i}年`, year - 20 + i, false, i === 20)));
    $('#focusMonth').replaceChildren(...Array.from({ length: 12 }, (_, i) => new Option(`${i + 1}月`, i, false, i === month.getMonth())));
    $('#calendarSelection').textContent = selected === today ? `${selected} · 今天` : selected;
    $('#calendarToday').hidden = selected === today;
    const grid = $('#calendarGrid'); grid.replaceChildren();
    const offset = (month.getDay() + 6) % 7;
    for (let i = 0; i < offset; i++) { const blank = document.createElement('span'); blank.setAttribute('aria-hidden', 'true'); grid.append(blank); }
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= count; i++) {
      const day = dateKey(new Date(month.getFullYear(), month.getMonth(), i));
      const button = document.createElement('button'); button.type = 'button'; button.textContent = i;
      button.className = `${marked(day) ? 'checked ' : ''}${day === today ? 'today ' : ''}${day === selected ? 'selected' : ''}`;
      button.setAttribute('aria-label', `${day}${marked(day) ? '，已打卡' : ''}${day === today ? '，今天' : ''}`);
      button.setAttribute('aria-pressed', String(day === selected));
      button.disabled = day > today;
      button.onclick = () => { if (day > dateKey(new Date())) return; selected = day; $('#calendarMessage').textContent = ''; render(); }; grid.append(button);
    }
    const entry = days[selected];
    const sessions = entry?.sessions || [];
    $('#selectedDate').textContent = selected === today ? '今天的努力' : selected;
    const minutes = sessions.reduce((sum, item) => sum + (Number(item.minutes) || 0), 0);
    $('#daySummary').textContent = sessions.length ? `${sessions.length} 次专注 · 累积 ${minutes} 分钟` : entry?.manual ? '这一天，你为自己留了时间。' : selected === today ? '从今天的一小步开始。' : '这一天还没有留下足迹。';
    const list = $('#daySessions'); list.replaceChildren();
    for (const item of sessions) { const li = document.createElement('li'); li.textContent = `${item.goal} · ${item.minutes} 分钟`; list.append(li); }
    $('#checkInToday').hidden = selected !== today;
    $('#checkInToday').disabled = selected !== today || marked(today);
    $('#checkInToday').textContent = marked(today) ? '今日已打卡' : '为今天打卡';
    $('#undoCheckIn').hidden = selected !== today || !days[today]?.manual || Boolean(days[today]?.sessions.length);
  }
  $('#checkInToday').onclick = () => {
    const today = dateKey(new Date()); if (selected !== today || marked(today)) return;
    if (!save(today, entry => ({ ...entry, manual: true }))) return;
    selected = today; month = new Date(); month.setDate(1);
    $('#calendarMessage').textContent = ''; render(); cheer.showModal();
  };
  function changeMonth(year, index) {
    month = new Date(year, index, 1);
    selected = dateKey(new Date(year, index, Math.min(Number(selected.slice(8)), new Date(year, index + 1, 0).getDate())));
    render();
  }
  $('#previousMonth').onclick = () => changeMonth(month.getFullYear(), month.getMonth() - 1);
  $('#previousYear').onclick = () => changeMonth(month.getFullYear() - 1, month.getMonth());
  $('#nextYear').onclick = () => changeMonth(month.getFullYear() + 1, month.getMonth());
  $('#focusYear').onchange = () => changeMonth(Number($('#focusYear').value), month.getMonth());
  $('#focusMonth').onchange = () => changeMonth(month.getFullYear(), Number($('#focusMonth').value));
  $('#undoCheckIn').onclick = () => {
    const today = dateKey(new Date()); const previous = days[today];
    if (selected !== today || !previous?.manual || previous.sessions.length) return;
    if (!save(today, entry => ({ ...entry, manual: entry.sessions.length ? entry.manual : false }))) return;
    $('#calendarMessage').textContent = '已撤销今日手动打卡。'; render();
  };
  $('#nextMonth').onclick = () => changeMonth(month.getFullYear(), month.getMonth() + 1);
  $('#calendarToday').onclick = () => { month = new Date(); month.setDate(1); selected = dateKey(new Date()); render(); };
  $('#closeCalendar').onclick = () => dialog.close();
  dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
  document.querySelector('#openCalendar').onclick = () => { $('#calendarMessage').textContent = ''; render(); dialog.showModal(); };
  window.addEventListener('inook:session-complete', event => {
    const today = dateKey(new Date());
    save(today, entry => ({ ...entry, sessions: [...entry.sessions, { ...event.detail, completedAt: new Date().toISOString() }] })); if (dialog.open) render();
  });
  window.addEventListener('storage', () => { days = store.read(); if (dialog.open) render(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && dialog.open) render(); });
})();
