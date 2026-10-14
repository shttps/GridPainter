'use strict';
/* «Сапёр Сплин» (Spleen Sweeper) — сапёр Кеза и Сплина из «Коронопада», в 2025–2026 доступен в мини-играх поиска матча.
   5 этапов: 9×9 (10 мин), 12×11, 15×13, 18×14 (43 мины), 20×16. На каждый этап — свой таймер.
   ЛКМ — открыть клетку (по числу с нужным числом флажков — открыть соседей), ПКМ — флажок.
   «1» — Echo Slash Кеза: 50 маны, иллюзия безопасно открывает клетку и обезвреживает мину, если она там.
   Предметы появляются на поле и пропадают через 5 ходов: кларити +25 маны, часы +30 секунд.
   Предмет может лежать на мине — ПКМ по нему перекладывает его на соседнюю клетку.
   Очки: этап — 4 000 (все пять — 20 000) и 20 за каждую оставшуюся секунду. Награды: 5 000, 15 000, 32 000, 35 000.
   Клетки — заранее нарисованные спрайты (трава в шахматку, земля с камешками, флажок, мина, предметы) под текущий размер. */
(() => {
  const STAGES = [
    { w: 9, h: 9, m: 10, t: 120 },
    { w: 12, h: 11, m: 20, t: 180 },
    { w: 15, h: 13, m: 30, t: 240 },
    { w: 18, h: 14, m: 43, t: 300 },
    { w: 20, h: 16, m: 60, t: 360 },
  ];
  const STAGE_POINTS = 4000, SEC_POINTS = 20;
  const MANA_MAX = 250, MANA_START = 100, SLASH_COST = 50, CLARITY = 25, CLOCK = 30, ITEM_MOVES = 5;
  const NUM_COL = ['', '#87b537', '#c5e030', '#ffe100', '#ffa500', '#ff6200', '#ff4500', '#ff0000', '#ff0000'];
  const FONT = '"Philosopher", "Onest", sans-serif';
  const CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/';
  const FX = window.ArcadeFX;
  const RIPPLE = .028;                     // задержка волны открытия на клетку, с
  const rnd = (a, b) => a + Math.random() * (b - a);
  const mmss = t => { t = Math.max(0, Math.ceil(t)); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
  const hash = (i, k) => { let x = (Math.imul(i, 374761393) + Math.imul(k, 668265263)) >>> 0; x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0; return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
  const CLOCK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 9v4.5l3 2M9 2.5h6M4.5 6.5l2-2M19.5 6.5l-2-2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  const BOMB_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="14" r="7.5" fill="currentColor"/><path d="M15 8.5l2.5-2.5M17 4.5l1 1M19.5 3.5v2M21 6h-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="11.5" r="1.8" fill="#000" opacity=".35"/></svg>';
  const CONFETTI = ['#ffd760', '#87b537', '#ff6a6a', '#8fd0ff', '#ffffff', '#ffa500'];

  // ---------- рисование клеток (в спрайты) ----------
  function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
  // трава: светлая/тёмная в шахматку, у каждой из 4 вариаций свои травинки и цветочки
  function grass(g, s, shade, v) {
    g.fillStyle = '#2b3c11'; g.fillRect(0, 0, s, s);
    const gr = g.createLinearGradient(0, 0, 0, s);
    if (shade) { gr.addColorStop(0, '#8ab43a'); gr.addColorStop(1, '#678f25'); }
    else { gr.addColorStop(0, '#7a9d30'); gr.addColorStop(1, '#56761d'); }
    g.save(); rr(g, 1, 1, s - 2, s - 2, Math.max(2, s * .12)); g.fillStyle = gr; g.fill(); g.clip();
    FX.texture(g, 0, 0, s, s, { seed: 50 + v, size: 64, k: .4, scale: s / 48 });
    // травинки: тёмные и светлые штрихи с наклоном
    const blades = 7 + Math.floor(hash(v, 3) * 5);
    for (let k = 0; k < blades; k++) {
      const gx = s * (.12 + hash(v * 31 + k, 1) * .76), gy = s * (.2 + hash(v * 31 + k, 2) * .7), len = s * (.1 + hash(k, v) * .1), lean = (hash(k, v + 9) - .5) * s * .08;
      g.strokeStyle = hash(k, v + 4) < .55 ? 'rgba(30,58,8,.55)' : 'rgba(220,255,160,.28)'; g.lineWidth = Math.max(1, s * .035); g.lineCap = 'round';
      g.beginPath(); g.moveTo(gx, gy); g.quadraticCurveTo(gx + lean * .3, gy - len * .6, gx + lean, gy - len); g.stroke();
    }
    // цветочки «+» (жёлтые) и белые точки
    const n = hash(v, 1) < .5 ? 1 : hash(v, 2) < .6 ? 2 : 0;
    for (let k = 0; k < n; k++) {
      const fx = s * (.2 + hash(v, k * 3 + 4) * .6), fy = s * (.2 + hash(v, k * 3 + 5) * .6), r = Math.max(1.2, s * .055);
      g.fillStyle = hash(v, k + 30) < .5 ? '#f0c64c' : '#e2ad3c';
      g.fillRect(fx - r * 1.6, fy - r * .5, r * 3.2, r); g.fillRect(fx - r * .5, fy - r * 1.6, r, r * 3.2);
      g.fillStyle = '#fff3c0'; g.fillRect(fx - r * .5, fy - r * .5, r, r);
    }
    if (v === 3) for (let k = 0; k < 3; k++) { g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(s * (.25 + k * .22), s * (.7 - k * .15), Math.max(.8, s * .025), 0, 7); g.fill(); }
    g.restore();
    // фаска: свет сверху, тень снизу
    g.fillStyle = 'rgba(255,255,220,.16)'; g.fillRect(2, 1.5, s - 4, Math.max(1, s * .07));
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(2, s - 1 - s * .09, s - 4, s * .09);
  }
  // земля: тёплая, с камешками, корешками и тёмными крапинками
  function dirt(g, s, v) {
    g.fillStyle = '#3e2919'; g.fillRect(0, 0, s, s);
    g.fillStyle = v % 2 ? '#5e4130' : '#583b2a'; g.fillRect(.5, .5, s - 1, s - 1);
    FX.texture(g, 0, 0, s, s, { seed: 60 + v, size: 64, k: .5, scale: s / 40 });
    for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(hash(v, k + 40) * (s - 3), hash(v, k + 50) * (s - 3), Math.max(1.5, s * .05), Math.max(1.5, s * .05)); }
    const pebbles = 1 + Math.floor(hash(v, 7) * 3);
    for (let k = 0; k < pebbles; k++) {
      const px = s * (.15 + hash(v, k + 70) * .7), py = s * (.15 + hash(v, k + 80) * .7), pr = s * (.04 + hash(v, k + 90) * .05);
      g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(px + pr * .3, py + pr * .4, pr, pr * .75, 0, 0, 7); g.fill();
      g.fillStyle = hash(v, k) < .5 ? '#8a7360' : '#76604e'; g.beginPath(); g.ellipse(px, py, pr, pr * .75, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(px - pr * .3, py - pr * .3, pr * .35, pr * .25, 0, 0, 7); g.fill();
    }
    if (v === 2) { g.strokeStyle = 'rgba(40,24,12,.6)'; g.lineWidth = Math.max(1, s * .03); g.beginPath(); g.moveTo(s * .1, s * .8); g.quadraticCurveTo(s * .4, s * .6, s * .7, s * .85); g.stroke(); }
  }
  function number(g, x, y, s, n) {
    g.font = `700 ${Math.round(s * .62)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillText(n, x + s / 2 + s * .04, y + s / 2 + 1 + s * .05);
    g.lineWidth = Math.max(2, s * .1); g.strokeStyle = 'rgba(20,10,4,.85)'; g.strokeText(n, x + s / 2, y + s / 2 + 1);
    g.fillStyle = NUM_COL[n]; g.fillText(n, x + s / 2, y + s / 2 + 1);
  }
  // флажок — красная табличка с «грибом» взрыва, как у Техиков
  function flag(g, x, y, s) {
    const cx = x + s / 2;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(cx + s * .04, y + s * .88, s * .16, s * .05, 0, 0, 7); g.fill();
    g.fillStyle = '#4a2d18'; g.fillRect(cx - s * .04, y + s * .5, s * .08, s * .4);
    g.fillStyle = '#6e1a26'; rr(g, x + s * .16, y + s * .14, s * .68, s * .48, s * .07); g.fill();
    const fg = g.createLinearGradient(0, y + s * .17, 0, y + s * .59); fg.addColorStop(0, '#e2566c'); fg.addColorStop(1, '#b8344a');
    g.fillStyle = fg; rr(g, x + s * .19, y + s * .17, s * .62, s * .42, s * .05); g.fill();
    g.fillStyle = '#ffe8ec';
    g.beginPath(); g.ellipse(cx, y + s * .3, s * .17, s * .085, 0, 0, 7); g.fill();
    g.fillRect(cx - s * .045, y + s * .32, s * .09, s * .16);
    g.beginPath(); g.ellipse(cx, y + s * .5, s * .14, s * .04, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x + s * .2, y + s * .18, s * .6, s * .05);
  }
  function mine(g, x, y, s, blown) {
    if (blown) { const bg = g.createRadialGradient(x + s / 2, y + s / 2, 1, x + s / 2, y + s / 2, s * .7); bg.addColorStop(0, '#ff5a3a'); bg.addColorStop(1, '#8a1f12'); g.fillStyle = bg; g.fillRect(x + 1, y + 1, s - 2, s - 2); }
    const cx = x + s / 2, cy = y + s / 2 + s * .04, r = s * .28;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(cx + r * .2, cy + r * .95, r * .9, r * .3, 0, 0, 7); g.fill();
    g.strokeStyle = '#1b1a1d'; g.lineWidth = Math.max(1.5, s * .07); g.lineCap = 'round';
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(cx + Math.cos(a) * r * .8, cy + Math.sin(a) * r * .8); g.lineTo(cx + Math.cos(a) * r * 1.25, cy + Math.sin(a) * r * 1.25); g.stroke(); }
    const mg = g.createRadialGradient(cx - r * .35, cy - r * .35, r * .1, cx, cy, r);
    mg.addColorStop(0, '#5a5760'); mg.addColorStop(.6, '#232126'); mg.addColorStop(1, '#141316');
    g.fillStyle = mg; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    g.fillStyle = '#ff3b2a'; g.beginPath(); g.arc(cx + r * .1, cy - r * .05, r * .2, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,200,180,.7)'; g.beginPath(); g.arc(cx + r * .03, cy - r * .12, r * .07, 0, 7); g.fill();
  }
  function clarity(g, x, y, s, bob) {
    const cx = x + s / 2, cy = y + s / 2 + bob;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(cx, y + s * .86, s * .22, s * .06, 0, 0, 7); g.fill();
    const b = g.createLinearGradient(cx - s * .2, 0, cx + s * .2, 0); b.addColorStop(0, '#2a6fd1'); b.addColorStop(.5, '#7fd0ff'); b.addColorStop(1, '#2557b0');
    g.fillStyle = b; g.beginPath(); g.ellipse(cx, cy + s * .1, s * .2, s * .22, 0, 0, 7); g.fill();
    g.fillStyle = '#9fe2ff'; g.fillRect(cx - s * .07, cy - s * .24, s * .14, s * .16);
    g.fillStyle = '#c8a26a'; g.fillRect(cx - s * .08, cy - s * .3, s * .16, s * .08);
    g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(cx - s * .08, cy + s * .04, s * .04, s * .08, 0, 0, 7); g.fill();
  }
  function clock(g, x, y, s, bob) {
    const cx = x + s / 2, cy = y + s / 2 + s * .05 + bob, r = s * .27;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(cx, y + s * .88, s * .22, s * .06, 0, 0, 7); g.fill();
    g.fillStyle = '#c99a2e'; g.fillRect(cx - s * .05, cy - r - s * .12, s * .1, s * .1);
    const gd = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r); gd.addColorStop(0, '#ffe08a'); gd.addColorStop(1, '#b07d1c');
    g.fillStyle = gd; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    g.fillStyle = '#fbf3df'; g.beginPath(); g.arc(cx, cy, r * .74, 0, 7); g.fill();
    g.strokeStyle = '#3a2a10'; g.lineWidth = Math.max(1.2, s * .045); g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy - r * .55); g.moveTo(cx, cy); g.lineTo(cx + r * .4, cy + r * .1); g.stroke();
  }
  // набор спрайтов под размер клетки s (в css-пикселях) и плотность экрана d
  function makeSprites(s, d) {
    const px = Math.max(1, Math.round(s * d));
    const make = draw => { const c = document.createElement('canvas'); c.width = c.height = px; const x = c.getContext('2d'); x.scale(px / s, px / s); draw(x); return c; };
    return {
      grass: [0, 1].map(shade => [0, 1, 2, 3].map(v => make(x => grass(x, s, shade, v)))),
      dirt: [0, 1, 2, 3].map(v => make(x => dirt(x, s, v))),
      flag: make(x => flag(x, 0, 0, s)),
      mine: make(x => mine(x, 0, 0, s, false)),
      blown: make(x => mine(x, 0, 0, s, true)),
    };
  }
  const grassOf = (sp, i, w) => sp.grass[((i % w) + ((i / w) | 0)) % 2][Math.floor(hash(i, 1) * 4)];
  const dirtOf = (sp, i) => sp.dirt[Math.floor(hash(i, 7) * 4)];
  // тени на открытой клетке от травы сверху и слева — поле выглядит объёмным
  function edgeShade(g, x, y, s, top, left) {
    if (top) { const sg = g.createLinearGradient(0, y, 0, y + s * .26); sg.addColorStop(0, 'rgba(0,0,0,.5)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sg; g.fillRect(x, y, s, s * .26); }
    if (left) { const sg = g.createLinearGradient(x, 0, x + s * .22, 0); sg.addColorStop(0, 'rgba(0,0,0,.4)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sg; g.fillRect(x, y, s * .22, s); }
  }

  // ---------- игра ----------
  function mount(shell, api) {
    shell.innerHTML = `<div class="sw-frame" id="swFrame">
      <div class="sw-bg" aria-hidden="true"><i class="sw-cloud a"></i><i class="sw-cloud b"></i><i class="sw-hills"></i><img class="sw-side l" src="${CDN}heroes/techies_vert.jpg" alt=""><img class="sw-side r" src="${CDN}heroes/kez_vert.jpg" alt=""><span class="sw-sign"></span></div>
      <div class="sw-panel">
        <div class="sw-hud">
          <div class="sw-score"><small>Очки</small><b id="swScore">0</b></div>
          <div class="sw-clock">${CLOCK_SVG}<b id="swTime">00:00</b></div>
          <div class="sw-mines" title="Осталось мин">${BOMB_SVG}<b id="swMines">0</b></div>
          <div class="sw-stage" id="swStage"></div>
        </div>
        <div class="sw-board-wrap"><canvas class="sw-board" id="swBoard" aria-label="Минное поле"></canvas>
          <div class="sw-banner" id="swBanner" hidden></div>
          <div class="ar-pause" id="swPause" hidden><b>Пауза</b><small>F9 или Esc — продолжить</small><button class="ar-btn" data-resume>Продолжить</button></div>
        </div>
      </div>
      <div class="sw-bottom">
        <button class="sw-skill" id="swSkill" type="button" title="Echo Slash — иллюзия безопасно открывает клетку (клавиша 1)"><i class="sw-hot">1</i><i class="sw-cost">${SLASH_COST}</i></button>
        <div class="sw-mana"><i id="swManaFill"></i><b id="swMana"></b></div>
        <button class="sw-flagmode" id="swFlagMode" type="button" aria-pressed="false" title="Режим флажков (для телефона)">⚑</button>
      </div>
    </div>`;
    const frame = shell.querySelector('#swFrame'), cv = shell.querySelector('#swBoard'), g = cv.getContext('2d');
    const $id = id => shell.querySelector('#' + id);

    const S = { stage: 0, score: 0, shownScore: 0, mana: MANA_START, time: 0, paused: false, over: false, busy: false, armed: false, flagMode: false, t: 0 };
    let B = null;   // поле текущего этапа
    let tile = 30, dpr = 1, hover = -1, dead = false, raf = 0, last = 0, dirty = true, fx = [], sprites = null, birdIn = rnd(4, 9);
    const particles = new FX.Particles(), pending = [], chunks = [];
    const schedule = (delay, run) => { pending.push({ at: S.t + delay, run }); pending.sort((a, b) => a.at - b.at); };
    const valid = i => Number.isInteger(i) && i >= 0 && i < B.n;
    const playable = i => !dead && !S.over && !S.busy && !S.paused && valid(i);
    const panOf = i => ((i % B.w) / Math.max(1, B.w - 1) - .5) * .9;
    const soundAt = (name, i) => api.sfx(name, { pan: panOf(i) });
    const cx = i => i % B.w + .5, cy = i => Math.floor(i / B.w) + .5;
    function burst(i, color, count = 16, speed = 2) {
      // Particle positions are in cells: resizing never detaches FX from their tile.
      particles.emit({ x: cx(i), y: cy(i), color, count, speed, gravity: 3 });
    }
    function invalid(i, quiet) { if (valid(i)) fx.push({ kind: 'invalid', i, t: 0 }); if (!quiet) api.sfx('invalid'); dirty = true; }

    function newStage(k) {
      const st = STAGES[k], n = st.w * st.h;
      B = { ...st, n, mines: st.m, mine: new Uint8Array(n), open: new Uint8Array(n), flag: new Uint8Array(n), num: new Uint8Array(n), revealedAt: new Float64Array(n).fill(-10), flaggedAt: new Float64Array(n).fill(-10), mineAt: new Float64Array(n).fill(-1), placed: false, opened: 0, items: new Map(), spawnIn: rnd(6, 11), blown: -1, exploded: false, scorch: -1 };
      S.stage = k; S.time = st.t; S.busy = false; S.armed = false; fx = []; chunks.length = 0;
      particles.clear(); hover = -1; frame.classList.remove('shake', 'low');
      $id('swStage').textContent = `Этап ${k + 1} из ${STAGES.length}`;
      layout(); hud(); dirty = true;
      if (k) fx.push({ kind: 'stagein', t: 0 });
    }
    const nb = i => { const x = i % B.w, y = (i / B.w) | 0, out = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < B.w && ny < B.h) out.push(ny * B.w + nx); } return out; };
    const count = i => nb(i).reduce((s, j) => s + B.mine[j], 0);
    const dist = (a, b) => Math.hypot(a % B.w - b % B.w, Math.floor(a / B.w) - Math.floor(b / B.w));
    // мины раскладываются после первого хода — первая клетка и её соседи пустые
    function place(safe) {
      const ban = new Set([safe, ...nb(safe)]), pool = [];
      for (let i = 0; i < B.n; i++) if (!ban.has(i)) pool.push(i);
      for (let k = 0; k < B.m; k++) { const j = k + Math.floor(Math.random() * (pool.length - k)); [pool[k], pool[j]] = [pool[j], pool[k]]; B.mine[pool[k]] = 1; }
      for (let i = 0; i < B.n; i++) B.num[i] = count(i);
      B.placed = true;
    }
    // открытие волной: клетки логически открыты сразу, а на экране траву «срывает» по очереди от точки нажатия
    function flood(start, origin = start) {
      const q = [start]; let got = 0, head = 0;
      while (head < q.length) {
        const i = q[head++];
        if (B.open[i] || B.flag[i]) continue;
        B.open[i] = 1; B.opened++; got++;
        const delay = Math.min(.7, dist(i, origin) * RIPPLE);
        B.revealedAt[i] = S.t + delay;
        chunks.push({ at: S.t + delay, i });
        const it = B.items.get(i); if (it) take(i, it);
        if (!B.num[i]) for (const j of nb(i)) if (!B.open[j] && !B.mine[j]) q.push(j);
      }
      chunks.sort((a, b) => a.at - b.at);
      return got;
    }
    function take(i, it) {
      B.items.delete(i);
      if (it.type === 'clarity') { const gain = Math.min(CLARITY, MANA_MAX - S.mana); S.mana += gain; fxText(i, `+${gain} маны`, '#8fd0ff'); flashEl(frame.querySelector('.sw-mana')); }
      else { S.time += CLOCK; fxText(i, '+30 с', '#ffd977'); flashEl($id('swTime').parentNode); }
      fx.push({ kind: 'pickup', i, color: it.type === 'clarity' ? '#8fd0ff' : '#ffd977', t: 0 });
      burst(i, it.type === 'clarity' ? '#8fd0ff' : '#ffd977', 22);
      particles.emit({ x: cx(i), y: cy(i), color: it.type === 'clarity' ? '#d6f2ff' : '#fff2b0', count: 6, speed: .6, gravity: -.6, shape: 'glint', size: 1.4, life: 1.2 });
      soundAt(it.type, i);
    }
    const flashEl = el => el?.animate?.([{ filter: 'brightness(2.2)', transform: 'scale(1.06)' }, { filter: 'none', transform: 'none' }], { duration: 450, easing: 'ease-out' });
    // после каждого хода (открытия клеток) предметы тают: число на предмете — сколько ходов осталось
    function tickItems() {
      for (const [i, it] of B.items) if (--it.left <= 0) {
        B.items.delete(i); fx.push({ kind: 'expire', i, type: it.type, t: 0 }); soundAt('expire', i);
        particles.emit({ x: cx(i), y: cy(i), color: '#cfd8c0', count: 5, speed: .4, gravity: -.8, shape: 'smoke', size: 1.4, life: 1 });
      }
    }
    function reveal(i) {
      if (!playable(i)) return;
      if (B.open[i]) { chord(i); return; }
      if (B.flag[i]) { invalid(i); return; }
      if (!B.placed) place(i);
      if (B.mine[i]) { boom(i); return; }
      const got = flood(i); burst(i, '#d5b775', 10, 1.2);
      soundAt('reveal', i); if (got > 14) api.amb?.('cascade', { pan: panOf(i), count: Math.round(got / 8) });
      tickItems(); afterMove();
    }
    function chord(i) {
      if (!playable(i) || !B.open[i]) return;
      if (!B.num[i]) return;
      const ns = nb(i), flags = ns.filter(j => B.flag[j]).length;
      if (flags !== B.num[i]) { invalid(i); fx.push({ kind: 'hint', i, t: 0 }); return; }
      const hit = ns.find(j => !B.open[j] && !B.flag[j] && B.mine[j]);
      if (hit != null) { boom(hit); return; }
      let got = 0; for (const j of ns) if (!B.open[j] && !B.flag[j]) got += flood(j, i);
      if (got) { soundAt('reveal', i); tickItems(); afterMove(); }
    }
    function toggleFlag(i) {
      if (!playable(i)) return;
      if (B.open[i]) return;
      const it = B.items.get(i);
      if (it) { moveItem(i, it); return; }
      B.flag[i] ^= 1; B.flaggedAt[i] = S.t; soundAt(B.flag[i] ? 'flag' : 'unflag', i); hud(); dirty = true;
      if (!B.flag[i]) fx.push({ kind: 'unflag', i, t: 0 });
      else schedule(.18, () => particles.emit({ x: cx(i), y: cy(i) + .38, color: ['#8a6a48', '#6d5038'], count: 5, speed: .9, gravity: -.2, shape: 'smoke', size: 1.1, life: .7, angle: -Math.PI / 2, spread: Math.PI * 1.2 }));
    }
    // ПКМ по предмету: он перепрыгивает на соседнюю закрытую клетку (если её нет — на любую)
    function moveItem(i, it) {
      const free = j => !B.open[j] && !B.flag[j] && !B.items.has(j);
      let opts = nb(i).filter(free);
      if (!opts.length) { opts = []; for (let j = 0; j < B.n; j++) if (free(j)) opts.push(j); }
      if (!opts.length) return;
      const target = opts[Math.floor(Math.random() * opts.length)];
      B.items.delete(i); B.items.set(target, { ...it, born: S.t, movingUntil: S.t + .25 });
      fx.push({ kind: 'move', i, target, type: it.type, t: 0 });
      soundAt('move', i); dirty = true;
    }
    function slash(i) {
      if (!playable(i)) return;
      if (B.open[i] || S.mana < SLASH_COST) { S.armed = false; skillUI(); invalid(i); return; }
      if (!B.placed) place(i);
      S.mana -= SLASH_COST; S.armed = false;
      B.flag[i] = 0;
      if (B.mine[i]) {   // иллюзия Кеза обезвреживает мину
        B.mine[i] = 0; B.mines--;
        for (const j of [i, ...nb(i)]) B.num[j] = count(j);
        fxText(i, 'Обезврежено', '#bfe7ff');
        schedule(.18, () => { burst(i, '#9ee5ff', 24, 3); soundAt('defuse', i); });
      }
      fx.push({ kind: 'slash', i, t: 0 });
      burst(i, '#aeeaff', 22, 2.5);
      frame.classList.remove('slashfx'); void frame.offsetWidth; frame.classList.add('slashfx');
      flood(i); soundAt('slash', i); tickItems(); afterMove();
    }
    function boom(i) {
      B.blown = i; S.over = true; S.busy = true;
      fx.push({ kind: 'prime', i, t: 0 }); soundAt('prime', i);
      schedule(.4, () => {
        B.exploded = true; B.scorch = i; fx.push({ kind: 'boom', i, t: 0 }, { kind: 'shock', i, t: 0 }); soundAt('boom', i);
        burst(i, '#ffc26b', 65, 5);
        particles.emit({ x: cx(i), y: cy(i), color: ['#5e4130', '#3e2919', '#7a9d30'], count: 26, speed: 4.5, gravity: 14, shape: 'chunk', size: 2.6, life: 1.6 });
        particles.emit({ x: cx(i), y: cy(i), color: ['#3a3236', '#4b4246'], count: 12, speed: 1.2, gravity: -1.2, shape: 'smoke', size: 2.4, life: 2.2, drag: 1.5 });
        particles.emit({ x: cx(i), y: cy(i), color: '#ffb35a', count: 16, speed: 2.5, gravity: 2, shape: 'ember', size: 1.4, life: 1.8 });
        frame.classList.add('shake'); dirty = true;
        revealMines(i, .15);
      });
      dirty = true; hud();
      schedule(1.8, () => api.end(S.score, 'Подрыв!'));
    }
    // остальные мины проявляются волной от места взрыва (или от центра, если кончилось время)
    function revealMines(from, delay) {
      let k = 0;
      for (let j = 0; j < B.n; j++) if (B.mine[j] && j !== from && !B.flag[j]) {
        const at = delay + dist(j, from) * .045; B.mineAt[j] = S.t + at;
        if (k++ < 12) schedule(at, () => { api.amb?.('pop', { pan: panOf(j), volume: .5 }); particles.emit({ x: cx(j), y: cy(j), color: '#ff9a55', count: 5, speed: 1.4, gravity: 3 }); });
      }
    }
    function afterMove() {
      hud(); dirty = true;
      if (B.opened >= B.n - B.mines) clearStage();
    }
    function clearStage() {
      S.busy = true;
      const bonus = Math.ceil(S.time) * SEC_POINTS, gain = STAGE_POINTS + bonus;
      S.score += gain; hud(); api.sfx('stage');
      let k = 0;
      for (let i = 0; i < B.n; i++) if (B.mine[i] && !B.flag[i]) { B.flag[i] = 1; B.flaggedAt[i] = S.t + .35 + (k++) * .04; }
      hud();
      fx.push({ kind: 'shine', t: 0 });
      // конфетти сыплется сверху по всему полю
      for (let c = 0; c < 6; c++) schedule(c * .12, () => particles.emit({ x: rnd(0, B.w), y: -.5, color: CONFETTI, count: 14, speed: 2.5, gravity: 7, shape: 'chunk', size: 2.2, life: 2.6, angle: Math.PI / 2, spread: 1.6, drag: .8 }));
      const last = S.stage === STAGES.length - 1;
      banner(`<b>${last ? 'Все мины найдены!' : `Этап ${S.stage + 1} пройден`}</b><span>${Arcade.fmt(STAGE_POINTS)} + ${Arcade.fmt(bonus)} за время</span>`);
      schedule(1.9, () => {
        if (dead) return;
        banner('');
        if (last) { S.over = true; api.end(S.score, 'Победа'); } else newStage(S.stage + 1);
      });
    }
    function banner(html) { const b = $id('swBanner'); b.innerHTML = html; b.hidden = !html; }
    function fxText(i, text, color) { fx.push({ kind: 'text', i, text, color, t: 0 }); }
    function spawnItem() {
      if (B.items.size >= 2 || !B.placed) return;
      const free = []; for (let j = 0; j < B.n; j++) if (!B.open[j] && !B.flag[j] && !B.items.has(j)) free.push(j);
      if (!free.length) return;
      const i = free[Math.floor(Math.random() * free.length)], type = Math.random() < .55 ? 'clarity' : 'clock';
      B.items.set(i, { type, left: ITEM_MOVES, born: S.t });
      fx.push({ kind: 'spawn', i, color: type === 'clarity' ? '143,208,255' : '255,217,119', t: 0 });
      particles.emit({ x: cx(i), y: cy(i), color: '#ffffff', count: 6, speed: .9, gravity: -.4, shape: 'glint', size: 1.3, life: 1.2 });
      api.amb?.('itemspawn', { pan: panOf(i) });
      dirty = true;
    }

    // ---------- интерфейс ----------
    function hud() {
      $id('swScore').textContent = Arcade.fmt(Math.round(S.shownScore));
      $id('swMines').textContent = Math.max(0, B.mines - B.flag.reduce((s, v) => s + v, 0));
      $id('swTime').textContent = mmss(S.time);
      $id('swTime').parentNode.classList.toggle('low', S.time <= 15);
      frame.classList.toggle('low', S.time <= 10 && S.time > 0 && B.placed && !S.over && !S.busy);
      $id('swMana').textContent = `${S.mana} / ${MANA_MAX}`;
      $id('swManaFill').style.width = (S.mana / MANA_MAX * 100) + '%';
      skillUI();
    }
    function skillUI() {
      const b = $id('swSkill');
      b.classList.toggle('armed', S.armed); b.classList.toggle('nomana', S.mana < SLASH_COST);
      frame.classList.toggle('slashing', S.armed);
    }
    function layout() {
      const wrap = cv.parentNode;
      const aw = Math.min(wrap.clientWidth || 600, 900), ah = Math.max(200, wrap.clientHeight || 500);
      const t = Math.max(14, Math.min(60, Math.floor(Math.min((aw - 16) / B.w, (ah - 16) / B.h))));   // 16 — рамка поля
      const d = Math.min(2, devicePixelRatio || 1);
      if (!sprites || t !== tile || d !== dpr) sprites = makeSprites(t, d);
      tile = t; dpr = d;
      cv.style.width = tile * B.w + 'px'; cv.style.height = tile * B.h + 'px';
      cv.width = Math.round(tile * B.w * dpr); cv.height = Math.round(tile * B.h * dpr);
      dirty = true;
    }
    function draw() {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const s = tile, showMines = S.over && (B.exploded || B.blown === B.n), calm = FX.reduced();
      const shown = i => B.open[i] && S.t >= B.revealedAt[i];
      for (let i = 0; i < B.n; i++) {
        const x = (i % B.w) * s, y = ((i / B.w) | 0) * s;
        if (B.open[i]) {
          const age = S.t - B.revealedAt[i];
          if (age >= 0) {
            g.drawImage(dirtOf(sprites, i), x, y, s, s);
            edgeShade(g, x, y, s, i >= B.w && !shown(i - B.w), i % B.w > 0 && !shown(i - 1));
            if (age < .25 && !calm) {
              // трава подпрыгивает и уходит
              g.save(); g.globalAlpha = 1 - age / .25; const k = 1 + age * 1.2;
              g.translate(x + s / 2, y + s / 2 - age * s * .8); g.scale(k, k); g.drawImage(grassOf(sprites, i, B.w), -s / 2, -s / 2, s, s); g.restore();
            }
            if (B.num[i]) { g.save(); FX.pop(g, x + s / 2, y + s / 2, age / (B.num[i] < 4 ? .55 : .3), B.num[i] >= 4); number(g, x, y, s, B.num[i]); g.restore(); }
            continue;
          }
        }
        if (showMines && B.mine[i] && !B.flag[i] && S.t >= B.mineAt[i]) {
          g.drawImage(dirtOf(sprites, i), x, y, s, s);
          g.save(); FX.pop(g, x + s / 2, y + s / 2, B.mineAt[i] < 0 ? 1 : (S.t - B.mineAt[i]) / .35);
          g.drawImage(i === B.blown && B.exploded ? sprites.blown : sprites.mine, x, y, s, s); g.restore();
          continue;
        }
        g.drawImage(grassOf(sprites, i, B.w), x, y, s, s);
        if (B.flag[i] && S.t >= B.flaggedAt[i]) {
          g.save(); FX.pop(g, x + s / 2, y + s / 2, (S.t - B.flaggedAt[i]) / .2, true); g.drawImage(sprites.flag, x, y, s, s); g.restore();
          if (showMines && !B.mine[i]) { g.strokeStyle = '#ff4030'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x + 5, y + 5); g.lineTo(x + s - 5, y + s - 5); g.moveTo(x + s - 5, y + 5); g.lineTo(x + 5, y + s - 5); g.stroke(); }
        }
        const it = B.items.get(i);
        if (it && !(it.movingUntil > S.t)) {
          const bob = Math.sin((S.t - it.born) * 4 + i) * s * .04;
          // мягкое свечение под предметом
          const glow = g.createRadialGradient(x + s / 2, y + s / 2, 1, x + s / 2, y + s / 2, s * .6);
          glow.addColorStop(0, it.type === 'clarity' ? 'rgba(143,208,255,.45)' : 'rgba(255,217,119,.45)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = glow; g.fillRect(x, y, s, s);
          g.save(); FX.pop(g, x + s / 2, y + s / 2, (S.t - it.born) / .2);
          (it.type === 'clarity' ? clarity : clock)(g, x, y, s, bob);
          g.restore();
          g.font = `700 ${Math.round(s * .36)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText(it.left, x + s * .82, y + s * .2); g.fillStyle = it.left <= 1 ? '#ff9a7a' : '#fff'; g.fillText(it.left, x + s * .82, y + s * .2);
        }
      }
      // воронка от взрыва
      if (B.scorch >= 0) {
        const x = cx(B.scorch) * s, y = cy(B.scorch) * s, sg = g.createRadialGradient(x, y, s * .2, x, y, s * 1.6);
        sg.addColorStop(0, 'rgba(10,6,4,.55)'); sg.addColorStop(1, 'rgba(10,6,4,0)'); g.fillStyle = sg; g.fillRect(x - s * 2, y - s * 2, s * 4, s * 4);
      }
      if (hover >= 0 && !S.over && !S.paused) {
        const x = hover % B.w * s, y = Math.floor(hover / B.w) * s;
        const duration = B.open[hover] ? 2.5 : 1.2;
        g.fillStyle = `rgba(255,245,188,${.06 + .05 * Math.sin(S.t * Math.PI * 2 / duration)})`; g.fillRect(x + 1, y + 1, s - 2, s - 2);
        // наведение на число: подсвечены закрытые соседи, зелёным — если флажков вокруг столько же, сколько мин
        if (B.open[hover] && B.num[hover] && !S.armed) {
          const ns = nb(hover), ok = ns.filter(j => B.flag[j]).length === B.num[hover];
          g.strokeStyle = ok ? 'rgba(170,255,140,.75)' : 'rgba(255,245,188,.45)'; g.lineWidth = 1.5;
          for (const j of ns) if (!B.open[j] && !B.flag[j]) { rr(g, (j % B.w) * s + 2.5, Math.floor(j / B.w) * s + 2.5, s - 5, s - 5, 3); g.stroke(); }
        }
      }
      if (S.armed && hover >= 0 && !B.open[hover]) {
        const x = (hover % B.w) * s, y = ((hover / B.w) | 0) * s;
        g.save(); g.shadowColor = '#6fd0ff'; g.shadowBlur = 14; g.strokeStyle = '#9fe0ff'; g.lineWidth = 2.5; rr(g, x + 2, y + 2, s - 4, s - 4, 4); g.stroke(); g.restore();
      }
      for (const f of fx) {
        const x = (f.i % B.w) * s, y = ((f.i / B.w) | 0) * s, p = f.t;
        if (f.kind === 'slash') {
          // Two curved, offset strikes and a translucent echo silhouette.
          g.save(); g.globalAlpha = Math.max(0, 1 - p / .65); g.strokeStyle = '#bfeaff'; g.shadowColor = '#4fb8ff'; g.shadowBlur = 16; g.lineWidth = s * .1; g.lineCap = 'round';
          for (let k = 0; k < 2; k++) {
            const t = Math.max(0, Math.min(1, (p - k * .12) / .18)); if (!t) continue;
            g.beginPath(); g.ellipse(x + s * .5, y + s * .5, s * .85, s * .22, -.7 + k * .25, Math.PI, Math.PI + t * Math.PI); g.stroke();
          }
          g.fillStyle = '#8acfff'; g.globalAlpha *= .35; g.beginPath(); g.moveTo(x + s * .15, y + s); g.lineTo(x + s * .5, y - s * .4); g.lineTo(x + s * .9, y + s * .9); g.closePath(); g.fill(); g.restore();
        } else if (f.kind === 'boom') {
          const r = s * (.4 + p * 3.5);
          const gr = g.createRadialGradient(x + s / 2, y + s / 2, 0, x + s / 2, y + s / 2, r);
          gr.addColorStop(0, `rgba(255,240,180,${Math.max(0, .95 - p)})`); gr.addColorStop(.4, `rgba(255,120,30,${Math.max(0, .8 - p)})`); gr.addColorStop(1, 'rgba(80,20,0,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(x + s / 2, y + s / 2, r, 0, 7); g.fill();
        } else if (f.kind === 'shock' && p < .6) {
          const k = p / .6;
          g.strokeStyle = `rgba(255,220,170,${(1 - k) * .7})`; g.lineWidth = s * .18 * (1 - k) + 1;
          g.beginPath(); g.arc(x + s / 2, y + s / 2, s * (.5 + k * 6), 0, 7); g.stroke();
        } else if (f.kind === 'prime' && p < .4) {
          g.fillStyle = `rgba(255,50,25,${.3 + .25 * Math.sin(p * 50)})`; g.fillRect(x, y, s, s);
          g.save(); g.translate(Math.sin(p * 120) * s * .04, 0); g.drawImage(sprites.mine, x, y, s, s); g.restore();
        } else if (f.kind === 'invalid') {
          g.fillStyle = `rgba(200,0,0,${Math.max(0, .6 * (1 - p / .4))})`; g.fillRect(x, y, s, s);
        } else if (f.kind === 'hint' && p < .5) {
          g.strokeStyle = `rgba(255,120,100,${.8 * (1 - p / .5)})`; g.lineWidth = 2;
          for (const j of nb(f.i)) if (!B.open[j]) { rr(g, (j % B.w) * s + 2, Math.floor(j / B.w) * s + 2, s - 4, s - 4, 3); g.stroke(); }
        } else if (f.kind === 'pickup') {
          g.save(); g.globalAlpha = Math.max(0, 1 - p / .6); g.strokeStyle = f.color; g.lineWidth = 2; g.shadowColor = f.color; g.shadowBlur = 12;
          g.beginPath(); g.arc(x + s / 2, y + s / 2, s * (.2 + p * 1.7), 0, 7); g.stroke(); g.restore();
        } else if (f.kind === 'spawn' && p < .7) {
          const k = p / .7;
          g.strokeStyle = `rgba(${f.color},${1 - k})`; g.lineWidth = 2;
          g.beginPath(); g.arc(x + s / 2, y + s / 2, s * (1.4 - k * 1), 0, 7); g.stroke();
        } else if (f.kind === 'move' && p < .25) {
          const k = p / .25, tx = (f.target % B.w) * s, ty = Math.floor(f.target / B.w) * s;
          (f.type === 'clarity' ? clarity : clock)(g, x + (tx - x) * k, y + (ty - y) * k - Math.sin(k * Math.PI) * s * .65, s, 0);
        } else if (f.kind === 'expire' || f.kind === 'unflag') {
          g.save(); g.globalAlpha = Math.max(0, 1 - p / .3);
          if (f.kind === 'unflag') g.drawImage(sprites.flag, x, y - p * s, s, s);
          else (f.type === 'clarity' ? clarity : clock)(g, x, y + p * s, s, 0);
          g.restore();
        } else if (f.kind === 'shine' && p < 1.1) {
          // золотой блик проходит по полю по диагонали
          const W = B.w * s, H = B.h * s, pos = -H + (W + H * 2) * (p / 1.1);
          const sg = g.createLinearGradient(pos - s * 3, 0, pos + s * 3, H * .4);
          sg.addColorStop(0, 'rgba(255,230,150,0)'); sg.addColorStop(.5, 'rgba(255,230,150,.45)'); sg.addColorStop(1, 'rgba(255,230,150,0)');
          g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = sg; g.fillRect(0, 0, W, H); g.restore();
        } else if (f.kind === 'stagein' && p < .6) {
          g.fillStyle = `rgba(0,0,0,${.6 * (1 - p / .6)})`; g.fillRect(0, 0, B.w * s, B.h * s);
        } else if (f.kind === 'text') {
          g.globalAlpha = Math.max(0, 1 - p / 1.1); g.font = `700 ${Math.max(13, s * .5)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
          const textX = Math.max(g.measureText(f.text).width / 2 + 4, Math.min(B.w * s - g.measureText(f.text).width / 2 - 4, x + s / 2));
          const textY = Math.max(14, y + s * .5 - p * 30);
          g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText(f.text, textX, textY); g.fillStyle = f.color; g.fillText(f.text, textX, textY); g.globalAlpha = 1;
        }
      }
      g.save(); g.scale(s, s);
      // Keep sparks small after mapping from cell coordinates to pixels.
      particles.draw(g, 1 / s);
      g.restore();
    }

    // ---------- ввод ----------
    const cellAt = e => {
      const r = cv.getBoundingClientRect(), scaleX = r.width / cv.offsetWidth, scaleY = r.height / cv.offsetHeight;
      const x = Math.floor((e.clientX - r.left - cv.clientLeft * scaleX) / (cv.clientWidth * scaleX / B.w));
      const y = Math.floor((e.clientY - r.top - cv.clientTop * scaleY) / (cv.clientHeight * scaleY / B.h));
      return x >= 0 && y >= 0 && x < B.w && y < B.h ? y * B.w + x : -1;
    };
    let press = null;
    const cancelPress = () => { if (press) clearTimeout(press.timer); press = null; };
    cv.addEventListener('pointermove', e => { const i = cellAt(e); if (i !== hover) { hover = i; dirty = true; } if (press && press.i !== i) { clearTimeout(press.timer); press = null; } });
    cv.addEventListener('pointerleave', () => { hover = -1; dirty = true; cancelPress(); });
    cv.addEventListener('pointercancel', cancelPress);
    cv.addEventListener('lostpointercapture', cancelPress);
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      if (S.over || S.busy || S.paused) return;
      const i = cellAt(e); if (i < 0) return;
      e.preventDefault();
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        // тап — открыть, долгое нажатие — флажок
        cancelPress(); cv.setPointerCapture(e.pointerId);
        press = { i, pointerId: e.pointerId, done: false, timer: setTimeout(() => { if (press && playable(i)) { press.done = true; toggleFlag(i); navigator.vibrate?.(15); } }, 380) };
        return;
      }
      if (e.button === 2) { if (S.armed) { S.armed = false; skillUI(); dirty = true; } else toggleFlag(i); return; }
      if (e.button === 1) { chord(i); return; }
      if (e.button === 0) { if (S.armed) slash(i); else reveal(i); }
    });
    cv.addEventListener('pointerup', e => {
      if (!press || press.pointerId !== e.pointerId) return;
      clearTimeout(press.timer);
      const p = press; press = null;
      if (p.done || S.over || S.busy || S.paused) return;
      const i = cellAt(e); if (i !== p.i) return;
      if (S.armed) slash(i); else if (S.flagMode && !B.open[i]) toggleFlag(i); else reveal(i);
    });
    const arm = () => {
      if (S.over || S.busy || S.paused) return;
      if (S.mana < SLASH_COST) { S.armed = false; skillUI(); invalid(hover, true); api.sfx('nomana'); flashEl(frame.querySelector('.sw-mana')); frame.querySelector('.sw-mana').animate([{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], 220); return; }
      S.armed = !S.armed; if (S.armed) api.sfx('arm'); skillUI(); dirty = true;
    };
    $id('swSkill').onclick = arm;
    $id('swFlagMode').onclick = e => { S.flagMode = !S.flagMode; e.currentTarget.classList.toggle('on', S.flagMode); e.currentTarget.setAttribute('aria-pressed', S.flagMode); };
    function setPause(on) {
      if (S.over || S.paused === on) return;
      S.paused = on; $id('swPause').hidden = !on; frame.classList.toggle('paused', on);
      cancelPress(); api.pauseAudio?.(on);
      if (!on) last = performance.now();
    }
    frame.querySelector('[data-resume]').onclick = () => setPause(false);
    const onKey = e => {
      if (e.repeat) return;
      if (e.key === 'F9' || e.key === 'Escape') { e.preventDefault(); if (S.armed && e.key === 'Escape') { S.armed = false; skillUI(); dirty = true; return; } setPause(!S.paused); return; }
      if (e.key === '1' && !e.repeat) { e.preventDefault(); arm(); }
    };
    const onBlur = () => setPause(true);
    const onVis = () => { if (document.hidden) setPause(true); };
    addEventListener('keydown', onKey); addEventListener('blur', onBlur); document.addEventListener('visibilitychange', onVis);
    const ro = new ResizeObserver(() => { if (B) layout(); }); ro.observe(cv.parentNode);

    function step(dt) {
      if (dead || S.paused) return;
      S.t += dt;
      while (pending.length && pending[0].at <= S.t) pending.shift().run();
      // клетки волны: в момент «срыва» травы — комья и шорох
      let torn = 0;
      while (chunks.length && chunks[0].at <= S.t) {
        const { i } = chunks.shift();
        if (torn++ < 6) particles.emit({ x: cx(i), y: cy(i), color: ['#7a9d30', '#5a7a1f', '#8ab43a'], count: 3, speed: 2.2, gravity: 9, shape: 'chunk', size: 2, life: .9, angle: -Math.PI / 2, spread: 2.2 });
        if (torn === 1) api.amb?.('grass', { pan: panOf(i), volume: .7 });
      }
      if (particles.items.length) { particles.step(dt); dirty = true; }
      if (fx.length) { for (const f of fx) f.t += dt; fx = fx.filter(f => f.t < (f.kind === 'boom' ? 1.2 : 1.1)); dirty = true; }
      if (B.items.size || hover >= 0 || B.revealedAt.some(t => S.t - t < .6) || B.flaggedAt.some(t => S.t - t < .25) || (S.over && B.mineAt.some(t => S.t - t < .4))) dirty = true;
      if (S.shownScore !== S.score) { S.shownScore = S.score - (S.score - S.shownScore) * Math.exp(-dt * 7); if (Math.abs(S.score - S.shownScore) < 1) S.shownScore = S.score; $id('swScore').textContent = Arcade.fmt(Math.round(S.shownScore)); }
      if (S.paused || S.over || S.busy) return;
      if ((birdIn -= dt) <= 0) { api.amb?.('bird', { pan: Math.random() < .5 ? -.8 : .8, volume: .6 }); birdIn = rnd(7, 16); }
      if (B.placed) {
        const before = Math.ceil(S.time);
        S.time -= dt;
        if (Math.ceil(S.time) !== before) { hud(); if (S.time <= 10 && S.time > 0) api.sfx('tick'); }
        B.spawnIn -= dt; if (B.spawnIn <= 0) { spawnItem(); B.spawnIn = rnd(7, 13); }
        if (S.time <= 0) {
          S.time = 0; S.over = true; B.blown = B.n; hud(); dirty = true;   // blown ≥ 0 — показать мины, ни одна не взорвана
          revealMines(Math.floor(B.n / 2), 0);
          cancelPress(); schedule(.9, () => api.end(S.score, 'Время вышло'));
        }
      }
    }
    function loop(now) {
      if (dead) return;
      let dt = Math.max(0, (now - (last || now)) / 1000); last = now;
      if (dt > 1 && !S.over) { setPause(true); dt = 0; }
      while (dt > 0) { const slice = Math.min(dt, 1 / 120); step(slice); dt -= slice; }
      if (dirty) { draw(); dirty = false; }
      raf = requestAnimationFrame(loop);
    }
    newStage(0);
    document.fonts?.load(`700 20px "Philosopher"`).then(() => { dirty = true; });
    raf = requestAnimationFrame(loop);
    return {
      destroy() {
        dead = true; cancelAnimationFrame(raf); ro.disconnect();
        cancelPress(); pending.length = 0; particles.clear();
        removeEventListener('keydown', onKey); removeEventListener('blur', onBlur); document.removeEventListener('visibilitychange', onVis);
      },
      _state: S, _board: () => B, _step: step, _reveal: i => reveal(i), _flag: i => toggleFlag(i), _draw: draw,
    };
  }

  // ---------- живое превью для витрины: поле само раскрывается волнами, ставит флажки и проходит этап ----------
  function preview(cv) {
    const PW = 960, PH = 540, BW = 15, BH = 8, N = BW * BH;
    const g = cv.getContext('2d'), parts = new FX.Particles(200);
    let sc = 1, t = 0, raf = 0, last = 0, sprites = null, s = 48, ox = 0, oy = 0, nextAt = .6, clearAt = -1, shineAt = -1;
    let mine, num, open, openAt, flagAt;
    const nbs = i => { const x = i % BW, y = (i / BW) | 0, o = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < BW && ny < BH) o.push(ny * BW + nx); } return o; };
    function reset() {
      mine = new Uint8Array(N); num = new Uint8Array(N); open = new Uint8Array(N); openAt = new Float64Array(N).fill(-10); flagAt = new Float64Array(N).fill(-1);
      const safe = Math.floor(BH / 2) * BW + Math.floor(BW / 2), ban = new Set([safe, ...nbs(safe)]);
      let m = 0; while (m < 18) { const i = Math.floor(Math.random() * N); if (!mine[i] && !ban.has(i)) { mine[i] = 1; m++; } }
      for (let i = 0; i < N; i++) num[i] = nbs(i).reduce((a, j) => a + mine[j], 0);
      clearAt = -1; shineAt = -1; nextAt = t + .5;
      openFrom(safe);
    }
    function openFrom(start) {
      const q = [start]; let h = 0;
      while (h < q.length) {
        const i = q[h++]; if (open[i] || mine[i]) continue;
        open[i] = 1; const d = Math.hypot(i % BW - start % BW, ((i / BW) | 0) - ((start / BW) | 0)); openAt[i] = t + d * RIPPLE * 1.3;
        if (d < 6) parts.emit({ x: i % BW + .5, y: ((i / BW) | 0) + .5, color: ['#7a9d30', '#5a7a1f'], count: 1, speed: 2, gravity: 9, shape: 'chunk', size: 2, life: .8 });
        if (!num[i]) for (const j of nbs(i)) q.push(j);
      }
    }
    function size() {
      const w = cv.clientWidth || 480, d = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(w * d); cv.height = Math.round(w * d * PH / PW); sc = cv.width / PW;
      s = Math.floor(Math.min((PW - 120) / BW, (PH - 70) / BH)); ox = (PW - s * BW) / 2; oy = (PH - s * BH) / 2 + 8;
      sprites = makeSprites(s, sc);
    }
    function step(dt) {
      t += dt; parts.step(dt);
      if (t >= nextAt && clearAt < 0) {
        // следующий ход: открыть безопасную клетку рядом с уже открытыми или поставить флажок на очевидную мину
        const edge = []; for (let i = 0; i < N; i++) if (!open[i] && nbs(i).some(j => open[j])) edge.push(i);
        const flagC = edge.filter(i => mine[i] && flagAt[i] < 0), safeC = edge.filter(i => !mine[i]);
        if (flagC.length && Math.random() < .4) flagAt[flagC[Math.floor(Math.random() * flagC.length)]] = t;
        else if (safeC.length) openFrom(safeC[Math.floor(Math.random() * safeC.length)]);
        nextAt = t + .55;
        if (!safeC.length) { clearAt = t; shineAt = t; for (let i = 0, k = 0; i < N; i++) if (mine[i] && flagAt[i] < 0) flagAt[i] = t + (k++) * .05;
          for (let c = 0; c < 4; c++) parts.emit({ x: Math.random() * BW, y: -.5, color: CONFETTI, count: 12, speed: 2.5, gravity: 7, shape: 'chunk', size: 2.2, life: 2.6, angle: Math.PI / 2, spread: 1.6, drag: .8 }); }
      }
      if (clearAt >= 0 && t - clearAt > 2.4) reset();
    }
    function draw() {
      g.setTransform(sc, 0, 0, sc, 0, 0);
      const sky = g.createLinearGradient(0, 0, 0, PH); sky.addColorStop(0, '#9ab4c4'); sky.addColorStop(.55, '#5f7889'); sky.addColorStop(1, '#2a2422');
      g.fillStyle = sky; g.fillRect(0, 0, PW, PH);
      g.fillStyle = 'rgba(40,60,30,.55)'; g.beginPath(); g.ellipse(160, PH, 360, 150, 0, 0, 7); g.ellipse(820, PH + 20, 380, 170, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(200 + (t * 8) % 200, 80, 120, 26, 0, 0, 7); g.ellipse(720 - (t * 6) % 150, 120, 150, 30, 0, 0, 7); g.fill();
      // деревянная рамка поля
      g.fillStyle = 'rgba(0,0,0,.4)'; rr(g, ox - 12, oy - 6, s * BW + 24, s * BH + 24, 10); g.fill();
      const wood = g.createLinearGradient(0, oy - 10, 0, oy + s * BH + 10); wood.addColorStop(0, '#7a5230'); wood.addColorStop(1, '#4a2f18');
      g.fillStyle = wood; rr(g, ox - 10, oy - 10, s * BW + 20, s * BH + 20, 8); g.fill();
      g.save(); g.translate(ox, oy);
      for (let i = 0; i < N; i++) {
        const x = (i % BW) * s, y = ((i / BW) | 0) * s;
        if (open[i] && t >= openAt[i]) {
          const age = t - openAt[i];
          g.drawImage(sprites.dirt[Math.floor(hash(i, 7) * 4)], x, y, s, s);
          edgeShade(g, x, y, s, i >= BW && !(open[i - BW] && t >= openAt[i - BW]), i % BW > 0 && !(open[i - 1] && t >= openAt[i - 1]));
          if (age < .25) { g.save(); g.globalAlpha = 1 - age / .25; g.drawImage(sprites.grass[((i % BW) + ((i / BW) | 0)) % 2][Math.floor(hash(i, 1) * 4)], x, y - age * s * .8, s, s); g.restore(); }
          if (num[i]) { g.save(); FX.pop(g, x + s / 2, y + s / 2, age / .55); number(g, x, y, s, num[i]); g.restore(); }
          continue;
        }
        g.drawImage(sprites.grass[((i % BW) + ((i / BW) | 0)) % 2][Math.floor(hash(i, 1) * 4)], x, y, s, s);
        if (flagAt[i] >= 0 && t >= flagAt[i]) { g.save(); FX.pop(g, x + s / 2, y + s / 2, (t - flagAt[i]) / .2, true); g.drawImage(sprites.flag, x, y, s, s); g.restore(); }
      }
      if (shineAt >= 0 && t - shineAt < 1.1) {
        const W = BW * s, H = BH * s, pos = -H + (W + H * 2) * ((t - shineAt) / 1.1);
        const sg = g.createLinearGradient(pos - s * 3, 0, pos + s * 3, H * .4); sg.addColorStop(0, 'rgba(255,230,150,0)'); sg.addColorStop(.5, 'rgba(255,230,150,.45)'); sg.addColorStop(1, 'rgba(255,230,150,0)');
        g.globalCompositeOperation = 'lighter'; g.fillStyle = sg; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
      }
      g.scale(s, s); parts.draw(g, 1 / s);
      g.restore();
    }
    function loop(now) {
      const dt = Math.min(.05, last ? (now - last) / 1000 : 0); last = now;
      step(dt); draw(); raf = requestAnimationFrame(loop);
    }
    size(); reset();
    // для статичной картинки (меньше анимации или вкладка не рисует) — показываем уже наполовину раскрытое поле
    for (let k = 0; k < 8; k++) { t += .6; nextAt = 0; step(0); }
    t += 1; draw();
    document.fonts?.load(`700 20px "Philosopher"`).then(() => raf || draw());
    return {
      play() { if (!raf && !FX.reduced()) { last = 0; raf = requestAnimationFrame(loop); } },
      stop() { cancelAnimationFrame(raf); raf = 0; },
      resize() { size(); draw(); },
    };
  }

  const hex = (n, c = '') => `<span class="ar-hexes">${`<i class="${c}">?</i>`.repeat(n)}</span>`;
  Arcade.register({
    id: 'sweeper', theme: 'crown', title: 'Сапёр Сплин',
    logo: '<h2 class="ar-title sw-logo"><span>Сапёр</span><span>Сплин</span></h2>',
    subtitle: '<em>Помогите Сплину найти путь через все мины. Наступите на мину — сразу проигрыш.</em>',
    how: `<div class="ar-step"><span class="sw-demo" aria-hidden="true"><i></i><i></i><i></i><i></i><i class="n">2</i><i></i><i></i><i class="o"></i><i class="o"></i></span><div><b>Зелёная клетка</b><p>Здесь может быть мина, а может и не быть.</p><b>Клетка с числом</b><p>Показывает, сколько мин вокруг неё. Наведи на число — подсветятся соседние клетки.</p></div></div>
      <div class="ar-step">${Arcade.MOUSE('l', 'ЛКМ')}<div><b>Открыть клетку</b><p>Откройте все клетки без мин, чтобы пройти дальше. ЛКМ по числу открывает соседей, если флажков вокруг столько же.</p></div></div>
      <div class="ar-step">${Arcade.MOUSE('r', 'ПКМ')}<div><b>Флажок</b><p>Отметьте клетку, где лежит мина. ПКМ по предмету перекладывает его на соседнюю клетку.</p></div></div>
      <div class="ar-step"><span class="sw-skill demo"><i class="sw-hot">1</i><i class="sw-cost">50</i></span><div><b>Echo Slash</b><p>Иллюзии Echo Slash безопасно открывают клетки с минами. Стоит ${SLASH_COST} маны.</p></div></div>
      <div class="ar-step"><span class="sw-items" aria-hidden="true"></span><div><b>Предметы</b><p>Кларити — +25 маны. Часы — +30 секунд. Исчезают через 5 ходов.</p><p class="warn">Клетки под предметами не обязательно безопасны!</p></div></div>
      <p class="ar-lead small">На телефоне: тап — открыть, долгое нажатие или кнопка ⚑ — флажок.</p>`,
    scoring: [['Пройденный этап', '4 000'], ['Каждая оставшаяся секунда', '20']],
    rewards: [
      { at: 5000, pic: '<span class="ar-token sw"></span>', label: 'Жетон мины' },
      { at: 15000, pic: hex(2), label: '2 жетона + пиксельный Сплин' },
      { at: 32000, pic: hex(3), label: '3 случайных жетона' },
      { at: 35000, pic: hex(5), label: '5 случайных жетонов' },
    ],
    mount, preview,
  });
})();
