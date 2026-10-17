(() => {
  let account = null, revision = 0, last = '', busy = false, ready = false;
  const read = () => ({ version: 1, calendar: createCalendarStore(localStorage).read(), companion: InookCompanionStore.read(localStorage) });
  const notice = document.createElement('p'); notice.id = 'historySyncStatus'; notice.setAttribute('role', 'status');
  document.querySelector('#focusCalendar').append(notice);
  async function api(name, body) {
    const response = await fetch(`/api/personal/${name}`, body ? { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
    const result = await response.json(); if (!response.ok) throw new Error(result.error || '暂时未能同步'); return result;
  }
  function apply(data) {
    for (const [day, entry] of Object.entries(data.calendar)) localStorage.setItem(`inookCalendarDay:${day}`, JSON.stringify(entry));
    if (data.companion) localStorage.setItem(InookCompanionStore.key, JSON.stringify(data.companion));
    window.dispatchEvent(new StorageEvent('storage', { key: InookCompanionStore.key }));
  }
  async function connect(id) {
    if (id === account && ready) return;
    const previous = account;
    account = id; ready = false;
    if (!id) {
      if (previous) {
        localStorage.setItem(`qiyeHistoryDraft:${previous}`, JSON.stringify(read()));
        for (const key of Object.keys(localStorage)) if (key.startsWith('inookCalendarDay:') || key === 'inookCalendarV1' || key === InookCompanionStore.key) localStorage.removeItem(key);
        localStorage.setItem('qiyeHistoryOwner', 'guest');
        window.dispatchEvent(new StorageEvent('storage', { key: InookCompanionStore.key }));
      }
      notice.textContent = '登录后可保存打卡与成长记录'; return;
    }
    try {
      const owner = localStorage.getItem('qiyeHistoryOwner');
      if (owner && owner !== id) {
        localStorage.setItem(`qiyeHistoryDraft:${owner}`, JSON.stringify(read()));
        for (const key of Object.keys(localStorage)) if (key.startsWith('inookCalendarDay:') || key === 'inookCalendarV1' || key === InookCompanionStore.key) localStorage.removeItem(key);
        const parked = localStorage.getItem(`qiyeHistoryDraft:${id}`); if (parked) apply(JSON.parse(parked));
      }
      localStorage.setItem('qiyeHistoryOwner', id);
      const remote = await api('history'); if (account !== id || remote.account !== id) return;
      await navigator.locks.request('inook-companion', () => { if (remote.data) apply(mergeQiyeHistory(read(), remote.data)); });
      revision = remote.revision; last = remote.data ? JSON.stringify(remote.data) : ''; ready = true; notice.textContent = ''; await sync();
    } catch { notice.textContent = '记录已留在本机，后台暂未同步'; }
  }
  async function sync() {
    if (!ready || busy || !account) return;
    const id = account;
    try {
      const data = read(), serialized = JSON.stringify(data); if (serialized === last) return;
      busy = true;
      const result = await api('history', { account: id, revision, data });
      if (account !== id) return;
      revision = result.revision; last = serialized; notice.textContent = '';
    } catch { ready = false; notice.textContent = '记录已留在本机，后台暂未同步'; }
    finally { busy = false; }
  }
  window.qiyePersonal = { api, account: () => account, sync };
  window.addEventListener('inook:account-profile', event => connect(event.detail?.id || null));
  setInterval(() => ready ? sync() : account && connect(account), 15000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) sync(); });
  fetch('/api/auth/me').then(r => r.json()).then(r => connect(r.user?.id || null)).catch(() => {});
})();
