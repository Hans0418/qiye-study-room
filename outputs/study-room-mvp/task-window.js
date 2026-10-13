(() => {
  let panel = null;
  let interval = null;
  let signature = '';
  let opening = false;
  const styles = `
    *{box-sizing:border-box}body{margin:0;padding:18px;background:#202824;color:#f0f1e9;font:14px/1.5 system-ui,sans-serif}
    header{display:flex;justify-content:space-between;align-items:center;color:#b9c6bd;font-size:12px}
    button,input{font:inherit}button{cursor:pointer;border:1px solid #526259;border-radius:6px;padding:7px 12px;color:inherit;background:transparent}
    button:hover{background:#36473c}button:disabled{opacity:.45;cursor:default}button:focus-visible,input:focus-visible,summary:focus-visible{outline:2px solid #b5dbcc;outline-offset:2px}
    h1{font-size:17px;line-height:1.5;margin:14px 0 8px;overflow-wrap:anywhere;font-weight:550}
    #clock{font-size:30px;font-variant-numeric:tabular-nums;color:#b5dbcc}#status{font-size:12px;color:#bdc8c0;min-height:18px}
    .actions{display:flex;gap:8px;margin:12px 0}.primary{background:#b5dbcc;color:#203b32;border-color:transparent}
    #extend{display:flex;align-items:center;gap:7px;margin:10px 0}input{width:55px;padding:6px;color:inherit;background:#ffffff08;border:1px solid #526259;border-radius:4px}
    details{border-top:1px solid #46534a;padding-top:10px}summary{cursor:pointer;color:#c8d5cc}#tasks{max-height:220px;overflow:auto}
    .task{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #ffffff12}.task span{flex:1;overflow-wrap:anywhere}.task.done span{text-decoration:line-through;opacity:.5}.task button{flex-shrink:0;font-size:12px;padding:5px 8px}
    [hidden]{display:none!important}#notice{color:#c0c9c2;font-size:12px;margin:8px 0}header button{padding:3px 8px}
  `;
  function refresh() {
    if (!panel || panel.closed) { clearInterval(interval); panel = null; return; }
    const doc = panel.document;
    const remaining = goalClock.tick();
    const active = Boolean(timedGoalText) && !goalClock.done;
    doc.querySelector('#task').textContent = timedGoalText || state.goal || '选择一件想做的事';
    doc.querySelector('#clock').textContent = goalClock.done ? '已完成' : remaining === null ? '未计时' : formatTime(Math.ceil(remaining / 1000));
    doc.querySelector('#status').textContent = goalClock.done ? '这一小步完成了。准备好后再开始下一项。' : remaining === 0 ? '预计时间到了，这项任务完成了吗？' : active ? (state.running ? '正在专注' : '已暂停') : '展开待办，选择一项开始';
    doc.querySelector('#complete').disabled = !active;
    doc.querySelector('#pause').textContent = state.running ? '暂停' : '继续';
    doc.querySelector('#extend').hidden = !active || remaining !== 0;
    const nextSignature = JSON.stringify([sessionTasks, timedGoalText, goalClock.done]);
    if (nextSignature === signature) return;
    signature = nextSignature;
    const list = doc.querySelector('#tasks'); list.replaceChildren();
    doc.querySelector('summary').textContent = `待办 ${sessionTasks.filter(t => t.done).length}/${sessionTasks.length}`;
    if (!sessionTasks.length) { list.textContent = '还没有待办，可返回书房添加。'; return; }
    sessionTasks.forEach(task => {
      const row = doc.createElement('div'); row.className = `task${task.done ? ' done' : ''}`;
      const text = doc.createElement('span'); text.textContent = `${task.text} · ${task.minutes} 分钟`;
      const button = doc.createElement('button');
      button.textContent = task.done ? '已完成' : active && task.text === timedGoalText ? '进行中' : '开始';
      button.disabled = task.done || (active && task.text === timedGoalText);
      button.addEventListener('click', () => { useTaskAsGoal(task); refresh(); });
      row.append(text, button); list.append(row);
    });
  }
  async function open() {
    if (panel && !panel.closed) { panel.focus(); return true; }
    if (opening) return false;
    opening = true;
    let native = false;
    try {
      if ('documentPictureInPicture' in window) {
        panel = await window.documentPictureInPicture.requestWindow({ width: 360, height: 340 }); native = true;
      } else {
        panel = window.open('', 'inook-task-window', 'popup,width=360,height=380');
      }
      if (!panel) throw new Error('popup-blocked');
      const doc = panel.document;
      doc.title = '栖页 · 当前任务'; doc.documentElement.lang = 'zh-CN';
      const style = doc.createElement('style'); style.textContent = styles; doc.head.append(style);
      doc.body.innerHTML = `<header><span>栖页 · 当前任务</span><button id="close" aria-label="关闭任务小窗" title="关闭">×</button></header>
        <p id="notice" ${native ? 'hidden' : ''}>当前为普通窗口，不能保持置顶。可用支持画中画的浏览器打开。</p>
        <h1 id="task"></h1><div id="clock"></div><div id="status" role="status"></div>
        <div class="actions"><button id="complete" class="primary">完成</button><button id="pause">暂停</button><button id="back">回到书房</button></div>
        <form id="extend" hidden><input type="number" min="1" max="180" step="1" required value="5" aria-label="加时分钟数" /><span>分钟</span><button type="submit">加时</button></form>
        <details><summary>待办</summary><div id="tasks"></div></details>`;
      doc.querySelector('#close').onclick = () => panel.close();
      doc.querySelector('#back').onclick = () => { window.focus(); panel.close(); };
      doc.querySelector('#pause').onclick = () => { state.running ? pauseTimer() : startTimer(); refresh(); };
      doc.querySelector('#complete').onclick = () => { completeTimedGoal(); refresh(); };
      doc.querySelector('#extend').onsubmit = event => {
        event.preventDefault();
        const input = doc.querySelector('#extend input');
        if (!input.reportValidity()) return;
        goalClock.start(Number(input.value), state.running); renderGoalClock(); refresh();
      };
      doc.querySelector('details').ontoggle = event => {
        if (native && !panel.closed) panel.resizeTo(360, event.target.open ? 540 : 340);
      };
      panel.addEventListener('pagehide', () => { clearInterval(interval); panel = null; signature = ''; }, { once: true });
      signature = ''; refresh(); interval = window.setInterval(refresh, 500);
      return true;
    } catch {
      const button = document.querySelector('.task-popout');
      if (button) button.textContent = '小窗未打开，请允许弹出窗口后重试';
      return false;
    } finally { opening = false; }
  }
  window.addEventListener('pagehide', () => { if (panel && !panel.closed) panel.close(); });
  window.taskWindow = { open, close() { if (panel && !panel.closed) panel.close(); clearInterval(interval); panel = null; signature = ''; } };
})();
