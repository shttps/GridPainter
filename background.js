'use strict';
/* «Фон меню» (background.html): свой фон главного меню Доты с живым превью.
   Превью рисуется тем же DotaBG.drawFrame, что и кадры видео в паке, — что видно, то и соберётся.
   Вкладка «Меню» — схема главной Доты поверх фона; «Сетка героев» — сетка поверх фона, как в игре:
   у экрана «Герои» своего фона нет, сквозь него виден фон меню, затемнённый игрой.
   После сборки кадр фона становится «Моим фоном» (GridRender.setMine): на нём показывают сетку
   превью «В игре» в редакторе и карточки Мастерской. Помощники ($, icon, toast, openSheet, bgSteps…) — из site.js. */
(() => {
  if (document.body.dataset.page !== 'background' || !window.DotaBG) return;
  const qs = new URLSearchParams(location.search);
  const pref = (() => { try { return JSON.parse(localStorage.getItem('gs.dotabg')) || {}; } catch { return {}; } })();
  const st = {
    tab: 'menu', screen: DotaBG.SCREENS.includes(pref.screen) ? pref.screen : DotaBG.guessScreen(),
    look: { fit: pref.fit === 'contain' ? 'contain' : 'cover', blur: 0, dim: 0 }, clean: !!pref.clean,
    grid: ['editor', 'workshop', 'none'].includes(pref.grid) ? pref.grid : 'editor',
    blob: null, kind: '', name: '', bg: null, start: 0, el: null, cats: null, gridName: '', busy: false, touched: false, built: false,
  };
  const cv = $('#bgbCanvas'), ctx = cv.getContext('2d'), screenBox = $('#bgbScreen');
  // шаги в шапке: 1 — файл, 2 — настройки (не обязательны), 3 — сборка
  const main = $('.bgb');
  function setStep() {
    const f = !!st.blob, t = st.touched, b = st.built;
    main.dataset.step = b ? 3 : f ? 2 : 1;
    const state = { 1: f ? 'done' : 'now', 2: !f ? '' : t || b ? 'done' : 'now', 3: b ? 'done' : f ? 'now' : '' };
    $$('#bgbSteps li').forEach(li => { li.className = state[li.dataset.s]; });
  }
  const touch = () => { if (st.blob && !st.touched) { st.touched = true; setStep(); } };
  $('#bgbSteps').onclick = e => {
    const b = e.target.closest('[data-go]'); if (!b) return;
    if (b.dataset.go === 'bgbGFile' && !st.blob) { $('#bgbFile').click(); return; }
    const g = $('#' + b.dataset.go);
    g.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
    g.classList.remove('flash'); void g.offsetWidth; g.classList.add('flash');
  };
  // блик по экрану при смене фона, вкладки или пропорций; шторка — при новом фоне
  const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  glyphField($('#bgbGlyphs'), { ox: 0.5, oy: 0.05, rx: 0.85, ry: 0.95, cx: 0.5, cy: 0.1, alpha: 0.7 });
  const saveTimer = () => { try { localStorage.setItem('gs.dotabg', JSON.stringify({ ...pref, screen: st.screen, fit: st.look.fit, clean: st.clean, grid: st.grid })); } catch {} };

  // ---------- переключатели ----------
  $('#bgbScreens').insertAdjacentHTML('beforeend', DotaBG.SCREENS.map(v => `<button data-v="${v}">${v}</button>`).join(''));
  const seg = (box, value, on) => {
    const set = v => { $$('button', box).forEach(b => b.classList.toggle('on', b.dataset.v === v)); segInd(box); };
    set(value);
    box.onclick = e => { const b = e.target.closest('button'); if (!b || st.busy) return; if (on(b.dataset.v) !== false) set(b.dataset.v); };
  };
  const relayout = () => ['#bgbTabs', '#bgbScreens', '#bgbFit', '#bgbGrid'].forEach(s => segInd($(s)));
  document.fonts?.ready.then(relayout); addEventListener('resize', relayout);
  seg($('#bgbTabs'), st.tab, v => { if (st.tab !== v) replay(screenBox, 'swap'); st.tab = v; showTab(); });
  seg($('#bgbScreens'), st.screen, v => { if (st.screen !== v) replay(screenBox, 'swap'); st.screen = v; touch(); saveTimer(); fitScreen(); });
  seg($('#bgbFit'), st.look.fit, v => { if (st.look.fit !== v) replay(screenBox, 'swap'); st.look.fit = v; touch(); $('#bgbFitNote').textContent = v === 'cover' ? 'края обрежутся, без чёрных полос' : 'вся картинка, по бокам чёрное'; saveTimer(); paint(); });
  seg($('#bgbGrid'), st.grid, v => { if (v === 'workshop') { openGridPicker(); return false; } st.grid = v; touch(); saveTimer(); loadGrid(); });
  $('#bgbFitNote').textContent = st.look.fit === 'cover' ? 'края обрежутся, без чёрных полос' : 'вся картинка, по бокам чёрное';
  const pct = v => v ? Math.round(v * 100) + ' %' : 'нет';
  for (const k of ['blur', 'dim']) {
    const r = $(k === 'blur' ? '#bgbBlur' : '#bgbDim'), out = $(k === 'blur' ? '#bgbBlurV' : '#bgbDimV');
    r.oninput = () => {
      st.look[k] = +r.value; out.textContent = pct(+r.value); r.style.setProperty('--range-fill', `${+r.value * 100}%`);
      out.classList.toggle('on', +r.value > 0); replay(out, 'pop'); touch(); paint();
    };
  }
  const clean = $('#bgbClean');
  clean.checked = st.clean;
  clean.onchange = () => { st.clean = clean.checked; touch(); saveTimer(); $('#bgbNews').hidden = st.clean; };
  $('#bgbNews').hidden = st.clean;
  const myScreen = DotaBG.guessScreen();
  const noteScreen = () => { $('#bgbScreenNote').textContent = st.screen === myScreen ? 'как у этого монитора' : `у этого монитора ${myScreen}`; };

  // ---------- экран превью ----------
  function fitScreen() {
    const [w, h] = DotaBG.SIZES[st.screen];
    screenBox.style.aspectRatio = `${w} / ${h}`;
    noteScreen(); requestAnimationFrame(() => { resize(); paint(); });
  }
  function resize() {
    const dpr = Math.min(2, devicePixelRatio || 1), W = Math.min(1600, Math.round(screenBox.clientWidth * dpr)), H = Math.round(W * screenBox.clientHeight / screenBox.clientWidth);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  }
  new ResizeObserver(() => { resize(); paint(); }).observe(screenBox);
  function showTab() {
    $('#bgbMenu').hidden = st.tab !== 'menu';
    $('#bgbDrop').hidden = st.tab === 'grid';
    $('.bgb-gridpick').classList.toggle('dim', st.tab !== 'grid');
    $('#bgbCap').textContent = st.tab === 'menu'
      ? 'Главное меню Доты с выбранными пропорциями экрана — схема, как ляжет фон.'
      : `Под сеткой — фон главного меню: в Доте у экрана «Герои» своего фона нет, игра только затемняет фон меню.${st.gridName ? ` Сетка: «${st.gridName}».` : ''}`;
    if (st.tab === 'grid' && !st.cats && !st.gridNote && st.grid !== 'none') loadGrid();
    paint();
  }

  // кадр фона (drawFrame) и, на вкладке «Сетка героев», затемнение и сетка поверх — в координатах экрана Доты
  function paint() {
    const W = cv.width, H = cv.height;
    if (!W) return;
    const el = st.el;
    if (el && (st.kind !== 'video' || el.readyState >= 2)) {
      const sw = el.videoWidth || el.naturalWidth, sh = el.videoHeight || el.naturalHeight;
      DotaBG.drawFrame(ctx, (c, x, y, w, h) => c.drawImage(el, x, y, w, h), sw, sh, W, H, st.look);
    } else {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#16120f'); g.addColorStop(1, '#0b0908');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (st.tab === 'grid') paintGrid(W, H);
  }
  function paintGrid(W, H) {
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, W, H);
    // экран по высоте — 938 единиц сетки, сетка (1204 × 612) по центру по горизонтали, на 150 ниже верха
    const k = H / GridRender.SCREEN.h, cx = GridRender.SCREEN.x + GridRender.SCREEN.w / 2;
    const ox = W / 2 - cx * k, oy = -GridRender.SCREEN.y * k;
    // верхнее меню и подменю «ГЕРОИ», как на экране «Герои»
    ctx.fillStyle = 'rgba(14,17,22,.92)'; ctx.fillRect(0, 0, W, 52 * k);
    ctx.fillStyle = 'rgba(10,7,5,.7)'; ctx.fillRect(0, 52 * k, W, 44 * k);
    ctx.fillStyle = '#c9ced6'; ctx.font = `600 ${15 * k}px Onest, sans-serif`; ctx.textBaseline = 'middle';
    ctx.fillText('ГЕРОИ   /   РУКОВОДСТВА   /   ТРЕНДЫ', ox + 135 * k, 74 * k);
    if (!st.cats) {
      if (st.grid !== 'none') { ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.textAlign = 'center'; ctx.fillText(st.gridNote || 'Загружаю сетку…', W / 2, H / 2); ctx.textAlign = 'left'; }
      return;
    }
    ctx.save(); ctx.setTransform(k, 0, 0, k, ox, oy);
    GridRender.draw(ctx, st.cats, { portraits: true, onLoad: () => requestAnimationFrame(paint), bg: 'none' });
    ctx.restore();
  }
  // видео — перерисовка каждый кадр, пока играет и видно
  let raf = 0;
  const loop = () => { raf = 0; paint(); if (st.kind === 'video' && !st.el.paused && !document.hidden) raf = requestAnimationFrame(loop); };
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

  // ---------- сетка в превью ----------
  const r6 = v => Math.round(v * 1e6) / 1e6;
  function editorGrid() {
    let els = null, name = 'Моя сетка';
    try { els = JSON.parse(localStorage.getItem('gp2.els')); name = JSON.parse(localStorage.getItem('gp2.settings'))?.configName || name; } catch {}
    if (!Array.isArray(els) || !els.length) return null;
    return { name, cats: els.map(e => e.t === 'hero'
      ? { category_name: e.name, x_position: r6(e.x), y_position: r6(e.y), width: r6(e.w), height: r6(e.h), hero_ids: e.heroes.slice() }
      : { category_name: e.name, x_position: r6(e.x), y_position: r6(e.y), width: 0, height: 0, hero_ids: [] }) };
  }
  let workshopPick = null;
  let gridRequest = 0;
  function openGridPicker() {
    const m = openSheet(`<div class="sh-body bgb-picker"><span class="bgb-eyebrow">СЕТКА ДЛЯ ПРЕВЬЮ</span><h2>Выбери из Мастерской</h2><p>Нажми на сетку, чтобы примерить её к своему фону.</p><form class="bgb-picker-search"><input class="input" type="search" aria-label="Название сетки или автор" placeholder="Название сетки или автор"><button class="btn" type="submit">Найти</button></form><p class="bgb-picker-status" role="status" aria-live="polite"></p><div class="bgb-picker-list"></div><button class="btn block bgb-picker-more" hidden>Показать ещё</button></div>`);
    m.root.setAttribute('aria-label', 'Выбор сетки из Мастерской');
    const list = $('.bgb-picker-list', m.root), status = $('.bgb-picker-status', m.root), more = $('.bgb-picker-more', m.root), input = $('input', m.root);
    let request = 0, offset = 0, query = '', choosing = false;
    const itemsById = new Map();
    async function fetchPage(reset) {
      const current = ++request;
      if (reset) { offset = 0; list.innerHTML = ''; itemsById.clear(); }
      more.hidden = true; status.textContent = 'Загружаем сетки…';
      try {
        const result = await API.list({ q: query, sort: 'popular', offset, limit: 12 });
        if (current !== request || !m.root.isConnected) return;
        offset += result.items.length;
        const items = result.items.filter(g => !g.nsfw || API.adult());
        items.forEach(g => itemsById.set(g.id, g));
        list.insertAdjacentHTML('beforeend', items.map(g => `<button class="bgb-picker-card" data-pick="${esc(g.id)}" aria-label="Выбрать: ${esc(g.title)}"><span class="gthumb" data-live="${esc(g.id)}"><canvas aria-hidden="true"></canvas><span class="g-load">Загружаем превью…</span></span><span class="bgb-picker-name">${esc(g.title)}</span><small>${esc(g.author)}</small>${workshopPick?.id === g.id ? '<span class="bgb-picker-selected">Выбрана</span>' : ''}</button>`).join(''));
        more.hidden = offset >= result.total || !result.items.length;
        status.textContent = itemsById.size ? 'Выбери сетку для предпросмотра' : 'Сетки не найдены. Попробуй другой запрос.';
      } catch { if (current === request && m.root.isConnected) { status.textContent = 'Не удалось загрузить сетки. Попробуй ещё раз.'; more.textContent = 'Повторить'; more.hidden = false; } }
    }
    $('form', m.root).onsubmit = e => { e.preventDefault(); if (choosing) return; query = input.value.trim(); more.textContent = 'Показать ещё'; fetchPage(true); };
    more.onclick = () => { if (!choosing) fetchPage(false); };
    list.onclick = async e => {
      const button = e.target.closest('[data-pick]');
      if (!button || choosing) return;
      const selected = itemsById.get(button.dataset.pick);
      choosing = true; status.textContent = 'Открываем выбранную сетку…'; list.setAttribute('aria-busy', 'true');
      try {
        const cfg = await API.config(selected.id);
        if (!m.root.isConnected) return;
        if (!cfg?.categories?.length) throw new Error('Эта сетка пустая или недоступна. Выбери другую.');
        ++gridRequest; workshopPick = selected; st.grid = 'workshop'; st.cats = cfg.categories; st.gridName = selected.title; st.gridNote = ''; st.tab = 'grid';
        for (const [id, value] of [['#bgbGrid', 'workshop'], ['#bgbTabs', 'grid']]) { $$('button', $(id)).forEach(b => b.classList.toggle('on', b.dataset.v === value)); segInd($(id)); }
        $('#bgbGridNote').textContent = `«${selected.title}» — ${selected.author}. Нажми «Из Мастерской», чтобы выбрать другую.`;
        saveTimer(); showTab(); m.close(); $('#bgbTabs button[data-v="grid"]').focus();
      } catch (e) { status.textContent = e.message || 'Не удалось открыть сетку. Попробуй ещё раз.'; }
      finally { choosing = false; list.removeAttribute('aria-busy'); }
    };
    input.focus(); fetchPage(true);
  }
  async function loadGrid() {
    const current = ++gridRequest;
    st.cats = null; st.gridName = ''; st.gridNote = '';
    const note = $('#bgbGridNote');
    if (st.grid === 'none') { note.textContent = 'Только фон, как пустой экран «Герои».'; showCap(); return; }
    if (st.grid === 'editor') {
      const g = editorGrid();
      if (g) { st.cats = g.cats; st.gridName = g.name; note.innerHTML = `«${esc(g.name)}» — то, что сейчас открыто в <a href="editor.html">редакторе</a>.`; showCap(); return; }
      note.innerHTML = 'В <a href="editor.html">редакторе</a> пусто — показываю сетку из Мастерской.';
    } else if (!workshopPick) { st.gridNote = 'Нажми «Из Мастерской», чтобы выбрать сетку.'; note.textContent = st.gridNote; paint(); return; }
    st.gridNote = 'Загружаю сетку…';
    try {
      if (!workshopPick) {
        const { items } = await API.list({ limit: 24 });
        if (current !== gridRequest) return;
        const pool = items.filter(g => !g.nsfw && g.cats >= 200);
        workshopPick = (pool.length ? pool : items)[Math.floor(Math.random() * Math.max(1, (pool.length ? pool : items).length))] || null;
      }
      if (!workshopPick) { st.gridNote = 'В Мастерской пока нет сеток'; paint(); return; }
      const cfg = await API.config(workshopPick.id);
      if (current !== gridRequest) return;
      st.cats = cfg?.categories || []; st.gridName = workshopPick.title;
      note.innerHTML = `${st.grid === 'editor' ? 'В <a href="editor.html">редакторе</a> пусто — показываю ' : ''}«${esc(workshopPick.title)}» — ${esc(workshopPick.author)}, из <a href="grid.html?id=${encodeURIComponent(workshopPick.id)}">Мастерской</a>.`;
    } catch { if (current !== gridRequest) return; st.gridNote = 'Мастерская не ответила'; }
    showCap();
  }
  const showCap = () => { if (st.tab === 'grid') showTab(); else paint(); };

  // ---------- исходник ----------
  async function useBlob(blob, { name = '', bg = null } = {}) {
    let kind;
    try { kind = await DotaBG.sniff(blob); } catch (e) { toast(e.message, 'err'); return; }
    if (blob.size > 500 * 1048576) { toast('Файл больше 500 МБ — укороти видео', 'err'); return; }
    if (st.el) { st.el.pause?.(); URL.revokeObjectURL(st.el.src); }
    const url = URL.createObjectURL(blob);
    let el;
    if (kind === 'video') {
      el = document.createElement('video');
      Object.assign(el, { muted: true, loop: false, playsInline: true, preload: 'auto', src: url });
      await new Promise((ok, no) => { el.onloadeddata = ok; el.onerror = () => no(new Error('Браузер не смог открыть это видео. Подойдут MP4 (H.264) и WebM.')); }).catch(e => { toast(e.message, 'err'); el = null; });
      if (!el) return;
    } else {
      el = new Image(); el.src = url;
      try { await el.decode(); } catch { toast('Картинка не открылась', 'err'); return; }
    }
    Object.assign(st, { blob, kind: kind === 'gif' ? 'gif' : kind, name, bg, el, start: 0 });
    // GIF в <img> анимируется сам — перерисовываем его постоянно, как видео
    if (kind === 'gif') { const tick = () => { if (st.el !== el) return; paint(); setTimeout(() => requestAnimationFrame(tick), 60); }; tick(); }
    $('#bgbDrop').classList.add('has');
    replay(screenBox, 'reveal'); replay(screenBox, 'swap');
    st.built = false; setStep();
    $('#bgbBuild').disabled = false;
    $('#bgbPublish').hidden = !!bg;
    $('#bgbSrc').innerHTML = bg ? `${icon('compass')}«${esc(bg.title)}» из <a href="bg.html?id=${encodeURIComponent(bg.id)}">Мастерской</a>` : `${icon('file')}${esc(name.length > 40 ? name.slice(0, 38) + '…' : name)} · ${mb(blob.size)}`;
    $('#bgbPick').lastChild.textContent = 'Другой файл';
    $('#bgbFileNote').textContent = kind === 'video' ? `Видео ${secs(el.duration)}. В фон пойдёт отрезок до 30 секунд — двигай начало под превью.` : kind === 'gif' ? 'GIF станет видео из своих кадров.' : 'Картинка станет неподвижным видео.';
    setupTrim();
    paint();
  }
  // отрезок видео: начало ползунком, длина — до 30 с; превью крутит именно его
  function setupTrim() {
    const box = $('#bgbTrim'), el = st.el, r = $('#bgbStart');
    box.hidden = st.kind !== 'video';
    if (st.kind !== 'video') return;
    const D = el.duration || 0, len = () => Math.min(DotaBG.LIMIT.seconds, D - st.start);
    r.max = Math.max(0, D - 1).toFixed(1); r.value = 0; r.disabled = D <= DotaBG.LIMIT.seconds;
    const time = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const label = () => { $('#bgbTime').textContent = `${time(st.start)}–${time(st.start + len())}${D > DotaBG.LIMIT.seconds ? ` из ${time(D)}` : ''}`; };
    r.oninput = () => { st.start = +r.value; el.currentTime = st.start; r.style.setProperty('--range-fill', `${+r.value / (+r.max || 1) * 100}%`); label(); touch(); paint(); };
    r.style.setProperty('--range-fill', '0%');
    el.ontimeupdate = () => { if (el.currentTime >= st.start + len() - 0.05 || el.currentTime < st.start - 0.5) el.currentTime = st.start; };
    el.onended = () => { el.currentTime = st.start; el.play().catch(() => {}); };
    el.onplay = kick; el.onseeked = paint;
    const play = $('#bgbPlay');
    const setBtn = () => { play.innerHTML = icon(el.paused ? 'play' : 'pause'); play.setAttribute('aria-label', el.paused ? 'Играть' : 'Пауза'); };
    play.onclick = () => { el.paused ? el.play().catch(() => {}) : el.pause(); };
    el.onpause = setBtn; el.addEventListener('play', setBtn);
    label();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) el.play().catch(() => {});
    setBtn();
  }
  const pickFile = f => { if (f && !st.busy) useBlob(f, { name: f.name }); };
  $('#bgbFile').onchange = e => pickFile(e.target.files[0]);
  $('#bgbPick').onclick = () => $('#bgbFile').click();
  const drop = $('#bgbDrop');
  for (const t of [drop, screenBox]) {
    t.addEventListener('dragover', e => { e.preventDefault(); screenBox.classList.add('over'); });
    t.addEventListener('dragleave', () => screenBox.classList.remove('over'));
    t.addEventListener('drop', e => { e.preventDefault(); screenBox.classList.remove('over'); pickFile(e.dataTransfer.files[0]); });
  }
  document.addEventListener('paste', e => { const f = [...(e.clipboardData?.files || [])][0]; if (f) pickFile(f); });

  // фон из Мастерской: ?bg=<id>
  async function fromWorkshop(id) {
    const box = $('#bgbLoading'), bar = $('i', box);
    box.hidden = false;
    try {
      const b = await API.bg.get(id);
      $('span', box).textContent = `Скачиваю «${b.title}»…`;
      const r = await fetch(b.file);
      if (!r.ok || !r.body) throw new Error('Не удалось скачать фон из Мастерской');
      const total = +r.headers.get('Content-Length') || b.size || 0, reader = r.body.getReader(), parts = [];
      let got = 0;
      for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); got += value.length; if (total) bar.style.width = Math.min(100, got / total * 100) + '%'; }
      await useBlob(new Blob(parts, { type: r.headers.get('Content-Type') || '' }), { name: b.title, bg: b });
    } catch (e) { toast(e.message, 'err'); }
    box.hidden = true;
  }

  // ---------- сборка ----------
  // кадр для «Моего фона»: 1280 px по ширине, с теми же кадрированием, размытием и затемнением
  function saveMine() {
    const el = st.el, [w, h] = DotaBG.SIZES[st.screen], c = document.createElement('canvas');
    c.width = 1280; c.height = Math.round(1280 * h / w);
    DotaBG.drawFrame(c.getContext('2d'), (x, ...a) => x.drawImage(el, ...a), el.videoWidth || el.naturalWidth, el.videoHeight || el.naturalHeight, c.width, c.height, st.look);
    try { GridRender.setMine(c.toDataURL('image/jpeg', 0.8), { title: st.bg?.title || st.name.replace(/\.[^.]+$/, ''), screen: st.screen }); } catch {}
  }
  $('#bgbBuild').onclick = async () => {
    if (!st.blob || st.busy) return;
    st.busy = true; document.body.classList.add('bgb-busy');
    const btn = $('#bgbBuild'), prog = $('#bgbProg'), bar = $('i', prog), say = $('span', prog);
    btn.disabled = true; prog.hidden = false;
    const was = st.kind === 'video' && !st.el.paused; if (was) st.el.pause();
    try {
      const job = DotaBG.build(st.blob, { screen: st.screen, clean: st.clean, look: { ...st.look }, start: st.start,
        onProgress: (p, text) => { bar.style.width = Math.round(p * 100) + '%'; if (text) say.textContent = text; } });
      const res = await job.done;
      saveBlob('pak02_dir.vpk', res.blob);
      saveMine();
      st.built = true; setStep();
      if (st.bg) API.bg.hit(st.bg.id);
      const m = openSheet(`<div class="sh-body db-body"><div class="sh-ico">${icon('check')}</div><h2>Файл скачан</h2>
        <p class="db-lead"><code>pak02_dir.vpk</code> · ${mb(res.blob.size)}. Осталось положить его в папку Доты:</p>
        ${bgSteps()}
        <p class="hint db-left">Этот фон теперь — «Мой фон»: на нём можно смотреть сетку в редакторе («В игре» → «Фон») и в Мастерской.</p>
        <div class="sh-actions"><a class="btn block" href="editor.html">${icon('brush')}Посмотреть свою сетку на этом фоне</a></div></div>`);
      fillMenuDate(m.root);
    } catch (e) { toast(e.message || 'Не получилось собрать фон', 'err'); }
    st.busy = false; document.body.classList.remove('bgb-busy');
    btn.disabled = false; prog.hidden = true;
    if (was) st.el.play().catch(() => {});
  };
  $('#bgbHow').onclick = () => openHowTo('bg');
  // в Мастерскую уходит исходный файл — так его можно собрать под любой экран и с любыми настройками
  $('#bgbPublish').onclick = () => openBgUpload(null, st.blob && !st.bg ? new File([st.blob], st.name || 'background', { type: st.blob.type }) : null);
  fillMenuDate(document);

  fitScreen(); showTab(); setStep(); applyIcons();
  if (qs.get('bg')) fromWorkshop(qs.get('bg'));
})();
