(() => {
  const images = new Map();
  const sheep = new Image(); sheep.src = './assets/sheep-walk.png';
  const random = n => { const x = Math.sin(n * 127.1 + 31.7) * 43758.5453; return x - Math.floor(x); };
  const phase = n => n - Math.floor(n);
  function polygon(ctx, points) {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.clip();
  }
  // Local texture deformation keeps window frames and furniture stationary.
  function warp(ctx, image, points, box, t, amplitude, speed, axis = 'x') {
    if (!image?.complete || !image.naturalWidth) return;
    const [x, y, w, h] = box;
    ctx.save(); polygon(ctx, points);
    for (let row = 0; row < h; row += 3) {
      const edge = Math.sin(Math.PI * row / h);
      const shift = Math.sin(row / 57 + t * speed) * amplitude * edge;
      const dy = axis === 'y' ? shift : 0, dx = axis === 'x' ? shift : 0;
      ctx.drawImage(image, Math.max(0, x - 12 + dx), Math.max(0, y + row + dy), w + 24, 3, x - 12, y + row, w + 24, 3.2);
    }
    ctx.restore();
  }
  function steam(ctx, x, y, t, strength = 1) {
    // Uneven overlapping vapor puffs rise, spread and dissipate, rather than repeating lines.
    for (let i = 0; i < 52; i++) {
      const p = phase(t * (.12 + random(i) * .035) + random(i + 80));
      const r = 4 + p * 24;
      const px = x + (random(i + 2) - .5) * 24 + Math.sin(p * 5 + t * .5 + random(i) * 3) * p * 22;
      const py = y - 4 - p * (105 + random(i + 4) * 35);
      const alpha = Math.sin(Math.PI * p) * .075 * strength;
      ctx.save(); ctx.translate(px, py); ctx.scale(1, 1.6);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, `rgba(241,239,228,${alpha})`); g.addColorStop(.45, `rgba(241,239,228,${alpha * .5})`); g.addColorStop(1, 'rgba(241,239,228,0)');
      ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
    }
  }
  function curtain(ctx, image, t) {
    if (!image?.complete || !image.naturalWidth) return;
    // Interior fabric only: no window, furniture or background pixels are sampled.
    const edges = [[0,615,700],[160,578,660],[320,520,650],[480,465,658],[610,430,665],[655,540,674]];
    const breeze = Math.sin(t * .42) * 2.4 + Math.sin(t * .19 + .7) * .6;
    for (let y = 0; y < 654; y += 3) {
      const index = edges.findIndex((edge, i) => i < edges.length - 1 && y < edges[i + 1][0]);
      const a = edges[index], b = edges[index + 1], p = (y - a[0]) / (b[0] - a[0]);
      const left = a[1] + (b[1] - a[1]) * p, right = a[2] + (b[2] - a[2]) * p;
      const fall = (y / 655) ** 2;
      const hem = Math.min(1, (655 - y) / 35);
      for (let x = left; x < right; x += 8) {
        const width = Math.min(8, right - x);
        const u = (x + width / 2 - left) / (right - left);
        const shift = breeze * fall * hem * Math.sin(Math.PI * u) ** 2;
        ctx.drawImage(image, x + shift, y, width, 3, x, y, width, 3);
      }
    }
  }
  function snow(ctx, t) {
    ctx.save();
    // Separate panes, stopping at the desk/monitor silhouettes.
    ctx.beginPath();
    for (const p of [[[315,153],[644,67],[644,577],[315,557]], [[671,63],[1080,0],[1080,641],[920,620],[920,597],[755,597],[755,577],[671,577]], [[1112,0],[1672,0],[1672,941],[1215,941],[1215,831],[1112,812]]]) {
      p.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.closePath();
    }
    ctx.clip();
    for (let i = 0; i < 680; i++) {
      const depth = random(i + 1), speed = 28 + depth * 115;
      const y = phase(random(i + 9) + t * speed / 1000) * 1020 - 40;
      const x = phase(random(i + 6) + t * (.008 + depth * .015)) * 1780 - 40 + Math.sin(t + i) * 8;
      ctx.fillStyle = `rgba(249,252,255,${.15 + depth * .55})`;
      ctx.beginPath(); ctx.ellipse(x, y, .6 + depth * 1.8, 1 + depth * 2.5, -.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function rain(ctx, image, t) {
    ctx.save(); polygon(ctx, [[604,0],[1455,0],[1455,687],[604,630]]);
    for (let i = 0; i < 250; i++) {
      const y = phase(random(i) + t * (.45 + random(i + 1) * .4)) * 750;
      const x = 600 + random(i + 5) * 860 - (y % 80) * .1;
      ctx.strokeStyle = `rgba(192,214,235,${.035 + random(i + 9) * .1})`; ctx.lineWidth = .5 + random(i + 3) * .5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 9 + random(i) * 18); ctx.stroke();
    }
    // Expanding elliptical impacts sit on the distant wet ground, behind the glass.
    for (let i = 0; i < 36; i++) {
      const p = phase(t * .65 + random(i));
      ctx.strokeStyle = `rgba(210,224,239,${(1-p)*.18})`; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.ellipse(780 + random(i+90)*630, 510+random(i+32)*100, 1+p*14, .5+p*3, 0, 0, Math.PI*2); ctx.stroke();
    }
    for (let i = 0; i < 85; i++) {
      const moving = i < 24, x = 620 + random(i + 12) * 810;
      const y = moving ? phase(t * (.018 + random(i) * .025) + random(i+8)) * 700 : random(i+8)*680;
      const r = 1.2 + random(i + 4) * 2.4;
      if (image?.complete && image.naturalWidth) {
        ctx.save(); ctx.beginPath(); ctx.ellipse(x,y,r,r*1.5,0,0,Math.PI*2); ctx.clip();
        ctx.drawImage(image,x-r*2,y-r*3,r*4,r*6,x-r,y-r*1.5,r*2,r*3); ctx.restore();
      }
      ctx.strokeStyle = 'rgba(8,20,29,.3)'; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.ellipse(x,y,r,r*1.5,0,0,Math.PI*2); ctx.stroke();
      ctx.strokeStyle = 'rgba(226,241,250,.35)'; ctx.beginPath(); ctx.arc(x-.4,y-.7,r*.65,Math.PI,Math.PI*1.7); ctx.stroke();
      if (moving) {
        ctx.strokeStyle = 'rgba(214,232,244,.07)'; ctx.lineWidth = r*.65;
        ctx.beginPath(); ctx.moveTo(x,y); ctx.bezierCurveTo(x+2,y-13,x-2,y-23,x,y-40); ctx.stroke();
      }
    }
    ctx.restore();
  }
  function draw(ctx, id, t) {
    const scene = scenes.find(s => s.id === id);
    if (!scene) return;
    if (!images.has(scene.image)) { const img = new Image(); img.src = scene.image; images.set(scene.image,img); }
    const image = images.get(scene.image);
    if (id === 'snow') snow(ctx,t);
    if (id === 'sea') {
      curtain(ctx,image,t);
      // Keep a margin around the shoreline, rocks, window sill and latch.
      warp(ctx,image,[[1310,440],[1440,440],[1440,610],[1420,650],[900,601],[820,580],[980,565],[1130,545],[1310,530]], [820,440,620,210],t,4,1.5,'y');
      steam(ctx,852,677,t,1.5);
    }
    if (id === 'garden') {
      steam(ctx,1055,670,t);
    }
    if (id === 'night') { rain(ctx,image,t); steam(ctx,925,667,t); }
    if (id === 'wild') {
      warp(ctx,image,[[150,0],[1310,0],[1190,174],[872,227],[590,364],[280,246],[112,180]], [112,0,1200,365],t,9,.075);
      if (sheep.complete && sheep.naturalWidth) {
        const cellW=sheep.naturalWidth/4, cellH=sheep.naturalHeight/2;
        const frame=Math.floor(t*6)%8, x=1600-(t*13)%1640;
        const y=612 + 5*Math.sin(x/430), size=72;
        ctx.save(); ctx.beginPath(); ctx.rect(100,610,596,170); ctx.rect(1095,610,491,170); ctx.clip();
        ctx.save(); ctx.translate(x+size*.52,y+size*.83); ctx.scale(1,.2);
        const shadow=ctx.createRadialGradient(0,0,1,0,0,27);
        shadow.addColorStop(0,'rgba(26,35,19,.25)'); shadow.addColorStop(1,'rgba(26,35,19,0)');
        ctx.fillStyle=shadow;ctx.fillRect(-27,-27,54,54);ctx.restore();
        ctx.filter='saturate(.72) contrast(.85) brightness(.93)';
        ctx.drawImage(sheep,(frame%4)*cellW+10,Math.floor(frame/4)*cellH+10,cellW-20,cellH-20,x,y,size,size);
        ctx.filter='none';
        // Restore the pot silhouette in front of the animal, including its lid and handle.
        if(image.complete && image.naturalWidth) {
          ctx.save(); polygon(ctx,[[1157,650],[1270,650],[1276,689],[1308,702],[1322,772],[1305,780],[1290,717],[1276,707],[1290,798],[1143,798],[1156,718],[1167,690],[1154,676]]);
          ctx.drawImage(image,0,0);ctx.restore();
        }
        ctx.restore();
      }
      steam(ctx,1215,654,t,.75);
    }
  }
  window.sceneEffects = { draw };
})();
