(function (root) {
  const key = 'inookCompanionV1';
  const dayKey = time => { const d = new Date(time); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const growthPerFeed = 2, adultGrowth = 100;
  const catalog = { qi: { name: '小栖', kind: '银渐层', species: '猫' }, mimo: { name: 'mimo', kind: '金渐层', species: '猫' }, beagle: { name: '小比', kind: '比格犬', species: '犬' } };
  function profile(state, id) {
    const pet = state.pets[id];
    if (!pet) return null;
    const birthday = pet.adoptedOn || state.adoptedOn;
    const [, month, day] = birthday.split('-').map(Number);
    const names = ['摩羯座','水瓶座','双鱼座','白羊座','金牛座','双子座','巨蟹座','狮子座','处女座','天秤座','天蝎座','射手座','摩羯座'];
    const boundaries = [20,19,21,20,21,22,23,23,23,24,23,22];
    return { birthday, zodiac: names[month - 1 + Number(day >= boundaries[month - 1])], weight: ((id === 'beagle' ? 1.5 : .6) + Math.min(pet.growth,100) / 100 * (id === 'beagle' ? 8.5 : 3.6)).toFixed(2) };
  }
  function normalize(value) {
    const state = JSON.parse(JSON.stringify(value));
    if (!state.pets) {
      state.pets = { qi: { growth: state.feeds * 10, feeds: state.feeds, adoptedOn: state.adoptedOn } };
      state.activePet = 'qi';
    }
    return state;
  }
  const checkins = calendar => Object.values(calendar || {}).filter(e => e.manual || e.sessions?.length).length;
  const dayNumber = day => {
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return NaN;
    const time = Date.parse(`${day}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === day ? time / 86400000 : NaN;
  };
  function fresh(now = Date.now()) { return { days: {}, food: 0, feeds: 0, target: 60, visible: true, lastEnd: 0, adoptedOn: dayKey(now), pets: {}, activePet: null }; }
  function adoptedDay(state, now) {
    const dates = [state.adoptedOn, ...Object.keys(state.days), dayKey(now)].filter(day => Number.isFinite(dayNumber(day)));
    return dates.sort()[0];
  }
  function progress(state, now = Date.now()) {
    state = normalize(state);
    const pet = state.pets[state.activePet];
    const growth = pet?.growth || 0;
    return { growth, adult: growth >= adultGrowth, remaining: Math.max(0, adultGrowth - growth),
      days: Math.max(1, dayNumber(dayKey(now)) - dayNumber(pet?.adoptedOn || adoptedDay(state, now)) + 1) };
  }
  function read(storage, now = Date.now()) {
    const raw = storage.getItem(key);
    if (!raw) return fresh(now);
    const value = JSON.parse(raw);
    if (!value || !value.days || !Number.isFinite(value.food) || !Number.isFinite(value.feeds)) throw new Error('Invalid companion record');
    return normalize({ ...value, adoptedOn: adoptedDay(value, now), target: value.target || 60 });
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
    const state = normalize(previous);
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
    } else if (action.type === 'choose' || action.type === 'adopt-pet') {
      if (!catalog[action.pet]) throw new Error('请选择一位伙伴。');
      if (!state.pets[action.pet]) {
        const capacity = checkins(action.calendar) >= 30 ? 2 : 1;
        if (Object.keys(state.pets).length >= capacity) throw new Error('累计打卡满 30 天，可以领养第二位伙伴。');
        state.pets[action.pet] = { growth: 0, feeds: 0, adoptedOn: dayKey(now) };
      }
      if (action.type === 'choose') { state.activePet = action.pet; state.selectedAt = now; }
    } else if (action.type === 'feed') {
      const pet = state.pets[action.pet || state.activePet];
      if (!pet) throw new Error('先选一位想陪伴你的伙伴吧。');
      if (state.food < 1) throw new Error('还没有食物，完成今天的第一段专注就能获得。');
      state.food--; state.feeds++;
      pet.feeds++; pet.growth += growthPerFeed;
    } else if (action.type === 'visible') state.visible = Boolean(action.value);
    return state;
  }
  const api = { key, dayKey, fresh, read, reduce, progress, growthPerFeed, adultGrowth, catalog, normalize, checkins, profile };
  if (typeof module !== 'undefined') module.exports = api; else root.InookCompanionStore = api;
})(typeof window === 'undefined' ? globalThis : window);
