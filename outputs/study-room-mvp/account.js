(() => {
  let mode = 'login', kind = 'email', user = null, busy = false;
  let picking = false, selectedAvatar = 'bear', afterAuth = null, requiredLogin = false, pendingLogin = null;
  const avatars = { bear: ['0% 0%', '小熊'], dog: ['50% 0%', '小狗'], cat: ['100% 0%', '小猫'], mouse: ['0% 100%', '小鼠'], rabbit: ['50% 100%', '小兔'], panda: ['100% 100%', '熊猫'] };
  const entry = document.querySelector('#openAccount');
  const dialog = document.createElement('dialog'); dialog.id = 'accountDialog'; dialog.setAttribute('aria-labelledby', 'accountTitle');
  dialog.innerHTML = `<header><div><small>栖页 · 留一点时间给自己</small><h2 id="accountTitle">欢迎回来</h2></div><button type="button" id="closeAccount" title="关闭" aria-label="关闭账号窗口">×</button></header>
    <div id="accountLoggedIn" hidden><p id="accountName"></p><p id="accountIdentity"></p><p class="account-note">手机号 / 邮箱尚未验证。学习记录保存在当前浏览器，暂不随账号同步。</p><button id="logoutAccount">退出登录</button></div>
    <div id="accountGuest"><div class="account-modes"><button type="button" data-auth-mode="login" aria-pressed="true">登录</button><button type="button" data-auth-mode="register" aria-pressed="false">注册</button></div>
    <div class="account-kinds"><button type="button" data-auth-kind="email" aria-pressed="true">邮箱</button><button type="button" data-auth-kind="phone" aria-pressed="false">手机号</button></div>
    <form id="accountForm">
      <label id="nicknameField" hidden>昵称<input id="accountNickname" autocomplete="nickname" maxlength="24" placeholder="怎么称呼你" /></label>
      <label><span id="identityLabel">邮箱地址</span><input id="accountIdentifier" type="email" autocomplete="username" maxlength="254" required placeholder="you@example.com" /></label>
      <small id="phoneHelp" hidden>中国大陆号码可直接填写；其他地区请加国家区号，如 +1。</small>
      <label>密码<div class="account-password"><input id="accountPassword" type="password" autocomplete="current-password" minlength="10" maxlength="128" required placeholder="10–128个字符" /><button type="button" id="showPassword" aria-label="显示密码" title="显示密码">显示</button></div></label>
      <label id="confirmField" hidden>确认密码<input id="accountConfirm" type="password" autocomplete="new-password" maxlength="128" placeholder="再次输入密码" /></label>
      <div class="account-options"><label><input id="rememberAccount" type="checkbox" checked />保持登录7天</label><button type="button" id="forgotPassword">忘记密码？</button></div>
      <p id="registrationNote" class="account-note" hidden>本地体验版暂不验证手机号或邮箱归属，也暂不支持找回密码。请使用测试账号，不要填写常用密码。</p>
      <button type="submit" id="submitAccount" class="account-primary">登录</button>
    </form><button type="button" id="continueGuest">先逛逛，暂不登录</button></div>
    <p id="accountStatus" role="status"></p>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  $('#accountLoggedIn').insertAdjacentHTML('afterbegin', '<button id="editAvatar" aria-label="更换头像" title="更换头像"></button>');
  $('#accountGuest').insertAdjacentHTML('afterend', `<section id="avatarPicker" hidden><p class="account-note">选一个喜欢的头像</p><div class="avatar-grid">${Object.entries(avatars).map(([key, [position, name]]) => `<button type="button" data-avatar="${key}" aria-label="${name}" title="${name}"><span class="avatar-illustration" style="background-position:${position}" aria-hidden="true"></span></button>`).join('')}</div><label class="avatar-upload">上传自己的图片<input id="avatarFile" type="file" accept="image/jpeg,image/png,image/webp" /></label><div id="avatarPreview"></div><button id="saveAvatar" class="account-primary">保存头像</button><button id="skipAvatar">稍后再选</button></section>`);
  function paintAvatar(element, value) {
    element.replaceChildren();
    if (value?.startsWith('data:image/jpeg;base64,')) { const img = document.createElement('img'); img.src = value; img.alt = ''; element.append(img); }
    else if (avatars[value]) {
      const portrait = document.createElement('span');
      portrait.className = 'avatar-illustration'; portrait.style.backgroundPosition = avatars[value][0];
      portrait.setAttribute('role', 'img'); portrait.setAttribute('aria-label', avatars[value][1]);
      element.append(portrait);
    }
    else { const silhouette = document.createElement('span'); silhouette.className = 'avatar-silhouette'; element.append(silhouette); }
  }
  function renderPicker() {
    paintAvatar($('#avatarPreview'), selectedAvatar);
    dialog.querySelectorAll('[data-avatar]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.avatar === selectedAvatar)));
  }
  function render() {
    $('#continueGuest').hidden = requiredLogin;
    $('#accountTitle').textContent = picking ? '给自己选个头像' : user ? '你的账号' : mode === 'login' ? '欢迎回来' : '认识一下，新的朋友';
    $('#accountLoggedIn').hidden = !user || picking; $('#accountGuest').hidden = Boolean(user) || picking;
    $('#avatarPicker').hidden = !picking;
    paintAvatar(entry, user?.avatar); paintAvatar($('#editAvatar'), user?.avatar);
    window.dispatchEvent(new CustomEvent('inook:account-profile', { detail: user ? { id: user.id, name: user.name, avatar: user.avatar } : null }));
    entry.title = user ? '查看账号' : '登录或注册';
    entry.setAttribute('aria-label', user ? `${user.name}的账号` : '登录或注册');
    if (user) { $('#accountName').textContent = user.name; $('#accountIdentity').textContent = user.identity; const roomName = document.querySelector('#friendName'); if (roomName && !roomName.value) roomName.value = user.name; }
    for (const button of dialog.querySelectorAll('[data-auth-mode]')) button.setAttribute('aria-pressed', String(button.dataset.authMode === mode));
    for (const button of dialog.querySelectorAll('[data-auth-kind]')) button.setAttribute('aria-pressed', String(button.dataset.authKind === kind));
    const register = mode === 'register';
    $('#nicknameField').hidden = !register; $('#accountNickname').required = register;
    $('#confirmField').hidden = !register; $('#accountConfirm').required = register;
    $('#registrationNote').hidden = !register; $('#forgotPassword').hidden = register;
    $('#accountPassword').autocomplete = register ? 'new-password' : 'current-password';
    $('#identityLabel').textContent = kind === 'email' ? '邮箱地址' : '手机号';
    $('#accountIdentifier').type = kind === 'email' ? 'email' : 'tel';
    $('#accountIdentifier').placeholder = kind === 'email' ? 'you@example.com' : '请输入手机号';
    $('#phoneHelp').hidden = kind !== 'phone';
    $('#submitAccount').textContent = register ? '注册并登录' : '登录';
  }
  async function api(path, body) {
    const response = await fetch(`/api/auth/${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error === '接口不存在' ? '账号服务尚未启动，请使用新版地址或重启本地服务。' : data.error || '暂时无法连接，请稍后重试。');
    return data;
  }
  function lock(value) {
    busy = value;
    dialog.querySelectorAll('input, button').forEach(control => { control.disabled = value; });
  }
  entry.onclick = async () => {
    $('#accountStatus').textContent = ''; render(); dialog.showModal();
    try { user = (await api('me')).user; render(); } catch (error) { $('#accountStatus').textContent = error.message; }
  };
  $('#closeAccount').onclick = () => dialog.close();
  $('#continueGuest').onclick = () => { const next = afterAuth; afterAuth = null; dialog.close(); next?.(); };
  dialog.addEventListener('close', () => { pendingLogin?.(false); pendingLogin = null; requiredLogin = false; picking = false; afterAuth = null; $('#accountPassword').value = ''; $('#accountConfirm').value = ''; render(); });
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.querySelectorAll('[data-auth-mode]').forEach(button => button.onclick = () => { mode = button.dataset.authMode; $('#accountStatus').textContent = ''; $('#accountConfirm').setCustomValidity(''); render(); });
  dialog.querySelectorAll('[data-auth-kind]').forEach(button => button.onclick = () => { kind = button.dataset.authKind; $('#accountIdentifier').value = ''; $('#accountStatus').textContent = ''; render(); });
  $('#showPassword').onclick = () => { const show = $('#accountPassword').type === 'password'; $('#accountPassword').type = show ? 'text' : 'password'; $('#showPassword').textContent = show ? '隐藏' : '显示'; $('#showPassword').setAttribute('aria-label', show ? '隐藏密码' : '显示密码'); };
  $('#forgotPassword').onclick = () => { $('#accountStatus').textContent = '找回密码需要短信或邮件验证，目前尚未开通。'; };
  $('#accountConfirm').oninput = $('#accountPassword').oninput = () => $('#accountConfirm').setCustomValidity('');
  $('#accountForm').onsubmit = async event => {
    event.preventDefault(); if (busy) return;
    if (mode === 'register' && $('#accountPassword').value !== $('#accountConfirm').value) { $('#accountConfirm').setCustomValidity('两次输入的密码不一致'); $('#accountConfirm').reportValidity(); return; }
    lock(true); $('#accountStatus').textContent = mode === 'login' ? '正在登录…' : '正在创建账号…';
    try {
      user = (await api(mode, { kind, identity: $('#accountIdentifier').value, password: $('#accountPassword').value, name: $('#accountNickname').value, remember: $('#rememberAccount').checked })).user;
      $('#accountPassword').value = ''; $('#accountConfirm').value = '';
      picking = mode === 'register'; selectedAvatar = 'bear'; renderPicker(); render(); $('#accountStatus').textContent = '';
      if (!picking && afterAuth) { const next = afterAuth; afterAuth = null; dialog.close(); next(); }
    } catch (error) { $('#accountStatus').textContent = error.message; }
    finally { lock(false); }
  };
  $('#logoutAccount').onclick = async () => {
    lock(true);
    try { await api('logout', {}); user = null; mode = 'login'; render(); $('#accountStatus').textContent = '已退出登录。'; }
    catch (error) { $('#accountStatus').textContent = error.message; }
    finally { lock(false); }
  };
  api('me').then(data => { user = data.user; render(); }).catch(() => {});
  function finishAvatar() { picking = false; render(); if (afterAuth) { const next = afterAuth; afterAuth = null; dialog.close(); next(); } }
  $('#editAvatar').onclick = () => { picking = true; selectedAvatar = user.avatar || 'bear'; renderPicker(); render(); };
  dialog.querySelectorAll('[data-avatar]').forEach(button => button.onclick = () => { selectedAvatar = button.dataset.avatar; renderPicker(); });
  $('#skipAvatar').onclick = finishAvatar;
  $('#saveAvatar').onclick = async () => {
    lock(true); $('#accountStatus').textContent = '';
    try { user = (await api('avatar', { avatar: selectedAvatar })).user; finishAvatar(); }
    catch (error) { $('#accountStatus').textContent = error.message; }
    finally { lock(false); }
  };
  $('#avatarFile').onchange = async event => {
    const file = event.target.files[0]; if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { $('#accountStatus').textContent = '请选择5MB以内的 JPG、PNG 或 WebP 图片。'; return; }
    lock(true);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 192;
      const side = Math.min(bitmap.width, bitmap.height);
      canvas.getContext('2d').drawImage(bitmap, (bitmap.width-side)/2, (bitmap.height-side)/2, side, side, 0, 0, 192, 192); bitmap.close();
      selectedAvatar = canvas.toDataURL('image/jpeg', .82); renderPicker(); $('#accountStatus').textContent = '';
    } catch { $('#accountStatus').textContent = '这张图片无法读取，请换一张。'; }
    finally { lock(false); event.target.value = ''; }
  };
  window.inookAccount = {
    paintAvatar,
    profile: () => user ? { name: user.name, avatar: user.avatar } : null,
    async requireLogin() {
      try { user = (await api('me')).user; } catch { user = null; }
      render();
      if (user) return true;
      requiredLogin = true; mode = 'login'; render();
      $('#accountStatus').textContent = '登录后开始学习，将使用你的账号昵称。';
      if (!dialog.open) dialog.showModal();
      return new Promise(resolve => {
        pendingLogin = resolve;
        afterAuth = () => { pendingLogin = null; requiredLogin = false; resolve(true); };
      });
    }
  };
  render();
})();
