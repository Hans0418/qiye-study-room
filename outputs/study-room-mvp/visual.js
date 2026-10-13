(() => {
  const app = document.querySelector('.app');
  const backdrop = document.querySelector('.scene-backdrop');
  const canvas = document.createElement('canvas');
  canvas.className = 'scene-atmosphere'; canvas.setAttribute('aria-hidden', 'true');
  backdrop.append(canvas);
  const ctx = canvas.getContext('2d');
  let frame = 0, previousFrame = 0;
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(backdrop.clientWidth * dpr);
    canvas.height = Math.round(backdrop.clientHeight * dpr);
  }
  new ResizeObserver(resize).observe(backdrop); resize();
  function draw(now) {
    frame = requestAnimationFrame(draw);
    if (now - previousFrame < 33) return;
    previousFrame = now;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (app.dataset.view === 'setup') return;
    const [w, h] = ['forest', 'wild'].includes(app.dataset.scene) ? [1586, 992] : [1672, 941];
    const scale = Math.max(canvas.width / w, canvas.height / h);
    ctx.save(); ctx.translate((canvas.width - w * scale) / 2, (canvas.height - h * scale) / 2); ctx.scale(scale, scale);
    window.sceneEffects.draw(ctx, app.dataset.scene, now / 1000);
    ctx.restore();
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function sync() {
    const active = !reduced.matches;
    document.documentElement.dataset.motion = active ? 'on' : 'off';
    app.dataset.motion = active ? 'on' : 'off';
    cancelAnimationFrame(frame); ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (active && !document.hidden) frame = requestAnimationFrame(draw);
  }
  reduced.addEventListener('change', sync); document.addEventListener('visibilitychange', sync); sync();
  let current = app.style.getPropertyValue('--scene-image');
  let version = 0, lastView = app.dataset.view;
  app.addEventListener('animationend', event => {
    if (event.animationName === 'view-enter') event.target.classList.remove('is-entering');
  });
  backdrop.style.backgroundImage = current;
  new MutationObserver(() => {
    if (lastView !== app.dataset.view) {
      lastView = app.dataset.view;
      app.querySelectorAll('.is-entering').forEach(view => view.classList.remove('is-entering'));
      document.getElementById(`${lastView}View`)?.classList.add('is-entering');
    }
    const next = app.style.getPropertyValue('--scene-image');
    if (!next || next === current) return;
    current = next; const token = ++version;
    const image = new Image(); image.src = next.slice(4, -1).replace(/^['"]|['"]$/g, '');
    image.decode().then(() => {
      if (token !== version) return;
      backdrop.style.setProperty('--previous-scene', backdrop.style.backgroundImage);
      backdrop.style.backgroundImage = next;
      backdrop.classList.remove('scene-changing'); void backdrop.offsetWidth; backdrop.classList.add('scene-changing');
    }).catch(() => {});
  }).observe(app, { attributes: true, attributeFilter: ['style', 'data-view'] });
})();
