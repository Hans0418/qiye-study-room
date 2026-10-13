// Keep the YouTube track independent from the local ambient audio graph.
window.snowBgm = (() => {
  let player, ready = false, loading = false, failed = false;
  let desired = false, volume = 38, position = 0, host = null;
  let generation = 0, loadTimeout;
  let videoId = 'bfVH3FgXtmE';
  const positions = {};
  const status = () => host?.querySelector('.bgm-status');
  const message = (text) => {
    if (status()) status().textContent = text;
    document.querySelector('#bgmPlaybackStatus').textContent = text;
    document.querySelector('#bgmPlaybackStatus').dataset.attention = String(/无法|暂停了|较慢/.test(text));
  };
  const retry = document.querySelector('#bgmPlayRetry');

  function apply() {
    if (!ready) return;
    player.setVolume(volume);
    if (desired) { player.unMute(); player.playVideo(); }
    else { player.pauseVideo(); retry.hidden = true; }
  }

  function create() {
    if (!host || !window.YT?.Player || player) return;
    const token = generation;
    const target = host.querySelector('.bgm-video');
    player = new YT.Player(target, {
      width: '100%', height: '200', videoId,
      playerVars: { playsinline: 1, origin: location.origin, start: Math.floor(position) },
      events: {
        onReady: () => {
          if (token !== generation) return;
          clearTimeout(loadTimeout);
          ready = true;
          message('已就绪');
          apply();
        },
        onStateChange: (event) => {
          if (token !== generation) return;
          if (event.data === 1) {
            if (!desired) { player.pauseVideo(); return; }
            message('正在播放');
            retry.hidden = true;
          }
          if (event.data === 2) message('已暂停');
          if (event.data === 0 && desired) { player.seekTo(0); player.playVideo(); }
        },
        onAutoplayBlocked: () => {
          if (token !== generation || !desired) return;
          message('浏览器暂停了自动播放');
          retry.hidden = false;
        },
        onError: () => {
          if (token !== generation) return;
          failed = true;
          message('BGM 暂时无法播放，环境声仍可使用');
        }
      }
    });
  }

  function sync(view, selected, playing, level, expanded = false, track = 'bfVH3FgXtmE') {
    desired = view !== 'home' && selected && playing && level > 0;
    volume = level;
    const next = selected ? document.querySelector('#setupBgm') : null;
    if (next !== host || (selected && track !== videoId)) {
      generation++;
      clearTimeout(loadTimeout);
      if (player) {
        if (ready) positions[videoId] = player.getCurrentTime() || 0;
        player.destroy();
      }
      player = null; ready = false; failed = false;
      retry.hidden = true;
      videoId = track;
      position = positions[videoId] || 0;
      if (host) { host.hidden = true; host.innerHTML = ''; }
      host = next;
      if (host) {
        host.hidden = false;
        host.classList.toggle('is-collapsed', !expanded);
        host.setAttribute('aria-hidden', String(!expanded));
        host.innerHTML = '<div class="bgm-video"></div><p class="bgm-status" role="status">正在连接 YouTube…</p>';
        if (location.protocol === 'file:') {
          message('暂时无法连接音乐');
          return;
        }
        loadTimeout = setTimeout(() => message('连接较慢，可在 YouTube 打开；环境声仍可使用'), 15000);
      }
    }
    if (host) {
      host.hidden = false;
      host.classList.toggle('is-collapsed', !expanded);
      host.setAttribute('aria-hidden', String(!expanded));
    }
    if (!host || location.protocol === 'file:') return;
    if (!loading && !window.YT?.Player) {
      loading = true;
      window.onYouTubeIframeAPIReady = create;
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = () => { loading = false; message('无法连接 YouTube，环境声仍可使用'); script.remove(); };
      document.head.append(script);
    }
    create();
    if (!failed) apply();
  }
  retry.addEventListener('click', () => {
    if (desired) apply();
  });
  return {
    sync,
    reset() {
      desired = false; generation++; clearTimeout(loadTimeout);
      if (player) player.destroy();
      player = null; ready = false; failed = false; position = 0;
      Object.keys(positions).forEach(key => delete positions[key]);
      if (host) { host.innerHTML = ''; host.hidden = true; }
      host = null; retry.hidden = true;
    },
    prepare() { sync('home', true, false, 38, false); },
    pause() { desired = false; retry.hidden = true; if (ready) player.pauseVideo(); }
  };
})();

window.localBgm = (() => {
  const audio = new Audio();
  audio.loop = true;
  let url = null, wanted = false;
  const status = document.querySelector('#localBgmStatus');
  audio.addEventListener('error', () => {
    status.textContent = '该音频无法播放，请更换 MP3、M4A 或 WAV 文件';
  });
  return {
    get available() { return Boolean(url); },
    load(file) {
      audio.pause();
      if (url) URL.revokeObjectURL(url);
      url = file ? URL.createObjectURL(file) : null;
      if (url) audio.src = url;
      else { audio.removeAttribute('src'); audio.load(); }
      status.textContent = file ? file.name : '未选择音频，学习时播放合成氛围音';
    },
    sync(selected, playing, volume) {
      wanted = selected && playing && Boolean(url);
      audio.volume = volume / 100;
      if (!wanted) { audio.pause(); return; }
      if (audio.paused) audio.play().then(() => {
        if (!wanted) audio.pause();
      }).catch(() => {
        if (wanted) status.textContent = '音频未能播放，请重新试听或更换文件';
      });
    },
    pause() { wanted = false; audio.pause(); },
    reset() { wanted = false; audio.pause(); audio.currentTime = 0; }
  };
})();
