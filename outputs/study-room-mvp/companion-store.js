(function (root) {
  const key = 'inookCompanionV1';
  const dayKey = time => { const d = new Date(time); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const growthPerFeed = 10, adultGrowth = 100;
  const dayNumber = day => {
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return NaN;
    const time = Date.parse(`${day}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === day ? time / 86400000 : NaN;
  };
  function fresh(now = Date.now()) { return { days: {}, food: 0, feeds: 0, target: 60, visible: true, lastEnd: 0, adoptedOn: dayKey(now) }; }
  function adoptedDay(state, now) {
    const dates = [state.adoptedOn, ...Object.keys(state.days), dayKey(now)].filter(day => Number.isFinite(dayNumber(day)));
    return dates.sort()[0];
  }
  function progress(state, now = Date.now()) {
    const growth = Math.max(0, Math.floor(state.feeds)) * growthPerFeed;
    return { growth, adult: growth >= adultGrowth, remaining: Math.max(0, adultGrowth - growth),
      days: Math.max(1, dayNumber(dayKey(now)) - dayNumber(adoptedDay(state, now)) + 1) };
  }
  function read(storage, now = Date.now()) {
    const raw = storage.getItem(key);
    if (!raw) return fresh(now);
    const value = JSON.parse(raw);
    if (!value || !value.days || !Number.isFinite(value.food) || !Number.isFinite(value.feeds)) throw new Error('Invalid companion record');
    return { ...fresh(now), ...value, adoptedOn: adoptedDay(value, now) };
  }
  function today(state, time) {
    const day = dayKey(time);
    return state.days[day] ||= { seconds: 0, earned: 0, target: state.target };
  }
  function reward(state, entry) {
    const earned = Number(entry.seconds >= 1500) + Number(entry.seconds >= entry.target * 60);
    if (earned > entry.earned) { state.food += earned - entry.earned; entry.earned = earned; }
  }
  function reduce(previous, action, now = Date.now()) {
    const state = JSON.parse(JSON.stringify(previous));
    state.adoptedOn = adoptedDay(state, now);
    const entry = today(state, now);
    if (action.type === 'tick') {
      const { start, end } = action;
      // Ignore sleep gaps and union overlapping ticks from multiple study tabs.
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 5000 || end > now) return state;
      let cursor = Math.max(start, state.lastEnd);
      while (cursor < end) {
        const boundary = new Date(cursor); boundary.setHours(24, 0, 0, 0);
        const stop = Math.min(end, boundary.getTime());
        const day = today(state, cursor);
        day.seconds += (stop - cursor) / 1000; reward(state, day); cursor = stop;
      }
      state.lastEnd = Math.max(state.lastEnd, end);
    } else if (action.type === 'target') {
      if (!Number.isInteger(action.minutes) || action.minutes < 30 || action.minutes > 240) throw new Error('目标请设为 30～240 分钟。');
      state.target = action.minutes;
      if (entry.earned < 2) { entry.target = action.minutes; reward(state, entry); }
    } else if (action.type === 'feed') {
      if (state.food < 1) throw new Error('还没有食物，完成今天的第一段专注就能获得。');
      state.food--; state.feeds++;
    } else if (action.type === 'visible') state.visible = Boolean(action.value);
    return state;
  }
  const api = { key, dayKey, fresh, read, reduce, progress, growthPerFeed, adultGrowth };
  if (typeof module !== 'undefined') module.exports = api; else root.InookCompanionStore = api;
})(typeof window === 'undefined' ? globalThis : window);
