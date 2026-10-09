'use strict';
/* «Угадайка»: угадай героя по портрету из символов.
   Портреты — в game-data.js (16 оттенков серого, 56×98, готовит update_game.py): CDN Valve не даёт
   браузеру читать пиксели своих картинок. Из портрета строится ASCII-арт; с каждой ошибкой он чётче.
   «Герой дня» один на всех и меняется в полночь по местному времени; «Бесконечный» — сколько угодно раундов. */
(() => {
  const HEROES = window.HEROES || [], ARTS = window.GAME_ARTS;
  const BY_ID = new Map(HEROES.map(h => [h.id, h]));
  const POOL = HEROES.filter(h => ARTS.d[h.id]);
  const TRIES = 6, COLS = [9, 12, 16, 21, 28, 38];
  const RAMP = ' .:-=+*#%@';
  const ATTR = { str: 'Сила', agi: 'Ловкость', int: 'Интеллект', all: 'Универсал' };
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  // портрет: base64 → 16 оттенков → 0…255
  const pixCache = new Map();
  function pixels(id) {
    let p = pixCache.get(id);
    if (!p) {
      const bin = atob(ARTS.d[id]); p = new Uint8Array(ARTS.w * ARTS.h);
      for (let i = 0; i < bin.length; i++) { const b = bin.charCodeAt(i); p[i * 2] = (b >> 4) * 17; p[i * 2 + 1] = (b & 15) * 17; }
      pixCache.set(id, p);
    }
    return p;
  }

  // ---------- рисование ----------
  const cv = $('#gArt'), ctx = cv.getContext('2d');
  let shown = null, anim = 0;
  // сетка символов cols × rows: клетка вдвое выше, чем шире (как у моноширинного шрифта)
  function asciiGrid(id, cols) {
    const W = ARTS.w, H = ARTS.h, px = pixels(id);
    const rows = Math.max(4, Math.round(cols * (H / W) / 2)), cw = W / cols, ch = H / rows, out = [];
    for (let r = 0; r < rows; r++) {
      let line = '';
      for (let c = 0; c < cols; c++) {
        let sum = 0, n = 0;
        for (let y = Math.floor(r * ch); y < Math.max(Math.floor(r * ch) + 1, Math.floor((r + 1) * ch)); y++)
          for (let x = Math.floor(c * cw); x < Math.max(Math.floor(c * cw) + 1, Math.floor((c + 1) * cw)); x++) { sum += px[y * W + x]; n++; }
        const v = sum / n / 255;
        line += RAMP[Math.min(RAMP.length - 1, Math.round(v ** 1.15 * (RAMP.length - 1)))];
      }
      out.push(line);
    }
    return out;
  }
  // смена детализации: символы «перебираются» и встают на место — около трети секунды
  function draw(id, cols, { scramble = true } = {}) {
    const lines = asciiGrid(id, cols);
    shown = { id, cols };
    cancelAnimationFrame(anim);
    const t0 = performance.now(), D = scramble && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 380 : 0;
    const frame = now => {
      const t = D ? Math.min(1, (now - t0) / D) : 1;
      paint(lines, t);
      if (t < 1) anim = requestAnimationFrame(frame);
    };
    anim = requestAnimationFrame(frame);
  }
  function paint(lines, t) {
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#1d140e'; ctx.fillRect(0, 0, W, H);
    const rows = lines.length, cols = lines[0].length, cw = W / cols, ch = H / rows;
    ctx.font = `600 ${Math.min(ch * 0.95, cw * 1.7)}px "JetBrains Mono", Consolas, monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      let chr = lines[r][c];
      // до конца анимации часть клеток ещё «перебирается»
      if (t < 1 && chr !== ' ' && Math.random() > t) chr = RAMP[1 + Math.floor(Math.random() * (RAMP.length - 1))];
      if (chr === ' ') continue;
      const k = RAMP.indexOf(chr) / (RAMP.length - 1);
      ctx.fillStyle = `rgba(${Math.round(150 + 80 * k)},${Math.round(165 + 70 * k)},${Math.round(190 + 55 * k)},${0.55 + 0.45 * k})`;
      ctx.fillText(chr, (c + 0.5) * cw, (r + 0.5) * ch);
    }
  }
  new ResizeObserver(() => { if (shown) draw(shown.id, shown.cols, { scramble: false }); }).observe(cv);

  // ---------- состояние ----------
  const today = gameDay();
  // герой дня: перестановка всех героев с постоянным зерном — повторов нет, пока не пройдёт полный круг
  const ORDER = shuffled(POOL.map(h => h.id).sort((a, b) => a - b), 20261009);
  const dailyHero = day => ORDER[((day - 1) % ORDER.length + ORDER.length) % ORDER.length];
  let mode = 'daily', round = null;
  const stats = load('gs.game.stats', { played: 0, wins: 0, streak: 0, best: 0, last: 0, dist: [0, 0, 0, 0, 0, 0] });
  const endless = load('gs.game.endless', { streak: 0, best: 0, last: 0 });

  function startDaily() {
    const s = load('gs.game.daily', null);
    round = s?.day === today ? { ...s, hero: dailyHero(today) } : { day: today, hero: dailyHero(today), guesses: [], done: false, win: false };
    render(true);
  }
  function startEndless() {
    let id; do { id = POOL[Math.floor(Math.random() * POOL.length)].id; } while (POOL.length > 1 && id === endless.last);
    endless.last = id; save('gs.game.endless', endless);
    round = { hero: id, guesses: [], done: false, win: false };
    render(true);
  }
  const persist = () => { if (mode === 'daily') save('gs.game.daily', { day: round.day, guesses: round.guesses, done: round.done, win: round.win }); };

  function guess(id) {
    if (round.done || round.guesses.includes(id)) return;
    round.guesses.push(id);
    if (id === round.hero) { round.done = round.win = true; }
    else if (round.guesses.length >= TRIES) round.done = true;
    if (round.done) finish();
    persist();
    render(true);
  }
  function finish() {
    if (mode === 'daily') {
      stats.played++;
      if (round.win) { stats.wins++; stats.dist[round.guesses.length - 1]++; stats.streak = stats.last === today - 1 ? stats.streak + 1 : 1; }
      else stats.streak = 0;
      stats.best = Math.max(stats.best, stats.streak); stats.last = round.win ? today : 0;
      save('gs.game.stats', stats);
    } else {
      endless.streak = round.win ? endless.streak + 1 : 0;
      endless.best = Math.max(endless.best, endless.streak);
      save('gs.game.endless', endless);
    }
  }

  // ---------- интерфейс ----------
  const hero = id => BY_ID.get(id);
  const face = h => `<img src="${portrait(h)}" alt="" loading="lazy">`;
  function render(redraw) {
    const g = round.guesses, wrong = g.filter(id => id !== round.hero).length, ans = hero(round.hero);
    const stage = round.done ? COLS.length - 1 : Math.min(wrong, COLS.length - 1);
    if (redraw) draw(round.hero, COLS[stage]);
    $('#gReveal').hidden = !round.done;
    if (round.done) { $('#gReveal').src = portrait(ans); $('#gReveal').alt = ans.n; }
    $('#gStage').textContent = round.done ? ans.n : `Детализация ${stage + 1} / ${COLS.length}`;
    $('#gTitle').textContent = mode === 'daily' ? `Герой дня #${today}` : `Бесконечный · серия ${endless.streak}`;
    $('#gTries').innerHTML = Array.from({ length: TRIES }, (_, k) => `<i class="${k < g.length ? (g[k] === round.hero ? 'win' : 'miss') : ''}"></i>`).join('')
      + `<span>${round.done ? (round.win ? 'Угадано!' : 'Попытки кончились') : `Осталось попыток: ${TRIES - g.length}`}</span>`;
    // подсказки открываются после 2-й и 4-й ошибки
    const hint = (open, label, value) => `<div class="g-hint${open ? ' open' : ''}"><small>${label}</small><b>${open ? esc(value) : `после ${label === 'Атрибут' ? 2 : 4}-й ошибки`}</b></div>`;
    $('#gHints').innerHTML = hint(wrong >= 2 || round.done, 'Атрибут', ATTR[ans.a] || ans.a) + hint(wrong >= 4 || round.done, 'Первая буква', ans.n[0]);
    $('#gLog').innerHTML = g.slice().reverse().map(id => {
      const h = hero(id), ok = id === round.hero, sameAttr = h.a === ans.a;
      return `<li class="${ok ? 'win' : 'miss'}">${face(h)}<b>${esc(h.n)}</b><span class="g-attr${sameAttr ? ' same' : ''}" title="${sameAttr ? 'Атрибут совпадает' : 'Атрибут другой'}">${ATTR[h.a] || h.a}</span><span class="g-mark">${ok ? '✓' : '✗'}</span></li>`;
    }).join('');
    $('#gForm').hidden = round.done;
    const res = $('#gResult');
    res.hidden = !round.done;
    if (round.done) {
      res.className = 'g-result ' + (round.win ? 'win' : 'lose');
      res.innerHTML = `${face(ans)}<div><small>${round.win ? `Угадано с ${g.length}-й попытки` : 'Это был'}</small><b>${esc(ans.n)}</b></div>
        <div class="g-res-actions">
          ${mode === 'daily' ? `<button class="btn sm" id="gShare">${icon('copy')}Поделиться</button><span class="g-next" id="gNext"></span><button class="btn primary sm" data-mode="endless">Ещё раунд</button>`
            : `<button class="btn primary sm" id="gAgain">${icon('arrow')}Следующий герой</button>`}
        </div>`;
      $('#gShare')?.addEventListener('click', share);
      $('#gAgain')?.addEventListener('click', startEndless);
      tickNext();
    }
    renderStats();
    $$('#gModes .chip').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
    modeInd();
    if (!round.done) setTimeout(() => $('#gInput').focus({ preventScroll: true }));
  }
  function renderStats() {
    const s = mode === 'daily' ? stats : null;
    $('#gStats').innerHTML = s
      ? `<div><b>${s.played}</b><span>сыграно</span></div><div><b>${s.played ? Math.round(s.wins / s.played * 100) : 0}%</b><span>побед</span></div><div><b>${s.streak}</b><span>серия</span></div><div><b>${s.best}</b><span>лучшая</span></div>`
      : `<div><b>${endless.streak}</b><span>серия</span></div><div><b>${endless.best}</b><span>лучшая серия</span></div>`;
  }
  // до следующего героя дня — до полуночи по местному времени
  let nextTimer = 0;
  function tickNext() {
    clearInterval(nextTimer);
    const el = $('#gNext'); if (!el) return;
    const upd = () => {
      const now = new Date(), mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), s = Math.max(0, Math.floor((mid - now) / 1000));
      el.textContent = `новый герой через ${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    };
    upd(); nextTimer = setInterval(upd, 1000);
  }
  function share() {
    const g = round.guesses;
    const text = `Угадайка Grid Studio #${today} — ${round.win ? g.length : 'X'}/${TRIES}\n${g.map(id => id === round.hero ? '🟩' : '🟥').join('')}\n${new URL('game.html', location.href).href}`;
    copyText(text, 'Результат скопирован — вставь его в чат');
  }

  // ---------- ввод: подсказки по имени героя ----------
  const input = $('#gInput'), sugg = $('#gSugg');
  const norm = s => s.toLowerCase().replace(/[\s'\-.]/g, '');
  let list = [], cur = 0;
  function suggest() {
    const q = norm(input.value);
    list = q ? POOL.filter(h => !round.guesses.includes(h.id) && norm(h.n).includes(q))
      .sort((a, b) => norm(a.n).indexOf(q) - norm(b.n).indexOf(q) || a.n.localeCompare(b.n)).slice(0, 7) : [];
    cur = 0;
    sugg.innerHTML = list.map((h, k) => `<button type="button" class="${k === cur ? 'on' : ''}" data-id="${h.id}">${face(h)}<span>${esc(h.n)}</span></button>`).join('');
    sugg.hidden = !list.length;
  }
  const pick = id => { input.value = ''; sugg.hidden = true; guess(id); };
  input.oninput = suggest;
  input.onkeydown = e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); if (!list.length) return;
      cur = (cur + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
      $$('button', sugg).forEach((b, k) => b.classList.toggle('on', k === cur));
    } else if (e.key === 'Escape') sugg.hidden = true;
  };
  sugg.onmousedown = e => { const b = e.target.closest('button'); if (b) { e.preventDefault(); pick(+b.dataset.id); } };
  $('#gForm').onsubmit = e => {
    e.preventDefault();
    if (list[cur]) { pick(list[cur].id); return; }
    const exact = POOL.find(h => norm(h.n) === norm(input.value));
    if (exact) pick(exact.id); else if (input.value.trim()) toast('Такого героя нет — выбери из списка', 'err');
  };
  document.addEventListener('click', e => { if (!e.target.closest('.g-guess')) sugg.hidden = true; });

  // ---------- режимы ----------
  const modeInd = () => { const b = $('#gModes .chip.on'); if (b) $('#gModeInd').style.cssText = `width:${b.offsetWidth}px;transform:translateX(${b.offsetLeft}px)`; };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-mode]'); if (!b) return;
    mode = b.dataset.mode;
    mode === 'daily' ? startDaily() : startEndless();
  });
  document.fonts?.ready.then(() => { modeInd(); if (shown) draw(shown.id, shown.cols, { scramble: false }); });
  addEventListener('resize', modeInd);
  $('#gModes [data-mode="daily"]').lastChild.textContent = ` Герой дня #${today}`;
  startDaily();
})();
