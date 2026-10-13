(function (root) {
  function createCalendarStore(storage) {
    const prefix = 'inookCalendarDay:';
    const valid = day => /^\d{4}-\d{2}-\d{2}$/.test(day);
    const normalize = entry => entry && typeof entry === 'object' ? { manual: Boolean(entry.manual), sessions: Array.isArray(entry.sessions) ? entry.sessions : [] } : null;
    function read() {
      const days = {};
      try {
        const legacy = JSON.parse(storage.getItem('inookCalendarV1') || '{}');
        for (const [day, entry] of Object.entries(legacy || {})) if (valid(day) && normalize(entry)) days[day] = normalize(entry);
      } catch { /* Keep independent day records readable even if the legacy record is damaged. */ }
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key?.startsWith(prefix) || !valid(key.slice(prefix.length))) continue;
        try { const entry = normalize(JSON.parse(storage.getItem(key))); if (entry) days[key.slice(prefix.length)] = entry; } catch { /* Ignore only the damaged day. */ }
      }
      return days;
    }
    function update(day, change) {
      if (!valid(day)) throw new Error('Invalid date');
      const entry = change(read()[day] || { manual: false, sessions: [] });
      storage.setItem(prefix + day, JSON.stringify(entry));
      return read();
    }
    return { read, update };
  }
  if (typeof module !== 'undefined') module.exports = createCalendarStore;
  else root.createCalendarStore = createCalendarStore;
})(typeof window === 'undefined' ? globalThis : window);
