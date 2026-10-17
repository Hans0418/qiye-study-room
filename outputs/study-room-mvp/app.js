const scenes = [
  {
    id: "snow",
    bgmVideoId: "bfVH3FgXtmE",
    name: "雪山书房",
    desc: "雪峰、冷光、安静桌面",
    image: "./assets/snow-study-window-v2.png",
    music: "钢琴、极简弦乐、低速节拍"
  },
  {
    id: "sea",
    bgmVideoId: "ovS27OGTajs",
    name: "海边书房",
    desc: "海浪、晨光、木质书桌",
    image: "./assets/sea-sharp-v2.png",
    music: "Lo-fi、轻音乐、柔和合成器"
  },
  {
    id: "garden",
    bgmVideoId: "rlMvVlBsey8",
    name: "清晨窗边",
    desc: "晨光、植物、安静书桌",
    image: "./assets/sea-study.png",
    music: "自然声、轻钢琴、白噪音"
  },
  {
    id: "night",
    bgmVideoId: "DDuXSR2Y8Ds",
    name: "雨夜图书馆",
    desc: "雨声、暖灯、低语消失",
    image: "./assets/rain-library.png",
    music: "雨声、深度白噪、慢速氛围"
  },
  {
    id: "forest",
    bgmVideoId: "_HvIkyzos3Y",
    name: "森隐书房",
    desc: "雨后林色、玻璃小屋、一盏暖灯",
    image: "./assets/forest-natural-v3.png",
    music: "林间配乐、轻风、树叶"
  },
  {
    id: "wild",
    bgmVideoId: "BBz7-F9mdUE",
    name: "旷野",
    desc: "帐篷里的书桌、热咖啡、雾绿山坡",
    image: "./assets/wild-clean-v3.png",
    music: "旷野配乐、轻风"
  }
];

const soundStyles = ["柔和", "温暖", "空灵", "低沉", "静音"];
const soundPresets = {
  snow: { style: "空灵", music: 38, ambient: 24, frequency: 420, label: "轻风环境声" },
  sea: { style: "柔和", music: 42, ambient: 58, frequency: 950, label: "潮汐环境声" },
  garden: { style: "温暖", music: 48, ambient: 30, frequency: 1600, label: "柔和自然底噪" },
  night: { style: "低沉", music: 28, ambient: 62, frequency: 2800, label: "细雨环境声" },
  forest: { style: "柔和", music: 35, ambient: 32, frequency: 1100, label: "林间轻风与树叶" },
  wild: { style: "空灵", music: 38, ambient: 24, frequency: 520, label: "旷野轻风" }
};
const sceneSounds = {};
const sceneBgmEnabled = { snow: true, night: true, forest: true, wild: true };

const state = {
  view: "home",
  sceneIndex: 0,
  minutes: 50,
  remaining: 50 * 60,
  running: false,
  sessions: 1,
  timerId: null,
  musicVolume: 58,
  ambientVolume: 44,
  soundStyle: "空灵",
  previewing: false,
  bgmExpanded: false,
  goal: "",
  agentTodos: [],
  reviewResult: "",
  records: JSON.parse(localStorage.getItem("inookRecords") || "[]"),
  audio: null
};

const app = document.querySelector(".app");
const sceneCards = document.querySelector("#sceneCards");
const soundStylesEl = document.querySelector("#soundStyles");
const durationButtons = document.querySelector("#durationButtons");
const focusTime = document.querySelector("#focusTime");
const progressFill = document.querySelector("#progressFill");
const progressPercent = document.querySelector("#progressPercent");
const sessionNumber = document.querySelector("#sessionNumber");
const statusText = document.querySelector("#statusText");
const pauseButton = document.querySelector("#pauseButton");
const musicVolume = document.querySelector("#musicVolume");
const ambientVolume = document.querySelector("#ambientVolume");
const dockMusicVolume = document.querySelector("#dockMusicVolume");
const dockAmbientVolume = document.querySelector("#dockAmbientVolume");
const musicLabel = document.querySelector("#musicLabel");
const setupGoalInput = document.querySelector("#setupGoalInput");
const goalInput = document.querySelector("#goalInput");
const reviewModal = document.querySelector("#reviewModal");
const reviewGoal = document.querySelector("#reviewGoal");
const reviewMinutes = document.querySelector("#reviewMinutes");
const reviewScene = document.querySelector("#reviewScene");
const reviewResult = document.querySelector("#reviewResult");
const nextStepInput = document.querySelector("#nextStepInput");
const agentPanel = document.querySelector("#agentPanel");
const agentPromptInput = document.querySelector("#agentPromptInput");
const agentTodos = document.querySelector("#agentTodos");

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function selectedScene() {
  return scenes[state.sceneIndex];
}

function updateBackdrop() {
  app.dataset.scene = selectedScene().id;
  app.style.setProperty("--scene-image", `url("${selectedScene().image}")`);
}

function setView(view) {
  const previousView = state.view;
  if (view !== state.view) state.bgmExpanded = false;
  const enteringSetup = view === "setup" && state.view !== "setup";
  if (view !== "focus" && state.running) pauseTimer();
  if (view !== state.view) stopPreview(view !== "focus");
  state.view = view;
  app.dataset.view = view;
  window.scrollTo(0, 0);
  if (view !== "focus") {
    app.classList.remove("is-focus-minimal", "is-companion");
  }
  document.querySelectorAll(".nav-links button").forEach((button) => {
    button.classList.toggle("active", view === "setup" && button.dataset.jump === "scene");
  });
  if (enteringSetup) { startPreview(); offerPreviousTasks(); }
  if (view !== "focus") updateSound();
  if (view !== previousView) window.dispatchEvent(new CustomEvent('inook:view-change', { detail: { view } }));
}

function renderScenes() {
  sceneCards.innerHTML = scenes.map((scene, index) => `
    <button class="scene-card ${index === state.sceneIndex ? "active" : ""}" data-scene-index="${index}" aria-pressed="${index === state.sceneIndex}">
      <div class="scene-card-image" style="background-image: url('${scene.image}')"></div>
      <div class="scene-card-body">
        <strong>${scene.name}<span>SCENE</span></strong>
        <p>${scene.desc}</p>
      </div>
    </button>
  `).join("");

  sceneCards.querySelectorAll(".scene-card").forEach((card) => {
    card.addEventListener("click", () => {
      state.sceneIndex = Number(card.dataset.sceneIndex);
      updateBackdrop();
      sceneCards.querySelectorAll(".scene-card").forEach((item) => {
        const selected = Number(item.dataset.sceneIndex) === state.sceneIndex;
        item.classList.toggle("active", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      applySceneSound();
      if (state.view === "setup") startPreview();
    });
  });
}

function renderSoundStyles() {
  soundStylesEl.innerHTML = soundStyles.map((name) => `
    <button class="style-button ${name === state.soundStyle ? "active" : ""}" data-style="${name}" aria-pressed="${name === state.soundStyle}">${name}</button>
  `).join("");

  soundStylesEl.querySelectorAll(".style-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.soundStyle = button.dataset.style;
      soundStylesEl.querySelectorAll(".style-button").forEach((item) => {
        item.classList.toggle("active", item.dataset.style === state.soundStyle);
        item.setAttribute("aria-pressed", String(item.dataset.style === state.soundStyle));
      });
      rememberSound();
      updateSound();
    });
  });
}

function rememberSound() {
  sceneSounds[selectedScene().id] = { style: state.soundStyle, music: state.musicVolume, ambient: state.ambientVolume };
}

function applySceneSound() {
  document.querySelector("#snowBgmEnabled").checked = sceneBgmEnabled[selectedScene().id] !== false;
  const preset = sceneSounds[selectedScene().id] || soundPresets[selectedScene().id];
  state.soundStyle = preset.style;
  musicVolume.value = preset.music;
  ambientVolume.value = preset.ambient;
  syncVolumes("setup");
  renderSoundStyles();
}

function updateSound() {
  window.ambientMixer.selectScene(selectedScene().id);
  const hasBgm = Boolean(selectedScene().bgmVideoId);
  const local = false;
  const enabled = !hasBgm || document.querySelector("#snowBgmEnabled").checked;
  document.querySelector("#localBgmField").hidden = true;
  document.querySelector("#snowBgmChoice").hidden = !hasBgm;
  document.querySelector("#sceneBgmLabel").textContent = `播放${selectedScene().name} BGM`;
  soundStylesEl.hidden = hasBgm;
  const youtube = hasBgm && enabled && state.view !== "home";
  document.querySelector("#bgmWidget").hidden = !youtube;
  const expanded = youtube && state.bgmExpanded;
  const toggle = document.querySelector("#bgmToggle");
  toggle.title = expanded ? "收起音乐播放器" : "展开音乐播放器";
  toggle.setAttribute("aria-label", toggle.title);
  toggle.setAttribute("aria-expanded", String(expanded));
  musicLabel.textContent = !enabled ? "BGM 已关闭" : hasBgm ? `${selectedScene().name} BGM` : state.soundStyle === "静音" ? "音乐已关闭" : `${state.soundStyle}氛围音 · 合成`;
  window.snowBgm.sync(state.view, youtube, wantsAudio(), state.musicVolume, expanded, selectedScene().bgmVideoId);
  window.localBgm.sync(local && enabled, wantsAudio(), state.musicVolume);
  document.querySelector("#ambientLabel").textContent = window.ambientMixer.summary();
  document.querySelector("#soundPresetLabel").textContent = `${selectedScene().name} · 声音搭配`;
  if (!state.audio) return;
  const { context, music, ambient, voices } = state.audio;
  music.gain.setTargetAtTime(hasBgm || !enabled || state.soundStyle === "静音" ? 0 : state.musicVolume / 100, context.currentTime, 0.15);
  ambient.gain.setTargetAtTime(state.ambientVolume / 100, context.currentTime, 0.15);
  const notes = { "柔和": [130.81, 164.81, 196], "温暖": [174.61, 220, 261.63], "空灵": [261.63, 392, 523.25], "低沉": [65.41, 98, 130.81], "静音": [130.81, 164.81, 196] };
  voices.forEach((voice, index) => voice.frequency.setTargetAtTime(notes[state.soundStyle][index], context.currentTime, 0.4));
}

function startPreview() {
  state.previewing = true;
  resumeAudio();
  const button = document.querySelector("#previewSoundButton");
  button.textContent = "停止试听";
  button.setAttribute("aria-pressed", "true");
}

function stopPreview(silence = true) {
  state.previewing = false;
  const button = document.querySelector("#previewSoundButton");
  button.textContent = "试听声音";
  button.setAttribute("aria-pressed", "false");
  if (silence && !state.running) silenceAudio();
}

function wantsAudio() {
  return state.running || state.previewing;
}

function silenceAudio() {
  window.snowBgm.pause();
  window.localBgm.pause();
  if (state.audio && state.audio.context.state !== "closed") {
    const { context, master } = state.audio;
    master.gain.setTargetAtTime(0, context.currentTime, 0.05);
  }
  document.querySelector("#audioRetryButton").hidden = true;
}

async function resumeAudio() {
  // Request media playback within the click handler, before awaiting Web Audio.
  updateSound();
  try {
    ensureAudio();
    if (!state.audio) throw new Error("Audio unavailable");
    const { context, master } = state.audio;
    if (context.state !== "running") await context.resume();
    if (!wantsAudio()) return silenceAudio();
    updateSound();
    master.gain.setTargetAtTime(0.24, context.currentTime, 0.15);
    document.querySelector("#audioRetryButton").hidden = context.state === "running";
  } catch (error) {
    document.querySelector("#audioRetryButton").hidden = !wantsAudio();
  }
}

function setDuration(minutes) {
  if (quickController) quickController.abort();
  pendingPlan = null;
  document.querySelector('#quickSuggestion').hidden = true;
  document.querySelector('#quickStatus').textContent = '';
  document.querySelector('#quickStepButton').textContent = `规划这 ${minutes} 分钟`;
  state.minutes = minutes;
  state.remaining = minutes * 60;
  durationButtons.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.minutes) === minutes);
  });
  renderTimer();
}

function renderTimer() {
  const total = state.minutes * 60;
  const elapsed = total - state.remaining;
  const progress = total > 0 ? Math.max(0, Math.min(100, Math.round((elapsed / total) * 100))) : 0;
  focusTime.textContent = formatTime(state.remaining);
  progressFill.style.width = `${progress}%`;
  progressPercent.textContent = `${progress}%`;
  sessionNumber.textContent = String(state.sessions);
}

function syncGoal(source) {
  const value = (source === "focus" ? goalInput.value : setupGoalInput.value).trim();
  state.goal = value;
  if (source !== "setup") setupGoalInput.value = state.goal;
  if (source !== "focus") goalInput.value = state.goal;
  if (source === "focus") localStorage.setItem('inookPendingGoal', state.goal);
  agentPromptInput.value = state.goal;
  document.querySelector("#quickStepButton").hidden = !value;
  document.querySelector("#quickSuggestion").hidden = true;
  document.querySelector("#quickStatus").textContent = '';
  if (quickController) quickController.abort();
  window.renderGoalTaskDetails?.();
}

function escapeHTML(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function renderAgentTodos() {
  document.querySelector('#startAgentPlan').hidden = !state.agentTodos.some(task => !task.done);
  if (!state.agentTodos.length) {
    agentTodos.replaceChildren();
    return;
  }

  agentTodos.innerHTML = state.agentTodos.map((todo, index) => `
    <div class="agent-todo">
      <input type="checkbox" aria-label="完成第${index + 1}项" data-agent-todo="${index}" ${todo.done ? "checked" : ""} />
      <textarea data-task-text="${index}" aria-label="第${index + 1}项任务" rows="2" maxlength="300">${escapeHTML(todo.text)}</textarea>
      <div class="task-options"><label>预计 <input data-task-minutes="${index}" type="number" min="1" max="180" step="1" required value="${todo.minutes || 15}" aria-label="第${index + 1}项预计分钟数" /> 分钟</label><button data-task-done="${index}" aria-pressed="${todo.done}">${todo.done ? '已完成 · 撤销' : '完成'}</button></div>
    </div>
  `).join("");

  agentTodos.querySelectorAll("[data-agent-todo]").forEach((input) => {
    input.addEventListener("change", () => {
      state.agentTodos[Number(input.dataset.agentTodo)].done = input.checked;
      const changed = state.agentTodos[Number(input.dataset.agentTodo)];
      if (unconfirmedPlan) { renderAgentTodos(); return; }
      sessionTasks.filter(t => t.text === changed.text).forEach(t => { t.done = changed.done; });
      if (changed.text === timedGoalText && changed.done) completeTimedGoal();
      else {
        if (changed.text === timedGoalText && goalClock.done) { goalClock.clear(); timedGoalText = ''; renderGoalClock(); }
        renderSessionTasks(); renderAgentTodos();
      }
      localStorage.setItem("inookAgentTodos", JSON.stringify(state.agentTodos));
    });
  });
  agentTodos.querySelectorAll('[data-task-text]').forEach(input => input.addEventListener('input', () => {
    const task = state.agentTodos[Number(input.dataset.taskText)];
    const text = input.value.trim();
    if (!text) { input.setCustomValidity('请填写任务'); return; }
    input.setCustomValidity('');
    const old = task.text;
    if (!unconfirmedPlan) sessionTasks.filter(t => t.text === old).forEach(t => { t.text = text; });
    if (!unconfirmedPlan && timedGoalText === old) { timedGoalText = text; state.goal = text; goalInput.value = text; setupGoalInput.value = text; }
    task.text = text; renderSessionTasks();
  }));
  agentTodos.querySelectorAll('[data-task-minutes]').forEach(input => input.addEventListener('input', () => {
    const task = state.agentTodos[Number(input.dataset.taskMinutes)];
    if (!input.checkValidity()) return;
    task.minutes = Number(input.value);
    if (!unconfirmedPlan) sessionTasks.filter(t => t.text === task.text).forEach(t => { t.minutes = task.minutes; });
    renderSessionTasks();
  }));
  agentTodos.querySelectorAll('[data-task-done]').forEach(button => button.addEventListener('click', () => {
    agentTodos.querySelector(`[data-agent-todo="${button.dataset.taskDone}"]`).click();
  }));
}

let quickController = null;
let pendingPlan = null;
let agentController = null;
let agentOriginalTask = '';
let studyGeneration = 0;
let previousStudyTasks = null;
const taskInboxStore = window.QiyeTasks.create(localStorage);
let restoredTasks = [];
try { restoredTasks = taskInboxStore.read().filter(task => task.selected && !task.done); }
catch { /* Keep existing stored data intact when storage cannot be read. */ }
const sessionTasks = restoredTasks.map(task => ({ ...task }));
function persistSessionTasks() {
  try { taskInboxStore.sync(sessionTasks); return true; }
  catch { document.querySelector('#inboxStatus').textContent = '未能自动保存，请保留任务内容并检查浏览器存储。'; return false; }
}
let unconfirmedPlan = false;
let previousPlanTexts = [];
const goalClock = new window.GoalClock();
let timedGoalText = '';
window.renderGoalTaskDetails = function () {
  let details = document.querySelector('#goalTaskDetails');
  if (!details) {
    details = document.createElement('details'); details.id = 'goalTaskDetails';
    const summary = document.createElement('summary'); summary.textContent = '任务详情';
    details.append(summary, document.createElement('p')); goalInput.parentElement.append(details);
  }
  const task = sessionTasks.find(task => task.text.trim() === state.goal.trim());
  const notes = task?.notes || '';
  const key = task?.id || task?.text || '';
  if (details.dataset.task !== key || details.querySelector('p').textContent !== notes) details.open = false;
  details.dataset.task = key;
  details.querySelector('p').textContent = notes; details.hidden = !notes;
};
function renderGoalClock() {
  window.renderGoalTaskDetails?.();
  const shared = window.together?.sharedTiming?.();
  const remaining = shared ? shared.remaining : goalClock.tick();
  const done = shared ? shared.done : goalClock.done;
  document.querySelector('#goalTimePrompt').hidden = remaining !== 0 || done;
  document.querySelector('#goalEstimate').textContent = done ? '已完成' : remaining === null ? '未计时' : remaining === 0 ? '等待确认' : `剩余 ${formatTime(Math.ceil(remaining / 1000))}`;
  document.querySelector('#applyGoalMinutes').textContent = remaining === null || goalClock.done ? '开始计时' : '重新计时';
}
function importSessionTasks() {
  state.agentTodos.forEach(t => {
    if (!sessionTasks.some(s => s.text === t.text)) sessionTasks.push({ text: t.text, done: t.done, minutes: t.minutes || 15 });
  });
  renderSessionTasks();
  document.querySelector('#sessionTodos').open = !agentPanel.classList.contains('open');
}
function completeTimedGoal() {
  if (window.together?.completeSharedGoal?.()) { renderGoalClock(); return; }
  goalClock.complete();
  sessionTasks.filter(t => t.text === timedGoalText).forEach(t => { t.done = true; });
  state.agentTodos.filter(t => t.text === timedGoalText).forEach(t => { t.done = true; });
  renderAgentTodos(); renderSessionTasks(); renderGoalClock();
}
function renderSessionTasks() {
  window.renderGoalTaskDetails?.();
  persistSessionTasks();
  const selectedNotice = document.querySelector('#selectedTaskNotice');
  const unfinished = sessionTasks.filter(task => !task.done).length;
  selectedNotice.hidden = !unfinished;
  selectedNotice.textContent = `本轮已有 ${unfinished} 项待办`;
  const list = document.querySelector('#sessionTodoList');
  list.replaceChildren();
  const sharedTasks = window.together?.sharedTasks?.();
  if (sharedTasks) {
    document.querySelector('#sessionTodoCount').textContent = `${sharedTasks.filter(t => t.done).length}/${sharedTasks.length}`;
    document.querySelector('#sessionTodos').hidden = false;
    if (sharedTasks.length) { const heading = document.createElement('p'); heading.className = 'todo-empty'; heading.textContent = '房间共享'; list.append(heading); }
    for (const task of sharedTasks) {
      const row = document.createElement('label'); row.className = 'session-task-row';
      const check = document.createElement('input'); check.type = 'checkbox'; check.checked = task.done;
      check.setAttribute('aria-label', `完成：${task.text}`);
      check.onchange = () => window.together.completeSharedTask(task.id, check.checked);
      const text = document.createElement('span'); text.textContent = `${task.text} · ${task.minutes ? `预计 ${task.minutes} 分钟` : '未估时'}`;
      row.append(check, text); list.append(row);
    }
  }
  const allTasks = [...(sharedTasks || []), ...sessionTasks];
  document.querySelector('#sessionTodoCount').textContent = `${allTasks.filter(t => t.done).length}/${allTasks.length}`;
  document.querySelector('#sessionTodos').hidden = false;
  const composer = document.createElement('form');
  composer.className = 'todo-composer';
  composer.innerHTML = '<input name="task" aria-label="新待办任务" placeholder="添加一件想做的事" maxlength="300" required /><label><input name="minutes" aria-label="新待办预计分钟数" type="number" min="1" max="180" step="1" value="15" required /><span>分钟</span></label><button type="submit" aria-label="添加待办" title="添加待办">+</button>';
  const addTask = document.createElement('details'); addTask.className = 'todo-add'; addTask.open = !sessionTasks.length;
  const addSummary = document.createElement('summary'); addSummary.textContent = '+ 添加任务';
  addTask.append(addSummary, composer);
  composer.addEventListener('submit', async event => {
    event.preventDefault();
    const input = composer.elements.namedItem('task');
    const text = input.value.trim();
    if (!text) { input.setCustomValidity('请填写任务'); input.reportValidity(); return; }
    if (sessionTasks.some(task => task.text === text)) { input.setCustomValidity('这项任务已经在清单里了'); input.reportValidity(); return; }
    const task = { text, minutes: Number(composer.elements.namedItem('minutes').value), done: false };
    const submit = composer.querySelector('button'); submit.disabled = true;
    const keep = await (window.together?.confirmTask?.(task) ?? true);
    submit.disabled = false;
    if (!keep) return;
    sessionTasks.push(task);
    renderSessionTasks();
    document.querySelector('.todo-add summary').focus();
  });
  composer.elements.namedItem('task').addEventListener('input', event => event.target.setCustomValidity(''));
  list.prepend(addTask);
  if (!allTasks.length) {
    const empty = document.createElement('p'); empty.className = 'todo-empty'; empty.textContent = '今天，想先做哪一件事？'; list.append(empty);
  }
  if (sharedTasks && sessionTasks.length) { const heading = document.createElement('p'); heading.className = 'todo-empty'; heading.textContent = '仅自己'; list.append(heading); }
  sessionTasks.forEach((task, index) => {
    const label = document.createElement('div'); label.className = 'session-task-row';
    const grip = document.createElement('button'); grip.type = 'button'; grip.className = 'task-drag-handle'; grip.textContent = '⠿';
    grip.title = '拖动排序，或使用上下方向键'; grip.setAttribute('aria-label', `调整第${index + 1}项顺序`);
    label.classList.add('sortable-task');
    grip.addEventListener('keydown', event => {
      if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const target = Math.max(0, Math.min(sessionTasks.length - 1, index + (event.key === 'ArrowUp' ? -1 : 1)));
      reorderSessionTask(index, target);
      list.querySelectorAll('.task-drag-handle')[target]?.focus();
    });
    let dragging = false, dropIndex = index;
    grip.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault(); dragging = true; grip.setPointerCapture(event.pointerId); label.classList.add('is-dragging');
    });
    grip.addEventListener('pointermove', event => {
      if (!dragging) return;
      const bounds = list.getBoundingClientRect();
      if (event.clientY < bounds.top + 40) list.scrollTop -= 12;
      if (event.clientY > bounds.bottom - 40) list.scrollTop += 12;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.sortable-task');
      if (!target || target === label || !list.contains(target)) return;
      const rect = target.getBoundingClientRect();
      const after = event.clientY >= rect.top + rect.height / 2;
      const targetIndex = [...list.querySelectorAll('.sortable-task')].indexOf(target);
      const insertion = targetIndex + (after ? 1 : 0);
      dropIndex = insertion - (index < insertion ? 1 : 0);
      list.querySelectorAll('.task-drop-before, .task-drop-after').forEach(row => row.classList.remove('task-drop-before', 'task-drop-after'));
      target.classList.add(after ? 'task-drop-after' : 'task-drop-before');
    });
    grip.addEventListener('pointerup', () => {
      if (!dragging) return;
      dragging = false;
      reorderSessionTask(index, dropIndex);
    });
    grip.addEventListener('pointercancel', () => { if (dragging) { dragging = false; renderSessionTasks(); } });
    const check = document.createElement('input');
    check.type = 'checkbox'; check.checked = task.done;
    check.addEventListener('change', () => {
      task.done = check.checked;
      state.agentTodos.filter(t => t.text === task.text).forEach(t => { t.done = task.done; });
      if (task.text === timedGoalText && task.done) completeTimedGoal();
      else {
        if (task.text === timedGoalText && goalClock.done) { goalClock.clear(); timedGoalText = ''; renderGoalClock(); }
        renderAgentTodos(); renderSessionTasks();
      }
    });
    const text = document.createElement('textarea');
    text.value = task.text; text.rows = 2; text.maxLength = 300; text.required = true;
    text.setAttribute('aria-label', `待办第${index + 1}项内容`);
    text.addEventListener('input', () => text.setCustomValidity(''));
    text.addEventListener('input', () => {
      const updated = text.value.trim();
      if (!updated || sessionTasks.some(other => other !== task && other.text === updated)) {
        text.setCustomValidity('请填写不重复的任务'); return;
      }
      const old = task.text;
      state.agentTodos.filter(t => t.text === old).forEach(t => { t.text = updated; });
      if (timedGoalText === old) { timedGoalText = updated; state.goal = updated; goalInput.value = updated; setupGoalInput.value = updated; }
      task.text = updated;
      persistSessionTasks();
      check.setAttribute('aria-label', `完成：${updated}`);
      renderAgentTodos();
    });
    const options = document.createElement('div'); options.className = 'session-task-options';
    const duration = document.createElement('label');
    const minutes = document.createElement('input');
    minutes.type = 'number'; minutes.min = '1'; minutes.max = '180'; minutes.step = '1'; minutes.value = task.minutes ?? ''; minutes.placeholder = '可选';
    minutes.setAttribute('aria-label', `待办第${index + 1}项预计分钟数`);
    minutes.addEventListener('input', () => {
      if (!minutes.checkValidity()) return;
      task.minutes = minutes.value ? Number(minutes.value) : null;
      persistSessionTasks();
      state.agentTodos.filter(t => t.text === task.text).forEach(t => { t.minutes = task.minutes; });
      renderAgentTodos();
    });
    duration.append(minutes, ' 分钟');
    check.setAttribute('aria-label', `完成：${task.text}`);
    const start = document.createElement('button');
    start.textContent = !goalClock.done && timedGoalText === task.text ? '进行中' : '做这项';
    start.disabled = task.done || (!goalClock.done && timedGoalText === task.text);
    start.addEventListener('click', () => useTaskAsGoal(task));
    const remove = document.createElement('button');
    remove.className = 'todo-remove'; remove.textContent = '×'; remove.title = '移回待办箱'; remove.setAttribute('aria-label', `移回待办箱第${index + 1}项`);
    remove.addEventListener('click', () => {
      sessionTasks.splice(sessionTasks.indexOf(task), 1);
      state.agentTodos = state.agentTodos.filter(t => t.text !== task.text);
      if (timedGoalText === task.text) {
        goalClock.clear(); timedGoalText = ''; state.goal = ''; goalInput.value = ''; setupGoalInput.value = ''; renderGoalClock();
      }
      renderAgentTodos(); renderSessionTasks();
    });
    options.append(duration, start, remove);
    label.append(grip, check, text, options); list.append(label);
    if (task.notes) {
      const details = document.createElement('details'); details.className = 'session-task-notes';
      const summary = document.createElement('summary'); summary.textContent = '任务详情';
      const content = document.createElement('p'); content.textContent = task.notes;
      details.append(summary, content); label.insertBefore(details, options);
    }
  });
}
function reorderSessionTask(from, to) {
  if (from < 0 || to < 0 || from >= sessionTasks.length || to >= sessionTasks.length) return;
  const [task] = sessionTasks.splice(from, 1); sessionTasks.splice(to, 0, task);
  if (!unconfirmedPlan) {
    const order = new Map(sessionTasks.map((item, index) => [item.text, index]));
    state.agentTodos.sort((a, b) => (order.get(a.text) ?? Infinity) - (order.get(b.text) ?? Infinity));
    renderAgentTodos();
  }
  renderSessionTasks();
}
renderSessionTasks();
window.setInterval(renderGoalClock, 500);
document.querySelector('#completeTimedGoal').addEventListener('click', completeTimedGoal);
document.querySelector('#extendTimedGoal').addEventListener('click', () => {
  if (window.together?.canEditGoal && !window.together.canEditGoal()) return;
  const input = document.querySelector('#goalExtraMinutes');
  if (!input.reportValidity()) return;
  goalClock.start(Number(input.value), state.running);
  renderGoalClock();
});
function syncAgentSend() {
  document.querySelector('#startAgentPlan').disabled = Boolean(agentController);
  const send = document.querySelector('#agentSendButton');
  send.disabled = !agentController && !agentPromptInput.value.trim();
  send.dataset.busy = String(Boolean(agentController));
  send.title = agentController ? '停止生成' : '发送';
  send.setAttribute('aria-label', send.title);
  document.querySelector('#agentStatus').setAttribute('aria-busy', String(Boolean(agentController)));
}
async function requestAI(mode, prompt, signal, minutes = state.minutes) {
  let response;
  try { response = await fetch('/api/assist', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
    body: JSON.stringify({ mode, prompt, minutes: Math.max(1, Math.min(180, Math.round(minutes))), provider: 'auto' })
  }); } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('暂时连接不上专注助手。你的输入还在，请确认网站服务已启动后，再点发送重试。');
  }
  if (!(response.headers.get('content-type') || '').includes('application/json')) throw new Error('当前是静态预览，尚未连接本地 AI 后端。你仍可直接开始专注。');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '暂时无法生成，请重试。');
  return data;
}
async function generateAgentTodos() {
  const generation = studyGeneration;
  const status = document.querySelector('#agentStatus');
  if (agentController) { agentController.abort(); return; }
  const prompt = agentPromptInput.value.trim();
  if (!prompt) { status.textContent = '先写下你想推进的事情。'; return; }
  agentController = new AbortController();
  syncAgentSend();
  status.textContent = 'AI 智能整理中…';
  try {
    const previous = state.agentTodos.map(task => ({ ...task }));
    const context = previous.length ? JSON.stringify({ task: agentOriginalTask || state.goal, currentPlan: previous, request: prompt, instruction: '根据用户的新要求调整当前计划，返回完整的未完成步骤；已完成的步骤无需重新安排。信息不足时给可开始的步骤，仅在必要时追问。' }) : prompt;
    if (context.length > 4000) throw new Error('这次补充有些长，请精简后再试。');
    const timeRequest = prompt.match(/(?:只有|还有|剩下|剩余|总共|一共|用时|控制在|我有)\s*(\d+)\s*(?:分钟|min\b)/i);
    const budget = timeRequest ? Math.max(1, Math.min(180, Number(timeRequest[1]))) : Math.max(1, Math.ceil(state.remaining / 60));
    const result = await requestAI('deep', context, agentController.signal, budget);
    if (generation !== studyGeneration) return;
    if (!agentOriginalTask) agentOriginalTask = prompt;
    const completed = previous.filter(task => task.done);
    const steps = result.steps.filter(text => !completed.some(task => task.text === text));
    state.agentTodos = [...completed, ...steps.map((text, index) => {
      const existing = previous.find(task => task.text === text);
      const minutes = timeRequest ? Math.max(1, Math.floor(budget / steps.length) + (index < budget % steps.length ? 1 : 0)) : 15;
      return existing && !timeRequest ? existing : { text, done: false, minutes };
    })];
    if (!unconfirmedPlan) previousPlanTexts = previous.map(task => task.text);
    unconfirmedPlan = true;
    document.querySelector('#agentAnswer').textContent = result.answer;
    localStorage.setItem('inookAgentTodos', JSON.stringify(state.agentTodos));
    renderAgentTodos(); status.textContent = '';
    agentPanel.classList.add('has-plan');
    document.querySelector('#agentInputLabel').textContent = '还有哪里需要调整？';
    agentPromptInput.value = '';
    agentPromptInput.placeholder = '比如：缩成三步，或说说你卡在哪里';
    agentPromptInput.rows = 2;
  } catch (error) { if (generation === studyGeneration) status.textContent = error.name === 'AbortError' ? '已取消' : error.message; }
  finally { if (generation === studyGeneration) { agentController = null; syncAgentSend(); } }
}

function toggleAgent(forceOpen, focusInput = true) {
  const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : !agentPanel.classList.contains("open");
  agentPanel.classList.toggle("open", shouldOpen);
  agentPanel.setAttribute("aria-hidden", String(!shouldOpen));
  if (!shouldOpen && agentPanel.contains(document.activeElement)) document.querySelector('#agentButton').focus();
  if (shouldOpen) {
    document.querySelector('#sessionTodos').open = false;
    document.querySelector('#goalTimeSettings').open = false;
    if (!state.agentTodos.length && !agentPromptInput.value.trim()) agentPromptInput.value = state.goal;
    syncAgentSend();
    if (focusInput) agentPromptInput.focus();
  }
}

function ensureAudio() {
  if (state.audio && state.audio.context.state !== "closed") return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  const master = context.createGain();
  const music = context.createGain();
  const ambient = context.createGain();
  master.gain.value = 0;
  music.gain.value = state.musicVolume / 100;
  ambient.gain.value = state.ambientVolume / 100;
  music.connect(master);
  ambient.connect(master);
  master.connect(context.destination);

  window.ambientMixer.create(context, ambient);
  const voices = [0, 1, 2].map((index) => {
    const voice = context.createOscillator();
    const gain = context.createGain();
    voice.type = "sine";
    gain.gain.value = 0.13 / (index + 1);
    voice.connect(gain);
    gain.connect(music);
    voice.start();
    return voice;
  });
  state.audio = { context, master, music, ambient, voices };
  context.addEventListener("statechange", () => {
    document.querySelector("#audioRetryButton").hidden = !wantsAudio() || context.state === "running";
  });
  updateSound();
}

function syncVolumes(source) {
  state.musicVolume = Number(source === "dock" ? dockMusicVolume.value : musicVolume.value);
  state.ambientVolume = Number(source === "dock" ? dockAmbientVolume.value : ambientVolume.value);
  musicVolume.value = String(state.musicVolume);
  ambientVolume.value = String(state.ambientVolume);
  dockMusicVolume.value = String(state.musicVolume);
  dockAmbientVolume.value = String(state.ambientVolume);
  rememberSound();
  updateSound();
}

function startTimer() {
  state.running = true;
  goalClock.resume();
  resumeAudio();
  statusText.textContent = "学习中";
  pauseButton.innerHTML = '<span class="pause-icon"></span><span>暂停学习</span>';
  pauseButton.setAttribute('aria-label', '暂停学习'); pauseButton.title = '暂停学习';
  window.clearInterval(state.timerId);
  let lastTimerTick = Date.now();
  state.timerId = window.setInterval(() => {
    const now = Date.now();
    const elapsed = Math.floor((now - lastTimerTick) / 1000);
    const credited = Math.min(elapsed, state.remaining);
    if (elapsed > 0 && elapsed <= 5 && credited > 0) {
      window.dispatchEvent(new CustomEvent('inook:focus-tick', { detail: { start: lastTimerTick, end: lastTimerTick + credited * 1000 } }));
    }
    lastTimerTick += elapsed * 1000;
    state.remaining -= elapsed;
    if (state.remaining <= 0) {
      state.remaining = 0;
      finishSession();
    }
    renderTimer();
  }, 1000);
}

function pauseTimer() {
  state.running = false;
  goalClock.pause();
  silenceAudio();
  statusText.textContent = "暂停中";
  pauseButton.innerHTML = '<span class="play-icon"></span><span>继续学习</span>';
  pauseButton.setAttribute('aria-label', '继续学习'); pauseButton.title = '继续学习';
  window.clearInterval(state.timerId);
}

function finishSession() {
  pauseTimer();
  window.dispatchEvent(new CustomEvent('inook:session-complete', { detail: { goal: state.goal || '自由专注', minutes: Math.round(state.minutes), scene: selectedScene().name } }));
  openReview("completed");
}

function resetTimer() {
  silenceAudio();
  window.clearInterval(state.timerId);
  state.remaining = state.minutes * 60;
  state.running = false;
  statusText.textContent = "准备中";
  pauseButton.innerHTML = '<span class="play-icon"></span>';
  renderTimer();
}

function enterFocus() {
  syncGoal("setup");
  localStorage.setItem('inookPendingGoal', state.goal);
  setView("focus");
  state.remaining = state.minutes * 60;
  renderTimer();
  startTimer();
}

function openReview(defaultResult = "") {
  state.reviewResult = defaultResult;
  reviewGoal.textContent = state.goal || '自由专注';
  reviewMinutes.textContent = `${state.minutes} 分钟`;
  reviewScene.textContent = selectedScene().name;
  reviewResult.textContent = resultLabel(defaultResult) || "等待选择";
  reviewModal.classList.add("open");
  reviewModal.setAttribute("aria-hidden", "false");
  document.querySelectorAll("#reviewActions button").forEach((button) => {
    button.classList.toggle("active", button.dataset.result === defaultResult);
  });
}

function closeReview() {
  reviewModal.classList.remove("open");
  reviewModal.setAttribute("aria-hidden", "true");
}

function resultLabel(result) {
  return {
    completed: "完成了",
    partial: "推进了一点",
    blocked: "卡住了"
  }[result] || "";
}

function saveReview() {
  const record = {
    goal: state.goal,
    next: nextStepInput.value.trim(),
    result: state.reviewResult || "partial",
    minutes: state.minutes,
    scene: selectedScene().name,
    createdAt: new Date().toISOString()
  };
  state.records = [record, ...state.records].slice(0, 8);
  state.sessions += 1;
  localStorage.setItem("inookRecords", JSON.stringify(state.records));
  localStorage.setItem('inookPendingGoal', record.next || (record.result === 'completed' ? '' : record.goal));
  if (record.next) {
    state.goal = record.next;
    localStorage.setItem("inookGoal", state.goal);
  }
  setupGoalInput.value = state.goal;
  goalInput.value = state.goal;
  renderResumeGoal();
  closeReview();
  setView("setup");
  renderTimer();
}

function changeScene(direction) {
  state.sceneIndex = (state.sceneIndex + direction + scenes.length) % scenes.length;
  updateBackdrop();
  renderScenes();
  applySceneSound();
}

document.querySelector("#previewSoundButton").addEventListener("click", () => {
  if (state.previewing) return stopPreview();
  startPreview();
});

document.querySelector("#audioRetryButton").addEventListener("click", resumeAudio);
document.querySelector("#bgmToggle").addEventListener("click", () => {
  state.bgmExpanded = !state.bgmExpanded;
  updateSound();
});
document.addEventListener("pointerdown", (event) => {
  if (state.bgmExpanded && !event.target.closest("#bgmWidget")) {
    state.bgmExpanded = false;
    updateSound();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.bgmExpanded) {
    state.bgmExpanded = false;
    updateSound();
    document.querySelector("#bgmToggle").focus();
  }
});
document.querySelector("#snowBgmEnabled").addEventListener("change", () => {
  sceneBgmEnabled[selectedScene().id] = document.querySelector("#snowBgmEnabled").checked;
  updateSound();
  if (document.querySelector("#snowBgmEnabled").checked && state.view === "setup") startPreview();
});
document.querySelector("#localBgmFile").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  window.localBgm.load(file);
  document.querySelector("#snowBgmEnabled").checked = true;
  updateSound();
  if (state.view === "setup") startPreview();
});
document.querySelector("#clearLocalBgm").addEventListener("click", () => {
  window.localBgm.load(null);
  document.querySelector("#localBgmFile").value = "";
  updateSound();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && wantsAudio()) resumeAudio();
});
document.addEventListener("pointerdown", () => {
  if (wantsAudio() && state.audio?.context.state !== "running") resumeAudio();
});

document.querySelector("#startSetupButton").addEventListener("click", () => { window.together?.solo(); setView("setup"); });
document.querySelector("#enterRoomButton").addEventListener("click", async event => {
  const button = event.currentTarget;
  if (button.disabled) return;
  button.disabled = true;
  try {
    if (!await window.inookAccount.requireLogin()) return;
    if (window.together?.configuring()) await window.together.create(); else enterFocus();
  } finally { button.disabled = false; }
});
const leaveDialog = document.createElement('dialog');
leaveDialog.id = 'leaveStudyDialog';
leaveDialog.setAttribute('aria-labelledby', 'leaveStudyTitle');
leaveDialog.innerHTML = '<h2 id="leaveStudyTitle">要离开这次专注吗？</h2><p>结束后将停止本次计时并返回首页。</p><p id="leaveStudyError" role="status"></p><div><button id="stayInStudy">留在书房</button><button id="leaveStudyEnd">结束并返回</button></div>';
document.body.append(leaveDialog);
let leaveDestination = () => setView('home');
function requestLeaveStudy(destination = () => setView('home')) {
  if (state.view !== 'focus') { pauseTimer(); destination(); return; }
  leaveDestination = destination;
  document.querySelector('#leaveStudyError').textContent = '';
  leaveDialog.showModal();
}
document.querySelector('#stayInStudy').onclick = () => leaveDialog.close();
const carryDialog = document.createElement('dialog');
carryDialog.id = 'carryStudyDialog'; carryDialog.setAttribute('aria-labelledby', 'carryStudyTitle');
carryDialog.innerHTML = '<h2 id="carryStudyTitle">沿用上次的学习目标吗？</h2><p>只保留目标和待办。这次的计时与助手对话将重新开始。</p><div><button id="discardStudyTasks">全新开始</button><button id="keepStudyTasks">保留目标和待办</button></div>';
document.body.append(carryDialog);
function offerPreviousTasks() { if (previousStudyTasks && !carryDialog.open) carryDialog.showModal(); }
document.querySelector('#discardStudyTasks').onclick = () => { previousStudyTasks = null; carryDialog.close(); window.dispatchEvent(new Event('inook:fresh-start')); };
carryDialog.addEventListener('cancel', () => { previousStudyTasks = null; });
document.querySelector('#keepStudyTasks').onclick = () => {
  if (previousStudyTasks) {
    setupGoalInput.value = previousStudyTasks.goal; syncGoal('setup');
    sessionTasks.push(...previousStudyTasks.tasks.map(task => ({ ...task })));
    renderSessionTasks();
  }
  previousStudyTasks = null; carryDialog.close();
};
function endStudyAndReset() {
  persistSessionTasks();
  previousStudyTasks = state.goal || sessionTasks.length ? { goal: state.goal, tasks: sessionTasks.filter(task => !task.done && !task.fromRoom).map(task => ({ ...task })) } : null;
  studyGeneration++; agentController?.abort(); quickController?.abort();
  agentController = null; quickController = null;
  pauseTimer(); state.previewing = false;
  window.snowBgm.reset(); window.localBgm.reset();
  goalClock.clear(); timedGoalText = ''; pendingPlan = null; agentOriginalTask = '';
  sessionTasks.length = 0; state.agentTodos = []; state.goal = '';
  unconfirmedPlan = false; previousPlanTexts = [];
  setupGoalInput.value = ''; goalInput.value = ''; agentPromptInput.value = ''; nextStepInput.value = '';
  state.sessions = 1; state.reviewResult = ''; setDuration(50); resetTimer();
  toggleAgent(false); closeReview();
  agentPanel.classList.remove('has-plan');
  agentPromptInput.placeholder = '写下任务，或你卡住的问题'; agentPromptInput.rows = 3;
  document.querySelector('#agentInputLabel').textContent = '本轮任务';
  for (const id of ['agentAnswer', 'agentStatus', 'quickStatus', 'quickStepText']) document.getElementById(id).textContent = '';
  document.querySelector('#quickPlanSteps').replaceChildren();
  document.querySelector('#quickSuggestion').hidden = true;
  document.querySelector('#sessionTodos').open = false; document.querySelector('#goalTimeSettings').open = false;
  document.querySelector('#focusSoundPanel').hidden = true;
  localStorage.removeItem('inookPendingGoal'); localStorage.removeItem('inookAgentTodos');
  renderResumeGoal(); renderAgentTodos(); renderSessionTasks(); renderGoalClock(); syncAgentSend();
}
document.querySelector('#leaveStudyEnd').onclick = async () => {
  const button = document.querySelector('#leaveStudyEnd');
  if (button.disabled) return;
  button.disabled = true;
  document.querySelector('#leaveStudyError').textContent = '';
  try {
    await window.together?.leave();
    endStudyAndReset(); leaveDialog.close(); leaveDestination();
  } catch (error) {
    document.querySelector('#leaveStudyError').textContent = error.message;
  } finally { button.disabled = false; }
};
document.querySelector("#backButton").addEventListener("click", () => requestLeaveStudy());
document.querySelector("#brandHome").addEventListener("click", (event) => {
  event.preventDefault();
  requestLeaveStudy();
});

document.querySelectorAll("[data-jump]").forEach((button) => {
  button.addEventListener("click", () => {
    if (state.view === 'focus' && button.dataset.jump === 'sound') {
      document.querySelector('#focusSoundPanel').hidden = false;
      return;
    }
    if (state.view === 'focus') {
      requestLeaveStudy(() => { setView('setup'); document.querySelector(`#${button.dataset.jump}Section`)?.scrollIntoView({ block: 'start' }); });
      return;
    }
    setView("setup");
    const target = document.querySelector(`#${button.dataset.jump}Section`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    document.querySelectorAll(".nav-links button").forEach((item) => item.classList.toggle("active", item.dataset.jump === button.dataset.jump));
  });
});

document.querySelector('#prevSceneFocus').remove();
document.querySelector('#nextSceneFocus').remove();
const focusPopovers = ['goalTimeSettings', 'sessionTodos'].map(id => document.getElementById(id));
focusPopovers.forEach(panel => {
  panel.querySelector('summary').addEventListener('click', () => {
    if (!panel.open) focusPopovers.forEach(other => { if (other !== panel) other.open = false; });
  });
});

durationButtons.querySelectorAll("button").forEach((button) => {
  button.addEventListener("click", () => setDuration(Number(button.dataset.minutes)));
});

[musicVolume, ambientVolume].forEach((input) => input.addEventListener("input", () => syncVolumes("setup")));
[dockMusicVolume, dockAmbientVolume].forEach((input) => input.addEventListener("input", () => syncVolumes("dock")));

pauseButton.addEventListener("click", () => {
  if (state.running) pauseTimer();
  else startTimer();
});

document.querySelector("#focusModeButton").addEventListener("click", () => {
  document.querySelector('#focusSoundPanel').hidden = true;
  toggleAgent(false);
  app.classList.toggle("is-focus-minimal");
  document.querySelector('#sessionTodos').open = false;
  document.querySelector('#goalTimeSettings').open = false;
});
document.querySelector('#leaveFocusMode').addEventListener('click', () => app.classList.remove('is-focus-minimal'));
document.querySelector('#closeFocusSound').addEventListener('click', () => { document.querySelector('#focusSoundPanel').hidden = true; });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    app.classList.remove('is-focus-minimal');
    document.querySelector('#focusSoundPanel').hidden = true;
  }
});
document.querySelector("#agentButton").addEventListener("click", () => toggleAgent());
document.querySelector("#agentCloseButton").addEventListener("click", () => toggleAgent(false));
document.querySelector('#agentSendButton').addEventListener('click', generateAgentTodos);
document.querySelector('#startAgentPlan').addEventListener('click', () => {
  if (window.together?.canEditGoal && !window.together.canEditGoal()) return;
  const first = state.agentTodos.find(task => !task.done);
  if (!first) return;
  for (let i = sessionTasks.length - 1; i >= 0; i--) {
    const task = sessionTasks[i];
    if (unconfirmedPlan && !task.done && task.text !== timedGoalText && previousPlanTexts.includes(task.text)) sessionTasks.splice(i, 1);
  }
  unconfirmedPlan = false; previousPlanTexts = [];
  importSessionTasks(); useTaskAsGoal(first);
  document.querySelector('#goalTimeSettings').open = false;
  document.querySelector('#sessionTodos').open = true;
});
document.querySelector('#sessionTodos').addEventListener('toggle', event => {
  if (event.target.open) toggleAgent(false, false);
});
agentPromptInput.addEventListener('input', syncAgentSend);
agentPromptInput.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
    event.preventDefault();
    if (!agentController && agentPromptInput.value.trim()) generateAgentTodos();
  }
});
function useTaskAsGoal(firstOpenTodo) {
  if (!firstOpenTodo) return;
  if (window.together?.canEditGoal && !window.together.canEditGoal()) return;
  state.goal = firstOpenTodo.text;
  setupGoalInput.value = state.goal;
  goalInput.value = state.goal;
  agentPromptInput.value = state.goal;
  localStorage.setItem("inookGoal", state.goal);
  localStorage.setItem('inookPendingGoal', state.goal);
  timedGoalText = state.goal;
  const minutes = firstOpenTodo.minutes;
  if (minutes) { document.querySelector('#manualGoalMinutes').value = minutes; goalClock.start(minutes, state.running); }
  else goalClock.clear();
  importSessionTasks();
  renderGoalClock();
  toggleAgent(false);
  goalInput.focus();
}
document.querySelector('#applyGoalMinutes').addEventListener('click', () => {
  const input = document.querySelector('#manualGoalMinutes');
  if (!input.reportValidity()) return;
  if (!goalInput.value.trim()) { goalInput.focus(); return; }
  timedGoalText = goalInput.value.trim();
  goalClock.start(Number(input.value), state.running);
  document.querySelector('#goalTimeSettings').open = false;
  renderGoalClock();
});
function adjustSessionTime(delta) {
  const next = Math.max(60, Math.min(state.remaining + Math.max(0, (180 - state.minutes) * 60), state.remaining + delta));
  const difference = next - state.remaining;
  state.remaining = next;
  state.minutes += difference / 60;
  renderTimer();
}
for (const [id, direction] of [['addSessionTime', 1], ['subtractSessionTime', -1]]) {
  document.querySelector(`#${id}`).addEventListener('click', () => {
    const input = document.querySelector('#sessionAdjustment');
    if (input.reportValidity()) adjustSessionTime(direction * Number(input.value) * 60);
  });
}
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && agentPanel.classList.contains('open')) toggleAgent(false);
});
goalInput.addEventListener('input', () => { goalClock.clear(); timedGoalText = ''; renderGoalClock(); });

setupGoalInput.addEventListener("input", () => syncGoal("setup"));
goalInput.addEventListener("input", () => syncGoal("focus"));
function renderResumeGoal() {
  const pending = localStorage.getItem('inookPendingGoal') || '';
  const button = document.querySelector('#resumeGoalButton');
  button.hidden = !pending;
  button.textContent = `继续上次：${pending}`;
  button.onclick = () => { setupGoalInput.value = pending; syncGoal('setup'); };
}
document.querySelector('#quickStepButton').addEventListener('click', async () => {
  const generation = studyGeneration;
  if (quickController) { quickController.abort(); return; }
  const prompt = setupGoalInput.value.trim();
  if (!prompt) return;
  const status = document.querySelector('#quickStatus');
  const button = document.querySelector('#quickStepButton');
  quickController = new AbortController();
  button.textContent = '取消'; status.textContent = 'AI 智能规划中…'; status.setAttribute('aria-busy', 'true');
  document.querySelector('#quickSuggestion').hidden = true;
  try {
    const result = await requestAI('quick', prompt, quickController.signal);
    if (generation !== studyGeneration) return;
    pendingPlan = result;
    document.querySelector('#quickStepText').textContent = [result.answer, ...(result.assumptions || []).map(s => `假设：${s}`), result.question].filter(Boolean).join('\n');
    document.querySelector('#quickPlanSteps').replaceChildren(...result.steps.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
    document.querySelector('#useQuickStep').hidden = !result.steps.length;
    document.querySelector('#quickSuggestion').hidden = false;
    status.textContent = '';
  } catch (error) { if (generation === studyGeneration) status.textContent = error.name === 'AbortError' ? '' : error.message; }
  finally { if (generation === studyGeneration) { quickController = null; status.setAttribute('aria-busy', 'false'); button.textContent = `规划这 ${state.minutes} 分钟`; } }
});
document.querySelector('#useQuickStep').addEventListener('click', () => {
  if (!pendingPlan?.steps.length) return;
  state.agentTodos = pendingPlan.steps.map((text, index) => ({ text, done: false, minutes: pendingPlan.plan?.[index]?.minutes || 15 }));
  importSessionTasks();
  renderAgentTodos();
  setupGoalInput.value = pendingPlan.answer;
  syncGoal('setup');
});
document.querySelector('#dismissQuickStep').addEventListener('click', () => { document.querySelector('#quickSuggestion').hidden = true; });
renderResumeGoal();
document.querySelectorAll("#reviewActions button").forEach((button) => {
  button.addEventListener("click", () => {
    state.reviewResult = button.dataset.result;
    reviewResult.textContent = resultLabel(state.reviewResult);
    document.querySelectorAll("#reviewActions button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
  });
});
document.querySelector("#saveReviewButton").addEventListener("click", saveReview);

window.ambientMixer.onChange(() => {
  document.querySelector("#ambientLabel").textContent = window.ambientMixer.summary();
  if (state.view === "setup" && !state.previewing && window.ambientMixer.hasActive()) startPreview();
});
renderScenes();
renderSoundStyles();
updateBackdrop();
applySceneSound();
syncGoal("setup");
renderAgentTodos();
renderTimer();
window.snowBgm.prepare();
