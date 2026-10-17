(function (root) {
  const key = 'qiyeTaskInbox.v1';
  const normalize = text => text.trim().replace(/\s+/g, ' ').toLowerCase();
  const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(new Date(`${value}T12:00:00`)) === value;
  function parse(text) {
    const rows = []; let current, group, skip = false;
    const lines = text.replace(/\r/g, '').split('\n');
    const hasBullets = lines.some(line => /^\s*(?:[-*+]\s|\d+[.)、]\s)/.test(line));
    const reference = /^(?:(?:[一二三四五六七八九十\d]+)[、.．)）]\s*)?(?:预期成果|交付物|作业目标|项目目标|预期产出|总结|expected outcomes?|deliverables?|objectives?)\s*[:：]?/i;
    for (const raw of lines) {
      const line = raw.trim().replace(/\*\*(.*?)\*\*/g, '$1');
      if (!line || /^```|^\|?[\s:|-]+\|?$/.test(line)) continue;
      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      const numberedHeading = line.match(/^([一二三四五六七八九十]+[、．])\s*(.+)$/);
      if (heading || numberedHeading) {
        const title = (heading ? heading[2] : numberedHeading[2]).replace(/^[一二三四五六七八九十\d]+[、.．)）]\s*/, '');
        skip = reference.test(title); current = null; group = null;
        if (!skip && (numberedHeading || heading[1].length >= 2)) group = { text: title.slice(0, 300), notes: '', minutes: null, source: 'paste', original: text };
        continue;
      }
      if (reference.test(line)) { skip = true; group = null; current = null; continue; }
      if (skip) continue;
      const cells = line.startsWith('|') ? line.split('|').slice(1, -1).map(s => s.trim()) : null;
      if (cells && cells.some(s => /^(任务|事项|步骤|task|时间|时长)$/i.test(s))) continue;
      const bullet = /^(?:[-*+]\s+(?:\[[ xX]\]\s*)?|\d+[.)、]\s*)/;
      if (current && !cells && !bullet.test(line) && /^\s+/.test(raw)) {
        current.notes += (current.notes ? '\n' : '') + line; continue;
      }
      const content = (cells ? cells.join(' · ') : line.replace(bullet, '')).replace(/\*\*(.*?)\*\*/g, '$1');
      if (!content) continue;
      if (group) {
        if (!rows.includes(group)) rows.push(group);
        if (!group.notes.split('\n').includes(content)) group.notes += (group.notes ? '\n' : '') + content;
        current = group; continue;
      }
      if (hasBullets && !cells && !bullet.test(line)) continue;
      const duration = content.match(/(?:预计|用时|约)?\s*(\d{1,3})\s*(?:分钟|mins?\b|minutes?\b)/i);
      const range = /\d+\s*[-–—~至到]\s*\d+\s*(?:分钟|mins?\b|minutes?\b)/i.test(content);
      const minutes = !range && duration && Number(duration[1]) >= 1 && Number(duration[1]) <= 180 ? Number(duration[1]) : null;
      current = { text: content.slice(0, 300), notes: content.length > 300 ? content : '', minutes, source: 'paste' };
      rows.push(current);
    }
    return rows.filter((row, index) => rows.findIndex(other => normalize(other.text) === normalize(row.text)) === index);
  }
  function create(storage, uuid = () => root.crypto.randomUUID()) {
    function read() {
      const raw = storage.getItem(key);
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) throw new Error('待办数据无法读取，请勿清除浏览器数据。');
      const items = data.filter(t => t && typeof t.id === 'string' && typeof t.text === 'string');
      if (items.some(t => !validDate(t.date))) {
        for (const item of items) if (!validDate(item.date)) item.date = dateKey();
        write(items);
      }
      return items;
    }
    function write(items) { storage.setItem(key, JSON.stringify(items)); }
    return {
      read,
      add(drafts) {
        const items = read(); let added = 0, duplicates = 0;
        for (const draft of drafts) {
          if (!draft.text.trim()) continue;
          const date = validDate(draft.date) ? draft.date : dateKey();
          if (items.some(t => !t.done && (t.date || dateKey()) === date && normalize(t.text) === normalize(draft.text))) { duplicates++; continue; }
          items.push({ ...draft, date, text: draft.text.trim(), id: uuid(), done: false, selected: false }); added++;
        }
        write(items); return { added, duplicates };
      },
      update(id, change) {
        const items = read(), task = items.find(t => t.id === id);
        if (task?.done && task.completedAt && Date.now() >= task.completedAt + 3000 && change.done === false) throw new Error('撤销时间已结束');
        if (task) Object.assign(task, change); write(items);
      },
      sync(tasks) {
        const items = read();
        for (const task of tasks.filter(t => !t.fromRoom)) {
          task.id ||= uuid();
          const found = items.find(t => t.id === task.id);
          if (found?.done && found.completedAt && Date.now() >= found.completedAt + 3000) Object.assign(task, found);
          task.date ||= found?.date || dateKey();
          if (found) Object.assign(found, task, { selected: !task.done });
          else items.push({ ...task, selected: !task.done });
        }
        const ids = new Set(tasks.filter(t => !t.fromRoom).map(t => t.id));
        for (const item of items) if (!ids.has(item.id)) item.selected = false;
        write(items);
      }
    };
  }
  const api = { parse, create, dateKey, validDate };
  if (typeof module !== 'undefined') module.exports = api;
  else root.QiyeTasks = api;
})(globalThis);
