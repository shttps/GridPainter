'use strict';
/* Лендинг (index.html) и каталог сеток (catalog.html). */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const API = window.CatalogAPI;

// ---------- иконки ----------
// Та же система, что в редакторе: 24px, линия 1.75, скруглённые концы, currentColor.
// Строка без «<» — это d у <path>, иначе — готовая разметка внутри <svg>.
const ICONS = {
  brush: 'M4 20l1-5L16 4l4 4L9 19zM13.5 6.5l4 4',
  grid: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 3.5v17M14.5 3.5v17"/>',
  upload: 'M12 16V5M7 10l5-5 5 5M5 20h14',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  ext: 'M9 5H5v14h14v-4M13 4h7v7M20 4l-9 9',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M20.5 16l-5-5-8.5 8"/>',
  eye: '<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.75"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  heart: 'M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.3 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M5 15.5V6.5a2 2 0 012-2h8.5"/>',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  edit: 'M4 20l1-5L16 4l4 4L9 19zM13.5 6.5l4 4',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  file: 'M6 3.5h8l4.5 4.5v12.5H6zM14 3.5V8h4.5M9 13h6M9 16.5h4',
  swap: 'M8 8l-4 4 4 4M16 8l4 4-4 4',
  cursor: 'M5.5 3.5L19 11.5 12.5 13 9.5 19.5z',
  pencil: 'M4 20l1-5L16 4l4 4L9 19zM13.5 6.5l4 4',
  line: '<path d="M6.5 17.5l11-11"/><circle cx="5" cy="19" r="1.75"/><circle cx="19" cy="5" r="1.75"/>',
  rect: '<rect x="4" y="5.5" width="16" height="13" rx="1.5"/>',
  ellipse: '<circle cx="12" cy="12" r="7.5"/>',
  rhombus: 'M12 3.5l8.5 8.5-8.5 8.5-8.5-8.5z',
  triangle: 'M12 4.5l8.5 14.5h-17z',
  text: 'M5 6.5V4.5h14v2M12 4.5v15M9 19.5h6',
  eraser: 'M8.5 19.5L4 15l9.5-9.5 5.5 5.5-9 8.5zM9 10.5l5 5M8.5 19.5H20',
  heroes: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" fill="currentColor"/>',
};
const icon = n => { const v = ICONS[n] || ''; return `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${v.startsWith('<') ? v : `<path d="${v}"/>`}</svg>`; };
function applyIcons(root = document) {
  for (const el of $$('[data-icon]', root)) { if (!el.querySelector(':scope > svg.i')) el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)); }
}
// знак «штрих по сетке» для пустых состояний
const MARK = '<svg class="empty-mark" viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="12" class="mk-bg"/><path d="M13 35L35 13" class="mk-stroke"/></svg>';

// ---------- мелочи ----------
function toast(msg, kind = '') {
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 240); }, kind === 'err' ? 5000 : 3000);
}
async function copyText(s, ok) {
  try { await navigator.clipboard.writeText(s); toast(ok, 'ok'); } catch { toast('Не удалось скопировать', 'err'); }
}
function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const plural = (n, one, few, many) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many; };
const num = n => (+n || 0).toLocaleString('ru');
function ago(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'только что';
  if (s < 3600) { const m = Math.floor(s / 60); return `${m} ${plural(m, 'минуту', 'минуты', 'минут')} назад`; }
  if (s < 86400) { const h = Math.floor(s / 3600); return `${h} ${plural(h, 'час', 'часа', 'часов')} назад`; }
  if (s < 86400 * 30) { const d = Math.floor(s / 86400); return `${d} ${plural(d, 'день', 'дня', 'дней')} назад`; }
  return new Date(iso).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ---------- карточка сетки ----------
function cardHTML(g, k = 0) {
  return `<button class="gcard" data-id="${esc(g.id)}" style="animation-delay:${Math.min(k, 12) * 40}ms">
    <span class="gthumb"><img src="${esc(g.thumb)}" alt="" loading="lazy">
      <span class="gkind">${esc(API.KINDS[g.kind] || 'Сетка')} · ${num(g.cats)} кат.</span>
      ${API.isMine(g.id) ? '<span class="gkind gmine">моя</span>' : ''}</span>
    <span class="gbody">
      <span class="gtitle">${esc(g.title)}</span>
      <span class="gmeta"><span class="by">${esc(g.author)} · ${ago(g.created_at)}</span>
        <span class="st ${API.isLiked(g.id) ? 'liked' : ''}" data-likes>${icon('heart')}${num(g.likes)}</span>
        <span class="st">${icon('download')}${num(g.downloads)}</span></span>
    </span>
  </button>`;
}
const skeletons = n => Array.from({ length: n }, () => '<div class="gcard sk"><div class="skeleton"></div><div class="gbody"><span></span><span></span></div></div>').join('');

// ---------- окно сетки ----------
async function openGrid(id, { onChange } = {}) {
  const root = $('#modalRoot');
  root.innerHTML = `<div class="modal"><div class="modal-view"><span class="loading">Загружаю сетку…</span></div><div class="modal-side"><span class="loading"> </span></div></div>`;
  setUrlId(id);
  let alive = true;
  const close = () => { alive = false; root.innerHTML = ''; setUrlId(null); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  root.onclick = e => { if (e.target === root) close(); };

  let g;
  try { g = await API.get(id); } catch (e) { if (alive) { close(); toast(e.message, 'err'); } return; }
  if (!alive) return;
  const cats = g.config?.categories || [];
  const mine = API.isMine(g.id);
  root.innerHTML = `<div class="modal" role="dialog" aria-label="${esc(g.title)}">
    <button class="modal-x" data-icon="x" aria-label="Закрыть"></button>
    <div class="modal-view"><canvas id="gv"></canvas></div>
    <div class="modal-side">
      <div><h2>${esc(g.title)}</h2><div class="by">от <b>${esc(g.author)}</b> · ${ago(g.created_at)}</div></div>
      ${g.description ? `<div class="desc">${esc(g.description)}</div>` : ''}
      <div class="stats">
        <div><b data-likes>${num(g.likes)}</b><span>${plural(g.likes, 'лайк', 'лайка', 'лайков')}</span></div>
        <div><b>${num(g.downloads)}</b><span>скачиваний</span></div>
        <div><b>${num(g.cats)}</b><span>${plural(g.cats, 'категория', 'категории', 'категорий')}</span></div>
      </div>
      <div class="hint">${esc(API.KINDS[g.kind] || 'Сетка')}${g.heroes ? ` · ${num(g.heroes)} ${plural(g.heroes, 'портрет', 'портрета', 'портретов')} героев` : ''}. Превью — как в игре, без интерфейса Доты.</div>
      <div class="actions">
        <a class="btn primary" id="gEdit" href="editor.html?grid=${encodeURIComponent(g.id)}"><span class="ico-box" data-icon="edit"></span>Открыть в редакторе</a>
        <div class="row">
          <button class="btn" id="gDl" data-icon="download">Скачать</button>
          <button class="btn ${API.isLiked(g.id) ? 'on' : ''}" id="gLike" data-icon="heart">${API.isLiked(g.id) ? 'Нравится' : 'Лайк'}</button>
        </div>
        <button class="btn ghost sm" id="gCopy" data-icon="copy">Копировать JSON</button>
        <div class="hint">Скачанный <code>hero_grid_config.json</code> заменит все твои сетки. Чтобы добавить эту к своим — открой её в редакторе, нажми «Открыть JSON» со своим файлом и сделай экспорт.</div>
        <div class="side-links">
          <button id="gLink">Скопировать ссылку</button>
          ${mine ? '<button class="danger" id="gDel">Удалить мою сетку</button>' : `<button id="gReport">${API.isReported(g.id) ? 'Жалоба отправлена' : 'Пожаловаться'}</button>`}
        </div>
      </div>
    </div>
  </div>`;
  applyIcons(root);
  $('.modal-x', root).onclick = close;

  // живое превью с настоящими портретами; перерисовка, когда догружаются картинки
  const cv = $('#gv'), ctx = cv.getContext('2d');
  let queued = false;
  const draw = () => {
    queued = false;
    if (!alive || !cv.isConnected) return;
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth || 800, k = w * dpr / GridRender.GRID.w;
    cv.width = Math.round(w * dpr); cv.height = Math.round(GridRender.GRID.h * k);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    GridRender.draw(ctx, cats, { portraits: true, onLoad: redraw });
  };
  const redraw = () => { if (!queued) { queued = true; requestAnimationFrame(draw); } };
  draw();
  document.fonts?.ready.then(redraw);
  new ResizeObserver(redraw).observe(cv);

  const json = () => JSON.stringify({ version: 3, configs: [{ config_name: g.title, categories: cats }] }, null, '\t');
  $('#gEdit').onclick = () => API.hit(g.id);
  $('#gDl').onclick = () => { download('hero_grid_config.json', json()); API.hit(g.id); toast('Файл скачан — положи его в Steam\\userdata\\<ID>\\570\\remote\\cfg', 'ok'); };
  $('#gCopy').onclick = () => { copyText(json(), 'JSON скопирован'); API.hit(g.id); };
  $('#gLink').onclick = () => copyText(new URL('catalog.html?id=' + g.id, location.href).href, 'Ссылка скопирована');
  const like = $('#gLike');
  like.onclick = async () => {
    like.disabled = true;
    try {
      const r = await API.like(g.id);
      g.likes = r.likes;
      like.classList.toggle('on', r.liked);
      like.lastChild.textContent = r.liked ? 'Нравится' : 'Лайк';
      $('[data-likes]', root).textContent = num(r.likes);
      $('[data-likes]', root).nextElementSibling.textContent = plural(r.likes, 'лайк', 'лайка', 'лайков');
      onChange && onChange(g);
    } catch (e) { toast(e.message, 'err'); }
    like.disabled = false;
  };
  const rep = $('#gReport');
  if (rep) rep.onclick = async () => {
    if (API.isReported(g.id)) return;
    if (!confirm('Пожаловаться на эту сетку? После нескольких жалоб она пропадёт из каталога до проверки.')) return;
    try { await API.report(g.id); rep.textContent = 'Жалоба отправлена'; toast('Спасибо, жалоба отправлена', 'ok'); } catch (e) { toast(e.message, 'err'); }
  };
  const del = $('#gDel');
  if (del) del.onclick = async () => {
    if (!confirm(`Удалить «${g.title}» из каталога? Это нельзя отменить.`)) return;
    try { await API.remove(g.id); close(); toast('Сетка удалена', 'ok'); onChange && onChange(g, true); } catch (e) { toast(e.message, 'err'); }
  };
}
function setUrlId(id) {
  if (document.body.dataset.page !== 'catalog') return;
  const u = new URL(location.href);
  id ? u.searchParams.set('id', id) : u.searchParams.delete('id');
  history.replaceState(null, '', u);
}

// ---------- главная ----------
// портрет героя в сетке — вертикальный, как в игре
const portrait = h => 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/' + (h.v ? `heroes/${h.s}_vert.jpg` : `dota_react/heroes/${h.s}.png`);
const heroImgTag = (h, lazy = true) => `<img src="${portrait(h)}" alt="${esc(h.n)}" title="${esc(h.n)}" ${lazy ? 'loading="lazy"' : ''} decoding="async">`;
function shuffled(list, seed = 7) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { seed = (seed * 16807) % 2147483647; const j = seed % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- главная ----------
function initHome() {
  $('#authorChip').onclick = () => copyText('ahttps', 'Ник в Discord скопирован: ahttps');
  const heroes = window.HEROES || [], still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // лёгкий наклон монитора за курсором
  const hero = $('#hero'), device = $('#device');
  if (!still && matchMedia('(pointer: fine)').matches) {
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      device.style.setProperty('--ry', (x * 8).toFixed(2) + 'deg'); device.style.setProperty('--rx', (-y * 5).toFixed(2) + 'deg');
    });
    hero.addEventListener('pointerleave', () => { device.style.setProperty('--ry', '0deg'); device.style.setProperty('--rx', '0deg'); });
  }

  // плашка «127 героев»: три портрета
  const pick = shuffled(heroes, 11);
  $('#fcFaces').innerHTML = pick.slice(0, 3).map(h => heroImgTag(h, false)).join('');
  $('.fc-heroes b').textContent = `${heroes.length} ${plural(heroes.length, 'герой', 'героя', 'героев')}`;

  // лента портретов: каждый ряд продублирован, чтобы прокрутка была бесконечной
  const half = Math.ceil(pick.length / 2), rowA = pick.slice(0, half), rowB = pick.slice(half);
  $('#mqA').innerHTML = [...rowA, ...rowA].map(h => heroImgTag(h)).join('');
  $('#mqB').innerHTML = [...rowB, ...rowB].map(h => heroImgTag(h)).join('');

  // мозаика: 8 × 3 портрета, проявляются, когда плитка доезжает до экрана
  const mosaic = $('#mosaic');
  mosaic.innerHTML = shuffled(heroes, 3).slice(0, 24).map((h, i) => heroImgTag(h).replace('<img', `<img style="transition-delay:${(i % 8) * 45 + Math.floor(i / 8) * 90}ms"`)).join('');
  new IntersectionObserver((es, io) => { if (es.some(e => e.isIntersecting)) { mosaic.classList.add('in'); io.disconnect(); } }, { threshold: .3 }).observe(mosaic);

  // «до / после»: пока не трогали — ползунок сам показывает разницу
  const cmp = $('#compare'), range = $('input', cmp);
  let touched = false;
  range.oninput = () => { touched = true; cmp.style.setProperty('--pos', range.value + '%'); };
  if (!still) new IntersectionObserver((es, io) => {
    if (!es.some(e => e.isIntersecting)) return;
    io.disconnect();
    const t0 = performance.now();
    const step = now => {
      if (touched) return;
      const t = Math.min(1, (now - t0) / 1800), pos = 50 + Math.sin(t * Math.PI * 2) * 22 * (1 - t);
      cmp.style.setProperty('--pos', pos + '%'); range.value = pos;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, { threshold: .5 }).observe(cmp);

  // док инструментов: оранжевая «таблетка» ходит по инструментам, как в редакторе
  const dock = $('#toolsDemo'), ind = $('.tools-ind', dock), tools = $$('span', dock);
  let cur = 0, timer = 0;
  const place = () => { const b = tools[cur]; ind.style.transform = `translate(${b.offsetLeft}px, ${b.offsetTop}px)`; tools.forEach((x, k) => x.classList.toggle('on', k === cur)); };
  place(); addEventListener('resize', place);
  dock.addEventListener('mouseover', e => { const b = e.target.closest('span'); if (b) { cur = tools.indexOf(b); place(); } });
  if (!still) new IntersectionObserver(es => {
    clearInterval(timer);
    if (es.some(e => e.isIntersecting)) timer = setInterval(() => { if (!dock.matches(':hover')) { cur = (cur + 1) % tools.length; place(); } }, 1500);
  }, { threshold: .4 }).observe(dock);

  const box = $('#latest');
  box.innerHTML = skeletons(3);
  API.list({ limit: 6 }).then(({ items, total }) => {
    // пустой каталог — не «0», а приглашение стать первым
    $('#catNum').textContent = total ? num(total) : '#1';
    $('.big-num span').textContent = total ? plural(total, 'сетка', 'сетки', 'сеток') + ' в каталоге' : 'стань первым автором';
    box.innerHTML = items.length ? items.map(cardHTML).join('') : `<div class="cards-empty">${MARK}<b>Здесь пока пусто</b><span>Стань первым: нарисуй сетку в редакторе и нажми «В каталог».</span><a class="btn primary sm" href="editor.html">Открыть редактор</a></div>`;
  }).catch(() => { box.closest('.section').hidden = true; $('#catNum').textContent = '∞'; });
  box.onclick = e => { const c = e.target.closest('.gcard[data-id]'); if (c) location.href = 'catalog.html?id=' + encodeURIComponent(c.dataset.id); };
}

// ---------- каталог ----------
function initCatalog() {
  $('#demoNote').hidden = API.remote;
  const PAGE = 24;
  const f = { q: '', kind: 'all', sort: 'new' };
  let offset = 0, total = 0, seq = 0;
  const cards = $('#cards'), more = $('#more');

  async function load(reset = true) {
    const my = ++seq;
    if (reset) { offset = 0; cards.innerHTML = skeletons(6); }
    more.disabled = true;
    try {
      const r = await API.list({ q: f.q, kind: f.kind === 'mine' ? 'all' : f.kind, onlyMine: f.kind === 'mine', sort: f.sort, offset, limit: PAGE });
      if (my !== seq) return;
      total = r.total;
      const html = r.items.map((g, k) => cardHTML(g, k)).join('');
      if (reset) cards.innerHTML = html || emptyHTML();
      else cards.insertAdjacentHTML('beforeend', html);
      offset += r.items.length;
      $('#count').textContent = `${num(total)} ${plural(total, 'сетка', 'сетки', 'сеток')}`;
      more.hidden = offset >= total;
    } catch (e) {
      if (my !== seq) return;
      cards.innerHTML = `<div class="cards-empty"><b>Каталог не загрузился</b><span>${esc(e.message)}</span><button class="btn sm" onclick="location.reload()">Обновить</button></div>`;
    }
    more.disabled = false;
  }
  const emptyHTML = () => f.q || f.kind !== 'all'
    ? `<div class="cards-empty"><b>Ничего не нашлось</b><span>${f.kind === 'mine' ? 'Ты ещё ничего не выкладывал из этого браузера.' : 'Попробуй другой запрос или фильтр.'}</span></div>`
    : `<div class="cards-empty">${MARK}<b>Здесь пока пусто</b><span>Стань первым: нарисуй сетку в редакторе и выложи её сюда.</span><a class="btn primary sm" href="editor.html?publish">Выложить сетку</a></div>`;

  let qt = 0;
  $('#q').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; load(); }, 280); };
  $('#sort').onchange = e => { f.sort = e.target.value; load(); };
  const chipInd = () => { const b = $('#kinds .chip.on'); $('#chipInd').style.cssText = `width:${b.offsetWidth}px;transform:translateX(${b.offsetLeft}px)`; };
  chipInd(); document.fonts?.ready.then(chipInd); addEventListener('resize', chipInd);
  $('#kinds').onclick = e => {
    const b = e.target.closest('.chip'); if (!b || b.classList.contains('on')) return;
    $$('.chip', $('#kinds')).forEach(c => c.classList.toggle('on', c === b));
    chipInd();
    f.kind = b.dataset.kind; load();
  };
  more.onclick = () => load(false);

  // карточка → окно; лайк/удаление в окне обновляют карточку
  const onChange = (g, removed) => {
    const c = $(`.gcard[data-id="${CSS.escape(g.id)}"]`, cards); if (!c) return;
    if (removed) { c.remove(); total--; $('#count').textContent = `${num(total)} ${plural(total, 'сетка', 'сетки', 'сеток')}`; if (!$('.gcard', cards)) cards.innerHTML = emptyHTML(); return; }
    const l = $('[data-likes]', c); l.classList.toggle('liked', API.isLiked(g.id)); l.lastChild.textContent = num(g.likes);
  };
  cards.onclick = e => { const c = e.target.closest('.gcard[data-id]'); if (c) openGrid(c.dataset.id, { onChange }); };

  load();
  const id = new URLSearchParams(location.search).get('id');
  if (id) openGrid(id, { onChange });
}

applyIcons();
// блоки с data-reveal проявляются, когда доезжают до экрана
{
  const els = $$('[data-reveal]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }, { threshold: .15, rootMargin: '0px 0px -40px 0px' });
    els.forEach(el => io.observe(el));
  } else els.forEach(el => el.classList.add('in'));
}
if (document.body.dataset.page === 'home') initHome();
if (document.body.dataset.page === 'catalog') initCatalog();
