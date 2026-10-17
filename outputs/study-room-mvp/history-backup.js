(function (root) {
  function mergeHistory(current, incoming) {
    const valid = value => value && typeof value === 'object' && !Array.isArray(value);
    if (!valid(incoming) || incoming.version !== 1 || !valid(incoming.calendar)) throw new Error('不是有效的栖页记录备份');
    const calendar = {};
    for (const data of [current.calendar, incoming.calendar]) {
      for (const [day, entry] of Object.entries(data || {})) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !valid(entry) || !Array.isArray(entry.sessions)) throw new Error('打卡记录格式不正确');
        const old = calendar[day] || { manual: false, sessions: [] };
        const sessions = new Map(old.sessions.map(s => [JSON.stringify(s), s]));
        for (const session of entry.sessions) {
          if (!valid(session) || !Number.isFinite(session.minutes) || session.minutes < 0 || typeof session.goal !== 'string') throw new Error('专注记录格式不正确');
          sessions.set(JSON.stringify(session), session);
        }
        calendar[day] = { manual: old.manual || Boolean(entry.manual), sessions: [...sessions.values()] };
      }
    }
    let companion = current.companion;
    if (incoming.companion != null) {
      const b = incoming.companion;
      if (!valid(b) || !valid(b.days) || !Number.isInteger(b.feeds) || b.feeds < 0 || !Number.isInteger(b.food) || b.food < 0) throw new Error('伙伴记录格式不正确');
      for (const [day, entry] of Object.entries(b.days)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !valid(entry) || !Number.isFinite(entry.seconds) || entry.seconds < 0 || !Number.isInteger(entry.earned) || entry.earned < 0 || entry.earned > 2 || !Number.isFinite(entry.target)) throw new Error('伙伴每日记录格式不正确');
      }
      const a = companion || { days: {}, food: 0, feeds: 0 };
      const days = { ...a.days };
      for (const [day, entry] of Object.entries(b.days)) {
        const old = days[day];
        days[day] = old ? { ...old, seconds: Math.max(old.seconds, entry.seconds), earned: Math.max(old.earned, entry.earned) } : entry;
      }
      const feeds = Math.max(a.feeds, b.feeds);
      const earned = Math.max(a.food + a.feeds, b.food + b.feeds, Object.values(days).reduce((sum, entry) => sum + entry.earned, 0));
      companion = { ...b, ...a, days, feeds, food: Math.max(0, earned - feeds), lastEnd: Math.max(a.lastEnd || 0, b.lastEnd || 0),
        adoptedOn: [a.adoptedOn, b.adoptedOn, ...Object.keys(days)].filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s || '')).sort()[0] };
      if (a.pets || b.pets) {
        const legacyPets = s => s.pets || (s.adoptedOn || s.feeds || Object.keys(s.days).length ? { qi: { growth: s.feeds * 10, feeds: s.feeds, adoptedOn: s.adoptedOn } } : {});
        const pets = { ...legacyPets(a) };
        for (const [id, pet] of Object.entries(legacyPets(b))) {
          const old = pets[id];
          pets[id] = old ? { ...old, growth: Math.max(old.growth, pet.growth), feeds: Math.max(old.feeds, pet.feeds) } : pet;
        }
        companion.pets = pets;
        companion.feeds = Object.values(pets).reduce((sum, p) => sum + p.feeds, 0);
        companion.food = Math.max(0, earned - companion.feeds);
        const selected = !Object.keys(legacyPets(a)).length || (b.selectedAt || 0) > (a.selectedAt || 0) ? b : a;
        companion.activePet = 'activePet' in selected ? selected.activePet : Object.keys(pets)[0] || null;
        companion.selectedAt = selected.selectedAt || 0;
      }
    }
    return { version: 1, calendar, companion };
  }
  if (typeof module !== 'undefined') { module.exports = { mergeHistory }; return; }
  root.mergeQiyeHistory = mergeHistory;
})(typeof window === 'undefined' ? globalThis : window);
