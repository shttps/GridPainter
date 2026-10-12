'use strict';
/* «Взлом замка» — мини-игра Сларка из ивента «Тёмный карнавал» (Dota 2, 2026).
   Отмычка бежит по кругу замка. ЛКМ — взлом: попал в жёлтое деление — +1000 очков, в синее — +1,5 секунды.
   После каждого попадания отмычка меняет направление; деления со временем сужаются и пропадают.
   Промах ненадолго отключает отмычку и замедляет её. ПКМ (удерживать) — ускорение. F9 — пауза.
   Награды как в игре: 6 000, 12 000, 18 000, 24 000. Сцена (камера, свечи, замок) нарисована на canvas,
   Сларк за решёткой — портрет с CDN Valve. */
(() => {
  const W = 600, H = 800;                 // логический размер сцены
  const CX = 300, CY = 566;               // центр замка
  const R_RIM = 178, R_FACE = 150, R_IN = 92, R_OUT = 144, R_HUB = 80;
  const START_TIME = 30, BLUE_BONUS = 1.5, GOLD_POINTS = 1000, MISS_LOCK = .8;
  const IMG = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/heroes/slark_vert.jpg';
  const FONT = '"Philosopher", "Onest", sans-serif';
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rad = d => d * Math.PI / 180;
  const angDiff = (a, b) => ((a - b + 540) % 360) - 180;   // знаковая разница углов в [-180, 180)
  const fmtTime = t => Math.max(0, t).toFixed(1);
  const fmtNum = n => n.toLocaleString('ru-RU');

  let slark = null;   // портрет грузим один раз на страницу
  function slarkImg(onload) {
    if (!slark) { slark = new Image(); slark.decoding = 'async'; slark.src = IMG; }
    if (slark.complete && slark.naturalWidth) return slark;
    slark.addEventListener('load', onload, { once: true });
    return null;
  }

  // ---------- статичная сцена: стена, окно с решёткой, подсвечники, ведро, пол ----------
  function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function drawScene(g, img) {
    const r = seeded(7);
    // стена
    const wall = g.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, '#24222a'); wall.addColorStop(.55, '#1d1b22'); wall.addColorStop(1, '#131217');
    g.fillStyle = wall; g.fillRect(0, 0, W, H);
    for (let y = -10, row = 0; y < 720; y += 48, row++) {
      for (let x = (row % 2 ? -50 : -5); x < W; ) {
        const w = 84 + r() * 34, l = 26 + r() * 12;
        g.fillStyle = `hsl(${250 + r() * 20} 8% ${l * .55}%)`;
        roundRect(g, x + 3, y + 3, w - 6, 42, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,.035)'; roundRect(g, x + 5, y + 5, w - 10, 10, 5); g.fill();
        if (r() < .25) { g.fillStyle = 'rgba(60,90,60,.18)'; g.beginPath(); g.ellipse(x + r() * w, y + 38, 18 + r() * 20, 5, 0, 0, 7); g.fill(); }
        x += w;
      }
    }
    // пол
    const fl = g.createLinearGradient(0, 690, 0, H);
    fl.addColorStop(0, '#17161b'); fl.addColorStop(1, '#0d0c10');
    g.fillStyle = fl; g.fillRect(0, 690, W, H - 690);
    for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(255,255,255,${.02 + r() * .03})`; g.beginPath(); g.ellipse(r() * W, 720 + r() * 70, 30 + r() * 40, 8 + r() * 6, 0, 0, 7); g.fill(); }

    // окно камеры: арка, темнота, Сларк, решётка
    const ax = 300, ay = 236, ar = 122, bottom = 372;
    const arch = () => { g.beginPath(); g.moveTo(ax - ar, bottom); g.lineTo(ax - ar, ay); g.arc(ax, ay, ar, Math.PI, 0); g.lineTo(ax + ar, bottom); g.closePath(); };
    g.save(); arch(); g.clip();
    const inside = g.createRadialGradient(ax, 250, 20, ax, 260, 200);
    inside.addColorStop(0, '#2c2530'); inside.addColorStop(1, '#09080c');
    g.fillStyle = inside; g.fillRect(ax - ar, ay - ar, ar * 2, bottom - ay + ar);
    if (img) {
      const iw = 236, ih = iw * img.naturalHeight / img.naturalWidth;
      g.globalAlpha = .95; g.drawImage(img, ax - iw / 2, 150, iw, ih); g.globalAlpha = 1;
      const shade = g.createLinearGradient(0, 130, 0, bottom);
      shade.addColorStop(0, 'rgba(10,8,14,.55)'); shade.addColorStop(.45, 'rgba(10,8,14,0)'); shade.addColorStop(1, 'rgba(10,8,14,.5)');
      g.fillStyle = shade; g.fillRect(ax - ar, ay - ar, ar * 2, bottom);
    }
    // решётка
    g.lineCap = 'round';
    for (let x = ax - 100; x <= ax + 100; x += 40) bar(g, x, 100, x, bottom, 9);
    bar(g, ax - ar, 196, ax + ar, 196, 8);
    g.restore();
    // каменная арка
    g.save();
    for (let k = 0; k <= 12; k++) {
      const a0 = Math.PI + k * Math.PI / 13, a1 = a0 + Math.PI / 13 - .025;
      g.beginPath(); g.arc(ax, ay, ar + 30, a0, a1); g.arc(ax, ay, ar, a1, a0, true); g.closePath();
      g.fillStyle = `hsl(250 6% ${24 + r() * 8}%)`; g.fill();
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2; g.stroke();
    }
    for (const sx of [ax - ar - 30, ax + ar]) for (let y = ay; y < bottom; y += 34) { g.fillStyle = `hsl(250 6% ${23 + r() * 8}%)`; roundRect(g, sx, y + 2, 30, 31, 4); g.fill(); }
    g.restore();
    // подоконник
    g.fillStyle = '#3a3742'; roundRect(g, ax - ar - 44, bottom - 4, ar * 2 + 88, 26, 5); g.fill();
    g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(ax - ar - 40, bottom - 2, ar * 2 + 80, 4);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(ax - ar - 44, bottom + 20, ar * 2 + 88, 8);

    // подсвечники (сами огоньки — в каждом кадре)
    sconce(g, 96, 236, 62); sconce(g, 506, 176, 70);
    // ведро справа внизу
    bucket(g, 508, 628);
    // цепь у таблички
    g.strokeStyle = '#4b4752'; g.lineWidth = 4;
    for (const x of [212, 388]) for (let y = 0; y < 52; y += 13) { g.beginPath(); g.ellipse(x, y + 6, 4, 7, 0, 0, 7); g.stroke(); }
    // виньетка
    const v = g.createRadialGradient(W / 2, H * .55, H * .3, W / 2, H * .55, H * .78);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
  function bar(g, x1, y1, x2, y2, w) {
    g.strokeStyle = '#121116'; g.lineWidth = w + 3; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.strokeStyle = '#3d3a44'; g.lineWidth = w; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x1 - (y1 === y2 ? 0 : 2), y1 - (y1 === y2 ? 2 : 0)); g.lineTo(x2 - (y1 === y2 ? 0 : 2), y2 - (y1 === y2 ? 2 : 0)); g.stroke();
  }
  function sconce(g, x, top, hgt) {
    // кронштейн
    g.fillStyle = '#26232b'; roundRect(g, x - 10, top + hgt + 6, 20, 120, 5); g.fill();
    g.fillStyle = '#3a3640'; roundRect(g, x - 26, top + hgt, 52, 14, 6); g.fill();
    g.strokeStyle = '#2d2a33'; g.lineWidth = 6; g.beginPath(); g.arc(x, top + hgt + 70, 18, Math.PI * .6, Math.PI * 1.4); g.stroke();
    // свеча с подтёками
    const c = g.createLinearGradient(x - 18, 0, x + 18, 0);
    c.addColorStop(0, '#b08a4a'); c.addColorStop(.45, '#f3dc9c'); c.addColorStop(1, '#a37a3c');
    g.fillStyle = c; roundRect(g, x - 17, top, 34, hgt + 4, 6); g.fill();
    g.fillStyle = '#f7e6b0';
    for (const [dx, len] of [[-12, 22], [-2, 12], [9, 30]]) { roundRect(g, x + dx, top + 2, 6, len, 3); g.fill(); }
    g.strokeStyle = '#2b1d10'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, top); g.lineTo(x, top - 8); g.stroke();
  }
  function bucket(g, x, y) {
    const w = 92, h = 86;
    const wood = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    wood.addColorStop(0, '#3b2414'); wood.addColorStop(.5, '#7a5230'); wood.addColorStop(1, '#3b2414');
    g.fillStyle = wood; g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x + w / 2, y); g.lineTo(x + w / 2 - 8, y + h); g.lineTo(x - w / 2 + 8, y + h); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2;
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(x + i * 18, y); g.lineTo(x + i * 16, y + h); g.stroke(); }
    g.fillStyle = '#3e4a5a';
    for (const yy of [y + 12, y + h - 18]) { roundRect(g, x - w / 2 - 2, yy, w + 4, 8, 3); g.fill(); }
    g.fillStyle = '#1a120c'; g.beginPath(); g.ellipse(x, y, w / 2, 10, 0, 0, 7); g.fill();
    g.strokeStyle = '#5a3a20'; g.lineWidth = 6; g.beginPath(); g.moveTo(x - 30, y - 4); g.lineTo(x - 4, y - 40); g.stroke();
  }
  function flame(g, x, y, t, seed) {
    const f = Math.sin(t * 9 + seed) * .12 + Math.sin(t * 23 + seed * 2) * .06;
    const glow = g.createRadialGradient(x, y - 10, 2, x, y - 10, 120);
    glow.addColorStop(0, 'rgba(255,170,70,.42)'); glow.addColorStop(.35, 'rgba(255,120,40,.12)'); glow.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = glow; g.fillRect(x - 120, y - 130, 240, 240);
    g.save(); g.translate(x, y); g.scale(1 + f * .5, 1 + f);
    const fl = g.createRadialGradient(0, -6, 1, 0, -10, 22);
    fl.addColorStop(0, '#fffbe0'); fl.addColorStop(.4, '#ffd36a'); fl.addColorStop(1, 'rgba(255,110,30,0)');
    g.fillStyle = fl; g.beginPath(); g.moveTo(0, -34); g.quadraticCurveTo(11, -12, 7, -2); g.quadraticCurveTo(0, 6, -7, -2); g.quadraticCurveTo(-11, -12, 0, -34); g.fill();
    g.restore();
  }

  function drawPrisoner(g, img, t, jolt) {
    if (!img?.naturalWidth) return;
    g.save(); g.beginPath(); g.moveTo(178, 372); g.lineTo(178, 236);
    g.arc(300, 236, 122, Math.PI, 0); g.lineTo(422, 372); g.closePath(); g.clip();
    const inside = g.createRadialGradient(300, 250, 20, 300, 260, 200);
    inside.addColorStop(0, '#2c2530'); inside.addColorStop(1, '#09080c');
    g.fillStyle = inside; g.fillRect(178, 114, 244, 258);
    const bob = ArcadeFX.reduced() ? 0 : Math.sin(t * Math.PI / 2);
    g.save(); g.translate(300, 260 + bob * 1.5);
    g.rotate((bob + Math.sin(jolt * 45) * jolt * 14) * Math.PI / 180);
    g.globalAlpha = .95; g.drawImage(img, -118, -110, 236, 236 * img.naturalHeight / img.naturalWidth); g.restore();
    const shade = g.createLinearGradient(0, 130, 0, 372);
    shade.addColorStop(0, 'rgba(10,8,14,.55)'); shade.addColorStop(.45, 'rgba(10,8,14,0)'); shade.addColorStop(1, 'rgba(10,8,14,.5)');
    g.fillStyle = shade; g.fillRect(178, 114, 244, 258);
    g.lineCap = 'round'; for (let x = 200; x <= 400; x += 40) bar(g, x, 100, x, 372, 9);
    bar(g, 178, 196, 422, 196, 8); g.restore();
  }

  // ---------- замок ----------
  function drawLockBody(g, jolt = 0) {
    // дужка
    g.save();
    g.translate(CX, 424); g.rotate(Math.sin(jolt * 35) * jolt * .14); g.translate(-CX, -424 - Math.sin(jolt * 25) * jolt * 10);
    g.lineCap = 'butt';
    const sh = g.createLinearGradient(CX - 100, 0, CX + 100, 0);
    sh.addColorStop(0, '#3b3a40'); sh.addColorStop(.3, '#8d8a92'); sh.addColorStop(.5, '#5d5b63'); sh.addColorStop(1, '#2c2b31');
    g.strokeStyle = '#141317'; g.lineWidth = 36; g.beginPath(); g.arc(CX, 424, 86, Math.PI, 0); g.lineTo(CX + 86, 470); g.moveTo(CX - 86, 470); g.lineTo(CX - 86, 424); g.stroke();
    g.strokeStyle = sh; g.lineWidth = 28; g.beginPath(); g.arc(CX, 424, 86, Math.PI, 0); g.lineTo(CX + 86, 470); g.moveTo(CX - 86, 470); g.lineTo(CX - 86, 424); g.stroke();
    // крепления дужки
    for (const sx of [-1, 1]) {
      const bx = CX + sx * 86;
      const bg = g.createLinearGradient(bx - 26, 0, bx + 26, 0); bg.addColorStop(0, '#4a4650'); bg.addColorStop(.5, '#7a7680'); bg.addColorStop(1, '#3a3640');
      g.fillStyle = '#121115'; roundRect(g, bx - 30, 392, 60, 46, 6); g.fill();
      g.fillStyle = bg; roundRect(g, bx - 27, 395, 54, 40, 5); g.fill();
      g.fillStyle = '#25232a'; g.beginPath(); g.arc(bx - 15, 405, 4, 0, 7); g.arc(bx + 15, 405, 4, 0, 7); g.fill();
    }
    g.restore();
    // обод
    g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.arc(CX, CY + 10, R_RIM + 8, 0, 7); g.fill();
    const rim = g.createLinearGradient(CX - R_RIM, CY - R_RIM, CX + R_RIM, CY + R_RIM);
    rim.addColorStop(0, '#8c8892'); rim.addColorStop(.35, '#55525b'); rim.addColorStop(.7, '#3a3840'); rim.addColorStop(1, '#6a6670');
    g.fillStyle = rim; g.beginPath(); g.arc(CX, CY, R_RIM, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2; g.beginPath(); g.arc(CX, CY, R_RIM - 2, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 4; g.beginPath(); g.arc(CX, CY, R_FACE + 3, 0, 7); g.stroke();
    // царапины на ободе
    const r = seeded(3);
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1;
    for (let i = 0; i < 26; i++) { const a = r() * 7, rr = R_FACE + 6 + r() * 20; g.beginPath(); g.arc(CX, CY, rr, a, a + .05 + r() * .12); g.stroke(); }
    // циферблат
    const face = g.createRadialGradient(CX, CY, R_IN - 20, CX, CY, R_FACE);
    face.addColorStop(0, '#1d1b1f'); face.addColorStop(1, '#141215');
    g.fillStyle = face; g.beginPath(); g.arc(CX, CY, R_FACE, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.035)'; g.lineWidth = 1.2;
    for (let a = 0; a < 360; a += 30) { g.beginPath(); g.moveTo(CX + Math.cos(rad(a)) * R_IN, CY + Math.sin(rad(a)) * R_IN); g.lineTo(CX + Math.cos(rad(a)) * R_OUT, CY + Math.sin(rad(a)) * R_OUT); g.stroke(); }
  }
  function drawHub(g, time, score, ready) {
    g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.arc(CX, CY + 4, R_HUB + 6, 0, 7); g.fill();
    const hub = g.createRadialGradient(CX - 20, CY - 30, 10, CX, CY, R_HUB);
    hub.addColorStop(0, '#47434a'); hub.addColorStop(1, '#2a272d');
    g.fillStyle = hub; g.beginPath(); g.arc(CX, CY, R_HUB, 0, 7); g.fill();
    g.strokeStyle = '#5a5660'; g.lineWidth = 2; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    if (ready) {
      g.fillStyle = '#d9cdb4'; g.font = `700 22px ${FONT}`; g.fillText('Готовься…', CX, CY + 8);
      return;
    }
    g.fillStyle = '#b9ad98'; g.font = `700 10.5px ${FONT}`; g.fillText('ОСТАЛОСЬ ВРЕМЕНИ', CX, CY - 34);
    g.fillStyle = time < 5 ? '#ff8a6a' : '#efe6d4'; g.font = `700 40px ${FONT}`; g.fillText(fmtTime(time), CX, CY + 6);
    g.fillStyle = '#b9ad98'; g.font = `700 10.5px ${FONT}`; g.fillText('ОЧКИ', CX, CY + 28);
    g.fillStyle = '#efe6d4'; g.font = `700 19px ${FONT}`; g.fillText(fmtNum(score), CX, CY + 49);
  }
  function drawZone(g, z, w, flash) {
    const a0 = rad(z.c - w / 2), a1 = rad(z.c + w / 2);
    const gold = z.kind === 'gold';
    const grad = g.createRadialGradient(CX, CY, R_IN, CX, CY, R_OUT);
    if (gold) { grad.addColorStop(0, '#9c7a14'); grad.addColorStop(.5, '#e2bc35'); grad.addColorStop(1, '#f4d660'); }
    else { grad.addColorStop(0, '#3d7fb8'); grad.addColorStop(.55, '#86c6f0'); grad.addColorStop(1, '#bfe6ff'); }
    g.save();
    g.shadowColor = gold ? 'rgba(255,200,60,.55)' : 'rgba(120,200,255,.6)'; g.shadowBlur = 14 + flash * 20;
    g.fillStyle = grad; g.beginPath(); g.arc(CX, CY, R_OUT, a0, a1); g.arc(CX, CY, R_IN, a1, a0, true); g.closePath(); g.fill();
    g.restore();
    // фактура: светлые прожилки, как на краске
    g.save(); g.beginPath(); g.arc(CX, CY, R_OUT, a0, a1); g.arc(CX, CY, R_IN, a1, a0, true); g.closePath(); g.clip();
    g.strokeStyle = gold ? 'rgba(255,240,170,.35)' : 'rgba(235,250,255,.4)'; g.lineWidth = 1.5;
    for (let k = 1; k < 4; k++) { const rr = R_IN + (R_OUT - R_IN) * k / 4 + Math.sin(z.seed + k) * 4; g.beginPath(); g.arc(CX, CY, rr, a0, a1); g.stroke(); }
    // шов посередине у синего — как на скриншоте
    if (!gold) { g.strokeStyle = 'rgba(30,60,90,.45)'; g.lineWidth = 2; const am = rad(z.c); g.beginPath(); g.moveTo(CX + Math.cos(am) * R_IN, CY + Math.sin(am) * R_IN); g.lineTo(CX + Math.cos(am) * R_OUT, CY + Math.sin(am) * R_OUT); g.stroke(); }
    g.restore();
  }
  function drawPick(g, angle, state) {
    const a = rad(angle), c = Math.cos(a), s = Math.sin(a);
    const col = state === 'off' ? '255,90,70' : '170,215,255';
    g.save(); g.lineCap = 'round';
    g.strokeStyle = `rgba(${col},.25)`; g.lineWidth = 12; g.beginPath(); g.moveTo(CX + c * (R_IN + 4), CY + s * (R_IN + 4)); g.lineTo(CX + c * (R_OUT - 2), CY + s * (R_OUT - 2)); g.stroke();
    g.strokeStyle = `rgba(${col},.55)`; g.lineWidth = 6; g.stroke();
    g.strokeStyle = state === 'off' ? '#ffd0c4' : '#ffffff'; g.lineWidth = 2.5; g.stroke();
    g.restore();
  }

  // ---------- игра ----------
  function mount(shell, api) {
    shell.innerHTML = `<div class="lp-frame" id="lpFrame">
      <canvas class="lp-cv" id="lpCv" aria-label="Замок: нажимай, когда отмычка в делении"></canvas>
      <div class="lp-plate"><span>Взлом замка</span></div>
      <div class="lp-legend">
        <div><span>Взлом</span>${Arcade.MOUSE('l', 'Левая кнопка мыши')}</div>
        <div><span>Ускорение (удерж.)</span>${Arcade.MOUSE('r', 'Правая кнопка мыши')}</div>
        <div><span>Пауза</span>${Arcade.KEY('F9')}</div>
      </div>
      <button class="lp-boost" id="lpBoost" type="button" aria-label="Ускорение (удерживать)">»</button>
      <div class="ar-pause" id="lpPause" hidden><b>Пауза</b><small>F9 или Esc — продолжить</small><button class="ar-btn" data-resume>Продолжить</button></div>
    </div>`;
    const frame = shell.querySelector('#lpFrame'), cv = shell.querySelector('#lpCv'), g = cv.getContext('2d');
    const scene = document.createElement('canvas'), sg = scene.getContext('2d');
    let scale = 1, dpr = 1;
    function resize() {
      const w = cv.clientWidth || 600;
      dpr = Math.min(2, devicePixelRatio || 1); scale = w * dpr / W;
      cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
      scene.width = cv.width; scene.height = cv.height;
      sg.setTransform(scale, 0, 0, scale, 0, 0); drawScene(sg, slarkImg(redrawScene));
    }
    const redrawScene = () => { if (!dead) { sg.setTransform(scale, 0, 0, scale, 0, 0); drawScene(sg, slark); } };
    const ro = new ResizeObserver(resize); ro.observe(cv);

    // состояние
    const S = { time: START_TIME, score: 0, hits: 0, dir: 1, angle: -90, off: 0, boost: false, zones: [], blueIn: rnd(2, 4), ready: 1.1, paused: false, over: false, fx: [], shake: 0, t: 0, action: 0, endIn: null, scorePop: 0, timePop: 0 };
    const particles = new ArcadeFX.Particles(), trail = [];
    let dead = false, raf = 0, last = 0;
    const diff = () => Math.min(1, S.hits / 40);
    function spawn(kind) {
      const d = diff();
      const w0 = kind === 'gold' ? 30 - 18 * d : 26 - 12 * d;
      const life = kind === 'gold' ? 4.4 - 1.9 * d : 3.3 - 1.1 * d;
      let c = 0;
      for (let k = 0; k < 40; k++) {
        c = rnd(0, 360);
        const okPick = Math.abs(angDiff(c, S.angle)) > w0 / 2 + 10;
        const okOther = S.zones.every(z => Math.abs(angDiff(c, z.c)) > (w0 + z.w0) / 2 + 12);
        if (okPick && okOther) break;
      }
      S.zones.push({ kind, c, w0, life, age: 0, seed: Math.random() * 10 });
    }
    const width = z => z.w0 * Math.max(0, 1 - Math.pow(z.age / z.life, 1.7));
    spawn('gold');

    function pick() {
      if (S.over || S.paused || S.ready > 0 || S.off > 0) return;
      S.action = .15;
      const z = S.zones.find(z => Math.abs(angDiff(S.angle, z.c)) <= width(z) / 2 + 1.2);
      if (z) {
        S.zones.splice(S.zones.indexOf(z), 1);
        S.dir *= -1; S.hits++;
        const a = rad(z.c), x = CX + Math.cos(a) * (R_OUT + 26), y = CY + Math.sin(a) * (R_OUT + 26);
        S.fx.push({ kind: 'burst', z: { ...z }, w: width(z), t: 0 });
        particles.burst(CX + Math.cos(a) * 126, CY + Math.sin(a) * 126, z.kind === 'gold' ? '#ffe477' : '#a8e5ff', 32, 155, 130);
        if (z.kind === 'gold') { S.score += GOLD_POINTS; S.scorePop = .3; S.fx.push({ kind: 'text', x, y, text: '+' + fmtNum(GOLD_POINTS), color: '#ffd760', t: 0 }); api.sfx('hit', { pan: Math.cos(a) * .45 }); spawn('gold'); }
        else { S.time += BLUE_BONUS; S.timePop = .5; S.fx.push({ kind: 'text', x: CX, y: CY - 30, text: '+1,5 с', color: '#a8dcff', t: 0 }); api.sfx('blue', { pan: Math.cos(a) * .45 }); S.blueIn = rnd(2.5, 5); }
      } else {
        S.off = MISS_LOCK; S.shake = .25; api.sfx('miss');
        const a = rad(S.angle);
        particles.burst(CX + Math.cos(a) * 130, CY + Math.sin(a) * 130, '#ff784a', 16, 95, 200);
      }
    }
    function setPause(on) {
      if (S.over || S.paused === on) return;
      S.paused = on; S.boost = false;
      frame.classList.toggle('paused', on); api.pauseAudio?.(on);
      frame.querySelector('#lpPause').hidden = !on;
      if (!on) last = performance.now();
    }

    // ввод: ЛКМ — взлом, ПКМ (держать) — ускорение; на телефоне — тап и кнопка «»»
    const onDown = e => {
      if (e.target.closest('.ar-pause, .lp-boost')) return;
      if (e.button === 2 && !S.paused && !S.over) { S.boost = true; return; }
      if (e.button === 0) { e.preventDefault(); pick(); }
    };
    const onUp = e => { if (e.button === 2) S.boost = false; };
    const onKey = e => {
      if (e.target.closest?.('button, input, textarea, select') && (e.code === 'Space' || e.key === 'Enter')) return;
      if (e.repeat && ['F9', 'Escape', 'p', 'з'].includes(e.key)) return;
      if (e.key === 'F9' || e.key === 'Escape' || e.key === 'p' || e.key === 'з') { e.preventDefault(); setPause(!S.paused); return; }
      if ((e.code === 'Space' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); pick(); }
      if (e.key === 'Shift' && !S.paused && !S.over) S.boost = true;
    };
    const onKeyUp = e => { if (e.key === 'Shift') S.boost = false; };
    const onBlur = () => { S.boost = false; setPause(true); };
    const onVis = () => { if (document.hidden) onBlur(); };
    frame.addEventListener('pointerdown', onDown);
    addEventListener('pointerup', onUp);
    const onCancel = () => { S.boost = false; };
    addEventListener('pointercancel', onCancel);
    frame.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('keydown', onKey); addEventListener('keyup', onKeyUp);
    addEventListener('blur', onBlur); document.addEventListener('visibilitychange', onVis);
    const boostBtn = frame.querySelector('#lpBoost');
    boostBtn.addEventListener('pointerdown', e => { e.preventDefault(); if (S.over || S.paused) return; S.boost = true; boostBtn.setPointerCapture(e.pointerId); });
    boostBtn.addEventListener('pointerup', () => { S.boost = false; });
    boostBtn.addEventListener('pointercancel', () => { S.boost = false; });
    frame.querySelector('[data-resume]').onclick = () => setPause(false);

    function step(dt) {
      if (dead || S.paused) return;
      S.t += dt;
      particles.step(dt);
      for (const f of S.fx) f.t += dt;
      S.fx = S.fx.filter(f => f.t < .9);
      for (const p of trail) p.age += dt;
      while (trail.length && trail[0].age > .14) trail.shift();
      if (S.endIn !== null) { S.endIn -= dt; if (S.endIn <= 0) { S.endIn = null; api.end(S.score, 'Время вышло'); } }
      if (S.over) return;
      if (S.ready > 0) { const remaining = Math.max(0, dt - S.ready); S.ready = Math.max(0, S.ready - dt); if (!remaining) return; dt = remaining; }
      const before = Math.ceil(S.time);
      S.time -= dt;
      if (S.time > 0 && S.time <= 5 && Math.ceil(S.time) !== before) api.sfx('tick');
      if (S.off > 0) S.off -= dt;
      S.shake = Math.max(0, S.shake - dt);
      S.action = Math.max(0, S.action - dt); S.scorePop = Math.max(0, S.scorePop - dt); S.timePop = Math.max(0, S.timePop - dt);
      const speed = (190 + 120 * diff()) * (S.boost ? 2.1 : 1) * (S.off > 0 ? .3 : 1);
      S.angle = (S.angle + S.dir * speed * dt + 360) % 360;
      trail.push({ angle: S.angle, age: 0 });
      if (trail.length > 32) trail.shift();
      for (const z of S.zones) z.age += dt;
      for (const z of S.zones.filter(z => z.age >= z.life)) {
        S.zones.splice(S.zones.indexOf(z), 1);
        if (z.kind === 'gold') spawn('gold'); else S.blueIn = rnd(2.5, 5);
      }
      if (!S.zones.some(z => z.kind === 'blue')) { S.blueIn -= dt; if (S.blueIn <= 0) spawn('blue'); }
      if (S.time <= 0) { S.time = 0; S.over = true; S.boost = false; S.endIn = 1.5; }
    }
    function render() {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(scene, 0, 0);
      g.setTransform(scale, 0, 0, scale, 0, 0);
      drawPrisoner(g, slark, S.t, ArcadeFX.reduced() ? 0 : S.shake);
      flame(g, 96, 228, S.t, 1); flame(g, 506, 168, S.t, 4);
      // Ambient candle motes use game time, so pausing freezes the entire scene.
      if (!ArcadeFX.reduced()) for (const [x, y] of [[96, 218], [506, 158]]) for (let k = 0; k < 6; k++) {
        const age = (S.t * .24 + k / 6) % 1;
        g.globalAlpha = Math.sin(age * Math.PI) * .38; g.fillStyle = '#ffca76';
        g.beginPath(); g.arc(x + Math.sin(age * 7 + k) * 12, y - age * 90, 1.2, 0, 7); g.fill();
      }
      g.globalAlpha = 1;
      const motion = ArcadeFX.reduced() ? 0 : Math.sin(S.t * Math.PI / 2) * .32;
      const jolt = ArcadeFX.reduced() ? 0 : S.shake;
      frame.querySelector('.lp-plate').style.transform = `translateX(-50%) translateY(${Math.sin(jolt * 40) * jolt * -50}px) rotate(${motion + Math.sin(jolt * 60) * jolt * 7}deg)`;
      g.save();
      if (jolt > 0) g.translate(Math.sin(S.t * 90) * jolt * 25, 0);
      else if (!ArcadeFX.reduced() && S.action > 0) g.translate(Math.sin(S.action * 80) * 2, Math.sin(S.action * 40) * 2);
      drawLockBody(g, jolt);
      for (const z of S.zones) {
        g.globalAlpha = z.kind === 'blue' ? .925 + .075 * Math.cos(S.t * Math.PI / .3) : 1;
        drawZone(g, z, width(z), 0);
      }
      g.globalAlpha = 1;
      for (const f of S.fx) if (f.kind === 'burst') { g.globalAlpha = Math.max(0, 1 - f.t / .45); drawZone(g, f.z, f.w * (1 + f.t * 1.6), 1); g.globalAlpha = 1; }
      if (!ArcadeFX.reduced()) for (const p of trail) {
        const a = rad(p.angle);
        g.globalAlpha = Math.max(0, 1 - p.age / .14) * (S.boost ? .25 : .12);
        g.strokeStyle = S.off > 0 ? '#ff6342' : '#c8efff'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(CX + Math.cos(a) * R_IN, CY + Math.sin(a) * R_IN); g.lineTo(CX + Math.cos(a) * R_OUT, CY + Math.sin(a) * R_OUT); g.stroke();
      }
      g.globalAlpha = 1;
      drawPick(g, S.angle, S.off > 0 ? 'off' : 'on');
      drawHub(g, S.time, S.score, S.ready > 0);
      const pulse = S.off > 0 ? Math.min(1, S.off / MISS_LOCK) : Math.max(S.scorePop / .3, S.timePop / .5);
      if (pulse > 0) {
        g.strokeStyle = S.off > 0 ? '#ff5844' : S.timePop > 0 ? '#a8e5ff' : '#ffe477';
        g.globalAlpha = pulse * .7; g.lineWidth = 3; g.shadowColor = g.strokeStyle; g.shadowBlur = 16;
        g.beginPath(); g.arc(CX, CY, R_HUB + 2, 0, 7); g.stroke(); g.shadowBlur = 0; g.globalAlpha = 1;
      }
      particles.draw(g);
      g.restore();
      g.textAlign = 'center';
      for (const f of S.fx) if (f.kind === 'text') {
        const duration = f.text.includes('с') ? .5 : .9;
        g.globalAlpha = Math.max(0, 1 - f.t / duration); g.fillStyle = f.color; g.font = `700 24px ${FONT}`;
        g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 4; g.strokeText(f.text, f.x, f.y - f.t * 40); g.fillText(f.text, f.x, f.y - f.t * 40);
        g.globalAlpha = 1;
      }
    }
    function loop(now) {
      if (dead) return;
      let dt = Math.max(0, (now - (last || now)) / 1000); last = now;
      if (dt > 1) { setPause(true); dt = 0; }
      while (dt > 0) { const slice = Math.min(dt, 1 / 120); step(slice); dt -= slice; }
      render();
      raf = requestAnimationFrame(loop);
    }
    resize(); render();
    document.fonts?.load(`700 20px "Philosopher"`).then(() => !dead && render());
    raf = requestAnimationFrame(loop);

    return {
      destroy() {
        dead = true; cancelAnimationFrame(raf); ro.disconnect();
        particles.clear(); removeEventListener('pointercancel', onCancel);
        removeEventListener('pointerup', onUp); removeEventListener('keydown', onKey); removeEventListener('keyup', onKeyUp);
        removeEventListener('blur', onBlur); document.removeEventListener('visibilitychange', onVis);
      },
      _state: S, _step: step, _pick: pick, _draw: render,   // для проверок из консоли
    };
  }

  const ticket = n => `<span class="ar-tickets">${'<i>?</i>'.repeat(n)}</span>`;
  Arcade.register({
    id: 'lockpick', theme: 'carnival', title: 'Взлом замка',
    subtitle: 'Помогите Сларку выбраться из камеры!',
    how: `<p class="ar-lead">Взломайте замок, как можно больше раз попав в отмеченные области за отведённое время.</p>
      <div class="ar-step">${Arcade.MOUSE('l', 'ЛКМ')}<div><b>Взлом</b><p>Нажмите кнопку взлома, когда деление достигнет выделенной области.</p><p>Промах ненадолго отключит взлом.</p><p>Синие области дают дополнительное время.</p></div></div>
      <div class="ar-step">${Arcade.MOUSE('r', 'ПКМ')}<div><b>Ускорение</b><p>Удерживайте эту кнопку для ускорения.</p></div></div>
      <div class="ar-step">${Arcade.KEY('F9')}<div><b>Пауза</b><p>Остановить игру. На телефоне: тап — взлом, кнопка «»» — ускорение.</p></div></div>`,
    scoring: [['Каждое попадание', '1 000'], ['Синяя область', '+1,5 секунды']],
    rewards: [
      { at: 6000, pic: '<span class="ar-token lp"></span>', label: 'Билет дальше' },
      { at: 12000, pic: ticket(3), label: '3 случайных билета' },
      { at: 18000, pic: ticket(5), label: '5 случайных билетов' },
      { at: 24000, pic: '<span class="ar-emo" style="--img:url(https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/slark.png)"></span>', label: 'Смайлик Сларка' },
    ],
    mount,
  });
})();
