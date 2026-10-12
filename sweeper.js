'use strict';
/* «Сапёр Сплин» (Spleen Sweeper) — сапёр Кеза и Сплина из «Коронопада», в 2025–2026 доступен в мини-играх поиска матча.
   5 этапов: 9×9 (10 мин), 12×11, 15×13, 18×14 (43 мины), 20×16. На каждый этап — свой таймер.
   ЛКМ — открыть клетку (по числу с нужным числом флажков — открыть соседей), ПКМ — флажок.
   «1» — Echo Slash Кеза: 50 маны, иллюзия безопасно открывает клетку и обезвреживает мину, если она там.
   Предметы появляются на поле и пропадают через 5 ходов: кларити +25 маны, часы +30 секунд.
   Предмет может лежать на мине — ПКМ по нему перекладывает его на соседнюю клетку.
   Очки: этап — 4 000 (все пять — 20 000) и 20 за каждую оставшуюся секунду. Награды: 5 000, 15 000, 32 000, 35 000. */
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
  const rnd = (a, b) => a + Math.random() * (b - a);
  const mmss = t => { t = Math.max(0, Math.ceil(t)); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
  const hash = (i, k) => { let x = (Math.imul(i, 374761393) + Math.imul(k, 668265263)) >>> 0; x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0; return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
  const CLOCK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 9v4.5l3 2M9 2.5h6M4.5 6.5l2-2M19.5 6.5l-2-2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  const BOMB_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="14" r="7.5" fill="currentColor"/><path d="M15 8.5l2.5-2.5M17 4.5l1 1M19.5 3.5v2M21 6h-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="11.5" r="1.8" fill="#000" opacity=".35"/></svg>';

  // ---------- рисование клеток ----------
  function grass(g, x, y, s, i, hover) {
    g.fillStyle = '#2f4214'; g.fillRect(x, y, s, s);
    const gr = g.createLinearGradient(0, y, 0, y + s);
    gr.addColorStop(0, hover ? '#8db43c' : '#7a9d30'); gr.addColorStop(1, hover ? '#6c9128' : '#5a7a1f');
    g.fillStyle = gr; rr(g, x + 1, y + 1, s - 2, s - 2, Math.max(2, s * .12)); g.fill();
    g.fillStyle = 'rgba(255,255,220,.12)'; g.fillRect(x + 2, y + 1.5, s - 4, Math.max(1, s * .08));
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + 2, y + s - 1 - s * .08, s - 4, s * .08);
    // травинки и жёлтые цветочки «+»
    g.strokeStyle = 'rgba(40,70,10,.35)'; g.lineWidth = 1;
    for (let k = 0; k < 3; k++) { const gx = x + 3 + hash(i, k + 9) * (s - 6), gy = y + 4 + hash(i, k + 19) * (s - 8); g.beginPath(); g.moveTo(gx, gy + 3); g.lineTo(gx + 1, gy); g.stroke(); }
    const n = hash(i, 1) < .55 ? 2 : hash(i, 2) < .5 ? 1 : 3;
    for (let k = 0; k < n; k++) {
      const fx = x + 4 + hash(i, k * 3 + 4) * (s - 8), fy = y + 4 + hash(i, k * 3 + 5) * (s - 8), r = Math.max(1.2, s * .055);
      g.fillStyle = hash(i, k + 30) < .5 ? '#e6bf4c' : '#d9a83c';
      g.fillRect(fx - r * 1.6, fy - r * .5, r * 3.2, r); g.fillRect(fx - r * .5, fy - r * 1.6, r, r * 3.2);
    }
  }
  function dirt(g, x, y, s, i) {
    g.fillStyle = '#4a3122'; g.fillRect(x, y, s, s);
    g.fillStyle = hash(i, 7) < .5 ? '#5e4130' : '#5a3d2c'; g.fillRect(x + .5, y + .5, s - 1, s - 1);
    g.fillStyle = 'rgba(0,0,0,.12)';
    for (let k = 0; k < 3; k++) g.fillRect(x + hash(i, k + 40) * (s - 3), y + hash(i, k + 50) * (s - 3), 2, 2);
  }
  function number(g, x, y, s, n) {
    g.font = `700 ${Math.round(s * .62)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = Math.max(2, s * .1); g.strokeStyle = 'rgba(20,10,4,.85)'; g.strokeText(n, x + s / 2, y + s / 2 + 1);
    g.fillStyle = NUM_COL[n]; g.fillText(n, x + s / 2, y + s / 2 + 1);
  }
  // флажок — красная табличка с «грибом» взрыва, как у Техиков
  function flag(g, x, y, s) {
    const cx = x + s / 2;
    g.fillStyle = '#4a2d18'; g.fillRect(cx - s * .04, y + s * .5, s * .08, s * .4);
    g.fillStyle = '#7e1f2c'; rr(g, x + s * .16, y + s * .14, s * .68, s * .48, s * .07); g.fill();
    g.fillStyle = '#d4445c'; rr(g, x + s * .19, y + s * .17, s * .62, s * .42, s * .05); g.fill();
    g.fillStyle = '#ffe8ec';
    g.beginPath(); g.ellipse(cx, y + s * .3, s * .17, s * .085, 0, 0, 7); g.fill();
    g.fillRect(cx - s * .045, y + s * .32, s * .09, s * .16);
    g.beginPath(); g.ellipse(cx, y + s * .5, s * .14, s * .04, 0, 0, 7); g.fill();
  }
  function mine(g, x, y, s, blown) {
    if (blown) { g.fillStyle = '#c0331f'; g.fillRect(x + 1, y + 1, s - 2, s - 2); }
    const cx = x + s / 2, cy = y + s / 2 + s * .04, r = s * .28;
    g.fillStyle = '#1b1a1d'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    g.fillStyle = '#3c3a40'; g.beginPath(); g.arc(cx - r * .3, cy - r * .3, r * .35, 0, 7); g.fill();
    g.fillStyle = '#ff3b2a'; g.beginPath(); g.arc(cx + r * .1, cy - r * .05, r * .2, 0, 7); g.fill();
    g.strokeStyle = '#1b1a1d'; g.lineWidth = Math.max(1.5, s * .06); g.beginPath(); g.moveTo(cx + r * .6, cy - r * .7); g.lineTo(cx + r * 1.1, cy - r * 1.2); g.stroke();
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
  function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }

  // ---------- игра ----------
  function mount(shell, api) {
    shell.innerHTML = `<div class="sw-frame" id="swFrame">
      <div class="sw-bg" aria-hidden="true"><img class="sw-side l" src="${CDN}heroes/techies_vert.jpg" alt=""><img class="sw-side r" src="${CDN}heroes/kez_vert.jpg" alt=""><span class="sw-sign"></span></div>
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

    const S = { stage: 0, score: 0, mana: MANA_START, time: 0, paused: false, over: false, busy: false, armed: false, flagMode: false, t: 0 };
    let B = null;   // поле текущего этапа
    let tile = 30, dpr = 1, hover = -1, dead = false, raf = 0, last = 0, dirty = true, fx = [];
    const particles = new ArcadeFX.Particles(), pending = [];
    const schedule = (delay, run) => { pending.push({ at: S.t + delay, run }); pending.sort((a, b) => a.at - b.at); };
    const valid = i => Number.isInteger(i) && i >= 0 && i < B.n;
    const playable = i => !dead && !S.over && !S.busy && !S.paused && valid(i);
    const soundAt = (name, i) => api.sfx(name, { pan: ((i % B.w) / Math.max(1, B.w - 1) - .5) * .9 });
    function burst(i, color, count = 16, speed = 2) {
      // Particle positions are in cells: resizing never detaches FX from their tile.
      particles.burst(i % B.w + .5, Math.floor(i / B.w) + .5, color, count, speed, 3);
    }
    function invalid(i) { if (valid(i)) fx.push({ kind: 'invalid', i, t: 0 }); api.sfx('invalid'); dirty = true; }

    function newStage(k) {
      const st = STAGES[k], n = st.w * st.h;
      B = { ...st, n, mines: st.m, mine: new Uint8Array(n), open: new Uint8Array(n), flag: new Uint8Array(n), num: new Uint8Array(n), revealedAt: new Float64Array(n).fill(-10), flaggedAt: new Float64Array(n).fill(-10), placed: false, opened: 0, items: new Map(), spawnIn: rnd(6, 11), blown: -1, exploded: false };
      S.stage = k; S.time = st.t; S.busy = false; S.armed = false; fx = [];
      particles.clear(); hover = -1; frame.classList.remove('shake');
      $id('swStage').textContent = `Этап ${k + 1} из ${STAGES.length}`;
      layout(); hud(); dirty = true;
    }
    const nb = i => { const x = i % B.w, y = (i / B.w) | 0, out = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < B.w && ny < B.h) out.push(ny * B.w + nx); } return out; };
    const count = i => nb(i).reduce((s, j) => s + B.mine[j], 0);
    // мины раскладываются после первого хода — первая клетка и её соседи пустые
    function place(safe) {
      const ban = new Set([safe, ...nb(safe)]), pool = [];
      for (let i = 0; i < B.n; i++) if (!ban.has(i)) pool.push(i);
      for (let k = 0; k < B.m; k++) { const j = k + Math.floor(Math.random() * (pool.length - k)); [pool[k], pool[j]] = [pool[j], pool[k]]; B.mine[pool[k]] = 1; }
      for (let i = 0; i < B.n; i++) B.num[i] = count(i);
      B.placed = true;
    }
    function flood(start) {
      const q = [start]; let got = 0;
      while (q.length) {
        const i = q.pop();
        if (B.open[i] || B.flag[i]) continue;
        B.open[i] = 1; B.opened++; got++;
        B.revealedAt[i] = S.t;
        const it = B.items.get(i); if (it) take(i, it);
        if (!B.num[i]) for (const j of nb(i)) if (!B.open[j] && !B.mine[j]) q.push(j);
      }
      return got;
    }
    function take(i, it) {
      B.items.delete(i);
      if (it.type === 'clarity') { const gain = Math.min(CLARITY, MANA_MAX - S.mana); S.mana += gain; fxText(i, `+${gain} маны`, '#8fd0ff'); }
      else { S.time += CLOCK; fxText(i, '+30 с', '#ffd977'); }
      fx.push({ kind: 'pickup', i, color: it.type === 'clarity' ? '#8fd0ff' : '#ffd977', t: 0 });
      burst(i, it.type === 'clarity' ? '#8fd0ff' : '#ffd977', 22);
      soundAt(it.type, i);
    }
    // после каждого хода (открытия клеток) предметы тают: число на предмете — сколько ходов осталось
    function tickItems() {
      for (const [i, it] of B.items) if (--it.left <= 0) {
        B.items.delete(i); fx.push({ kind: 'expire', i, type: it.type, t: 0 }); soundAt('expire', i);
      }
    }
    function reveal(i) {
      if (!playable(i)) return;
      if (B.open[i]) { chord(i); return; }
      if (B.flag[i]) { invalid(i); return; }
      if (!B.placed) place(i);
      if (B.mine[i]) { boom(i); return; }
      flood(i); burst(i, '#d5b775', 10, 1.2); soundAt('reveal', i); tickItems(); afterMove();
    }
    function chord(i) {
      if (!playable(i) || !B.open[i]) return;
      if (!B.num[i]) return;
      const ns = nb(i), flags = ns.filter(j => B.flag[j]).length;
      if (flags !== B.num[i]) { invalid(i); return; }
      const hit = ns.find(j => !B.open[j] && !B.flag[j] && B.mine[j]);
      if (hit != null) { boom(hit); return; }
      let got = 0; for (const j of ns) if (!B.open[j] && !B.flag[j]) got += flood(j);
      if (got) { api.sfx('reveal'); tickItems(); afterMove(); }
    }
    function toggleFlag(i) {
      if (!playable(i)) return;
      if (B.open[i]) return;
      const it = B.items.get(i);
      if (it) { moveItem(i, it); return; }
      B.flag[i] ^= 1; B.flaggedAt[i] = S.t; soundAt(B.flag[i] ? 'flag' : 'unflag', i); hud(); dirty = true;
      if (!B.flag[i]) fx.push({ kind: 'unflag', i, t: 0 });
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
      flood(i); soundAt('slash', i); tickItems(); afterMove();
    }
    function boom(i) {
      B.blown = i; S.over = true; S.busy = true;
      fx.push({ kind: 'prime', i, t: 0 }); soundAt('prime', i);
      schedule(.4, () => {
        B.exploded = true; fx.push({ kind: 'boom', i, t: 0 }); soundAt('boom', i);
        burst(i, '#ffc26b', 65, 5); frame.classList.add('shake'); dirty = true;
      });
      dirty = true; hud();
      schedule(1.8, () => api.end(S.score, 'Подрыв!'));
    }
    function afterMove() {
      hud(); dirty = true;
      if (B.opened >= B.n - B.mines) clearStage();
    }
    function clearStage() {
      S.busy = true;
      const bonus = Math.ceil(S.time) * SEC_POINTS, gain = STAGE_POINTS + bonus;
      S.score += gain; hud(); api.sfx('stage');
      for (let i = 0; i < B.n; i++) if (B.mine[i] && !B.flag[i]) { B.flag[i] = 1; B.flaggedAt[i] = S.t; }
      hud();
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
      B.items.set(free[Math.floor(Math.random() * free.length)], { type: Math.random() < .55 ? 'clarity' : 'clock', left: ITEM_MOVES, born: S.t });
      dirty = true;
    }

    // ---------- интерфейс ----------
    function hud() {
      $id('swScore').textContent = Arcade.fmt(S.score);
      $id('swMines').textContent = Math.max(0, B.mines - B.flag.reduce((s, v) => s + v, 0));
      $id('swTime').textContent = mmss(S.time);
      $id('swTime').parentNode.classList.toggle('low', S.time <= 15);
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
      tile = Math.max(14, Math.min(60, Math.floor(Math.min((aw - 12) / B.w, (ah - 12) / B.h))));   // 12 — рамка поля
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.style.width = tile * B.w + 'px'; cv.style.height = tile * B.h + 'px';
      cv.width = Math.round(tile * B.w * dpr); cv.height = Math.round(tile * B.h * dpr);
      dirty = true;
    }
    function draw() {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const s = tile, showMines = S.over && (B.exploded || B.blown === B.n);
      for (let i = 0; i < B.n; i++) {
        const x = (i % B.w) * s, y = ((i / B.w) | 0) * s;
        if (B.open[i]) {
          dirt(g, x, y, s, i);
          const age = S.t - B.revealedAt[i];
          if (age < .25 && !ArcadeFX.reduced()) { g.globalAlpha = 1 - age / .25; grass(g, x, y, s, i, false); g.globalAlpha = 1; }
          if (B.num[i]) { g.save(); ArcadeFX.pop(g, x + s / 2, y + s / 2, age / (B.num[i] < 4 ? .55 : .3), B.num[i] >= 4); number(g, x, y, s, B.num[i]); g.restore(); }
          continue;
        }
        if (showMines && B.mine[i] && !B.flag[i]) { dirt(g, x, y, s, i); mine(g, x, y, s, i === B.blown); continue; }
        grass(g, x, y, s, i, i === hover && !S.over);
        if (B.flag[i]) { g.save(); ArcadeFX.pop(g, x + s / 2, y + s / 2, (S.t - B.flaggedAt[i]) / .2, true); flag(g, x, y, s); g.restore(); if (showMines && !B.mine[i]) { g.strokeStyle = '#ff4030'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x + 5, y + 5); g.lineTo(x + s - 5, y + s - 5); g.moveTo(x + s - 5, y + 5); g.lineTo(x + 5, y + s - 5); g.stroke(); } }
        const it = B.items.get(i);
        if (it && !(it.movingUntil > S.t)) {
          const bob = Math.sin((S.t - it.born) * 4 + i) * s * .04;
          g.save(); ArcadeFX.pop(g, x + s / 2, y + s / 2, (S.t - it.born) / .2);
          (it.type === 'clarity' ? clarity : clock)(g, x, y, s, bob);
          g.restore();
          g.font = `700 ${Math.round(s * .36)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText(it.left, x + s * .82, y + s * .2); g.fillStyle = '#fff'; g.fillText(it.left, x + s * .82, y + s * .2);
        }
      }
      if (hover >= 0 && !S.over && !S.paused) {
        const x = hover % B.w * s, y = Math.floor(hover / B.w) * s;
        const duration = B.open[hover] ? 2.5 : 1.2;
        g.fillStyle = `rgba(255,245,188,${.045 + .045 * Math.sin(S.t * Math.PI * 2 / duration)})`; g.fillRect(x + 1, y + 1, s - 2, s - 2);
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
        } else if (f.kind === 'prime' && p < .4) {
          g.fillStyle = `rgba(255,50,25,${.3 + .25 * Math.sin(p * 50)})`; g.fillRect(x, y, s, s); mine(g, x, y, s, false);
        } else if (f.kind === 'invalid') {
          g.fillStyle = `rgba(200,0,0,${Math.max(0, .6 * (1 - p / .4))})`; g.fillRect(x, y, s, s);
        } else if (f.kind === 'pickup') {
          g.save(); g.globalAlpha = Math.max(0, 1 - p / .6); g.strokeStyle = f.color; g.lineWidth = 2; g.shadowColor = f.color; g.shadowBlur = 12;
          g.beginPath(); g.arc(x + s / 2, y + s / 2, s * (.2 + p * 1.7), 0, 7); g.stroke(); g.restore();
        } else if (f.kind === 'move' && p < .25) {
          const k = p / .25, tx = (f.target % B.w) * s, ty = Math.floor(f.target / B.w) * s;
          (f.type === 'clarity' ? clarity : clock)(g, x + (tx - x) * k, y + (ty - y) * k - Math.sin(k * Math.PI) * s * .65, s, 0);
        } else if (f.kind === 'expire' || f.kind === 'unflag') {
          g.save(); g.globalAlpha = Math.max(0, 1 - p / .3);
          if (f.kind === 'unflag') flag(g, x, y - p * s, s);
          else (f.type === 'clarity' ? clarity : clock)(g, x, y + p * s, s, 0);
          g.restore();
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
    const arm = () => { if (S.over || S.busy || S.paused) return; if (S.mana < SLASH_COST) { S.armed = false; skillUI(); invalid(hover); frame.querySelector('.sw-mana').animate([{ filter: 'brightness(2)' }, { filter: 'none' }], 300); return; } S.armed = !S.armed; if (S.armed) api.sfx('arm'); skillUI(); dirty = true; };
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
      if (particles.items.length) { particles.step(dt); dirty = true; }
      if (fx.length) { for (const f of fx) f.t += dt; fx = fx.filter(f => f.t < (f.kind === 'boom' ? 1.2 : 1.1)); dirty = true; }
      if (B.items.size || hover >= 0 || B.revealedAt.some(t => S.t - t < .6) || B.flaggedAt.some(t => S.t - t < .25)) dirty = true;
      if (S.paused || S.over || S.busy) return;
      if (B.placed) {
        const before = Math.ceil(S.time);
        S.time -= dt;
        if (Math.ceil(S.time) !== before) { hud(); if (S.time <= 10 && S.time > 0) api.sfx('tick'); }
        B.spawnIn -= dt; if (B.spawnIn <= 0) { spawnItem(); B.spawnIn = rnd(7, 13); }
        if (S.time <= 0) {
          S.time = 0; S.over = true; B.blown = B.n; hud(); dirty = true;   // blown ≥ 0 — показать мины, ни одна не взорвана
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

  const hex = (n, c = '') => `<span class="ar-hexes">${`<i class="${c}">?</i>`.repeat(n)}</span>`;
  Arcade.register({
    id: 'sweeper', theme: 'crown', title: 'Сапёр Сплин',
    logo: '<h2 class="ar-title sw-logo"><span>Сапёр</span><span>Сплин</span></h2>',
    subtitle: '<em>Помогите Сплину найти путь через все мины. Наступите на мину — сразу проигрыш.</em>',
    how: `<div class="ar-step"><span class="sw-demo" aria-hidden="true"><i></i><i></i><i></i><i></i><i class="n">2</i><i></i><i></i><i class="o"></i><i class="o"></i></span><div><b>Зелёная клетка</b><p>Здесь может быть мина, а может и не быть.</p><b>Клетка с числом</b><p>Показывает, сколько мин вокруг неё.</p></div></div>
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
    mount,
  });
})();
