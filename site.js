'use strict';
/* Лендинг (index.html) и каталог сеток (catalog.html). */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const API = window.CatalogAPI;

// ---------- иконки ----------
const ICONS = {
  brush: 'M4 20c3 0 5-1.5 5-4a2.5 2.5 0 00-5 0M9.5 13.5L20 3M12 11l1.5 1.5',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  upload: 'M12 15V4M7.5 8.5L12 4l4.5 4.5M5 20h14',
  download: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14',
  ext: 'M9 5H5v14h14v-4M13 4h7v7M20 4l-9 9',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  image: 'M4 5h16v14H4zM4 16l4.5-4.5 4 4 2.5-2.5L20 18M15.5 9.5h.01',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z',
  search: 'M10.5 4a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM20 20l-4.8-4.8',
  heart: 'M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.3 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z',
  copy: 'M8.5 8.5h11v11h-11zM5 15.5V4.5h11',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  edit: 'M4 20l4.2-1L19 8.2 15.8 5 5 15.8zM13.5 7.3l3.2 3.2',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  file: 'M6 3.5h8l4.5 4.5v12.5H6zM14 3.5V8h4.5M9 13h6M9 16.5h4',
  swap: 'M8 8l-4 4 4 4M16 8l4 4-4 4',
  pencil: 'M4 20l4.2-1L19 8.2 15.8 5 5 15.8zM13.5 7.3l3.2 3.2',
  line: 'M5 19L19 5',
  rect: 'M4.5 5.5h15v13h-15z',
  ellipse: 'M12 5.5c4.4 0 8 2.9 8 6.5s-3.6 6.5-8 6.5-8-2.9-8-6.5 3.6-6.5 8-6.5z',
  rhombus: 'M12 3.5l8 8.5-8 8.5-8-8.5z',
  triangle: 'M12 4.5l8.5 15h-17z',
  text: 'M5 7V5h14v2M12 5v14M9 19h6',
  eraser: 'M15.5 4l4.5 4.5-9.5 9.5H6.5L4 15.5zM9 20h11M11 8.5l4.5 4.5',
};
const icon = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n] || ''}"/></svg>`;
function applyIcons(root = document) {
  for (const el of $$('[data-icon]', root)) { if (!el.querySelector(':scope > svg.i')) el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)); }
}

// ---------- мелочи ----------
function toast(msg, kind = '') {
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), kind === 'err' ? 5000 : 3000);
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

  // «до / после»
  const cmp = $('#compare'), range = $('input', cmp);
  range.oninput = () => cmp.style.setProperty('--pos', range.value + '%');

  const box = $('#latest');
  box.innerHTML = skeletons(3);
  API.list({ limit: 6 }).then(({ items, total }) => {
    // пустой каталог — не «0», а приглашение стать первым
    $('#catNum').textContent = total ? num(total) : '#1';
    $('.big-num span').textContent = total ? plural(total, 'сетка', 'сетки', 'сеток') + ' в каталоге' : 'стань первым автором';
    box.innerHTML = items.length ? items.map(cardHTML).join('') : `<div class="cards-empty"><b>Здесь пока пусто</b><span>Стань первым: нарисуй сетку в редакторе и нажми «В каталог».</span><a class="btn primary sm" href="editor.html">Открыть редактор</a></div>`;
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
    : `<div class="cards-empty"><b>Здесь пока пусто</b><span>Стань первым: нарисуй сетку в редакторе и выложи её сюда.</span><a class="btn primary sm" href="editor.html?publish">Выложить сетку</a></div>`;

  let qt = 0;
  $('#q').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; load(); }, 280); };
  $('#sort').onchange = e => { f.sort = e.target.value; load(); };
  $('#kinds').onclick = e => {
    const b = e.target.closest('.chip'); if (!b || b.classList.contains('on')) return;
    $$('.chip', $('#kinds')).forEach(c => c.classList.toggle('on', c === b));
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
if (document.body.dataset.page === 'home') initHome();
if (document.body.dataset.page === 'catalog') initCatalog();
