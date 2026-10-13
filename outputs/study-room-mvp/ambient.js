window.ambientMixer = (() => {
  const sounds = [
    { id: 'rain', name: '细雨', icon: 'cloud-rain', frequency: 4200, type: 'lowpass', rate: 0.37 },
    { id: 'wind', name: '轻风', icon: 'wind', frequency: 520, type: 'lowpass', rate: 0.065 },
    { id: 'waves', name: '海浪', icon: 'waves', frequency: 1200, type: 'lowpass', rate: 0.12 },
    { id: 'stream', name: '溪流', icon: 'droplets', frequency: 1800, type: 'bandpass', rate: 0.8 },
    { id: 'leaves', name: '树叶', icon: 'leaf', frequency: 2800, type: 'highpass', rate: 0.22 },
    { id: 'fan', name: '风扇', icon: 'fan', frequency: 350, type: 'lowpass', rate: 1.4 },
    { id: 'white', name: '白噪音', icon: 'radio', frequency: 18000, type: 'lowpass', rate: 0 },
    { id: 'brown', name: '棕噪音', icon: 'audio-lines', frequency: 800, type: 'lowpass', rate: 0 }
  ];
  const defaults = { snow: { wind: 55, brown: 20 }, sea: { waves: 65, wind: 20 }, garden: { leaves: 45, stream: 30 }, night: { rain: 65, brown: 18 }, forest: { wind: 25, leaves: 45, rain: 15 }, wild: { wind: 45 } };
  const presets = { gentle: { wind: 35, brown: 30 }, rainy: { rain: 60, leaves: 18 }, coast: { waves: 65, wind: 25 } };
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('inookAmbientMixes') || '{}') || {}; } catch (_) {}
  let scene, mix, engine, onChange = () => {};
  const grid = document.querySelector('#ambientSounds');
  const select = document.querySelector('#ambientPreset');
  function initial(values) {
    return Object.fromEntries(sounds.map(s => [s.id, { enabled: Boolean(values[s.id]), volume: values[s.id] || 40 }]));
  }
  function store() {
    saved[scene] = mix;
    try { localStorage.setItem('inookAmbientMixes', JSON.stringify(saved)); } catch (_) {}
  }
  function apply() {
    if (!engine) return;
    // Divide by the summed levels to keep multi-layer combinations comfortable.
    const total = sounds.reduce((sum, s) => sum + (mix[s.id].enabled ? mix[s.id].volume / 100 : 0), 0);
    sounds.forEach(s => engine.gains[s.id].gain.setTargetAtTime(
      mix[s.id].enabled ? mix[s.id].volume / 100 / Math.max(1, total) : 0,
      engine.context.currentTime, 0.18));
  }
  function render() {
    grid.innerHTML = sounds.map(s => `<div class="ambient-sound ${mix[s.id].enabled ? 'active' : ''}" data-sound="${s.id}">
      <label class="ambient-sound-toggle"><img src="./assets/ambient-${s.icon}.svg" width="22" height="22" alt=""/><span>${s.name}</span><input type="checkbox" aria-label="播放${s.name}" ${mix[s.id].enabled ? 'checked' : ''}/></label>
      <div class="ambient-level"><input type="range" min="0" max="100" value="${mix[s.id].volume}" aria-label="${s.name}音量" ${mix[s.id].enabled ? '' : 'disabled'}/><output>${mix[s.id].volume}%</output></div>
    </div>`).join('');
    grid.querySelectorAll('[data-sound]').forEach(card => {
      const item = mix[card.dataset.sound];
      const toggle = card.querySelector('[type="checkbox"]');
      const slider = card.querySelector('[type="range"]');
      toggle.addEventListener('change', () => {
        item.enabled = toggle.checked;
        slider.disabled = !item.enabled;
        card.classList.toggle('active', item.enabled);
        changed();
      });
      slider.addEventListener('input', () => {
        item.volume = Number(slider.value);
        card.querySelector('output').textContent = `${item.volume}%`;
        changed();
      });
    });
  }
  function changed() { select.value = 'custom'; store(); apply(); onChange(); }
  select.addEventListener('change', () => {
    if (select.value === 'custom') return;
    mix = initial(select.value === 'scene' ? defaults[scene] : presets[select.value]);
    store(); render(); apply(); onChange();
  });
  document.querySelector('#ambientOff').addEventListener('click', () => {
    sounds.forEach(s => { mix[s.id].enabled = false; });
    changed(); render();
  });
  return {
    onChange(callback) { onChange = callback; },
    selectScene(id) {
      if (scene === id) return;
      scene = id;
      mix = initial(defaults[id]);
      sounds.forEach(s => {
        const value = saved[id]?.[s.id];
        if (value && typeof value.enabled === 'boolean' && Number.isFinite(value.volume)) {
          mix[s.id] = { enabled: value.enabled, volume: Math.max(0, Math.min(100, value.volume)) };
        }
      });
      select.value = saved[id] ? 'custom' : 'scene';
      render(); apply();
    },
    summary() { return sounds.filter(s => mix[s.id].enabled && mix[s.id].volume > 0).map(s => s.name).join(' · ') || '背景音已关闭'; },
    hasActive() { return sounds.some(s => mix[s.id].enabled && mix[s.id].volume > 0); },
    create(context, destination) {
      const buffer = context.createBuffer(1, context.sampleRate * 8, context.sampleRate);
      const brown = context.createBuffer(1, buffer.length, context.sampleRate);
      const whiteData = buffer.getChannelData(0), brownData = brown.getChannelData(0);
      let last = 0;
      for (let i = 0; i < buffer.length; i++) {
        const noise = Math.random() * 2 - 1;
        whiteData[i] = noise;
        last = (last + 0.02 * noise) / 1.02;
        brownData[i] = last * 3.5;
      }
      const gains = {};
      sounds.forEach(s => {
        const source = context.createBufferSource(), filter = context.createBiquadFilter();
        const envelope = context.createGain(), gain = context.createGain();
        source.buffer = s.id === 'brown' ? brown : buffer;
        source.loop = true;
        filter.type = s.type; filter.frequency.value = s.frequency; filter.Q.value = 0.5;
        envelope.gain.value = s.rate ? 0.65 : 0.8;
        gain.gain.value = 0;
        source.connect(filter); filter.connect(envelope); envelope.connect(gain); gain.connect(destination);
        source.start(0, Math.random() * 7);
        if (s.rate) {
          const oscillator = context.createOscillator(), depth = context.createGain();
          oscillator.frequency.value = s.rate;
          depth.gain.value = s.id === 'waves' ? 0.5 : 0.25;
          oscillator.connect(depth); depth.connect(envelope.gain); oscillator.start();
        }
        gains[s.id] = gain;
      });
      engine = { context, gains }; apply();
    }
  };
})();
