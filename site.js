'use strict';
/* Сайт: главная, Мастерская, гайды, профиль (и общее меню для «Угадайки»).
   Меню сверху и полоса снизу рисуются отсюда — разметка одна на все страницы. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const API = window.CatalogAPI;
const ACC = window.Accounts;
const SITE = window.SITE || {};
const PAGE = document.body.dataset.page;

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
  home: 'M4 11l8-7 8 7M6.5 9v11h11V9',
  hand: 'M12 3v18M3 12h18M9.5 5.5L12 3l2.5 2.5M9.5 18.5L12 21l2.5-2.5M5.5 9.5L3 12l2.5 2.5M18.5 9.5L21 12l-2.5 2.5',
  chev: 'M8 10l4 4 4-4',
  plus: 'M12 5v14M5 12h14',
  github: 'M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 00-1.3-3.2 4.3 4.3 0 00-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 00-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.3 4.3 0 00-.1 3.2A4.6 4.6 0 004 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21',
  user: '<circle cx="12" cy="8" r="3.75"/><path d="M4.5 20a7.5 7.5 0 0115 0"/>',
  book: 'M4 5.5A1.5 1.5 0 015.5 4H11v15.5H5.5A1.5 1.5 0 014 18zM20 5.5A1.5 1.5 0 0018.5 4H13v15.5h5.5A1.5 1.5 0 0020 18z',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.1" fill="currentColor"/><circle cx="15" cy="15" r="1.1" fill="currentColor"/><circle cx="15" cy="9" r="1.1" fill="currentColor"/><circle cx="9" cy="15" r="1.1" fill="currentColor"/>',
  send: 'M20.5 3.5L3.5 10.5l6.5 2.5 2.5 6.5zM10 13l5-5',
  steam: '<circle cx="12" cy="12" r="8.5"/><circle cx="15" cy="9.5" r="2.4"/><circle cx="9.2" cy="15.6" r="1.7"/><path d="M3.9 13.4l3.9 1.6M13.3 11.4l-2.6 3.1"/>',
  telegram: 'M20.5 4.5L3.5 11l5.5 2 2 6 3-4 4.5 3.5zM9 13l7-5.5',
  megaphone: 'M4 10v4h3l7 4.5v-13L7 10zM17.5 9a4 4 0 010 6M7 14l1.5 5.5h2.5L10 15.5',
  logout: 'M14 4h4.5A1.5 1.5 0 0120 5.5v13a1.5 1.5 0 01-1.5 1.5H14M9.5 8L5.5 12l4 4M5.5 12H15',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.7 3.5 5.5 3.5 8.5s-1 5.8-3.5 8.5c-2.5-2.7-3.5-5.5-3.5-8.5s1-5.8 3.5-8.5z"/>',
  trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.4c-.4-.9-1.4-1.4-2.8-1.4-1.6 0-2.7.8-2.7 2 0 2.8 5.6 1.4 5.6 4.2 0 1.2-1.2 2.1-2.9 2.1-1.5 0-2.6-.6-3-1.6M12 6.8V8m0 8v1.2"/>',
  shield: 'M12 3.5l7 2.8v5.4c0 4.2-2.9 7.4-7 8.8-4.1-1.4-7-4.6-7-8.8V6.3zM9 12l2.2 2.2L15.5 10',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z',
  compass: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  play: 'M8 5.5v13l10.5-6.5z',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  pause: 'M8.5 5.5v13M15.5 5.5v13',
  alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.4v.1"/>',
  discord: 'M8.5 16.5c-2 .5-4-.5-4.5-1 0-4 1-7.5 2.5-9.5 1.5-.8 3-1.2 4-1.3l.5 1.3a14 14 0 013.5 0l.5-1.3c1 .1 2.5.5 4 1.3 1.5 2 2.5 5.5 2.5 9.5-.5.5-2.5 1.5-4.5 1l-1-1.8M7 15.5c3.3 1.5 6.7 1.5 10 0M9.5 12.5a.5.5 0 100-1 .5.5 0 000 1zM14.5 12.5a.5.5 0 100-1 .5.5 0 000 1z',
};
const icon = n => { const v = ICONS[n] || ''; return `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${v.startsWith('<') ? v : `<path d="${v}"/>`}</svg>`; };
function applyIcons(root = document) {
  for (const el of $$('[data-icon]', root)) { if (!el.querySelector(':scope > svg.i')) el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)); }
}
const LOGO = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="12" class="mk-bg"/><path d="M13 35L35 13" class="mk-stroke"/></svg>';
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
// аватар: картинка, а если её нет или не загрузилась — первая буква ника
function avatarHTML(url, nick, cls = 'ava') {
  const letter = esc([...String(nick || '?').trim()][0] || '?').toUpperCase();
  return url ? `<span class="${cls}"><img src="${esc(url)}" alt="${letter}" referrerpolicy="no-referrer" onerror="this.parentNode.textContent=this.alt"></span>` : `<span class="${cls}">${letter}</span>`;
}
// аватары авторов на карточках и в окнах: разметка с data-uid, картинки подтягиваются пачкой (fillAvatars)
const authorAva = (uid, nick) => uid && ACC?.enabled ? avatarHTML('', nick, 'ava gava').replace('<span class="ava gava"', `<span class="ava gava" data-uid="${esc(uid)}"`) : avatarHTML('', nick, 'ava gava');
async function fillAvatars() {
  if (!ACC?.enabled) return;
  const els = $$('[data-uid]:not([data-av])'); if (!els.length) return;
  for (const el of els) el.dataset.av = '1';
  const map = await ACC.authors(els.map(el => el.dataset.uid));
  for (const el of els) {
    const a = map.get(el.dataset.uid)?.avatar;
    if (a && el.isConnected) el.innerHTML = `<img src="${esc(a)}" alt="${esc(el.textContent)}" referrerpolicy="no-referrer" onerror="this.parentNode.textContent=this.alt">`;
  }
}
const isAdmin = () => !!ACC?.enabled && ACC.isAdmin();
// «Угадайка»: номер дня — сколько дней прошло с запуска игры (по местному времени), с единицы
const GAME_START = new Date(2026, 9, 9);
const gameDay = (d = new Date()) => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - GAME_START) / 864e5) + 1;
// куда можно вернуться после входа: только страницы этого сайта
const safeNext = s => /^(index|workshop|grid|bg|editor|guides|game|profile|background)\.html(\?[\w=&%.-]*)?$/.test(s || '') ? s : '';

// ---------- меню сверху ----------
const NAV = [['workshop', 'workshop.html', 'compass', 'Мастерская'], ['background', 'background.html', 'image', 'Фон меню'], ['guides', 'guides.html', 'book', 'Гайды'], ['game', 'game.html', 'dice', 'Угадайка']];
function renderNav() {
  const bar = document.createElement('header');
  bar.className = 'navbar'; bar.id = 'navbar';
  bar.innerHTML = `<nav class="nav-pill" aria-label="Главное меню">
    <a class="logo" href="index.html" aria-label="Grid Studio — на главную">${LOGO}<span>Grid<b>Studio</b></span></a>
    <div class="nav-links" id="navLinks">
      <span class="nav-hl" aria-hidden="true"></span>
      ${NAV.map(([k, href, ic, label]) => `<a href="${href}"${k === (PAGE === 'grid' || PAGE === 'bg' ? 'workshop' : PAGE) ? ' aria-current="page"' : ''}>${icon(ic)}${label}${k === 'workshop' ? '<b class="nav-badge" data-cat-count hidden></b>' : ''}</a>`).join('')}
      <a href="editor.html" class="nav-studio">${icon('brush')}Редактор${icon('arrow')}</a>
    </div>
    ${SITE.telegram ? `<a class="nav-tg" href="${esc(SITE.telegram)}" target="_blank" rel="noopener" title="Telegram: чат и новости" aria-label="Telegram: чат и новости">${icon('telegram')}<span>Чат и новости</span></a>` : ''}
    <div class="nav-acc" id="navAcc"></div>
    <button class="nav-burger" id="navBurger" aria-label="Открыть меню" aria-expanded="false" aria-controls="navLinks"><i></i><i></i></button>
  </nav>`;
  document.body.prepend(bar);
  renderAccount();
  ACC?.onChange(renderAccount);
}
// справа в меню: «Войти» или аватар с ником; без аккаунтов — просто «Создать сетку»
function renderAccount() {
  const box = $('#navAcc'); if (!box) return;
  if (!ACC?.enabled) { box.innerHTML = `<a class="btn primary sm" href="editor.html">Создать сетку${icon('arrow')}</a>`; return; }
  const p = ACC.profile(), u = ACC.user();
  box.innerHTML = u
    ? `<a class="nav-user${PAGE === 'profile' && !new URLSearchParams(location.search).get('u') ? ' on' : ''}" href="profile.html" title="Мой профиль">${avatarHTML(p?.avatar, p?.nick || u.email)}<span>${esc(p?.nick || 'Профиль')}</span></a>`
    : `<a class="btn sm nav-login" href="profile.html${PAGE !== 'profile' && PAGE !== 'home' ? '?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search) : ''}">${icon('user')}Войти</a>`;
}
// Подсветка переезжает под ссылку под курсором и возвращается к текущей странице;
// при прокрутке меню становится плотнее; на узком экране ссылки прячутся в «бургер».
function initNav() {
  const bar = $('#navbar'); if (!bar) return;
  const links = $('#navLinks'), hl = $('.nav-hl', links), cur = $('a[aria-current]', links);
  const moveTo = a => {
    if (!a) { hl.style.opacity = 0; return; }
    hl.style.width = a.offsetWidth + 'px'; hl.style.transform = `translateX(${a.offsetLeft}px)`; hl.style.opacity = 1;
  };
  const home = () => moveTo(cur);
  links.addEventListener('mouseover', e => { const a = e.target.closest('a'); if (a) moveTo(a); });
  links.addEventListener('mouseleave', home);
  // без перехода при первой расстановке — иначе подсветка «приезжает» из угла
  hl.style.transition = 'none'; home(); requestAnimationFrame(() => { hl.style.transition = ''; });
  document.fonts?.ready.then(home); addEventListener('resize', home);
  // бейдж «13» у «Мастерской» появляется, когда придёт ответ каталога, — ссылка раздвигается, подсветка должна за ней
  const ro = new ResizeObserver(() => { const h = $('a:hover', links); moveTo(h || cur); });
  $$('a', links).forEach(a => ro.observe(a));

  const onScroll = () => bar.classList.toggle('scrolled', scrollY > 12);
  onScroll(); addEventListener('scroll', onScroll, { passive: true });

  const burger = $('#navBurger');
  const setOpen = on => { bar.classList.toggle('open', on); burger.setAttribute('aria-expanded', on); burger.setAttribute('aria-label', on ? 'Закрыть меню' : 'Открыть меню'); };
  burger.onclick = e => { e.stopPropagation(); setOpen(!bar.classList.contains('open')); };
  document.addEventListener('click', e => { if (!bar.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
}
// число сеток в Мастерской — в меню и в блоках главной
function setCatCount(total) {
  for (const el of $$('[data-cat-count]')) { el.textContent = num(total); el.hidden = !total && el.classList.contains('nav-badge'); }
}

// ---------- полоса снизу: автор, поддержка, Telegram, реклама, GitHub, версия ----------
function renderBottomBars() {
  const a = SITE.author || {};
  const html = `<div class="bb-left">
      <span class="bb-authors">Автор <button class="bb-author" data-info="author">${avatarHTML(a.avatar, a.nick)}@${esc(a.nick || 'ahttps')}</button></span>
      <button class="bb-link" data-info="support">${icon('heart')}Поддержать разработку</button>
      <button class="bb-link" data-info="ads">${icon('megaphone')}Реклама</button>
    </div>
    <div class="bb-right">
      ${SITE.repo ? `<a class="bb-link" href="${esc(SITE.repo)}" target="_blank" rel="noopener">${icon('github')}GitHub${icon('ext')}</a>` : ''}
      <span class="bb-ver" title="Версия сайта">v${esc(SITE.version || '1.0.0')}</span>
    </div>`;
  for (const el of $$('[data-bottom-bar]')) el.innerHTML = html;
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-info]'); if (b) openInfo(b.dataset.info);
  });
  konami();
}

// ---------- пасхалка: код из старых игр (↑↑↓↓←→←→ B A) — сакура, золото и Эгида разом ----------
// Лёгкий холст поверх страницы: частицы падают (или летят вверх) несколько секунд, потом холст убирается.
let fx = null;
function egg(kind) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  burst(kind);
}
function konami() {
  const seq = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let at = 0;
  addEventListener('keydown', e => {
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    at = (e.key.length === 1 ? e.key.toLowerCase() : e.key) === seq[at] ? at + 1 : +(e.key === seq[0]);
    if (at === seq.length) { at = 0; toast('⌨ Код принят: сакура, золото и Эгида разом'); ['sakura', 'gold', 'aegis'].forEach((k, i) => setTimeout(() => egg(k), i * 500)); }
  });
}
function burst(kind) {
  if (!fx) {
    const cv = document.createElement('canvas');
    cv.className = 'fx'; cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
    fx = { cv, c: cv.getContext('2d'), ps: [], t: 0, last: 0, raf: 0 };
    const fit = () => { const d = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; fx.c.setTransform(d, 0, 0, d, 0, 0); };
    fit(); fx.fit = fit; addEventListener('resize', fit);
  }
  const W = innerWidth, H = innerHeight, rnd = (a, b) => a + Math.random() * (b - a);
  const n = Math.min(110, Math.round(W / 14));
  const make = {
    sakura: () => ({ k: 'petal', x: rnd(-.1, 1.05) * W, y: rnd(-.3, 0) * H, vy: rnd(40, 90), vx: rnd(20, 60), s: rnd(7, 13), a: rnd(0, 6.28), va: rnd(-2, 2), sw: rnd(0, 6.28), col: ['#ffc4d2', '#ff9db5', '#ffb3c6', '#fff0f4'][Math.floor(Math.random() * 4)] }),
    snow: () => ({ k: 'flake', x: rnd(-.05, 1.05) * W, y: rnd(-.3, 0) * H, vy: rnd(45, 110), vx: rnd(-14, 14), s: rnd(1.6, 4.2), sw: rnd(0, 6.28), col: '#eef5ff' }),
    embers: () => ({ k: 'ember', x: rnd(0, 1) * W, y: H + rnd(0, .2) * H, vy: -rnd(70, 190), vx: rnd(-26, 26), s: rnd(1.4, 3.6), sw: rnd(0, 6.28), col: ['#ff6a2a', '#ff9a3c', '#ffd27a', '#ff4d2a'][Math.floor(Math.random() * 4)] }),
    gold: () => ({ k: 'coin', x: rnd(0, 1) * W, y: rnd(-.35, 0) * H, vy: rnd(160, 330), vx: rnd(-18, 18), s: rnd(7, 11), a: rnd(0, 6.28), va: rnd(5, 10), sw: 0 }),
  };
  if (kind === 'aegis') fx.ps.push({ k: 'aegis', life: 0 });
  else for (let i = 0; i < n; i++) { const p = make[kind](); p.delay = rnd(0, 2.6); fx.ps.push(p); }
  if (fx.raf) return;
  fx.last = performance.now();
  const step = now => {
    const dt = Math.min(.05, (now - fx.last) / 1000); fx.last = now;
    const { c, ps } = fx; c.clearRect(0, 0, W, H);
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      if (p.k === 'aegis') { p.life += dt; drawAegis(c, p.life, W, H); if (p.life > 2.6) ps.splice(i, 1); continue; }
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.sw += dt * 2.2; p.y += p.vy * dt; p.x += (p.vx + Math.sin(p.sw) * (p.k === 'coin' ? 6 : 26)) * dt;
      if (p.a !== undefined) p.a += p.va * dt;
      if (p.y > H + 30 || p.y < -80 || p.x > W + 40 || p.x < -40) { ps.splice(i, 1); continue; }
      drawParticle(c, p);
    }
    if (ps.length) fx.raf = requestAnimationFrame(step);
    else { fx.raf = 0; removeEventListener('resize', fx.fit); fx.cv.remove(); fx = null; }
  };
  fx.raf = requestAnimationFrame(step);
}
function drawParticle(c, p) {
  c.save(); c.translate(p.x, p.y);
  if (p.k === 'petal') {
    c.rotate(p.a); c.scale(1, .55 + .45 * Math.abs(Math.cos(p.a * .7))); c.fillStyle = p.col; c.globalAlpha = .92;
    const s = p.s; c.beginPath(); c.moveTo(0, -s); c.bezierCurveTo(s * .9, -s * .7, s * .8, s * .5, 0, s); c.bezierCurveTo(-s * .8, s * .5, -s * .9, -s * .7, 0, -s * .55); c.fill();
  } else if (p.k === 'flake') {
    c.fillStyle = p.col; c.globalAlpha = .55 + p.s / 10; c.beginPath(); c.arc(0, 0, p.s, 0, 6.283); c.fill();
  } else if (p.k === 'ember') {
    c.globalCompositeOperation = 'lighter'; c.fillStyle = p.col; c.globalAlpha = Math.max(.15, Math.min(1, p.y / 300));
    c.shadowColor = p.col; c.shadowBlur = 10; c.beginPath(); c.arc(0, 0, p.s, 0, 6.283); c.fill();
  } else if (p.k === 'coin') {
    const w = Math.abs(Math.cos(p.a)), s = p.s;
    c.scale(Math.max(.12, w), 1);
    const g = c.createRadialGradient(-s * .3, -s * .3, 1, 0, 0, s); g.addColorStop(0, '#fff3b0'); g.addColorStop(.55, '#f3b93a'); g.addColorStop(1, '#a9740f');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, s, 0, 6.283); c.fill();
    c.strokeStyle = 'rgba(120,70,0,.55)'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, s * .66, 0, 6.283); c.stroke();
  }
  c.restore();
}
// Эгида Бессмертного: золотая вспышка из центра и кольцо света
function drawAegis(c, t, W, H) {
  const k = Math.min(1, t / 2.6), a = Math.sin(Math.PI * Math.min(1, k * 1.15)), R = Math.hypot(W, H) * (.25 + .5 * k), cx = W / 2, cy = H * .45;
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, `rgba(255,214,120,${.26 * a})`); g.addColorStop(.5, `rgba(255,150,60,${.14 * a})`); g.addColorStop(1, 'rgba(255,120,40,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.strokeStyle = `rgba(255,226,150,${.7 * (1 - k)})`; c.lineWidth = 3 + 8 * (1 - k); c.beginPath(); c.arc(cx, cy, R * .62, 0, 6.283); c.stroke();
  c.restore();
}
// небольшие окна: автор, поддержка, реклама
function openSheet(html) {
  const root = $('#modalRoot');
  root.innerHTML = `<div class="modal sheet" role="dialog"><button class="modal-x" data-icon="x" aria-label="Закрыть"></button>${html}</div>`;
  applyIcons(root);
  const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  root.onclick = e => { if (e.target === root || e.target.closest('.modal-x')) close(); };
  // root — само окно: оно новое при каждом открытии, так что обработчики на нём не копятся
  return { root: $('.modal', root), close };
}
function openInfo(kind) {
  if (kind === 'support') return openSupport();
  const a = SITE.author || {};
  const discord = `<button class="btn block" data-copy="${esc(a.discord || 'ahttps')}">${icon('discord')}Discord: ${esc(a.discord || 'ahttps')}<span class="sh-note">скопировать</span></button>`;
  const tg = SITE.telegram ? `<a class="btn block" href="${esc(SITE.telegram)}" target="_blank" rel="noopener">${icon('send')}Telegram: чат и новости</a>` : '';
  const sheets = {
    author: `${avatarHTML(a.avatar, a.nick, 'sh-ava')}<h2>@${esc(a.nick || 'ahttps')}</h2>
      <p>Автор Grid Studio. Пиши по вопросам, насчёт заказа сеток и с интересными предложениями.</p>
      <div class="sh-actions">${discord}${a.github ? `<a class="btn block" href="https://github.com/${esc(a.github)}" target="_blank" rel="noopener">${icon('github')}GitHub: ${esc(a.github)}</a>` : ''}${tg}</div>`,
    ads: `<div class="sh-ico">${icon('megaphone')}</div><h2>Реклама на Grid Studio</h2>
      <p>Аудитория — игроки Dota 2, которые настраивают игру под себя. Места: главная, Мастерская, гайды и «Угадайка». Обсудим формат и цену.</p>
      <div class="sh-actions">${SITE.ads ? `<a class="btn primary block" href="${esc(SITE.ads)}" target="_blank" rel="noopener">${icon('send')}Написать насчёт рекламы</a>` : ''}${discord}${tg}</div>`,
  };
  const m = openSheet(`<div class="sh-body">${sheets[kind]}</div>`);
  m.root.addEventListener('click', e => { const b = e.target.closest('[data-copy]'); if (b) copyText(b.dataset.copy, 'Скопировано'); });
}

// ---------- «Поддержать разработку»: криптовалюта (адреса — в config.js), ещё способы, QR для телефона ----------
const COIN_MARK = { btc: '₿', eth: 'Ξ', usdt: '₮', ton: '◈', sol: '◎', ltc: 'Ł', trx: 'T', xmr: 'ɱ' };
let qrLoad = null;
const loadQR = () => qrLoad ||= new Promise((res, rej) => {
  if (window.qrcode) return res(window.qrcode);
  const sc = document.createElement('script');
  sc.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
  sc.onload = () => res(window.qrcode); sc.onerror = () => { qrLoad = null; rej(new Error('qr')); };
  document.head.appendChild(sc);
});
// QR одним SVG-путём: тёмные модули на белой плашке с тихой зоной — так читается любым сканером
async function qrSVG(text) {
  const q = (await loadQR())(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), m = 3; let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!q.isDark(y, x)) continue;
    let w = 1; while (x + w < n && q.isDark(y, x + w)) w++;
    d += `M${x + m} ${y + m}h${w}v1h-${w}z`; x += w - 1;
  }
  return `<svg viewBox="0 0 ${n + m * 2} ${n + m * 2}" shape-rendering="crispEdges" role="img" aria-label="QR-код адреса"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#15100d"/></svg>`;
}
function openSupport() {
  const coins = (SITE.crypto || []).filter(c => c?.addr);
  const m = openSheet(`<div class="sup-body">
    <div class="sup-head">
      <div class="sup-heart"><i></i><i></i>${icon('heart')}</div>
      <h2>Поддержать Grid Studio</h2>
      <p>Сайт бесплатный и таким останется. Если он пригодился — помоги ему расти: новые режимы, гайды и игры появятся быстрее.</p>
    </div>
    <section class="sup-sec">
      <h3>${icon('coin')}Криптовалютой</h3>
      ${coins.length ? `<div class="coin-tabs" role="tablist">${coins.map((c, i) => `<button class="coin-tab${i ? '' : ' on'}" role="tab" data-coin="${i}" style="--cc:${esc(c.color || '#f08a4b')}"><i>${esc(COIN_MARK[c.id] || c.ticker?.[0] || '¤')}</i>${esc(c.ticker)}</button>`).join('')}</div>
      <div class="coin-panel" id="coinPanel"></div>`
      : `<div class="coin-soon">${icon('coin')}<b>Кошельки скоро появятся</b><span>Адреса для перевода добавятся сюда. Пока можно поддержать другими способами ниже.</span></div>`}
    </section>
    <section class="sup-sec">
      <h3>${icon('star')}Без денег — тоже помощь</h3>
      <div class="sup-ways">
        ${SITE.support ? `<a class="sup-way pri" href="${esc(SITE.support)}" target="_blank" rel="noopener">${icon('heart')}<b>Рублями</b><span>Boosty и подобные</span></a>` : ''}
        ${SITE.repo ? `<a class="sup-way" href="${esc(SITE.repo)}" target="_blank" rel="noopener">${icon('star')}<b>Звезда на GitHub</b><span>одна секунда</span></a>` : ''}
        <button class="sup-way" data-copy="${esc(new URL('index.html', location.href).href)}">${icon('link')}<b>Рассказать друзьям</b><span>скопировать ссылку</span></button>
        <a class="sup-way" href="editor.html?publish">${icon('upload')}<b>Выложить сетку</b><span>в Мастерскую</span></a>
      </div>
    </section>
    <p class="sup-thanks">Спасибо, что ты здесь 🧡</p>
  </div>`);
  m.root.classList.add('sup');
  m.root.addEventListener('click', e => { const b = e.target.closest('[data-copy]'); if (b) copyText(b.dataset.copy, 'Скопировано'); });
  if (!coins.length) return;
  const panel = $('#coinPanel', m.root);
  const show = async i => {
    const c = coins[i];
    panel.dataset.i = i;
    $$('.coin-tab', m.root).forEach((t, k) => { t.classList.toggle('on', k === i); t.setAttribute('aria-selected', k === i); });
    panel.style.setProperty('--cc', c.color || '#f08a4b');
    panel.innerHTML = `<div class="coin-qr" aria-hidden="true"><span class="loading">QR…</span></div>
      <div class="coin-info">
        <div class="coin-name"><b>${esc(c.name || c.ticker)}</b><em>сеть ${esc(c.network || c.name)}</em></div>
        <button class="coin-addr" data-copy="${esc(c.addr)}" title="Скопировать адрес"><code>${esc(c.addr)}</code><span>${icon('copy')}Копировать</span></button>
        ${c.memo ? `<button class="coin-addr memo" data-copy="${esc(c.memo)}" title="Скопировать memo"><small>Memo / тег</small><code>${esc(c.memo)}</code><span>${icon('copy')}</span></button>` : ''}
        <p class="coin-warn">${icon('shield')}<span>Отправляй только ${esc(c.ticker)} в сети «${esc(c.network || c.name)}» — перевод в другую сеть не вернуть.</span></p>
      </div>`;
    try { const svg = await qrSVG(c.addr); if (+panel.dataset.i === i) $('.coin-qr', panel).innerHTML = svg; } catch { $('.coin-qr', panel)?.remove(); }
  };
  m.root.addEventListener('click', e => { const t = e.target.closest('.coin-tab'); if (t) show(+t.dataset.coin); });
  show(0);
}

// ---------- карточка сетки ----------
// Превью — живой холст (GridRender.mount) с настоящими портретами: сетка подгружается, когда карточка доезжает до экрана.
// 18+ — карточка размыта, пока не нажмёшь (или не ответишь «мне есть 18, не спрашивать»).
const tagsHTML = (tags, n = 3) => tags?.length ? `<span class="gtags">${tags.slice(0, n).map(t => `<i>${esc(t)}</i>`).join('')}${tags.length > n ? `<i>+${tags.length - n}</i>` : ''}</span>` : '';
const nsfwCover = () => `<span class="nsfw-cover"><b>18+</b><span>Нажми, чтобы показать</span></span>`;
// что внутри сетки — строкой под карточкой: «ASCII · 11 909 категорий» или «Мозаика · 1 903 кат. · 82 героя»
function gridFacts(g) {
  const kind = API.KINDS[g.kind] || 'Сетка';
  return g.heroes ? `${kind} · ${num(g.cats)} кат. · ${num(g.heroes)} ${plural(g.heroes, 'герой', 'героя', 'героев')}`
    : `${kind} · ${num(g.cats)} ${plural(g.cats, 'категория', 'категории', 'категорий')}`;
}
function cardHTML(g, k = 0) {
  const hide = g.nsfw && !API.adult();
  return `<article class="gcard${hide ? ' hide18' : ''}" data-id="${esc(g.id)}" tabindex="0" style="animation-delay:${Math.min(k, 12) * 40}ms">
    <span class="gthumb" data-live="${esc(g.id)}"><canvas aria-hidden="true"></canvas><span class="g-load">Загружаем сетку…</span>
      ${API.isMine(g.id, g.user_id) ? '<span class="gmine">моя</span>' : ''}
      ${g.nsfw ? '<span class="g18">18+</span>' : ''}${hide ? nsfwCover() : ''}</span>
    <div class="ginfo">
      <div class="gmain"><a class="gtitle" href="${gridUrl(g.id)}" title="${esc(g.title)}">${esc(g.title)}</a>
        <span class="gby">${authorAva(g.user_id, g.author)}${esc(g.author)}<i>· ${ago(g.created_at)}</i></span></div>
      <div class="gacts"><span class="gdl" title="Скачали: ${num(g.downloads)}">${icon('download')}${num(g.downloads)}</span>
        <button class="glike${API.isLiked(g.id) ? ' liked' : ''}" data-grid-like="${esc(g.id)}" data-likes aria-label="Лайк">${icon('heart')}${num(g.likes)}</button></div>
    </div>
    <div class="gfoot"><span>${gridFacts(g)}</span>${g.tags?.length ? `<span class="gtagline">${g.tags.map(esc).join(', ')}</span>` : ''}</div>
  </article>`;
}
const skeletons = n => Array.from({ length: n }, () => '<div class="gcard sk"><div class="skeleton"></div><div class="ginfo"><span></span><span></span></div></div>').join('');

// подложка превью сеток: «как в Доте», «классика» (старый коричневый клиент), тёмная или градиент — выбор запоминается
const PREVIEW_BG = [['dota', 'Как в Dota'], ['classic', 'Классика'], ['dark', 'Тёмный'], ['grad', 'Градиент'], ...(GridRender.mine() ? [['mine', 'Мой фон']] : [])];
const previewBg = () => { try { const v = localStorage.getItem('gs.previewBg'); return PREVIEW_BG.some(b => b[0] === v) ? v : 'dota'; } catch { return 'dota'; } };
function setPreviewBg(v) {
  try { localStorage.setItem('gs.previewBg', v); } catch {}
  for (const el of $$('.gthumb.ready')) el._view?.set({ bg: v });
  for (const el of $$('[data-preview-bg]')) el._view?.set({ bg: v });
}
// живые превью: любая вставленная карточка сама подхватывается, сетка грузится, когда до неё ~300px
const liveIO = 'IntersectionObserver' in window ? new IntersectionObserver(es => {
  for (const e of es) if (e.isIntersecting) { liveIO.unobserve(e.target); hydrate(e.target); }
}, { rootMargin: '300px 0px' }) : null;
async function hydrate(el) {
  const id = el.dataset.live, cv = $('canvas', el);
  try {
    const cfg = await API.config(id);
    if (!el.isConnected) return;
    el._view = GridRender.mount(cv, cfg?.categories || [], { bg: previewBg() });
  } catch {
    // сетку скачать не вышло — показываем сохранённую картинку
    try { const t = await API.thumb(id); if (t) cv.insertAdjacentHTML('afterend', `<img src="${esc(t)}" alt="">`); } catch {}
  }
  el.classList.add('ready');
}
function watchLive() {
  for (const el of $$('.gthumb[data-live]:not([data-seen])')) { el.dataset.seen = '1'; liveIO ? liveIO.observe(el) : hydrate(el); }
}
new MutationObserver(() => { watchLive(); fillAvatars(); }).observe(document.body, { childList: true, subtree: true });

// 18+: клик по размытой карточке сначала спрашивает — до того, как сработает открытие окна
document.addEventListener('click', e => {
  const card = e.target.closest('.hide18');
  if (!card) return;
  e.preventDefault(); e.stopPropagation();
  askAdult(() => card.classList.remove('hide18'));
}, true);
// лайк прямо с карточки сетки: перехватываем раньше, чем клик откроет окно
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-grid-like]');
  if (!b || b.closest('.hide18')) return;
  e.preventDefault(); e.stopPropagation();
  b.disabled = true;
  try {
    const r = await API.like(b.dataset.gridLike);
    b.classList.toggle('liked', r.liked); b.lastChild.textContent = num(r.likes);
  } catch (er) { toast(er.message, 'err'); }
  b.disabled = false;
}, true);
// «В Dota» на карточке фона — просто ссылка в сборщик: страницу фона при этом не открываем
document.addEventListener('click', e => { if (e.target.closest('[data-bg-dota]') && !e.target.closest('.hide18')) e.stopPropagation(); }, true);
// карточка — <article>, поэтому Enter открывает её вручную
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches?.('.gcard[data-id], .bcard[data-bg]')) e.target.click();
});
function askAdult(onShow) {
  const m = openSheet(`<div class="sh-body"><div class="sh-ico sh-18">18+</div><h2>Работа для взрослых</h2>
    <p>Автор пометил её как 18+. Показать?</p>
    <div class="sh-actions"><button class="btn primary block" data-adult="once">Показать</button>
      <button class="btn block" data-adult="always">Мне есть 18 — больше не спрашивать</button></div></div>`);
  m.root.addEventListener('click', ev => {
    const b = ev.target.closest('[data-adult]'); if (!b) return;
    if (b.dataset.adult === 'always') { API.setAdult(true); $$('.hide18').forEach(c => c.classList.remove('hide18')); }
    m.close(); onShow();
  });
}

// ---------- страницы сетки и фона: общее ----------
// Сетка и фон открываются своей страницей, а не окном: их можно открыть в новой вкладке, переслать ссылкой и вернуться «назад».
const gridUrl = id => 'grid.html?id=' + encodeURIComponent(id);
const bgPageUrl = id => 'bg.html?id=' + encodeURIComponent(id);
// клик по карточке: ссылки внутри карточки срабатывают сами; с Ctrl/⌘/Shift — в новой вкладке
function goTo(url, e) {
  if (e?.target?.closest?.('a[href]')) return;
  if (e && (e.ctrlKey || e.metaKey || e.shiftKey)) window.open(url, '_blank', 'noopener');
  else location.href = url;
}
const goGrid = (id, e) => goTo(gridUrl(id), e);
const goBg = (id, e) => goTo(bgPageUrl(id), e);
// колёсиком по карточке — тоже в новой вкладке, как по обычной ссылке
const cardUrl = c => c.dataset.id ? gridUrl(c.dataset.id) : bgPageUrl(c.dataset.bg);
document.addEventListener('mousedown', e => { if (e.button === 1 && e.target.closest('.gcard[data-id], .bcard[data-bg]')) e.preventDefault(); });
document.addEventListener('auxclick', e => {
  const c = e.button === 1 && e.target.closest('.gcard[data-id]:not(.hide18), .bcard[data-bg]:not(.hide18)');
  if (c && !e.target.closest('a[href], button')) { e.preventDefault(); window.open(cardUrl(c), '_blank', 'noopener'); }
});
// сетки или фона нет — вместо страницы заглушка со ссылкой обратно
function pageFail(box, title, text, back = 'workshop.html') {
  box.innerHTML = `<div class="gp-empty">${MARK}<h1>${title}</h1><p>${esc(text)}</p>
    <div class="gp-empty-acts"><a class="btn primary" href="${back}">${icon('compass')}В Мастерскую</a><a class="btn" href="editor.html">${icon('brush')}Открыть редактор</a></div></div>`;
}
// «← Мастерская»: если пришли оттуда — шаг назад по истории, чтобы не потерять фильтры и прокрутку
function bindBack(from) {
  $('#gpBack').onclick = e => {
    let ref = null; try { ref = new URL(document.referrer); } catch {}
    if (ref && ref.origin === location.origin && from.test(ref.pathname) && history.length > 1) { e.preventDefault(); history.back(); }
  };
}
// превью на весь экран: вместе с панелью над ним
function bindFullscreen(stage, onChange) {
  const full = $('#gpFull');
  if (!stage.requestFullscreen) { full.hidden = true; return; }
  full.onclick = () => document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen().catch(() => {});
  document.addEventListener('fullscreenchange', () => {
    const on = document.fullscreenElement === stage;
    full.innerHTML = `${icon(on ? 'x' : 'ext')}<span>${on ? 'Выйти' : 'На весь экран'}</span>`;
    requestAnimationFrame(onChange);
  });
}

// ---------- страница сетки (grid.html?id=…) ----------
const gridJSON = (g, cats) => JSON.stringify({ version: 3, configs: [{ config_name: g.title, categories: cats }] }, null, '\t');
const STEAM_CFG = 'Steam\\userdata\\<твой ID>\\570\\remote\\cfg';

async function initGridPage() {
  const box = $('#gp'), id = new URLSearchParams(location.search).get('id');
  if (!id) return pageFail(box, 'Сетка не выбрана', 'В ссылке нет номера сетки — найди нужную в Мастерской.');
  let g;
  // профиль ждём вместе с сеткой: от него зависит, показать ли «Удалить» и плашку админа
  try { [g] = await Promise.all([API.get(id), ACC?.enabled ? ACC.ready().catch(() => {}) : null]); }
  catch (e) { document.title = 'Сетка не найдена · Grid Studio'; return pageFail(box, 'Сетка не найдена', e.message); }

  const cats = g.config?.categories || [], st = GridRender.stats(cats);
  const uniq = new Set(cats.flatMap(c => Array.isArray(c.hero_ids) ? c.hero_ids : [])).size;
  const size = new Blob([gridJSON(g, cats)]).size;
  const kind = API.KINDS[g.kind] || 'Сетка', hide = g.nsfw && !API.adult();
  const author = g.user_id && ACC?.enabled ? `<a href="profile.html?u=${encodeURIComponent(g.user_id)}">${esc(g.author)}</a>` : `<b>${esc(g.author)}</b>`;
  const liked = () => API.isLiked(g.id);
  document.title = `${g.title} — сетка героев Dota 2 · Grid Studio`;
  $('meta[name="description"]').content = `«${g.title}» от ${g.author}: ${kind.toLowerCase()}, ${num(g.cats)} ${plural(g.cats, 'категория', 'категории', 'категорий')}. Живое превью, скачивание и правка в редакторе Grid Studio.`;

  const fact = (n, label, note = '') => `<div><b>${n}</b><span>${label}</span>${note ? `<small>${note}</small>` : ''}</div>`;
  box.innerHTML = `
    <nav class="gp-crumbs" aria-label="Где ты">
      <a href="workshop.html" id="gpBack">${icon('arrow')}Мастерская</a><i>/</i><a href="workshop.html">Сетки</a><i>/</i><span>${esc(g.title)}</span>
    </nav>
    <header class="gp-head">
      <div class="gp-title">
        <span class="gp-kind">${icon('grid')}${esc(kind)} · ${num(g.cats)} ${plural(g.cats, 'категория', 'категории', 'категорий')}${g.nsfw ? '<b class="g18">18+</b>' : ''}</span>
        <h1>${esc(g.title)}</h1>
        <div class="gp-by">${authorAva(g.user_id, g.author)}<span>от ${author}</span><i>·</i><span>${ago(g.created_at)}</span></div>
      </div>
      <div class="gp-cta">
        <a class="btn primary lg" id="gEdit" href="editor.html?grid=${encodeURIComponent(g.id)}">${icon('edit')}Открыть в редакторе</a>
        <button class="btn lg" id="gDl">${icon('download')}Скачать</button>
        <button class="btn lg gp-like${liked() ? ' on' : ''}" id="gLike" aria-label="Лайк">${icon('heart')}<span data-likes>${num(g.likes)}</span></button>
      </div>
    </header>

    <section class="gp-stage" id="gpStage">
      <div class="gp-bar">
        <div class="seg sm" id="gpBg" aria-label="Подложка превью"><i class="seg-ind"></i>${PREVIEW_BG.map(([v, l]) => `<button data-v="${v}" class="${previewBg() === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="gp-tools">
          <div class="seg sm" id="gpZoom" aria-label="Масштаб"><i class="seg-ind"></i><button data-v="1" class="on">1×</button><button data-v="2">2×</button></div>
          <button class="btn sm" id="gpFull">${icon('ext')}<span>На весь экран</span></button>
        </div>
      </div>
      <div class="gp-view${hide ? ' hide18' : ''}" id="gpView" data-preview-bg><div class="gp-canvas"><canvas id="gv" aria-label="Превью сетки"></canvas></div>${hide ? nsfwCover() : ''}</div>
    </section>
    <p class="gp-cap">Превью — как экран «Герои» в игре: поле 1204 × 612, настоящие портреты, без интерфейса Доты.<span id="gpPan" hidden> В 2× сетку можно таскать мышью.</span></p>

    <div class="gp-body">
      <div class="gp-main">
        <section class="gp-block">
          <h2>Об этой сетке</h2>
          ${g.description ? `<div class="gp-desc">${esc(g.description)}</div>` : '<p class="gp-none">Автор не добавил описание.</p>'}
          ${g.tags?.length ? `<div class="gp-tags">${g.tags.map(t => `<a href="workshop.html" data-tag="${esc(t)}">${esc(t)}</a>`).join('')}</div>` : ''}
        </section>
        <section class="gp-block">
          <h2>Что внутри</h2>
          <div class="gp-facts">
            ${fact(num(st.cats), plural(st.cats, 'категория', 'категории', 'категорий'), 'всего в файле')}
            ${fact(num(st.hero), plural(st.hero, 'блок', 'блока', 'блоков'), 'с героями')}
            ${fact(num(st.label), plural(st.label, 'подпись', 'подписи', 'подписей'), 'текст и символы')}
            ${fact(num(st.ids), plural(st.ids, 'портрет', 'портрета', 'портретов'), uniq ? `${num(uniq)} ${plural(uniq, 'разный герой', 'разных героя', 'разных героев')}` : 'героев нет')}
            ${fact(size < 1048576 ? `${Math.max(1, Math.round(size / 1024))} КБ` : mb(size), 'размер файла', 'hero_grid_config.json')}
          </div>
        </section>
        <section class="gp-block">
          <h2>Как установить</h2>
          <ol class="gp-steps">
            <li><b>Скачай файл</b><span>Кнопка «Скачать» наверху — придёт <code>hero_grid_config.json</code>.</span></li>
            <li><b>Положи в папку игры</b><span>Закрой Доту и скопируй файл с заменой в <code>${esc(STEAM_CFG)}</code>.</span></li>
            <li><b>Выбери в игре</b><span>«Герои» → сортировка → сетка с названием «${esc(g.title)}».</span></li>
          </ol>
          <p class="hint">Файл заменит все твои сетки. Чтобы добавить эту к своим — открой её в редакторе, нажми «Открыть JSON» со своим файлом и сделай экспорт. <a href="guides.html#start">Подробный гайд с картинками</a></p>
        </section>
      </div>
      <aside class="gp-side" id="gpSide"></aside>
    </div>

    <section class="gp-more" id="gpAuthor" hidden>
      <div class="gp-more-head"><h2>Ещё от ${esc(g.author)}</h2>${g.user_id && ACC?.enabled ? `<a class="btn sm" href="profile.html?u=${encodeURIComponent(g.user_id)}">${icon('user')}Профиль автора</a>` : ''}</div>
      <div class="cards"></div>
    </section>
    <section class="gp-more" id="gpSimilar" hidden>
      <div class="gp-more-head"><h2>Похожие сетки</h2><a class="btn sm" href="workshop.html">${icon('compass')}Вся Мастерская</a></div>
      <div class="cards"></div>
    </section>`;

  // ----- превью: подложка, масштаб, весь экран -----
  const view = $('#gpView'), wrap = $('.gp-canvas', view), stage = $('#gpStage');
  view._view = GridRender.mount($('#gv'), cats, { bg: previewBg() });
  const segs = () => ['#gpBg', '#gpZoom'].forEach(s => segInd($(s)));
  requestAnimationFrame(segs); document.fonts?.ready.then(segs); addEventListener('resize', segs);
  $('#gpBg').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('#gpBg button').forEach(x => x.classList.toggle('on', x === b)); segInd($('#gpBg')); setPreviewBg(b.dataset.v);
  };
  $('#gpZoom').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('#gpZoom button').forEach(x => x.classList.toggle('on', x === b)); segInd($('#gpZoom'));
    // увеличиваем к центру того, что сейчас видно
    const cx = (view.scrollLeft + view.clientWidth / 2) / wrap.offsetWidth, cy = (view.scrollTop + view.clientHeight / 2) / wrap.offsetHeight;
    view.style.setProperty('--z', b.dataset.v); view.classList.toggle('zoomed', b.dataset.v !== '1'); $('#gpPan').hidden = b.dataset.v === '1';
    view.scrollLeft = cx * wrap.offsetWidth - view.clientWidth / 2; view.scrollTop = cy * wrap.offsetHeight - view.clientHeight / 2;
  };
  // в 2× сетку таскаем мышью
  view.addEventListener('pointerdown', e => {
    if (!view.classList.contains('zoomed') || e.button !== 0 || e.pointerType === 'touch' || e.target.closest('.nsfw-cover')) return;
    const x0 = e.clientX, y0 = e.clientY, l0 = view.scrollLeft, t0 = view.scrollTop;
    view.setPointerCapture(e.pointerId); view.classList.add('drag');
    const move = ev => { view.scrollLeft = l0 - (ev.clientX - x0); view.scrollTop = t0 - (ev.clientY - y0); };
    const up = () => { view.classList.remove('drag'); view.removeEventListener('pointermove', move); };
    view.addEventListener('pointermove', move); view.addEventListener('pointerup', up, { once: true }); view.addEventListener('pointercancel', up, { once: true });
  });
  bindFullscreen(stage, segs);

  // ----- действия -----
  $('#gEdit').onclick = () => API.hit(g.id);
  $('#gDl').onclick = () => { download('hero_grid_config.json', gridJSON(g, cats)); API.hit(g.id); toast('Файл скачан — положи его в Steam\\userdata\\<ID>\\570\\remote\\cfg', 'ok'); };
  const like = $('#gLike');
  like.onclick = async () => {
    like.disabled = true;
    try {
      const r = await API.like(g.id);
      g.likes = r.likes;
      like.classList.toggle('on', r.liked);
      $$('[data-likes]', box).forEach(el => { el.textContent = num(r.likes); });
      const s = $('[data-likes-label]', box); if (s) s.textContent = plural(r.likes, 'лайк', 'лайка', 'лайков');
    } catch (e) { toast(e.message, 'err'); }
    like.disabled = false;
  };
  bindBack(/workshop\.html$/);
  // тег — в Мастерскую с этим тегом
  box.addEventListener('click', e => {
    const t = e.target.closest('[data-tag]');
    if (t) { e.preventDefault(); location.href = 'workshop.html?tag=' + encodeURIComponent(t.dataset.tag); return; }
    const c = e.target.closest('.gcard[data-id]'); if (c) goGrid(c.dataset.id, e);
  });

  // ----- панель справа: цифры, админ, ссылка, жалоба / удаление (перерисовывается, когда меняется вход) -----
  function renderSide() {
    const mine = API.isMine(g.id, g.user_id), adm = isAdmin(), side = $('#gpSide');
    side.innerHTML = `
      ${adm ? adminBox(g, mine) : ''}
      <div class="gp-stats">
        <div><b data-likes>${num(g.likes)}</b><span data-likes-label>${plural(g.likes, 'лайк', 'лайка', 'лайков')}</span></div>
        <div><b>${num(g.downloads)}</b><span>${plural(g.downloads, 'скачивание', 'скачивания', 'скачиваний')}</span></div>
      </div>
      <div class="gp-side-acts">
        <button class="btn block" id="gLink">${icon('link')}Скопировать ссылку</button>
        <button class="btn block" id="gCopy">${icon('copy')}Копировать JSON</button>
        ${mine ? `<button class="btn block ghost danger" id="gDel">${icon('trash')}Удалить мою сетку</button>`
          : adm ? '' : `<button class="btn block ghost" id="gReport"${API.isReported(g.id) ? ' disabled' : ''}>${icon('alert')}${API.isReported(g.id) ? 'Жалоба отправлена' : 'Пожаловаться'}</button>`}
      </div>
      <p class="hint">Опубликовано ${new Date(g.created_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>`;
    $('#gLink').onclick = () => copyText(new URL(gridUrl(g.id), location.href).href, 'Ссылка скопирована');
    $('#gCopy').onclick = () => { copyText(gridJSON(g, cats), 'JSON скопирован'); API.hit(g.id); };
    const rep = $('#gReport');
    if (rep) rep.onclick = async () => {
      if (API.isReported(g.id)) return;
      if (!confirm('Пожаловаться на эту сетку? После нескольких жалоб она пропадёт из Мастерской до проверки.')) return;
      try { await API.report(g.id); renderSide(); toast('Спасибо, жалоба отправлена', 'ok'); } catch (e) { toast(e.message, 'err'); }
    };
    for (const del of $$('#gDel, #aDel', side)) del.onclick = async () => {
      if (!confirm(`Удалить «${g.title}» из Мастерской? Это нельзя отменить.`)) return;
      try { await API.remove(g.id); toast('Сетка удалена', 'ok'); setTimeout(() => { location.href = 'workshop.html'; }, 700); } catch (e) { toast(e.message, 'err'); }
    };
    bindAdmin(side, 'grid', g, renderSide);
  }
  renderSide();
  ACC?.onChange(renderSide);

  // ----- ещё от автора и похожие (по первому тегу, а без тегов — популярные) -----
  const fill = (sec, items) => { if (!items.length) return; $('.cards', sec).innerHTML = items.map(cardHTML).join(''); sec.hidden = false; };
  const sameAuthor = x => g.user_id ? x.user_id === g.user_id : x.author === g.author;
  if (g.user_id && ACC?.enabled) ACC.userGrids(g.user_id).then(list => fill($('#gpAuthor'), list.filter(x => x.id !== g.id).slice(0, 3))).catch(() => {});
  (async () => {
    let items = [];
    for (const tag of [g.tags?.[0] || '', '']) {
      const r = await API.list({ tag, sort: 'popular', limit: 12 }).catch(() => ({ items: [] }));
      items = r.items.filter(x => x.id !== g.id && !sameAuthor(x));
      if (items.length >= 3 || !tag) break;
    }
    fill($('#gpSimilar'), items.slice(0, 6));
  })();
}
// админу на странице сетки или фона: сколько жалоб, скрыто ли, и кнопки «Скрыть / Вернуть», «Удалить»
// у фонов ещё «На главную»: отмеченный фон идёт фоном первого экрана сайта (без 18+ и скрытых)
const admState = x => `${x.hidden ? 'Скрыто из Мастерской' : 'Видно всем'}${x.featured ? ' · на главной' : ''}${+x.reports ? ` · ${x.reports} ${plural(+x.reports, 'жалоба', 'жалобы', 'жалоб')}` : ''}`;
function adminBox(x, mine, kind = 'grid') {
  const feat = kind === 'bg' && !x.nsfw && x.featured !== undefined;
  return `<div class="adm-box${x.hidden ? ' off' : ''}">
    <span class="adm-tag">${icon('star')}Админ</span>
    <span class="adm-state">${admState(x)}</span>
    <span class="adm-acts"><button class="btn sm" id="aHide">${x.hidden ? `${icon('eye')}Вернуть` : `${icon('lock')}Скрыть`}</button>
      ${feat ? `<button class="btn sm" id="aFeat">${icon('home')}<span>${x.featured ? 'С главной' : 'На главную'}</span></button>` : ''}
      ${mine ? '' : `<button class="btn sm ghost danger" id="aDel">${icon('trash')}Удалить</button>`}</span>
  </div>`;
}
function bindAdmin(root, kind, x, onChange) {
  const f = $('#aFeat', root);
  if (f) f.onclick = async () => {
    f.disabled = true;
    try {
      await API.admin.feature(x.id, !x.featured);
      x.featured = !x.featured;
      $('span', f).textContent = x.featured ? 'С главной' : 'На главную';
      $('.adm-state', root).textContent = admState(x);
      toast(x.featured ? 'Фон будет на главной сайта' : 'Фон убран с главной', 'ok');
    } catch (e) { toast(e.message, 'err'); }
    f.disabled = false;
  };
  const b = $('#aHide', root); if (!b) return;
  b.onclick = async () => {
    b.disabled = true;
    try {
      await API.admin.moderate(kind, x.id, !x.hidden);
      x.hidden = !x.hidden; if (!x.hidden) x.reports = 0;
      toast(x.hidden ? 'Скрыто из Мастерской' : 'Снова видно всем', 'ok');
      onChange && onChange(x, x.hidden);
    } catch (e) { toast(e.message, 'err'); b.disabled = false; }
  };
}

// ---------- герои ----------
// портрет героя в сетке — вертикальный, как в игре
const portrait = h => 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/' + (h.v ? `heroes/${h.s}_vert.jpg` : `dota_react/heroes/${h.s}.png`);
const heroImgTag = (h, lazy = true) => `<img src="${portrait(h)}" alt="${esc(h.n)}" title="${esc(h.n)}" ${lazy ? 'loading="lazy"' : ''} decoding="async">`;
function shuffled(list, seed = 7) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { seed = (seed * 16807) % 2147483647; const j = seed % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- гайды: список (статьи — в guides.html) ----------
const GUIDES = [
  ['start', 'Старт', 'Как поставить свою сетку в Доту', 'Где лежит hero_grid_config.json, как не потерять старые сетки и где выбрать новую в игре.', 4],
  ['lineart', 'Картинки', 'Line-art, который читается в игре', 'Какую картинку брать, как выставить кадр, детализацию и тени, чтобы арт не превратился в кашу.', 6],
  ['limits', 'Производительность', 'Сколько категорий можно', 'Почему экран героев думает дольше и как сэкономить категории без потери картинки.', 3],
  ['mosaic', 'Мозаика', 'Мозаика из портретов героев', 'Как Дота раскладывает портреты, какую ширину выбрать и зачем исключать героев из палитры.', 4],
  ['steam', 'Steam', 'Брайль-арт для профиля Steam', 'Арт для «Своего информационного поля»: ширина, лимит 8000 символов и почему строки переносятся.', 3],
  ['text', 'Текст', 'Подписи и текст в сетке', 'Как Дота показывает названия категорий и как сделать надписи ровными.', 3],
  ['share', 'Мастерская', 'Профиль, «Мои работы» и Мастерская', 'Как хранить работы приватно, возвращаться к ним и выкладывать сетки от своего имени.', 3],
];
const guideCard = ([id, tag, title, desc, min], k) => `<a class="guide-card" href="guides.html#${id}" data-reveal style="--d:${(k % 3) * 0.06}s">
  <span class="gc-tag">${esc(tag)}</span><b>${esc(title)}</b><span>${esc(desc)}</span><small>${icon('clock')}${min} мин чтения</small></a>`;

// ---------- главная ----------
// Брайль-арт для панели «Профиль Steam» (сделан из docs/art-white-src.webp тем же способом, что в редакторе:
// тёмное — точка, дизеринг). Рисуем его точками на холсте, а не текстом: ширина символов Брайля
// разная в разных шрифтах, и текстом арт разъезжался и обрезался.
const BRAILLE = `⠀⠀⠀⠀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡄⢀⡃⡄⠐⠀⠀⠀⠀⠀⡅⠐⡄⠀⠢⠀⠀⠀⠀⠀⠀⠐⠀⠀⠀⠀⡂⠀⢱⡑⡈⢢⢃⢇⢟⡄⠀⠠⢐⠀⠀⠀⠀⠀⠀
⠀⠀⠀⢰⠁⠀⠠⠀⠀⠀⡀⠀⠀⠀⢀⠁⠀⡂⠀⠌⡘⠀⣸⠀⡇⢘⠀⠀⠀⠀⠀⡇⠀⡅⠀⠸⠀⠀⠀⠀⠀⠀⠈⠀⠀⠀⠀⢸⠀⠀⣇⢕⡈⢜⢜⢭⣻⡀⢈⢢⠀⠀⡀⠀⠀⠀
⠀⠀⠠⢸⠀⠀⠀⠀⠀⠀⠄⠐⠀⠀⡂⠀⠰⠀⠰⢐⠀⢠⡇⢰⠁⡔⠀⠀⠀⠀⠂⣗⠀⣗⠀⠁⡅⠀⠀⠀⠀⠀⠀⠄⠀⠀⠀⠀⣇⠀⢸⡢⡲⡈⢮⡚⣞⣇⠀⢢⠁⠀⠂⠀⠀⠀
⠀⠀⠀⣟⠀⠀⠨⠀⠀⢈⢄⠁⠀⢐⠀⠀⡊⣀⣀⣊⣀⣬⡥⡼⠤⡇⠀⠀⠀⢰⢀⣗⠀⣳⠀⢀⡇⠀⠀⢀⠀⠀⠀⠄⠀⠀⠅⠀⢻⡄⠐⡧⡣⡣⡕⣝⢮⣿⠀⠡⠊⠀⢡⠀⠀⠀
⠀⠀⠠⣗⠀⠀⢸⠀⠀⠐⡤⠐⢐⠚⠉⢹⠉⠉⢨⠂⡐⠨⠀⠎⢀⠃⡅⠀⠀⡜⢰⠩⠐⠾⠄⣀⡏⠀⠀⢰⠀⠀⠀⢅⠀⠀⡣⠀⢺⣧⠀⢳⢕⡕⣕⢗⢗⡿⡇⠨⢘⠀⢨⠀⠀⠀
⠀⠀⡸⡳⠀⠀⠰⠀⠀⠀⡧⠀⡢⠁⠠⠏⠀⡈⠎⠠⠀⠐⠈⠄⠀⠂⡅⠀⠠⠃⠔⠈⠄⣹⠀⠬⡏⠐⠢⢘⠀⠀⢠⢑⠀⠀⡯⠀⢸⢾⡀⢸⢇⢏⡮⣫⣳⡻⣿⡀⠱⠀⢘⠄⠀⠂
⠀⠀⢺⠁⠄⠀⠀⡃⠀⠀⢻⠀⠅⠀⠈⠂⠀⠂⠂⠒⠖⠄⠀⡁⠐⢐⠀⠀⠈⢀⠁⠨⠀⠪⠀⢜⠂⠨⠀⠄⠀⠀⢸⢰⠁⠀⣏⠀⣸⣝⡇⠨⣯⡳⣝⣞⣞⣾⣽⣧⢘⠀⠨⡃⠀⠄
⠀⠀⢽⠈⡂⠀⠀⣇⢀⠤⢴⣶⣶⣿⣿⣿⣿⣿⣿⣷⣄⠀⠀⠀⠐⠐⠀⠀⠀⡐⠀⠈⠐⡒⠈⠀⠀⠇⠠⠁⠀⠰⡌⢸⠀⢀⡇⠀⣞⡎⣿⠀⣿⣝⢷⣻⢾⣷⣷⣿⡦⠂⠨⡧⠀⠂
⠀⠀⢹⡇⠨⠀⠀⢸⠀⡀⠈⢿⣿⣿⣿⣿⣿⣿⡟⠀⠁⠀⠈⠀⠈⠐⠀⠀⠀⠀⣴⣿⣿⣿⣿⣿⣿⣶⠌⠐⠀⣇⠇⡞⠀⢸⠄⠀⣷⢝⣺⠀⣗⣗⢯⢯⣟⡾⣯⣿⣿⣅⠨⣺⠀⢁
⠠⠀⢸⡇⣦⠅⠀⠈⣇⢡⠀⡀⢙⡿⠿⢿⣿⡍⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⡻⠟⠐⡇⢀⠇⢰⡳⠠⡇⢀⢙⠆⢸⢯⡪⣾⠀⡷⣕⢯⢗⡯⣿⢽⣾⣻⣿⡰⢵⠀⢂
⠐⠀⢸⠂⣿⡝⡀⠀⢿⡀⢇⢂⠈⠛⠛⠋⠉⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠐⠿⣿⣿⣿⡂⠀⣼⡁⡸⠀⣞⠆⡼⠃⡸⠠⠀⢾⡳⡹⡼⢰⡫⡮⣫⢗⢯⢯⢿⡽⣿⣽⣿⣽⠀⡂
⠡⠀⢸⢠⢿⡇⢧⠀⠘⣧⠸⡌⠆⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⢀⢜⡿⢀⡇⣸⡇⣰⠫⢀⠣⠀⠰⠸⣝⢭⣓⢼⢝⢮⡳⡽⣹⢽⣝⣯⣿⣽⣯⣿⣧⡀
⡑⠀⠨⠸⣽⢿⠸⡄⠀⠹⡆⢳⡘⣆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣮⢟⠂⡞⢀⡾⢠⡟⢀⢺⠀⠌⠈⣆⢫⣗⣕⢯⢝⡵⣝⣞⢽⢵⣳⣳⣟⣾⣿⣿⣿⡧
⡸⠀⠀⢯⣟⡏⡆⢷⠀⠈⢞⡌⢧⠹⡗⢦⣀⠀⠀⠀⠀⠀⠀⠀⠂⠀⠀⠀⠀⠀⠀⣀⡴⡿⢇⠃⡜⠀⠠⠁⠉⠃⠮⡐⡄⠁⠀⢹⡄⢷⣕⢯⡳⡽⣺⣪⢯⣗⣗⡷⣯⣷⣿⣷⣿⣿
⡸⠀⠀⣿⢽⠂⢿⢸⡆⠀⠐⠹⡘⣷⡹⠀⠌⠓⠦⣄⠀⠀⠀⠀⠀⠀⢀⣀⠤⠒⠉⠡⡑⠀⢸⠸⡀⠀⡈⠀⠀⠈⠀⠈⢦⠐⠀⠈⣷⡘⣗⡯⡯⡯⡷⣽⣳⣳⣻⣞⣷⢿⣾⣿⡿⣿`;
const BRAILLE_BITS = [[0, 0, 1], [0, 1, 2], [0, 2, 4], [1, 0, 8], [1, 1, 16], [1, 2, 32], [0, 3, 64], [1, 3, 128]];
function brailleCanvas(cv, texts) {
  texts = [].concat(texts);
  let rows = 0, cols = 0, dots = [], at = 0, cover = false;
  const load = text => {
    const lines = text.split('\n').map(l => [...l]);
    rows = lines.length; cols = Math.max(...lines.map(l => l.length)); dots = []; cover = text !== texts[0];
    lines.forEach((l, r) => l.forEach((ch, c) => { const b = ch.codePointAt(0) - 0x2800; for (const [dx, dy, bit] of BRAILLE_BITS) if (b & bit) dots.push(c * 2 + dx, r * 4 + dy); }));
  };
  load(texts[0]);
  let color = 'oklch(0.86 0.02 250)', upto = rows * 4;
  const paint = () => {
    const W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // шаг точки — чтобы арт целиком влез с небольшими полями
    const p = cover ? Math.max(W / (cols * 2), H / (rows * 4)) : Math.min((W - 14) / (cols * 2), (H - 10) / (rows * 4)), ox = (W - p * cols * 2) / 2, oy = (H - p * rows * 4) / 2, rad = p * 0.36;
    c.fillStyle = color; c.beginPath();
    for (let i = 0; i < dots.length; i += 2) {
      if (dots[i + 1] >= upto) continue;
      const x = ox + (dots[i] + 0.5) * p, y = oy + (dots[i + 1] + 0.5) * p;
      c.moveTo(x + rad, y); c.arc(x, y, rad, 0, Math.PI * 2);
    }
    c.fill();
  };
  // арт «печатается» сверху вниз, когда панель доезжает до экрана
  const reveal = () => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { paint(); return; }
    const t0 = performance.now(), total = rows * 4;
    const step = now => { upto = Math.min(total, Math.ceil((now - t0) / 700 * total)); paint(); if (upto < total) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  reveal();
  new ResizeObserver(paint).observe(cv);
  // арты сменяют друг друга: каждый «печатается» сверху вниз заново, пока плитка на экране
  if (texts.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let tm = 0;
    new IntersectionObserver(es => {
      clearInterval(tm);
      if (es.some(e => e.isIntersecting)) tm = setInterval(() => { if (!document.hidden) { load(texts[at = (at + 1) % texts.length]); upto = 0; reveal(); } }, 6500);
    }, { threshold: .3 }).observe(cv);
  }
  const card = cv.closest('.fcard');
  card?.addEventListener('pointerenter', () => { color = 'oklch(0.93 0.03 70)'; paint(); });
  card?.addEventListener('pointerleave', () => { color = 'oklch(0.86 0.02 250)'; paint(); });
}
// Оживляем «Угадайку» на главной: в плитке бегут случайные символы
function homeTileFx() {
  const rows = $$('#gameCard .gc-art i'), ramp = '.:-=+*#%@';
  if (rows.length) setInterval(() => {
    if (document.hidden) return;
    const r = rows[Math.floor(Math.random() * rows.length)];
    r.textContent = Array.from({ length: 3 }, () => ramp[Math.floor(Math.random() * ramp.length)]).join('');
  }, 240);
}
// «Фон меню»: в плитке по кругу случайные работы из Мастерской — плавно сменяются и чуть «дышат»
function homeBgTile() {
  const box = $('#wcBg'); if (!box) return;
  const fallback = () => { if (!$('img', box)) box.insertAdjacentHTML('afterbegin', '<img class="on" src="docs/menu-bg.webp" alt="">'); };
  API.bg.list({ sort: 'popular', limit: 24 }).then(({ items }) => {
    const pics = shuffled(items.filter(b => !b.nsfw), 1 + Math.floor(Math.random() * 2e9)).slice(0, 8);
    if (!pics.length) return fallback();
    const imgs = pics.map(b => { const im = new Image(); im.alt = ''; im.src = b.poster; box.append(im); return im; });
    let at = -1;
    const next = () => {
      const im = imgs[(at = (at + 1) % imgs.length)];
      if (!im.complete || !im.naturalWidth) return;
      $$('img.on', box).forEach(o => o.classList.remove('on'));
      im.classList.add('on');
    };
    next();
    if (imgs.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) setInterval(() => { if (!document.hidden) next(); }, 3200);
  }).catch(fallback);
}
function initHome() {
  const heroes = window.HEROES || [], still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // карточки разделов: портреты героев, Брайль
  // «Сетка героев»: два ряда портретов бегут навстречу друг другу (ряд дублируем, чтобы лента была бесшовной)
  const ffRow = list => `<div class="ff-row"><div class="ff-track">${(list + list)}</div></div>`;
  const tags = shuffled(heroes, 5).slice(0, 24).map(h => heroImgTag(h, false));
  $('#fcFacesGrid').innerHTML = ffRow(tags.slice(0, 12).join("")) + ffRow(tags.slice(12).join(""));
  brailleCanvas($('#fcBraille'), [BRAILLE, ...(window.BRAILLE_ARTS || [])]);
  if (!still) homeTileFx();
  homeBgTile();

  // «Угадайка»: номер дня и, если сегодня уже играли, — результат
  const day = gameDay(), today = (() => { try { return JSON.parse(localStorage.getItem('gs.game.daily')); } catch { return null; } })();
  $('#gameTitle').textContent = `Угадайка #${day}`;
  if (today?.day === day && today.done) $('#gameSub').textContent = today.win ? `Сегодня угадано с ${today.guesses.length}-й попытки — заходи завтра` : 'Сегодня не угадано — завтра новый герой';

  // ноутбук чуть поворачивается за курсором
  const scene = $('#scene');
  if (!still && matchMedia('(pointer: fine)').matches) {
    addEventListener('pointermove', e => {
      const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5;
      scene.style.setProperty('--mx', x.toFixed(3)); scene.style.setProperty('--my', y.toFixed(3));
    }, { passive: true });
  }

  glyphField($('#bgGlyphs'));

  // панели: «прожектор» и светящийся край идут за курсором — пишем только две переменные той панели, что под мышью
  $('.landing-copy').addEventListener('pointermove', e => {
    const card = e.target.closest('.fcard, .fwide'); if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--x', (e.clientX - r.left) + 'px'); card.style.setProperty('--y', (e.clientY - r.top) + 'px');
  }, { passive: true });

  // экран ноутбука: в редакторе открыта случайная сетка из Мастерской (живой холст на подложке «как в Доте»);
  // она прорисовывается слева направо, счётчик категорий бежит вместе с ней. Мастерская молчит — показываем готовый арт.
  const mock = $('#mock'), counters = [$('#mkCount'), $('#mkCount2')];
  let shown = false;
  const setN = n => counters.forEach(c => { c.textContent = num(n); });
  const run = N => {
    mock.classList.remove('drawn'); void mock.offsetWidth; mock.classList.add('drawing');
    const t0 = performance.now(), D = 2600;
    const tick = now => {
      const t = Math.min(1, (now - t0) / D);
      setN(Math.round(N * (1 - (1 - t) ** 2)));
      if (t < 1) requestAnimationFrame(tick); else { mock.classList.remove('drawing'); mock.classList.add('drawn'); }
    };
    requestAnimationFrame(tick);
    // вкладка в фоне и кадры не идут — всё равно приходим к итоговому числу
    setTimeout(() => { setN(N); mock.classList.remove('drawing'); mock.classList.add('drawn'); }, D + 400);
  };
  const start = N => { if (shown) return; shown = true; if (still) { setN(N); mock.classList.add('drawn'); } else setTimeout(() => run(N), 300); };
  const fallback = setTimeout(() => { const img = $('.mk-sheet img', mock); img.complete ? start(11821) : img.addEventListener('load', () => start(11821), { once: true }); }, 2500);
  async function laptopGrid(g) {
    try {
      const cfg = await API.config(g.id);
      if (shown || !cfg?.categories?.length) return;
      clearTimeout(fallback);
      const sheet = $('.mk-sheet', mock);
      sheet.insertAdjacentHTML('afterbegin', '<canvas class="mk-grid" aria-hidden="true"></canvas>');
      $('img', sheet).hidden = true;
      GridRender.mount($('canvas', sheet), cfg.categories, { bg: 'dota' });
      $('.mk-brand b', mock).textContent = g.title;
      $('.mk-row:not(.on)', mock).lastElementChild.textContent = '1';
      $('.mk-row:not(.on)', mock).childNodes[1].textContent = `«${g.title}»`;
      mock.setAttribute('aria-label', `Редактор Grid Studio: сетка «${g.title}» из Мастерской, ${num(g.cats)} категорий`);
      start(g.cats);
    } catch { /* останется готовый арт */ }
  }

  // примеры артов в блоке сравнения: картинка ↔ сетка
  const cmpBox = $('#compare');
  $('#cmpPicks').onclick = e => {
    const b = e.target.closest('button'); if (!b || b.classList.contains('on')) return;
    $$('#cmpPicks button').forEach(x => x.classList.toggle('on', x === b));
    cmpBox.classList.add('swap');
    setTimeout(() => {
      const [before, after] = [$('.before', cmpBox), $('.after', cmpBox)];
      let n = 0; const done = () => { if (++n === 2) cmpBox.classList.remove('swap'); };
      before.onload = after.onload = done;
      before.src = b.dataset.src; after.src = b.dataset.out;
      if (before.complete && after.complete) cmpBox.classList.remove('swap');
    }, 200);
  };

  // лента портретов, мозаика
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

  // док инструментов: «таблетка» ходит по инструментам, как в редакторе
  const dock = $('#toolsDemo'), ind = $('.tools-ind', dock), tools = $$('span', dock);
  let cur = 0, timer = 0;
  const place = () => { const b = tools[cur]; ind.style.transform = `translate(${b.offsetLeft}px, ${b.offsetTop}px)`; tools.forEach((x, k) => x.classList.toggle('on', k === cur)); };
  place(); addEventListener('resize', place);
  dock.addEventListener('mouseover', e => { const b = e.target.closest('span'); if (b) { cur = tools.indexOf(b); place(); } });
  if (!still) new IntersectionObserver(es => {
    clearInterval(timer);
    if (es.some(e => e.isIntersecting)) timer = setInterval(() => { if (!dock.matches(':hover')) { cur = (cur + 1) % tools.length; place(); } }, 1500);
  }, { threshold: .4 }).observe(dock);

  $('#guideTeaser').innerHTML = GUIDES.slice(0, 3).map(guideCard).join('');

  const box = $('#latest');
  box.innerHTML = skeletons(3);
  API.list({ limit: 24 }).then(({ items, total }) => {
    setCatCount(total);
    $('#catNum').textContent = total ? num(total) : '#1';
    $('.big-num span').textContent = total ? plural(total, 'сетка', 'сетки', 'сеток') + ' в Мастерской' : 'стань первым автором';
    box.innerHTML = items.length ? items.slice(0, 6).map(cardHTML).join('') : `<div class="cards-empty">${MARK}<b>Здесь пока пусто</b><span>Стань первым: нарисуй сетку в редакторе и нажми «В Мастерскую».</span><a class="btn primary sm" href="editor.html">Открыть редактор</a></div>`;
    inGameTile(items, still);
    // случайная сетка из Мастерской — на экран ноутбука и в подпись под ним; 18+ на главную не берём
    const pool = items.filter(g => !g.nsfw), big = pool.filter(g => g.cats >= 300);
    if (pool.length) {
      const list = big.length ? big : pool, g = list[Math.floor(Math.random() * list.length)], rg = $('#randomGrid');
      laptopGrid(g);
      rg.href = gridUrl(g.id);
      rg.innerHTML = `<span class="rg-likes">${icon('heart')}${num(g.likes)}</span><b>«${esc(g.title)}» — ${esc(g.author)}</b><span class="rg-note">случайная сетка из Мастерской</span>`;
      rg.hidden = false;
    }
  }).catch(() => { box.closest('.section').hidden = true; $('#catNum').textContent = '∞'; setCatCount(0); });

  // сетка открывается своей страницей
  box.onclick = e => { const c = e.target.closest('.gcard[data-id]'); if (c) goGrid(c.dataset.id, e); };
  heroBackdrop();
}

// Плитка «Как в игре»: экран «Герои» Доты, в нём по очереди случайные работы из Мастерской.
// Работы подгружаются заранее и сменяются плавно, пока плитка на экране; 18+ не берём.
function inGameTile(items, still) {
  const view = $('#igView'), stage = $('#igStage'), cap = $('#igCap'), hid = $('#igHidden');
  const pool = shuffled(items.filter(g => !g.nsfw && g.cats >= 20), 1 + Math.floor(Math.random() * 2e9)).slice(0, 6);
  if (!view || !pool.length) return;
  const cfgs = new Map(), want = g => cfgs.get(g.id) || cfgs.set(g.id, API.config(g.id).then(c => c?.categories?.length ? c.categories : null).catch(() => null)).get(g.id);
  let at = -1, timer = 0, cur = null;
  const show = async () => {
    for (let tries = 0; tries < pool.length; tries++) {
      const g = pool[(at = (at + 1) % pool.length)], cats = await want(g);
      if (!cats) continue;
      want(pool[(at + 1) % pool.length]);                    // следующую грузим, пока смотрят эту
      const cv = document.createElement('canvas'); cv.className = 'ig-cv'; stage.appendChild(cv);
      GridRender.mount(cv, cats, { bg: 'none' });
      requestAnimationFrame(() => requestAnimationFrame(() => { $$('.ig-cv.on', stage).forEach(o => { o.classList.remove('on'); setTimeout(() => o.remove(), 900); }); cv.classList.add('on'); }));
      view.classList.add('live'); cur = g;
      const used = new Set(cats.flatMap(c => c.hero_ids || [])), hidden = Math.max(0, (window.HEROES || []).length - used.size);
      hid.hidden = !hidden; hid.textContent = `НЕ ВИДНО ${hidden} ${plural(hidden, 'ГЕРОЯ', 'ГЕРОЕВ', 'ГЕРОЕВ')}`;
      cap.hidden = false; cap.href = gridUrl(g.id);
      cap.innerHTML = `<span>«${esc(g.title)}» — ${esc(g.author)}</span><small>случайная работа из Мастерской</small>`;
      return;
    }
  };
  view.onclick = e => { if (cur) goGrid(cur.id, e); };
  view.style.cursor = 'pointer';
  new IntersectionObserver(es => {
    clearInterval(timer);
    if (!es.some(e => e.isIntersecting)) return;
    if (at < 0) show();
    if (!still && pool.length > 1) timer = setInterval(show, 5200);
  }, { threshold: .35 }).observe(view);
}

async function dimFor(src) {
  try {
    const im = new Image(); im.crossOrigin = 'anonymous'; im.src = src;
    await im.decode();
    const cv = document.createElement('canvas'); cv.width = 32; cv.height = 18;
    const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(im, 0, 0, 32, 18);
    const d = c.getImageData(0, 0, 32, 18).data;
    let sum = 0; for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    return Math.min(0.95, Math.max(0.35, 0.27 / Math.max(0.01, sum / (d.length / 4) / 255))).toFixed(2);
  } catch { return 0.45; }
}
// Фон первого экрана: фон из Мастерской, который админ отметил «На главную», а пока таких нет — туман с фонарями.
// Любой фон тонируется под сайт (CSS .bg-media). На телефоне и при экономии трафика тяжёлое видео не грузим —
// хватает постера; при «уменьшении движения» видео стоит на первом кадре.
function heroBackdrop() {
  const box = $('#heroMedia'); if (!box) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lite = matchMedia('(max-width: 900px)').matches || navigator.connection?.saveData;
  const first = $('video', box);
  if (still) { first.removeAttribute('autoplay'); first.pause(); } else first.play().catch(() => {});
  API.bg.featured().then(async list => {
    if (!list.length) return;
    const b = list[Math.floor(Math.random() * list.length)];
    const video = b.kind === 'video' && !lite && !still;
    const el = document.createElement(video ? 'video' : 'img');
    if (video) Object.assign(el, { muted: true, loop: true, playsInline: true, autoplay: true, poster: b.poster });
    el.alt = ''; el.setAttribute('aria-hidden', 'true'); el.className = 'feat';
    // яркий фон приглушаем сильнее: средняя яркость постера → множитель, чтобы любой был не светлее тумана
    el.style.setProperty('--bgk', await dimFor(b.poster));
    // показываем, только когда есть что показать, — и плавно гасим туман под ним
    el.addEventListener(video ? 'playing' : 'load', () => {
      el.classList.add('on'); first.classList.remove('on');
      setTimeout(() => { first.pause(); first.remove(); }, 1800);
    }, { once: true });
    el.src = video || b.kind !== 'video' ? b.file : b.poster;
    box.append(el);
    const credit = $('#heroCredit');
    credit.href = bgPageUrl(b.id);
    credit.innerHTML = `${icon('image')}<span>Фон: «${esc(b.title)}» — ${esc(b.author || 'Игрок')}</span>`;
    credit.hidden = false;
  });
}

// Фон главной: поле ASCII-символов. Яркость клетки — сумма нескольких бегущих волн, у курсора светлее;
// цвет — градиент «Огня» по диагонали. Чтобы не тормозить:
//  * символы не печатаются текстом каждый кадр — они один раз рисуются в атлас и дальше копируются drawImage;
//  * градиент накладывается одной заливкой поверх всех символов (source-in), а не на каждый символ;
//  * затухание к краям посчитано заранее по клеткам — пустые клетки не трогаем, CSS-маски на холсте нет;
//  * ~20 кадров в секунду и только пока первый экран виден.
// opts: центр овала с символами (ox, oy) и его радиусы (rx, ry) в долях холста, откуда бегут волны (cx, cy),
// alpha — насколько приглушить (в Мастерской символы за карточками бледнее, чем на главной)
function glyphField(cv, { ox = 0.62, oy = 0.42, rx = 0.8, ry = 0.75, cx: wx = 0.68, cy: wy = 0.35, alpha = 1 } = {}) {
  if (!cv) return;
  const ctx = cv.getContext('2d'), RAMP = ' .·:-=+*#%@', CW = 15, CH = 24;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, cols = 0, rows = 0, dpr = 1, mx = -1e4, my = -1e4, sx = -1e4, sy = -1e4, fill = null, raf = 0, last = 0, visible = true;
  let atlas = null, cells = null;
  const makeAtlas = () => {
    atlas = document.createElement('canvas');
    atlas.width = Math.ceil(CW * dpr) * RAMP.length; atlas.height = Math.ceil(CH * dpr);
    const a = atlas.getContext('2d');
    a.scale(dpr, dpr); a.fillStyle = '#fff';
    a.font = '600 13px "JetBrains Mono", Consolas, monospace'; a.textAlign = 'center'; a.textBaseline = 'middle';
    for (let k = 1; k < RAMP.length; k++) a.fillText(RAMP[k], (k + 0.5) * Math.ceil(CW * dpr) / dpr, CH / 2);
  };
  const resize = () => {
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(W / CW); rows = Math.ceil(H / CH);
    const cs = getComputedStyle(document.documentElement), g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, cs.getPropertyValue('--c1').trim()); g.addColorStop(.55, cs.getPropertyValue('--c2').trim()); g.addColorStop(1, cs.getPropertyValue('--c3').trim());
    fill = g;
    makeAtlas();
    // клетки внутри овала (центр 62% / 42%), с готовыми затуханием и расстоянием до «источника» волны
    const cx = cols * wx, cy = rows * wy, list = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * CW, y = (r + 0.5) * CH;
      const e = Math.hypot((x / W - ox) / rx, (y / H - oy) / ry);
      const fade = e < 0.2 ? 1 : e > 0.78 ? 0 : 1 - (e - 0.2) / 0.58;
      if (fade > 0.03) list.push(c, r, fade, Math.hypot(c - cx, (r - cy) * 1.6) * 0.32);
    }
    cells = Float32Array.from(list);
    if (still) draw(0);
  };
  function draw(t) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    // курсор догоняется плавно — пятно света не дёргается
    sx += (mx - sx) * 0.15; sy += (my - sy) * 0.15;
    const aw = Math.ceil(CW * dpr), ah = atlas.height, top = RAMP.length - 1;
    const colW = new Float32Array(cols), rowW = new Float32Array(rows), diag = new Float32Array(cols + rows);
    for (let c = 0; c < cols; c++) colW[c] = Math.sin(c * 0.11 + t * 0.55);
    for (let r = 0; r < rows; r++) rowW[r] = Math.sin(r * 0.19 - t * 0.4);
    for (let d = 0; d < cols + rows; d++) diag[d] = Math.sin(d * 0.07 + t * 0.3);
    for (let i = 0; i < cells.length; i += 4) {
      const c = cells[i], r = cells[i + 1], fade = cells[i + 2];
      const v = (colW[c] + rowW[r] + diag[c + r] + Math.sin(cells[i + 3] - t * 0.9) + 4) / 8;
      const x = c * CW, y = r * CH, dx = x + CW / 2 - sx, dy = y + CH / 2 - sy, d2 = dx * dx + dy * dy;
      const glow = d2 < 67600 ? (1 - Math.sqrt(d2) / 260) ** 1.6 : 0;
      const lvl = Math.min(1, v ** 2.4 + glow * 0.85);
      const k = Math.round(lvl * top);
      if (k < 1) continue;
      ctx.globalAlpha = Math.min(0.95, 0.1 + lvl * 0.6 + glow * 0.4) * fade * alpha;
      ctx.drawImage(atlas, k * aw, 0, aw, ah, x, y, CW, CH);
    }
    ctx.globalAlpha = 1;
    // белые символы → цвета градиента одной заливкой
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = fill; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }
  const loop = now => {
    raf = requestAnimationFrame(loop);
    if (now - last < 50) return;
    last = now; draw(now / 1000);
  };
  resize();
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
  document.fonts?.ready.then(() => { makeAtlas(); if (still) draw(0); });
  if (still) return;
  addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; if (sx < -1e3) { sx = mx; sy = my; } }, { passive: true });
  new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); cancelAnimationFrame(raf); if (visible && !document.hidden) raf = requestAnimationFrame(loop); }).observe(cv);
  document.addEventListener('visibilitychange', () => { cancelAnimationFrame(raf); if (visible && !document.hidden) raf = requestAnimationFrame(loop); });
}

// ---------- Мастерская: сетки и фоны ----------
// Вкладки «Сетки | Фоны» (?backgrounds в адресе), сортировки, теги, поиск; у фонов ещё пропорции экрана.
const SORTS = [['popular', 'Популярные'], ['week', 'За неделю'], ['new', 'Новые'], ['mine', 'Мои публикации']];
const SORT_NOTE = { popular: 'по числу лайков', week: 'лучшие за 7 дней', new: 'сначала новые', mine: 'твои публикации' };
// «таблетка» под выбранной кнопкой сегмента
function segInd(box) {
  const b = $('.on', box), ind = $('.seg-ind', box); if (!b || !ind) return;
  ind.style.cssText = `width:${b.offsetWidth}px;transform:translateX(${b.offsetLeft}px)`;
}
function initWorkshop() {
  // фон как на главной: сполохи и поле символов за шапкой, к карточкам гаснет
  glyphField($('#wsGlyphs'), { ox: 0.5, oy: 0.05, rx: 0.85, ry: 0.95, cx: 0.5, cy: 0.1, alpha: 0.85 });
  const bar = $('.ws-bar');
  if (bar) {
    const stuck = () => bar.classList.toggle('stuck', bar.getBoundingClientRect().top < parseFloat(getComputedStyle(bar).top) + 1);
    addEventListener('scroll', stuck, { passive: true }); stuck();
  }
  const qs = new URLSearchParams(location.search);
  const PAGE_SIZE = 24;
  // старые ссылки на сетку и фон (workshop.html?id=… / ?bg=…, в том числе из «Каталога») ведут на их страницы
  if (qs.get('id')) { location.replace(gridUrl(qs.get('id'))); return; }
  if (qs.get('bg')) { location.replace(bgPageUrl(qs.get('bg'))); return; }
  const f = { tab: qs.has('backgrounds') || qs.has('bg') ? 'bg' : 'grids', q: '', tag: qs.get('tag') || '', sort: 'popular', aspect: '' };
  let offset = 0, total = 0, seq = 0, qt = 0;
  const cards = $('#cards'), more = $('#more');
  $('#demoNote').hidden = API.remote;

  // ----- разметка фильтров под вкладку -----
  const chip = (v, label, on) => `<button class="tchip${on ? ' on' : ''}" data-v="${esc(v)}" aria-pressed="${!!on}">${esc(label)}</button>`;
  function renderControls() {
    const bg = f.tab === 'bg';
    document.title = bg ? 'Мастерская — фоны главного меню Dota 2 · Grid Studio' : 'Мастерская — сетки героев Dota 2 · Grid Studio';
    $('#wsLead').textContent = bg ? 'Новый вид с первого экрана. Картинки и видео для главного меню твоей Dota.' : 'Твоя Dota. Твой стиль. Найди сетку по душе и сделай её своей.';
    const create = $('#wsCreate');
    create.innerHTML = `${icon('plus')}${bg ? 'Выложить фон' : 'Создать сетку'}`;
    create.href = bg ? '#' : 'editor.html';
    $('#wsSorts').innerHTML = '<i class="seg-ind"></i>' + SORTS.map(([v, l]) => `<button data-v="${v}" class="${f.sort === v ? 'on' : ''}" aria-pressed="${f.sort === v}">${l}</button>`).join('');
    const tags = bg ? API.TAGS.bg : API.TAGS.grid;
    $('#wsTags').innerHTML = chip('', 'Все теги', !f.tag) + tags.map(t => chip(t, t, f.tag === t)).join('') + chip('18+', '18+', f.tag === '18+');
    $('#wsAspect').hidden = !bg;
    $('#wsAspect').innerHTML = `<span>Экран</span>` + chip('', 'Любой', !f.aspect) + API.TAGS.aspects.map(a => chip(a, a, f.aspect === a)).join('');
    $('#wsPreview').hidden = bg;
    $('#wsBg').innerHTML = '<i class="seg-ind"></i>' + PREVIEW_BG.map(([v, l]) => `<button data-v="${v}" class="${previewBg() === v ? 'on' : ''}" aria-pressed="${previewBg() === v}">${l}</button>`).join('');
    $$('#wsTabs button').forEach(b => {
      const selected = b.dataset.v === f.tab;
      b.classList.toggle('on', selected); b.setAttribute('aria-selected', selected); b.tabIndex = selected ? 0 : -1;
    });
    $('#wsResults').setAttribute('aria-labelledby', bg ? 'wsBackgroundsTab' : 'wsGridsTab');
    applyIcons($('.ws-head'));
    requestAnimationFrame(() => { ['#wsTabs', '#wsSorts', '#wsBg'].forEach(s => segInd($(s))); });
  }
  // ----- арт в шапке: случайные работы из Мастерской (сетки и фоны, без 18+) на всю плитку, плавно сменяют друг друга -----
  (async () => {
    const stage = $('#wsArt .ws-art-stage'), label = $('#wsArtLabel');
    const seed = () => 1 + Math.floor(Math.random() * 2e9);
    const [gr, br] = await Promise.allSettled([API.list({ sort: 'popular', limit: 24 }), API.bg.list({ sort: 'popular', limit: 24 })]);
    const grids = gr.status === 'fulfilled' ? gr.value.items.filter(x => !x.nsfw && x.cats >= 20).map(g => ({ ...g, kind: 'grid' })) : [],
      bgs = br.status === 'fulfilled' ? br.value.items.filter(x => !x.nsfw).map(b => ({ ...b, kind: 'bg' })) : [];
    const pool = shuffled([...shuffled(grids, seed()).slice(0, 5), ...shuffled(bgs, seed()).slice(0, 4)], seed());
    if (!stage || !pool.length) return;
    const ready = new Map();                                    // id → Promise<элемент слайда | null>
    const build = w => ready.get(w.id) || ready.set(w.id, (async () => {
      const a = document.createElement('a'); a.className = `ws-slide ${w.kind}`; a.tabIndex = -1; a.setAttribute('aria-hidden', 'true');
      a.href = w.kind === 'bg' ? bgPageUrl(w.id) : gridUrl(w.id);
      if (w.kind === 'bg') {
        const img = new Image(); img.alt = ''; img.src = w.poster;
        await img.decode(); a.append(img); return a;
      }
      const cfg = await API.config(w.id);
      if (!cfg?.categories?.length) return null;
      const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); a.append(cv);
      stage.append(a);                                          // холсту нужна ширина, поэтому рисуем уже в плитке
      GridRender.mount(cv, cfg.categories, { bg: 'dota' });
      return a;
    })().catch(() => null)).get(w.id);
    let at = -1, cur = null, timer = 0;
    const show = async () => {
      for (let tries = 0; tries < pool.length; tries++) {
        const w = pool[(at = (at + 1) % pool.length)], el = await build(w);
        if (!el) continue;
        if (pool.length > 1) build(pool[(at + 1) % pool.length]);   // следующую готовим, пока смотрят эту
        stage.append(el);
        const old = cur; cur = el;
        label.classList.remove('in');
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (old) { old.classList.remove('on'); old.classList.add('out'); setTimeout(() => { old.classList.remove('out'); old.remove(); }, 1300); }
          el.classList.add('on');
          label.href = el.href; label.hidden = false;
          $('i', label).textContent = w.kind === 'bg' ? 'Фон меню' : 'Сетка героев';
          $('em', label).textContent = `${w.title} · ${w.author || 'Аноним'}`;
          label.classList.add('in');
        }));
        return;
      }
    };
    show();
    if (pool.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches)
      new IntersectionObserver(es => {
        clearInterval(timer);
        if (es.some(e => e.isIntersecting)) timer = setInterval(() => { if (!document.hidden) show(); }, 6500);
      }, { threshold: .2 }).observe(stage);
  })();
  const relayout = () => ['#wsTabs', '#wsSorts', '#wsBg'].forEach(s => segInd($(s)));
  document.fonts?.ready.then(relayout); addEventListener('resize', relayout);

  // ----- загрузка списка -----
  async function load(reset = true) {
    const my = ++seq, bg = f.tab === 'bg';
    $('#wsReset').hidden = !(f.q || f.tag || f.aspect || f.sort !== 'popular');
    cards.setAttribute('aria-busy', 'true');
    if (reset) {
      offset = 0; cards.className = bg ? 'cards bcards' : 'cards'; cards.innerHTML = skeletons(6);
      more.hidden = true; $('#count').textContent = 'Ищем работы…';
    }
    more.disabled = true;
    try {
      const args = { q: f.q, tag: f.tag, sort: f.sort === 'mine' ? 'new' : f.sort, onlyMine: f.sort === 'mine', offset, limit: PAGE_SIZE };
      const r = bg ? await API.bg.list({ ...args, aspect: f.aspect }) : await API.list(args);
      if (my !== seq) return;
      total = r.total;
      if (!bg && !f.tag && !f.q && f.sort !== 'mine' && f.sort !== 'week') setCatCount(total);
      const html = r.items.map((g, k) => bg ? bgCardHTML(g, k) : cardHTML(g, k)).join('');
      if (reset) cards.innerHTML = html || emptyHTML(r.missing);
      else cards.insertAdjacentHTML('beforeend', html);
      offset += r.items.length;
      $('#count').innerHTML = `<strong>${num(total)} ${bg ? plural(total, 'фон', 'фона', 'фонов') : plural(total, 'сетка', 'сетки', 'сеток')}</strong> · ${SORT_NOTE[f.sort]}`;
      more.hidden = offset >= total;
    } catch (e) {
      if (my !== seq) return;
      more.hidden = true; $('#count').textContent = 'Не удалось загрузить работы';
      cards.innerHTML = `<div class="cards-empty"><b>Мастерская не загрузилась</b><span>${esc(e.message)}</span><button class="btn sm" onclick="location.reload()">Обновить</button></div>`;
    }
    cards.setAttribute('aria-busy', 'false');
    more.disabled = false;
  }
  function emptyHTML(missing) {
    const resetButton = '<button class="btn sm" data-act="reset">Сбросить фильтры</button>';
    if (f.tab === 'bg') {
      if (missing || !API.bg.enabled) return `<div class="cards-empty">${MARK}<b>Фоны скоро появятся</b><span>Раздел уже готов — осталось подключить хранилище. Загляни чуть позже.</span></div>`;
      if (f.q || f.tag || f.aspect || f.sort === 'mine') return `<div class="cards-empty">${MARK}<b>Ничего не нашлось</b><span>${f.sort === 'mine' ? 'Ты ещё не выкладывал фоны.' : 'Попробуй другой запрос, тег или пропорции экрана.'}</span>${resetButton}</div>`;
      return `<div class="cards-empty">${MARK}<b>Фонов пока нет</b><span>Стань первым: выложи картинку или видео для главного меню.</span><button class="btn primary sm" data-act="upload">Выложить фон</button></div>`;
    }
    return f.q || f.tag || f.sort === 'mine' || f.sort === 'week'
      ? `<div class="cards-empty">${MARK}<b>Ничего не нашлось</b><span>${f.sort === 'mine' ? 'Ты ещё ничего не выкладывал из этого браузера или аккаунта.' : 'Попробуй другой запрос или тег — твоя сетка ещё найдётся.'}</span>${resetButton}</div>`
      : `<div class="cards-empty">${MARK}<b>Здесь пока пусто</b><span>Стань первым: нарисуй сетку в редакторе и выложи её сюда.</span><a class="btn primary sm" href="editor.html?publish">Выложить сетку</a></div>`;
  }

  // ----- переключатели -----
  function setTab(t) {
    if (t === f.tab) return;
    clearTimeout(qt);
    f.tab = t; f.tag = ''; f.aspect = '';
    const u = new URL(location.href);
    u.search = t === 'bg' ? '?backgrounds' : '';
    history.replaceState(null, '', u);
    renderControls(); load();
  }
  $('#wsTabs').onclick = e => { const b = e.target.closest('button'); if (b) setTab(b.dataset.v); };
  $('#wsTabs').onkeydown = e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const tab = e.key === 'Home' ? 'grids' : e.key === 'End' ? 'bg' : f.tab === 'grids' ? 'bg' : 'grids';
    setTab(tab); $(`#wsTabs button[data-v="${tab}"]`).focus();
  };
  $('#wsSorts').onclick = e => {
    const b = e.target.closest('button'); if (!b || b.classList.contains('on')) return;
    f.sort = b.dataset.v; $$('#wsSorts button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); segInd($('#wsSorts')); load();
  };
  const chips = (box, key) => box.onclick = e => {
    const b = e.target.closest('.tchip'); if (!b || b.classList.contains('on')) return;
    f[key] = b.dataset.v; $$('.tchip', box).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); load();
  };
  chips($('#wsTags'), 'tag'); chips($('#wsAspect'), 'aspect');
  $('#wsBg').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('#wsBg button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); segInd($('#wsBg')); setPreviewBg(b.dataset.v);
  };
  $('#q').oninput = e => { clearTimeout(qt); f.q = e.target.value; qt = setTimeout(() => load(), 280); };
  function resetFilters() {
    clearTimeout(qt); f.q = ''; f.tag = ''; f.aspect = ''; f.sort = 'popular'; $('#q').value = '';
    const u = new URL(location.href); u.searchParams.delete('tag'); history.replaceState(null, '', u);
    renderControls(); load();
  }
  $('#wsReset').onclick = resetFilters;
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.target.closest('input, textarea, select, [contenteditable]') && !$('#modalRoot').children.length) {
      e.preventDefault(); $('#q').focus();
    }
  });
  more.onclick = () => load(false);
  $('#wsHow').onclick = () => openHowTo(f.tab);
  $('#wsCreate').onclick = e => { if (f.tab === 'bg') { e.preventDefault(); openBgUpload(() => { f.sort = 'new'; renderControls(); load(); }); } };

  // ----- карточки -----
  cards.onclick = e => {
    if (e.target.closest('[data-act="reset"]')) { resetFilters(); return; }
    if (e.target.closest('[data-act="upload"]')) { openBgUpload(() => load()); return; }
    if (bgLikeClick(e)) return;
    const b = e.target.closest('.bcard[data-bg]');
    if (b) { goBg(b.dataset.bg, e); return; }
    const c = e.target.closest('.gcard[data-id]');
    if (c) goGrid(c.dataset.id, e);
  };
  bgHover(cards);

  renderControls();
  load();
}

// ---------- фоны: карточка, страница, загрузка ----------
const secs = s => s ? `${(Math.round(s * 10) / 10).toLocaleString('ru')} с` : '';
const mb = n => `${(n / 1048576).toLocaleString('ru', { maximumFractionDigits: 1 })} МБ`;
const bgName = b => `${String(b.title || 'background').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 50) || 'background'}.${String(b.file).split('.').pop()}`;
const bgDlUrl = b => API.bg.downloadUrl(b, bgName(b));
function bgCardHTML(b, k = 0) {
  const hide = b.nsfw && !API.adult(), gif = /\.gif$/i.test(b.file);
  return `<article class="bcard${hide ? ' hide18' : ''}" data-bg="${esc(b.id)}" style="animation-delay:${Math.min(k, 12) * 40}ms">
    <div class="bpic">
      <img src="${esc(b.poster)}" alt="" loading="lazy"${gif ? ` data-gif="${esc(b.file)}" data-poster="${esc(b.poster)}"` : ''}>
      ${b.kind === 'video' ? `<video muted loop playsinline preload="none" data-src="${esc(b.file)}"></video><span class="bplay">${icon('play')}</span>` : ''}
      ${b.tags?.length || b.nsfw ? `<span class="btags">${b.nsfw ? '<i class="t18">18+</i>' : ''}${(b.tags || []).slice(0, 2).map(t => `<i>${esc(t)}</i>`).join('')}${b.tags?.length > 2 ? `<i>+${b.tags.length - 2}</i>` : ''}</span>` : ''}
      <span class="bfacts">${esc(b.aspect === 'other' ? `${b.width}×${b.height}` : b.aspect)}${b.duration ? ' · ' + secs(b.duration) : ''}<span>${icon('download')}${num(b.downloads)}</span></span>
      ${hide ? nsfwCover() : ''}
    </div>
    <div class="bbody">
      <a class="btitle" href="${bgPageUrl(b.id)}" title="${esc(b.title)}">${esc(b.title)}</a>
      <span class="bby">${authorAva(b.user_id, b.author || 'Игрок')}<span>${esc(b.author || 'Игрок')} · ${ago(b.created_at)}</span></span>
      <div class="bacts">
        <button class="blike${API.bg.isLiked(b.id) ? ' liked' : ''}" data-bg-like="${esc(b.id)}" data-likes aria-label="Лайк">${icon('heart')}${num(b.likes)}</button>
        <a class="btn sm" href="background.html?bg=${encodeURIComponent(b.id)}" data-bg-dota title="Поставить на главный экран Доты: превью с сеткой и сборка">${icon('download')}В Dota</a>
      </div>
    </div>
  </article>`;
}
// лайк на карточке фона: true — клик обработан
function bgLikeClick(e) {
  const like = e.target.closest('[data-bg-like]'); if (!like) return false;
  e.preventDefault(); e.stopPropagation();
  like.disabled = true;
  API.bg.like(like.dataset.bgLike).then(r => { like.classList.toggle('liked', r.liked); like.lastChild.textContent = num(r.likes); }).catch(er => toast(er.message, 'err')).finally(() => { like.disabled = false; });
  return true;
}
// ---------- страница фона (bg.html?id=…) ----------
// Как у сеток: фон открывается своей страницей. Превью — сам файл целиком или 16:9 со схемой главного меню Доты поверх.
const DOTA_MENU = `<div class="dm" aria-hidden="true">
  <div class="dm-top"><i class="dm-logo"></i><span class="on">ГЕРОИ</span><span>АРСЕНАЛ</span><span>ПРОСМОТР</span><span>ИГРОТЕКА</span><b></b><i class="dm-ico"></i><i class="dm-ico"></i><i class="dm-ava"></i></div>
  <div class="dm-friends"><div class="dm-me"><i></i><span><b></b><s></s></span></div><p></p><div class="dm-f"><i></i><s></s></div><div class="dm-f"><i></i><s></s></div><div class="dm-f"><i></i><s></s></div><div class="dm-f off"><i></i><s></s></div><div class="dm-f off"><i></i><s></s></div></div>
  <div class="dm-news"><div class="dm-card big"><span>СОБЫТИЕ</span></div><div class="dm-card"><span>НОВОСТИ</span></div></div>
  <div class="dm-chat"></div>
  <div class="dm-play">ИГРАТЬ</div>
</div>`;
// фоны в карточках: видео играет, пока курсор над карточкой; GIF — тоже оживает только при наведении
function bgHover(box) {
  box.addEventListener('pointerover', e => {
    const pic = e.target.closest('.bpic'); if (!pic || pic.dataset.on) return;
    pic.dataset.on = '1';
    const v = $('video', pic);
    if (v) { if (!v.src) v.src = v.dataset.src; v.play().then(() => pic.classList.add('playing')).catch(() => {}); }
    const gif = $('img[data-gif]', pic); if (gif) { gif.src = gif.dataset.gif; }
    pic.addEventListener('pointerleave', () => {
      delete pic.dataset.on; pic.classList.remove('playing');
      if (v) v.pause();
      if (gif) gif.src = gif.dataset.poster;
    }, { once: true });
  });
}

async function initBgPage() {
  const box = $('#gp'), id = new URLSearchParams(location.search).get('id');
  const back = 'workshop.html?backgrounds';
  if (!id) return pageFail(box, 'Фон не выбран', 'В ссылке нет номера фона — найди нужный в Мастерской.', back);
  let b;
  try { [b] = await Promise.all([API.bg.get(id), ACC?.enabled ? ACC.ready().catch(() => {}) : null]); }
  catch (e) { document.title = 'Фон не найден · Grid Studio'; return pageFail(box, 'Фон не найден', e.message, back); }

  const video = b.kind === 'video', type = video ? 'Видео' : /\.gif$/i.test(b.file) ? 'GIF' : 'Картинка';
  const hide = b.nsfw && !API.adult(), aspect = b.aspect === 'other' ? `${b.width}×${b.height}` : b.aspect;
  const author = b.user_id && ACC?.enabled ? `<a href="profile.html?u=${encodeURIComponent(b.user_id)}">${esc(b.author || 'Игрок')}</a>` : `<b>${esc(b.author || 'Игрок')}</b>`;
  document.title = `${b.title} — фон главного меню Dota 2 · Grid Studio`;
  $('meta[name="description"]').content = `«${b.title}» — ${type.toLowerCase()} для главного меню Dota 2, ${aspect}. Посмотри в схеме меню, скачай файл или собери фон для игры в Grid Studio.`;
  const media = video
    ? `<video src="${esc(b.file)}" poster="${esc(b.poster)}" muted loop playsinline autoplay disablepictureinpicture></video>`
    : `<img src="${esc(b.file)}" alt="${esc(b.title)}">`;
  const fact = (n, label, note = '') => `<div><b>${n}</b><span>${label}</span>${note ? `<small>${note}</small>` : ''}</div>`;

  box.innerHTML = `
    <nav class="gp-crumbs" aria-label="Где ты">
      <a href="${back}" id="gpBack">${icon('arrow')}Мастерская</a><i>/</i><a href="${back}">Фоны</a><i>/</i><span>${esc(b.title)}</span>
    </nav>
    <header class="gp-head">
      <div class="gp-title">
        <span class="gp-kind">${icon(video ? 'play' : 'image')}${type} · ${esc(aspect)}${b.duration ? ' · ' + secs(b.duration) : ''}${b.nsfw ? '<b class="g18">18+</b>' : ''}</span>
        <h1>${esc(b.title)}</h1>
        <div class="gp-by">${authorAva(b.user_id, b.author || 'Игрок')}<span>от ${author}</span><i>·</i><span>${ago(b.created_at)}</span></div>
      </div>
      <div class="gp-cta">
        <a class="btn primary lg" href="background.html?bg=${encodeURIComponent(b.id)}">${icon('download')}Поставить в Dota</a>
        <a class="btn lg" id="bDl" href="${esc(bgDlUrl(b))}" download>${icon('file')}Файл</a>
        <button class="btn lg gp-like${API.bg.isLiked(b.id) ? ' on' : ''}" id="bLike" aria-label="Лайк">${icon('heart')}<span data-likes>${num(b.likes)}</span></button>
      </div>
    </header>

    <section class="gp-stage" id="gpStage">
      <div class="gp-bar">
        <div class="seg sm" id="bpMode" aria-label="Как показать"><i class="seg-ind"></i><button data-v="file" class="on">Файл целиком</button><button data-v="menu">В меню Доты</button></div>
        <div class="gp-tools">
          ${video ? `<button class="btn sm" id="bpPlay">${icon('pause')}<span>Пауза</span></button>` : ''}
          <button class="btn sm" id="gpFull">${icon('ext')}<span>На весь экран</span></button>
        </div>
      </div>
      <div class="gp-view bp-view${hide ? ' hide18' : ''}" id="bpView" style="--ar0: ${+b.width || 16} / ${+b.height || 9}"><div class="bp-screen">${media}${DOTA_MENU}</div>${hide ? nsfwCover() : ''}</div>
    </section>
    <p class="gp-cap" id="bpCap">Файл как есть — ${num(b.width)}×${num(b.height)}. «В меню Доты» покажет схему главного экрана поверх фона.</p>

    <div class="gp-body">
      <div class="gp-main">
        <section class="gp-block">
          <h2>О фоне</h2>
          <div class="gp-facts">
            ${fact(type, 'тип файла', video ? 'без звука, по кругу' : /GIF/.test(type) ? 'анимация' : 'статичный')}
            ${fact(`${num(b.width)}×${num(b.height)}`, 'разрешение', b.height >= 2160 ? '4K' : b.height >= 1440 ? '2K' : b.height >= 1080 ? 'Full HD' : '')}
            ${fact(esc(b.aspect === 'other' ? '—' : b.aspect), 'экран', b.aspect === 'other' ? 'нестандартные пропорции' : 'пропорции')}
            ${video ? fact(secs(b.duration) || '—', 'длительность') : ''}
            ${fact(mb(b.size), 'размер файла')}
          </div>
          ${b.tags?.length ? `<div class="gp-tags">${b.tags.map(t => `<a href="${back}" data-tag="${esc(t)}">${esc(t)}</a>`).join('')}</div>` : ''}
        </section>
        <section class="gp-block">
          <h2>Как поставить в Dota</h2>
          <ol class="gp-steps">
            <li><b>Открой сборщик</b><span>Кнопка «Поставить в Dota»: превью меню и твоей сетки поверх фона, размытие и затемнение.</span></li>
            <li><b>Собери файл</b><span>Нажми «Собрать фон» — придёт <code>pak02_dir.vpk</code>.</span></li>
            <li><b>Положи в игру</b><span>В папку <code>dota 2 beta\\game\\dota_russian</code> и перезапусти Доту.</span></li>
          </ol>
          <details class="gp-details"><summary>Подробно, по шагам</summary><div class="db-body">${bgSteps()}</div></details>
        </section>
      </div>
      <aside class="gp-side" id="gpSide"></aside>
    </div>

    <section class="gp-more" id="gpAuthor" hidden>
      <div class="gp-more-head"><h2>Ещё от ${esc(b.author || 'автора')}</h2>${b.user_id && ACC?.enabled ? `<a class="btn sm" href="profile.html?u=${encodeURIComponent(b.user_id)}">${icon('user')}Профиль автора</a>` : ''}</div>
      <div class="cards bcards"></div>
    </section>
    <section class="gp-more" id="gpSimilar" hidden>
      <div class="gp-more-head"><h2>Похожие фоны</h2><a class="btn sm" href="${back}">${icon('compass')}Все фоны</a></div>
      <div class="cards bcards"></div>
    </section>`;
  fillMenuDate(box);

  // ----- превью: файл целиком или в меню Доты, пауза, весь экран -----
  const view = $('#bpView'), stage = $('#gpStage'), v = $('video', view);
  const segs = () => segInd($('#bpMode'));
  requestAnimationFrame(segs); document.fonts?.ready.then(segs); addEventListener('resize', segs);
  $('#bpMode').onclick = e => {
    const btn = e.target.closest('button'); if (!btn) return;
    $$('#bpMode button').forEach(x => x.classList.toggle('on', x === btn)); segs();
    const menu = btn.dataset.v === 'menu';
    view.classList.toggle('menu', menu);
    $('#bpCap').textContent = menu ? 'Экран 16:9 со схемой главного меню Доты: так фон ляжет в игре. С твоей сеткой героев и настройками — в сборщике «Поставить в Dota».'
      : `Файл как есть — ${num(b.width)}×${num(b.height)}. «В меню Доты» покажет схему главного экрана поверх фона.`;
  };
  const play = $('#bpPlay');
  if (play && v) {
    const sync = () => { play.innerHTML = `${icon(v.paused ? 'play' : 'pause')}<span>${v.paused ? 'Играть' : 'Пауза'}</span>`; };
    play.onclick = () => { v.paused ? v.play().catch(() => {}) : v.pause(); };
    v.addEventListener('play', sync); v.addEventListener('pause', sync);
    // при «уменьшении движения» видео стоит, пока не нажмут «Играть»
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { v.removeAttribute('autoplay'); v.pause(); }
    sync();
  }
  bindFullscreen(stage, segs);

  // ----- действия -----
  $('#bDl').onclick = () => API.bg.hit(b.id);
  const like = $('#bLike');
  like.onclick = async () => {
    like.disabled = true;
    try {
      const r = await API.bg.like(b.id);
      b.likes = r.likes;
      like.classList.toggle('on', r.liked);
      $$('[data-likes]', box).forEach(el => { el.textContent = num(r.likes); });
      const s = $('[data-likes-label]', box); if (s) s.textContent = plural(r.likes, 'лайк', 'лайка', 'лайков');
    } catch (e) { toast(e.message, 'err'); }
    like.disabled = false;
  };
  bindBack(/workshop\.html$/);
  box.addEventListener('click', e => {
    const t = e.target.closest('[data-tag]');
    if (t) { e.preventDefault(); location.href = back + '&tag=' + encodeURIComponent(t.dataset.tag); return; }
    if (bgLikeClick(e)) return;
    const c = e.target.closest('.bcard[data-bg]'); if (c) goBg(c.dataset.bg, e);
  });

  // ----- панель справа -----
  function renderSide() {
    const mine = API.bg.isMine(b), adm = isAdmin(), side = $('#gpSide'), rep = API.bg.isReported(b.id);
    side.innerHTML = `
      ${adm ? adminBox(b, mine, 'bg') : ''}
      <div class="gp-stats">
        <div><b data-likes>${num(b.likes)}</b><span data-likes-label>${plural(b.likes, 'лайк', 'лайка', 'лайков')}</span></div>
        <div><b>${num(b.downloads)}</b><span>${plural(b.downloads, 'скачивание', 'скачивания', 'скачиваний')}</span></div>
      </div>
      <div class="gp-side-acts">
        <button class="btn block" id="bLink">${icon('link')}Скопировать ссылку</button>
        <a class="btn block" href="background.html?bg=${encodeURIComponent(b.id)}">${icon('grid')}Примерить со своей сеткой</a>
        ${mine ? `<button class="btn block ghost danger" id="bDel">${icon('trash')}Удалить мой фон</button>`
          : adm ? '' : `<button class="btn block ghost" id="bReport"${rep ? ' disabled' : ''}>${icon('alert')}${rep ? 'Жалоба отправлена' : 'Пожаловаться'}</button>`}
      </div>
      <p class="hint">Опубликован ${new Date(b.created_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}<br>«Файл» — исходная картинка или видео, для игры его собирает сборщик.</p>`;
    $('#bLink').onclick = () => copyText(new URL(bgPageUrl(b.id), location.href).href, 'Ссылка скопирована');
    const r = $('#bReport');
    if (r) r.onclick = async () => {
      if (API.bg.isReported(b.id)) return;
      if (!confirm('Пожаловаться на этот фон? После нескольких жалоб он пропадёт из Мастерской до проверки.')) return;
      try { await API.bg.report(b.id); renderSide(); toast('Спасибо, жалоба отправлена', 'ok'); } catch (e) { toast(e.message, 'err'); }
    };
    for (const del of $$('#bDel, #aDel', side)) del.onclick = async () => {
      if (!confirm(`Удалить «${b.title}» из Мастерской? Файл сотрётся, это нельзя отменить.`)) return;
      try { await API.bg.remove(b.id); toast('Фон удалён', 'ok'); setTimeout(() => { location.href = back; }, 700); } catch (e) { toast(e.message, 'err'); }
    };
    bindAdmin(side, 'bg', b, renderSide);
  }
  renderSide();
  ACC?.onChange(renderSide);

  // ----- ещё от автора и похожие (по первому тегу, а без тегов — популярные) -----
  const fill = (sec, items) => { if (!items.length) return; const c = $('.cards', sec); c.innerHTML = items.map((x, i) => bgCardHTML(x, i)).join(''); bgHover(c); sec.hidden = false; };
  if (b.user_id) API.bg.list({ userId: b.user_id, sort: 'new', limit: 5 }).then(r => fill($('#gpAuthor'), r.items.filter(x => x.id !== b.id).slice(0, 4))).catch(() => {});
  (async () => {
    let items = [];
    for (const tag of [b.tags?.[0] || '', '']) {
      const r = await API.bg.list({ tag, sort: 'popular', limit: 12 }).catch(() => ({ items: [] }));
      items = r.items.filter(x => x.id !== b.id && (!b.user_id || x.user_id !== b.user_id));
      if (items.length >= 4 || !tag) break;
    }
    fill($('#gpSimilar'), items.slice(0, 8));
  })();
}

// постер и описание файла фона: размеры, длительность, пропорции — считаем в браузере
const ASPECTS = [['16:9', 16 / 9], ['16:10', 1.6], ['21:9', 21 / 9], ['4:3', 4 / 3]];
const aspectOf = (w, h) => { const r = w / h, a = ASPECTS.find(([, v]) => Math.abs(r / v - 1) < 0.04); return a ? a[0] : 'other'; };
async function bgProbe(file) {
  const url = URL.createObjectURL(file);
  try {
    let src, w, h, duration = 0;
    if (file.type.startsWith('video/')) {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
      await new Promise((ok, no) => { v.onloadeddata = ok; v.onerror = () => no(new Error('Браузер не смог открыть это видео. Подойдут MP4 (H.264) и WebM.')); });
      w = v.videoWidth; h = v.videoHeight; duration = v.duration || 0;
      await new Promise(ok => { v.onseeked = ok; v.currentTime = Math.min(1, duration / 3); setTimeout(ok, 1500); });
      src = v;
    } else {
      const im = new Image();
      await new Promise((ok, no) => { im.onload = ok; im.onerror = () => no(new Error('Картинка не открылась. Подойдут PNG, JPEG, WebP и GIF.')); im.src = url; });
      w = im.naturalWidth; h = im.naturalHeight; src = im;
    }
    const k = Math.min(1, 640 / w), cv = document.createElement('canvas');
    cv.width = Math.round(w * k); cv.height = Math.round(h * k);
    cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
    let poster = await new Promise(ok => cv.toBlob(ok, 'image/webp', 0.82));
    if (!poster || poster.type !== 'image/webp') poster = await new Promise(ok => cv.toBlob(ok, 'image/jpeg', 0.85)); // Safari не умеет webp
    return { w, h, duration, poster, preview: cv.toDataURL('image/jpeg', 0.8), aspect: aspectOf(w, h), kind: file.type.startsWith('video/') ? 'video' : 'image' };
  } finally { URL.revokeObjectURL(url); }
}
function openBgUpload(onDone, initial = null) {
  if (!API.bg.canUpload()) {
    openSheet(`<div class="sh-body"><div class="sh-ico">${icon('upload')}</div><h2>Загрузка фонов скоро</h2><p>Хранилище для фонов ещё подключается. Как только заработает — здесь можно будет выложить свою картинку или видео.</p></div>`);
    return;
  }
  if (!ACC.signedIn()) {
    const m = openSheet(`<div class="sh-body"><div class="sh-ico">${icon('user')}</div><h2>Войди, чтобы выложить фон</h2>
      <p>Фоны выкладываются от имени профиля — так их можно удалить с любого устройства, а Мастерская защищена от спама.</p>
      <div class="sh-actions"><a class="btn primary block" href="profile.html?next=${encodeURIComponent('workshop.html?backgrounds')}">${icon('user')}Войти</a></div></div>`);
    return m;
  }
  const tags = new Set();
  let file = null, info = null;
  const m = openSheet(`<div class="sh-body up-body">
    <h2>Выложить фон</h2>
    <label class="drop" id="upDrop"><input type="file" id="upFile" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" hidden>
      <span class="drop-empty">${icon('upload')}<b>Перетащи картинку, GIF или видео</b><span>или нажми, чтобы выбрать · картинки и GIF до 5 МБ, видео до 15 МБ</span></span>
      <img class="drop-prev" id="upPrev" alt="" hidden><span class="drop-facts" id="upFacts" hidden></span></label>
    <label class="field"><span>Название</span><input class="input" id="upTitle" maxlength="60" placeholder="Например, «Закат над Рошаном»"></label>
    <div class="field"><span>Теги · до 5</span><div class="tchips" id="upTags">${API.TAGS.bg.map(t => `<button type="button" class="tchip" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>
    <label class="check"><input type="checkbox" id="up18"><span><b>18+</b> — откровенное: в Мастерской будет размыто, пока не нажмут</span></label>
    <div class="up-bar" id="upBar" hidden><i></i></div>
    <div class="sh-actions"><button class="btn primary block" id="upGo" disabled>${icon('upload')}Опубликовать</button></div>
    <p class="hint">Выкладывай только то, что можно показывать: за чужие работы без разрешения и запрещённый контент фон удалят.</p>
  </div>`);
  const go = $('#upGo', m.root), drop = $('#upDrop', m.root);
  async function pick(f) {
    if (!f) return;
    const isVideo = /^video\/(mp4|webm)$/.test(f.type), isImage = /^image\/(png|jpeg|webp|gif)$/.test(f.type);
    if (!isVideo && !isImage) { toast('Подходят PNG, JPEG, WebP, GIF, MP4 и WebM', 'err'); return; }
    if (f.size > (isVideo ? 15 : 5) * 1048576) { toast(isVideo ? 'Видео — до 15 МБ. Сожми его или укороти.' : 'Картинка — до 5 МБ.', 'err'); return; }
    go.disabled = true; drop.classList.add('busy');
    try {
      info = await bgProbe(f); file = f;
      $('#upPrev', m.root).src = info.preview; $('#upPrev', m.root).hidden = false;
      $('#upFacts', m.root).hidden = false;
      $('#upFacts', m.root).textContent = `${info.w}×${info.h} · ${info.aspect === 'other' ? 'свои пропорции' : info.aspect}${info.duration ? ' · ' + secs(info.duration) : ''} · ${mb(f.size)}`;
      drop.classList.add('has');
      const t = $('#upTitle', m.root); if (!t.value) t.value = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 60);
      go.disabled = false;
    } catch (e) { toast(e.message, 'err'); }
    drop.classList.remove('busy');
  }
  $('#upFile', m.root).onchange = e => pick(e.target.files[0]);
  if (initial) pick(initial);
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); pick(e.dataTransfer.files[0]); };
  $('#upTags', m.root).onclick = e => {
    const b = e.target.closest('.tchip'); if (!b) return;
    if (tags.has(b.dataset.v)) tags.delete(b.dataset.v);
    else if (tags.size < 5) tags.add(b.dataset.v);
    else { toast('Не больше 5 тегов', 'err'); return; }
    b.classList.toggle('on', tags.has(b.dataset.v));
  };
  go.onclick = async () => {
    const title = $('#upTitle', m.root).value.trim();
    if (!title) { $('#upTitle', m.root).focus(); toast('Дай фону название', 'err'); return; }
    go.disabled = true;
    const bar = $('#upBar', m.root); bar.hidden = false;
    try {
      await API.bg.upload({ file, poster: info.poster, meta: { title, tags: [...tags], nsfw: $('#up18', m.root).checked, aspect: info.aspect, width: info.w, height: info.h, duration: info.duration } },
        p => { $('i', bar).style.width = Math.round(p * 100) + '%'; });
      m.close(); toast(`«${title}» в Мастерской`, 'ok');
      onDone && onDone();
    } catch (e) { toast(e.message, 'err'); go.disabled = false; bar.hidden = true; }
  };
  return m;
}

// «Как установить»: сетка — куда положить файл; фон — куда положить собранный пак
function openHowTo(tab) {
  const steam = 'Steam\\userdata\\<твой ID>\\570\\remote\\cfg';
  if (tab === 'bg') {
    const m = openSheet(`<div class="sh-body db-body"><div class="sh-ico">${icon('download')}</div><h2>Как установить фон</h2>
      ${bgSteps()}
      ${PAGE === 'background' ? '' : `<div class="sh-actions"><a class="btn block" href="background.html">${icon('image')}Собрать фон из своего файла</a></div>`}</div>`);
    fillMenuDate(m.root);
    return;
  }
  openSheet(`<div class="sh-body"><div class="sh-ico">${icon('grid')}</div><h2>Как установить сетку</h2>
      <ol class="sh-steps"><li>Открой сетку и нажми <b>«Скачать»</b> — придёт файл <code>hero_grid_config.json</code>.</li>
        <li>Закрой Доту и положи файл в папку <code>${esc(steam)}</code> (с заменой).</li>
        <li>Запусти игру: «Герои» → сортировка → выбери сетку по названию.</li></ol>
      <p class="hint">Файл заменит все твои сетки. Чтобы добавить чужую к своим — открой её в редакторе, затем свой JSON, и сделай экспорт.</p>
      <div class="sh-actions"><a class="btn block" href="guides.html#start">${icon('book')}Подробный гайд с картинками</a></div></div>`);
}

// ---------- фон в Dota: сборка pak02_dir.vpk (dotabg.js) ----------
// Шаги установки — после сборки и в «Как установить». Почему именно так — в шапке dotabg.js.
function bgSteps() {
  return `<ol class="sh-steps">
      <li>В Steam: Dota 2 → «Свойства» → «Установленные файлы» → «Обзор». Откроется папка <code>dota 2 beta</code>.</li>
      <li>Зайди в <code>game</code> → <code>dota_russian</code>. Если такой папки нет, создай её.</li>
      <li>Положи туда скачанный <code>pak02_dir.vpk</code>. Если рядом лежит <code>pak01_dir.vpk</code> — это русская озвучка, его не трогай.</li>
      <li>В настройках Доты поставь русский язык озвучки. Если в параметрах запуска есть <code>-language</code> (кроме <code>-language russian</code>), убери его.</li>
      <li>Перезапусти Dota 2.</li>
    </ol>
    <p class="hint db-left">Убрать фон — удали <code>pak02_dir.vpk</code>. После крупного обновления Доты меню может поменяться: если фон пропал или в меню что-то исчезло, удали файл и собери фон здесь заново.</p>
    <p class="hint db-left" data-menu-date hidden></p>
    <div class="db-warn">${icon('alert')}<span><b>Это безопасно?</b> Это изменение файлов игры. Банов за фоны меню не известно — они ничего не дают в игре. Но правила Steam изменение файлов формально не разрешают, так что решение за тобой. Всё возвращается проверкой целостности файлов в Steam.</span></div>`;
}
async function fillMenuDate(root) {
  const d = (await window.DotaBG?.info())?.date;
  if (!d) return;
  for (const el of $$('[data-menu-date]', root)) { el.textContent = `Файлы меню — от обновления Dota ${d.split('-').reverse().join('.')}.`; el.hidden = false; }
}
function saveBlob(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

// ---------- гайды ----------
function initGuides() {
  $('#guideList').innerHTML = GUIDES.map(guideCard).join('');
  // оглавление сбоку подсвечивает статью, которую сейчас читают
  const toc = $('#guideToc');
  toc.innerHTML = GUIDES.map(([id, , title]) => `<a href="#${id}" data-id="${id}">${esc(title)}</a>`).join('');
  const links = new Map($$('a', toc).map(a => [a.dataset.id, a]));
  const io = new IntersectionObserver(es => {
    for (const e of es) if (e.isIntersecting) { for (const a of links.values()) a.classList.remove('on'); links.get(e.target.id)?.classList.add('on'); }
  }, { rootMargin: '-30% 0px -60% 0px' });
  for (const id of links.keys()) { const el = document.getElementById(id); if (el) io.observe(el); }
  document.addEventListener('click', e => { const b = e.target.closest('[data-copy]'); if (b) copyText(b.dataset.copy, 'Скопировано'); });
}

// ---------- профиль ----------
async function initProfile() {
  const box = $('#profile'), qs = new URLSearchParams(location.search);
  const viewId = qs.get('u'), next = safeNext(qs.get('next'));
  if (!ACC?.enabled) {
    box.innerHTML = `<div class="auth-card">${LOGO}<h1>Профили скоро появятся</h1><p>Здесь можно будет хранить работы приватно, возвращаться к ним с любого устройства и выкладывать сетки от своего имени. Пока редактор сохраняет всё в этом браузере.</p><a class="btn primary" href="editor.html">Открыть редактор</a></div>`;
    return;
  }
  const err = ACC.error(); if (err) toast(err, 'err');
  await ACC.ready();
  if (viewId && viewId !== ACC.user()?.id) return renderPublicProfile(box, viewId);
  if (!ACC.signedIn()) return renderSignIn(box, next);
  if (next) { location.replace(next); return; }
  renderMyProfile(box);
}

function renderSignIn(box, next) {
  const redirect = new URL('profile.html' + (next ? '?next=' + encodeURIComponent(next) : ''), location.href).href;
  const PROV = { discord: ['discord', 'Discord'], github: ['github', 'GitHub'] };
  box.innerHTML = `<div class="pf-auth-layout">
    <section class="pf-auth-intro" aria-labelledby="authIntro">
      <span class="pf-eyebrow">Твоё пространство в Grid Studio</span>
      <h1 id="authIntro">Хорошие сетки.<br><span>Всегда под рукой.</span></h1>
      <p>Собирай героев по-своему. Сохраняй идеи и делись тем, что получилось.</p>
      <div class="pf-auth-art" aria-hidden="true"><div class="pf-art-grid"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><span class="pf-art-mark">${LOGO}</span><span class="pf-art-label">Твоя игра. Твой порядок.</span></div>
      <ul class="pf-auth-benefits"><li>${icon('lock')}Личные работы видишь только ты</li><li>${icon('globe')}Публикации — от твоего имени</li><li>${icon('heart')}Любимые сетки — в одном месте</li></ul>
    </section>
    <section class="auth-card pf-signin" aria-labelledby="authTitle">
    <span class="pf-auth-symbol">${icon('user')}</span>
    <span class="pf-eyebrow">Личный профиль</span>
    <h2 id="authTitle">Заходи, здесь твоё</h2>
    <p>Войди, чтобы сохранить свою следующую идею.</p>
    ${ACC.providers.length ? `<div class="auth-prov">${ACC.providers.map(p => `<button class="btn block" data-prov="${p}">${icon(PROV[p]?.[0] || 'user')}Войти через ${PROV[p]?.[1] || p}</button>`).join('')}</div><div class="auth-or"><span>или по почте</span></div>` : ''}
    <form class="auth-form" id="authForm">
      <label class="pf-field-label" for="authEmail">Электронная почта</label>
      <div class="auth-field">${icon('mail')}<input class="input" id="authEmail" type="email" required placeholder="you@example.com" autocomplete="email"></div>
      <button class="btn primary block" id="authGo">Получить ссылку для входа ${icon('arrow')}</button>
    </form>
    <div class="pf-auth-privacy">${icon('shield')}<span>Без пароля. Почта останется приватной — другие увидят только твой ник.</span></div>
  </section></div>`;
  for (const b of $$('[data-prov]', box)) b.onclick = () => ACC.oauth(b.dataset.prov, redirect);
  $('#authForm').onsubmit = async e => {
    e.preventDefault();
    const email = $('#authEmail').value.trim(), go = $('#authGo');
    go.disabled = true; go.textContent = 'Отправляю…';
    try { await ACC.sendLink(email, redirect); renderSent(box, email, next); }
    catch (er) { toast(er.message, 'err'); go.disabled = false; go.textContent = 'Получить ссылку для входа'; }
  };
}
function renderSent(box, email, next) {
  box.innerHTML = `<div class="auth-card pf-sent"><span class="pf-auth-symbol">${icon('mail')}</span><span class="pf-eyebrow">Остался один шаг</span>
    <h1>Проверь почту</h1>
    <p>Письмо со ссылкой отправлено на <b>${esc(email)}</b>. Открой ссылку в этом браузере — и сразу окажешься в профиле. Письма нет — загляни в «Спам».</p>
    <form class="auth-form" id="codeForm">
      <label class="pf-field-label" for="authCode">Или введи код из письма, если он есть</label>
      <input class="input code" id="authCode" inputmode="numeric" autocomplete="one-time-code" maxlength="10" required placeholder="Код из письма">
      <button class="btn block">Войти по коду</button>
    </form>
    <button class="link" id="authBack">Другая почта</button>
  </div>`;
  $('#authBack').onclick = () => renderSignIn(box, next);
  $('#codeForm').onsubmit = async e => {
    e.preventDefault();
    try { await ACC.verifyCode(email, $('#authCode').value); if (next) location.replace(next); else renderMyProfile(box); }
    catch (er) { toast(er.message, 'err'); }
  };
}

// шапка профиля: баннер, аватар поверх него, ник, «о себе», ссылки (Steam, Telegram), цифры
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const sinceText = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `С нами с ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`; };
const tgUrl = nick => 'https://t.me/' + encodeURIComponent(nick);
function profileHead(p, { me, grids = [], backgrounds = [], works = null }) {
  const published = [...grids, ...backgrounds];
  const likes = published.reduce((a, g) => a + (+g.likes || 0), 0), dls = published.reduce((a, g) => a + (+g.downloads || 0), 0);
  const adm = me ? ACC.isAdmin() : p.admin;
  const links = [
    p.steam && `<a class="pf-link" href="${esc(p.steam)}" target="_blank" rel="noopener">${icon('steam')}Steam</a>`,
    p.tg && `<a class="pf-link tg" href="${esc(tgUrl(p.tg))}" target="_blank" rel="noopener">${icon('telegram')}@${esc(p.tg)}</a>`,
  ].filter(Boolean).join('');
  // чужой профиль глазами админа: убрать аватар или баннер
  const modBtns = !me && isAdmin() ? `${p.avatar ? `<button class="btn sm ghost danger" data-clear="avatar">${icon('trash')}Убрать аватар</button>` : ''}${p.banner ? `<button class="btn sm ghost danger" data-clear="banner">${icon('trash')}Убрать баннер</button>` : ''}` : '';
  const stat = (n, ic, label) => `<div class="pf-stat">${icon(ic)}<b>${num(n)}</b><span>${label}</span></div>`;
  return `<div class="pf-pagebar"><span class="pf-eyebrow">${me ? 'Личное пространство' : 'Знакомься с автором'}</span><a href="workshop.html">Мастерская ${icon('arrow')}</a></div><section class="pf-head${me ? ' pf-own' : ''}" aria-label="${me ? 'Мой профиль' : 'Профиль автора'}">
    <div class="pf-banner${p.banner ? ' on' : ''}">${p.banner ? `<img src="${esc(p.banner)}" alt="" onerror="this.remove()">` : ''}
      <div class="pf-cover-art" aria-hidden="true"><i></i><i></i><i></i><span>GRID<br>STUDIO</span></div>
      <span class="pf-cover-label">${icon(me ? 'brush' : 'compass')}${me ? 'Твоя игра. Твой порядок.' : 'Автор Grid Studio'}</span>
      ${me && ACC.media() ? `<button class="pf-banner-edit" id="pfBanner">${icon('image')}${p.banner ? 'Сменить баннер' : 'Добавить баннер'}</button>` : ''}</div>
    <div class="pf-top">
      <div class="pf-ava-wrap">${avatarHTML(p.avatar, p.nick, 'pf-ava')}${me ? `<button class="pf-ava-edit" id="pfAva" title="Сменить аватар" aria-label="Сменить аватар">${icon('edit')}</button>` : ''}</div>
      <div class="pf-id">
        ${me ? `<h1 class="pf-name"><input class="pf-nick" id="pfNick" value="${esc(p.nick)}" maxlength="32" spellcheck="false" title="Нажми, чтобы изменить ник" aria-label="Твой ник в Мастерской">${icon('edit')}</h1>` : `<h1 class="pf-nick">${esc(p.nick || 'Игрок')}</h1>`}
        <div class="pf-meta">${adm ? `<span class="adm-tag">${icon('star')}Админ</span>` : ''}${p.created_at ? `<span>${sinceText(p.created_at)}</span>` : ''}</div>
      </div>
      <div class="pf-actions">
        ${me ? `<a class="btn primary sm" href="editor.html?new">${icon('brush')}Новая сетка</a>${ACC.ext() ? `<button class="btn sm" id="pfLinks">${icon('link')}Ссылки</button>` : ''}` : ''}
        <button class="btn sm" id="pfShare" data-copy="${esc(new URL('profile.html?u=' + p.id, location.href).href)}">${icon('copy')}${me ? 'Поделиться' : 'Ссылка на профиль'}</button>
        ${me ? `<button class="btn sm ghost" id="pfOut" title="Выйти из аккаунта">${icon('logout')}Выйти</button>` : ''}${modBtns}
      </div>
    </div>
    <div class="pf-body">
      <div class="pf-about">
        ${me && ACC.ext() ? `<label class="pf-about-label" for="pfBio">О себе ${icon('edit')}</label><textarea class="pf-bio" id="pfBio" maxlength="200" rows="1" aria-label="О себе" placeholder="Какие сетки делаешь? За кого играешь? Расскажи о себе…">${esc(p.bio || '')}</textarea>` : p.bio ? `<p class="pf-bio">${esc(p.bio)}</p>` : ''}
        ${links ? `<div class="pf-links">${links}</div>` : me && ACC.ext() ? `<button class="pf-link add" id="pfLinksAdd">${icon('plus')}Добавить Steam или Telegram</button>` : ''}
        ${me ? `<span class="pf-private">${icon('lock')}<span>${esc(ACC.user()?.email || '')}<small>Почту видишь только ты</small></span></span>` : ''}
      </div>
    </div>
    <div class="pf-stats" aria-label="Статистика профиля">
      ${works ? stat(works.length, 'lock', 'Личные работы') : ''}
      ${stat(published.length, 'globe', 'В Мастерской')}
      ${stat(likes, 'heart', 'Лайки')}
      ${stat(dls, 'download', 'Скачивания')}
    </div>
  </section>`;
}
// ссылки в профиле: Steam и Telegram (ник, @ник или ссылка t.me — сохраняем только ник)
function openLinksSheet(p, onDone) {
  const m = openSheet(`<form class="sh-body links-sheet" id="lnForm">
    <div class="sh-ico">${icon('link')}</div><h2>Ссылки в профиле</h2>
    <p>Их видят все, кто откроет твой профиль. Пустое поле — ссылку убрать.</p>
    <label class="ln-field"><span>${icon('steam')}Steam</span><input class="input" id="lnSteam" value="${esc(p.steam || '')}" placeholder="https://steamcommunity.com/id/…" inputmode="url" spellcheck="false"></label>
    ${ACC.tg() ? `<label class="ln-field"><span>${icon('telegram')}Telegram</span><input class="input" id="lnTg" value="${p.tg ? '@' + esc(p.tg) : ''}" placeholder="@ник или t.me/ник" spellcheck="false" autocapitalize="off"></label>` : ''}
    <div class="sh-actions"><button class="btn primary block">${icon('check')}Сохранить</button></div>
  </form>`);
  $('#lnForm', m.root).onsubmit = async e => {
    e.preventDefault();
    const fields = { steam: $('#lnSteam', m.root).value.trim() };
    if (fields.steam && !/^https?:\/\//.test(fields.steam)) fields.steam = 'https://' + fields.steam;
    fields.steam = fields.steam.replace(/^http:/, 'https:');
    const tgIn = $('#lnTg', m.root);
    if (tgIn) fields.tg = tgIn.value.trim().replace(/^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '');
    if (fields.tg && !/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(fields.tg)) { toast('Ник в Telegram — 5–32 символа: латиница, цифры и _, начинается с буквы.', 'err'); tgIn.focus(); return; }
    try { const np = await ACC.updateProfile(fields); m.close(); toast('Ссылки сохранены', 'ok'); onDone(np); }
    catch (er) { toast(er.message, 'err'); }
  };
}

// работа → hero_grid_config.json (как экспорт в редакторе)
function workToConfig(w) {
  const r6 = v => Math.round(v * 1e6) / 1e6, d = w.data || {};
  const categories = (d.els || []).map(e => e.t === 'hero'
    ? { category_name: e.name, x_position: r6(e.x), y_position: r6(e.y), width: r6(e.w), height: r6(e.h), hero_ids: (e.heroes || []).slice() }
    : { category_name: e.name, x_position: r6(e.x), y_position: r6(e.y), width: 0, height: 0, hero_ids: [] });
  return JSON.stringify({ version: 3, configs: [{ config_name: d.settings?.configName || w.title, categories }] }, null, '\t');
}

// аватар: своя картинка (кадрируешь сам, квадрат 160 px, webp), GIF (как есть, до 2 МБ), портрет героя или картинка из Discord/GitHub
function openAvatarSheet(p, onDone) {
  const heroes = (window.HEROES || []).slice().sort((a, b) => a.n.localeCompare(b.n));
  const prov = ACC.user()?.meta?.avatar;
  const m = openSheet(`<div class="sh-body ava-sheet">
    ${avatarHTML(p.avatar, p.nick, 'sh-ava')}
    <h2>Аватар</h2>
    <div class="sh-actions">
      ${ACC.ext() ? `<button class="btn primary block" data-av="upload">${icon('upload')}Загрузить свою картинку<span class="sh-note">${ACC.media() ? 'или GIF до 2 МБ' : 'png, jpg, webp'}</span></button>` : ''}
      ${prov ? `<button class="btn block" data-av="prov">${icon('user')}Как в Discord / GitHub</button>` : ''}
      ${p.avatar ? `<button class="btn block ghost" data-av="clear">${icon('trash')}Убрать аватар</button>` : ''}
    </div>
    <div class="ava-heroes-head"><b>Или портрет героя</b><input class="input" id="avQ" placeholder="Найти героя…"></div>
    <div class="ava-heroes" id="avHeroes"></div>
  </div><input type="file" id="avFile" accept="image/*" hidden>`);
  const grid = $('#avHeroes', m.root);
  const draw = q => { grid.innerHTML = heroes.filter(h => !q || h.n.toLowerCase().includes(q)).map(h => `<button data-hero="${esc(portrait(h))}" title="${esc(h.n)}"><img src="${esc(portrait(h))}" alt="" loading="lazy"></button>`).join(''); };
  draw('');
  $('#avQ', m.root).oninput = e => draw(e.target.value.trim().toLowerCase());
  const set = async avatar => {
    try { const np = await ACC.updateProfile({ avatar }); toast('Аватар обновлён', 'ok'); m.close(); onDone(np); }
    catch (e) { toast(e.message, 'err'); }
  };
  m.root.addEventListener('click', e => {
    const h = e.target.closest('[data-hero]'); if (h) { set(h.dataset.hero); return; }
    const a = e.target.closest('[data-av]')?.dataset.av;
    if (a === 'upload') $('#avFile', m.root).click();
    else if (a === 'prov') set(prov);
    else if (a === 'clear') set('');
  });
  $('#avFile', m.root).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const back = () => openAvatarSheet(p, onDone);
    // GIF не пережимаем — иначе пропадёт анимация; кладём в хранилище как есть
    if (f.type === 'image/gif' && ACC.media()) {
      if (f.size > 2 * 1048576) { toast(`GIF для аватара — до 2 МБ, а этот ${mb(f.size)}. Сожми его или обрежь.`, 'err'); e.target.value = ''; return; }
      uploadMedia(m, 'avatar', f, onDone, back); return;
    }
    try {
      const img = await loadImage(f);
      cropImage(m, img, { title: 'Выбери кадр', text: 'Двигай картинку и приближай — в аватар попадёт то, что внутри круга.', round: true, outW: 160, outH: 160 }, async out => {
        // база принимает до ~90 КБ; webp обычно 5–15 КБ, Safari без webp — jpeg
        let url = out.toDataURL('image/webp', 0.88);
        if (!url.startsWith('data:image/webp')) url = out.toDataURL('image/jpeg', 0.88);
        if (url.length > 88000) url = out.toDataURL('image/jpeg', 0.7);
        await set(url);
      }, back);
    } catch (er) { toast(er.message, 'err'); }
  };
}
const loadImage = f => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('Не удалось открыть картинку')); im.src = URL.createObjectURL(f); });
// файл аватара или баннера — в хранилище профиля; не вышло — возвращаемся к выбору
async function uploadMedia(m, kind, blob, onDone, back) {
  const body = $('.sh-body', m.root);
  body.className = 'sh-body';
  body.innerHTML = `<div class="sh-ico">${icon('upload')}</div><h2>Загружаю…</h2><p>${kind === 'banner' ? 'Баннер' : 'Аватар'} · ${mb(blob.size)}</p>`;
  applyIcons(body);
  try { const np = await ACC.setMedia(kind, blob); m.close(); toast(kind === 'banner' ? 'Баннер обновлён' : 'Аватар обновлён', 'ok'); onDone(np); }
  catch (e) { toast(e.message, 'err'); back(); }
}
// баннер над профилем: картинку кадрируем в 4:1 (1600 × 400, webp), GIF — как есть, до 5 МБ
function openBannerSheet(p, onDone) {
  const m = openSheet(`<div class="sh-body ban-sheet">
    <div class="ban-prev">${p.banner ? `<img src="${esc(p.banner)}" alt="">` : ''}</div>
    <h2>Баннер профиля</h2>
    <p>Широкая картинка над профилем — её видят все, кто зайдёт. GIF тоже можно: он будет двигаться.</p>
    <div class="sh-actions">
      <button class="btn primary block" data-ban="upload">${icon('upload')}Загрузить картинку или GIF<span class="sh-note">GIF до 5 МБ</span></button>
      ${p.banner ? `<button class="btn block ghost" data-ban="clear">${icon('trash')}Убрать баннер</button>` : ''}
    </div>
  </div><input type="file" id="banFile" accept="image/png,image/jpeg,image/webp,image/gif" hidden>`);
  const back = () => openBannerSheet(p, onDone);
  m.root.addEventListener('click', async e => {
    const a = e.target.closest('[data-ban]')?.dataset.ban;
    if (a === 'upload') $('#banFile', m.root).click();
    else if (a === 'clear') {
      try { const np = await ACC.setMedia('banner', null); m.close(); toast('Баннер убран', 'ok'); onDone(np); } catch (er) { toast(er.message, 'err'); }
    }
  });
  $('#banFile', m.root).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.type === 'image/gif') {
      if (f.size > 5 * 1048576) { toast(`GIF для баннера — до 5 МБ, а этот ${mb(f.size)}.`, 'err'); e.target.value = ''; return; }
      uploadMedia(m, 'banner', f, onDone, back); return;
    }
    try {
      const img = await loadImage(f);
      cropImage(m, img, { title: 'Кадр баннера', text: 'Двигай и приближай — так баннер встанет над профилем.', aspect: 4, outW: 1600, outH: 400 }, async out => {
        let blob = await new Promise(ok => out.toBlob(ok, 'image/webp', 0.86));
        if (!blob || blob.type !== 'image/webp') blob = await new Promise(ok => out.toBlob(ok, 'image/jpeg', 0.86)); // Safari не умеет webp
        await uploadMedia(m, 'banner', blob, onDone, back);
      }, back);
    } catch (er) { toast(er.message, 'err'); }
  };
}
// кадрирование: тянешь картинку и приближаешь (ползунок или колёсико); round — круг для аватара, aspect — ширина к высоте
// save получает готовый холст outW × outH
function cropImage(m, img, { title, text, round = false, aspect = 1, outW, outH }, save, back) {
  const body = $('.sh-body', m.root);
  body.className = 'sh-body ava-crop' + (aspect > 1 ? ' ban-crop' : '');
  body.innerHTML = `<h2>${esc(title)}</h2><p>${esc(text)}</p>
    <canvas class="crop-cv" width="${aspect > 1 ? 960 : 560}" height="${Math.round((aspect > 1 ? 960 : 560) / aspect)}" aria-label="${esc(title)}"></canvas>
    <label class="crop-zoom" title="Приблизить">${icon('search')}<input type="range" min="1" max="5" step="0.01" value="1" aria-label="Приближение"></label>
    <div class="crop-acts"><button class="btn" data-crop="back">Назад</button><button class="btn primary" data-crop="ok">${icon('check')}Готово</button></div>`;
  const cv = $('.crop-cv', body), c = cv.getContext('2d'), zoom = $('.crop-zoom input', body);
  const W = img.naturalWidth, H = img.naturalHeight, CW = cv.width, CH = cv.height, fit = Math.max(CW / W, CH / H);
  let z = 1, cx = W / 2, cy = H / 2;
  // видимая область в пикселях картинки; картинка всегда закрывает кадр целиком
  const view = () => {
    const vw = CW / (fit * z), vh = CH / (fit * z);
    cx = Math.min(Math.max(cx, vw / 2), W - vw / 2); cy = Math.min(Math.max(cy, vh / 2), H - vh / 2);
    return [cx - vw / 2, cy - vh / 2, vw, vh];
  };
  const paint = () => {
    const [x, y, vw, vh] = view();
    c.imageSmoothingQuality = 'high';
    c.clearRect(0, 0, CW, CH); c.drawImage(img, x, y, vw, vh, 0, 0, CW, CH);
    if (!round) return;
    const r = CW / 2 - 3;
    c.fillStyle = 'rgba(8, 6, 6, .62)'; c.beginPath(); c.rect(0, 0, CW, CH); c.arc(CW / 2, CH / 2, r, 0, Math.PI * 2); c.fill('evenodd');
    c.strokeStyle = 'rgba(255, 255, 255, .5)'; c.lineWidth = 3; c.beginPath(); c.arc(CW / 2, CH / 2, r, 0, Math.PI * 2); c.stroke();
  };
  const setZoom = v => { z = Math.min(5, Math.max(1, v)); zoom.value = z; paint(); };
  zoom.oninput = () => setZoom(+zoom.value);
  cv.addEventListener('wheel', e => { e.preventDefault(); setZoom(z * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  let drag = null;
  cv.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = e => {
    if (!drag) return;
    const k = CW / cv.clientWidth / (fit * z);
    cx -= (e.clientX - drag.x) * k; cy -= (e.clientY - drag.y) * k;
    drag = { x: e.clientX, y: e.clientY }; paint();
  };
  cv.onpointerup = cv.onpointercancel = () => { drag = null; };
  paint();
  body.onclick = async e => {
    const a = e.target.closest('[data-crop]')?.dataset.crop;
    if (a === 'back') { URL.revokeObjectURL(img.src); back(); return; }
    if (a !== 'ok') return;
    const [x, y, vw, vh] = view(), out = document.createElement('canvas');
    out.width = outW; out.height = outH;
    const o = out.getContext('2d'); o.imageSmoothingQuality = 'high';
    o.drawImage(img, x, y, vw, vh, 0, 0, outW, outH);
    const ok = e.target.closest('button'); ok.disabled = true;
    await save(out);   // при ошибке save сам покажет её — даём нажать ещё раз
    if (ok.isConnected) ok.disabled = false;
  };
}

async function renderMyProfile(box) {
  let p = ACC.profile() || await ACC.loadProfile();
  let works = [], pub = [], pubBg = [], liked = null, queue = null, home = null, tab = 'works';
  const adm = isAdmin();
  const head = () => {
    $('#pfHeadBox').innerHTML = profileHead(p, { me: true, grids: pub, backgrounds: pubBg, works });
    applyIcons($('#pfHeadBox'));
    bindHead();
  };
  box.innerHTML = `<div id="pfHeadBox"></div>
    <div class="pf-tabs chips" id="pfTabs" role="tablist" aria-label="Работы профиля">
      <button class="chip on" id="pfTab-works" role="tab" aria-selected="true" aria-controls="pfPanel" data-tab="works">${icon('lock')}Мои работы <b id="pfWorksN"></b></button>
      <button class="chip" id="pfTab-pub" role="tab" aria-selected="false" aria-controls="pfPanel" tabindex="-1" data-tab="pub">${icon('globe')}Опубликованные <b id="pfPubN"></b></button>
      <button class="chip" id="pfTab-liked" role="tab" aria-selected="false" aria-controls="pfPanel" tabindex="-1" data-tab="liked">${icon('heart')}Понравившиеся <b id="pfLikedN"></b></button>
      ${adm ? `<button class="chip" id="pfTab-mod" role="tab" aria-selected="false" aria-controls="pfPanel" tabindex="-1" data-tab="mod">${icon('star')}Модерация <b id="pfModN"></b></button><button class="chip" id="pfTab-home" role="tab" aria-selected="false" aria-controls="pfPanel" tabindex="-1" data-tab="home">${icon('home')}Главная <b id="pfHomeN"></b></button>` : ''}
    </div>
    <section class="pf-collection" id="pfPanel" role="tabpanel" aria-labelledby="pfTab-works" tabindex="0">
      <div class="pf-section-head"><div><h2 id="pfSectionTitle">Мои работы</h2><p id="pfSectionNote">Сохранённые сетки, к которым хочется вернуться.</p></div><span class="pf-visibility" id="pfVisibility">${icon('lock')}Только для тебя</span></div>
      <div class="cards" id="pfList" aria-busy="true">${skeletons(3)}</div>
    </section>`;
  head();
  function bindHead() {
    const nick = $('#pfNick');
    nick.onchange = async () => {
      const v = nick.value.trim().slice(0, 32);
      if (!v) { nick.value = p.nick; return; }
      try { p = await ACC.updateProfile({ nick: v }); toast('Ник сохранён', 'ok'); } catch (e) { toast(e.message, 'err'); nick.value = p.nick; }
    };
    nick.onkeydown = e => { if (e.key === 'Enter') nick.blur(); };
    const bio = $('#pfBio');
    if (bio) {
      const fit = () => { bio.style.height = 'auto'; bio.style.height = bio.scrollHeight + 'px'; };
      fit(); bio.oninput = fit;
      bio.onchange = async () => { try { p = await ACC.updateProfile({ bio: bio.value.trim().slice(0, 200) }); toast('Сохранено', 'ok'); } catch (e) { toast(e.message, 'err'); } };
    }
    $('#pfAva').onclick = () => openAvatarSheet(p, np => { p = np; head(); });
    const avatar = $('.pf-ava-wrap .pf-ava');
    avatar.setAttribute('role', 'button'); avatar.setAttribute('aria-label', 'Сменить аватар'); avatar.tabIndex = 0;
    avatar.onclick = () => $('#pfAva').click();
    avatar.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); avatar.click(); } };
    const ban = $('#pfBanner'); if (ban) ban.onclick = () => openBannerSheet(p, np => { p = np; head(); });
    $('#pfOut').onclick = async () => { await ACC.signOut(); location.href = 'index.html'; };
    $('#pfShare').onclick = e => copyText(e.currentTarget.dataset.copy, 'Ссылка на профиль скопирована');
    for (const b of $$('#pfLinks, #pfLinksAdd')) b.onclick = () => openLinksSheet(p, np => { p = np; head(); });
  }

  const sections = {
    works: ['Мои работы', 'Сохранённые сетки, к которым хочется вернуться.', 'lock', 'Только для тебя'],
    pub: ['В Мастерской', 'Твои сетки и фоны, которыми ты поделился с сообществом.', 'globe', 'Видно всем'],
    liked: ['Твои находки', 'Сетки из Мастерской, которые тебе понравились.', 'heart', 'Твоя коллекция'],
    mod: ['Модерация', 'Жалобы на работы и скрытые публикации.', 'shield', 'Для администратора'],
    home: ['Фоны главной', 'Выбирай, что увидят посетители Grid Studio.', 'home', 'Для администратора'],
  };
  const draw = () => {
    $('#pfWorksN').textContent = works.length; $('#pfPubN').textContent = pub.length + pubBg.length; $('#pfLikedN').textContent = liked ? liked.length : API.likedIds().length;
    const list = $('#pfList');
    const [title, note, symbol, visibility] = sections[tab];
    $('#pfSectionTitle').textContent = title; $('#pfSectionNote').textContent = note;
    $('#pfVisibility').innerHTML = `${icon(symbol)}${visibility}`;
    list.setAttribute('aria-busy', String((tab === 'liked' && !liked) || (tab === 'mod' && !queue) || (tab === 'home' && !home)));
    if (tab === 'works') list.innerHTML = works.length ? works.map(workCard).join('')
      : `<div class="cards-empty"><span class="pf-empty-icon">${icon('brush')}</span><b>Здесь начнётся твоя коллекция</b><span>Создай сетку в редакторе и выбери «Сохранить в мои работы» в меню у её названия.</span><a class="btn primary" href="editor.html?new">${icon('plus')}Создать первую сетку</a></div>`;
    else if (tab === 'pub') list.innerHTML = pub.length + pubBg.length ? pub.map(cardHTML).join('') + pubBg.map((x, i) => bgCardHTML(x, i)).join('')
      : `<div class="cards-empty"><span class="pf-empty-icon">${icon('globe')}</span><b>Твои идеи ещё впереди</b><span>Опубликуй сетку или фон в Мастерской — здесь появятся все твои публикации.</span><a class="btn" href="workshop.html">Открыть Мастерскую ${icon('arrow')}</a></div>`;
    else if (tab === 'liked') list.innerHTML = !liked ? skeletons(3) : liked.length ? liked.map(cardHTML).join('')
      : `<div class="cards-empty"><span class="pf-empty-icon">${icon('heart')}</span><b>Сохраняй то, что вдохновляет</b><span>Ставь лайки сеткам в Мастерской — любимые работы соберутся здесь.</span><a class="btn" href="workshop.html">Найти свою сетку ${icon('arrow')}</a></div>`;
    else if (tab === 'home') {
      // админ: нажатие на фон ставит его на главную или убирает; на главной случайный из отмеченных
      if (!home) list.innerHTML = skeletons(3);
      else {
        const items = [...home.items].sort((a, b) => home.ids.has(b.id) - home.ids.has(a.id));
        list.innerHTML = `<p class="hint home-hint">Нажми на фон, чтобы поставить его на главную или убрать. Можно отметить несколько — при каждом заходе сайт покажет случайный из них. Сейчас на главной: <b>${home.ids.size}</b>. Фоны 18+ на главную не попадают.</p>`
          + (items.length ? items.map((x, i) => bgCardHTML(x, i)).join('') : `<div class="cards-empty"><b>В Мастерской пока нет фонов</b></div>`);
        $$('.bcard', list).forEach((c, i) => {
          c.classList.toggle('is-feat', home.ids.has(items[i].id));
          $('.bpic', c).insertAdjacentHTML('beforeend', `<span class="adm-flag feat">${home.ids.has(items[i].id) ? 'на главной · убрать' : '+ на главную'}</span>`);
        });
      }
      $('#pfHomeN').textContent = home ? home.ids.size : '';
    }
    else if (!queue) list.innerHTML = skeletons(3);
    else {
      const items = [...queue.grids.map(x => ['grid', x]), ...queue.backgrounds.map(x => ['bg', x])];
      list.innerHTML = items.length ? items.map(([k, x], i) => k === 'grid' ? cardHTML(x, i) : bgCardHTML(x, i)).join('')
        : `<div class="cards-empty">${MARK}<b>Жалоб нет</b><span>Здесь появятся сетки и фоны, на которые жаловались, и всё, что скрыто. 5 жалоб прячут работу сами.</span></div>`;
      // поверх превью: скрыто ли и сколько жалоб
      items.forEach(([, x], i) => {
        const r = +x.reports || 0, pic = $('.gthumb, .bpic', list.children[i]);
        pic?.insertAdjacentHTML('beforeend', `<span class="adm-flag${x.hidden ? ' off' : ''}">${x.hidden ? 'скрыто' : 'видно'}${r ? ` · ${r} ${plural(r, 'жалоба', 'жалобы', 'жалоб')}` : ''}</span>`);
      });
    }
    if (adm) $('#pfModN').textContent = queue ? queue.grids.length + queue.backgrounds.length : '';
    applyIcons(list);
  };
  const loadHome = async () => {
    try {
      const [f, all] = await Promise.all([API.bg.featured(100), API.bg.list({ sort: 'new', limit: 60 })]);
      const items = all.items.filter(x => !x.nsfw), have = new Set(items.map(x => x.id));
      home = { ids: new Set(f.map(x => x.id)), items: [...items, ...f.filter(x => !have.has(x.id))] };
    } catch (e) { home = { ids: new Set(), items: [] }; toast(e.message, 'err'); }
    draw();
  };
  const loadQueue = async () => {
    try { queue = await API.admin.queue(); } catch (e) { queue = { grids: [], backgrounds: [] }; toast(e.message, 'err'); }
    draw();
  };
  $('#pfTabs').onclick = async e => {
    const b = e.target.closest('.chip'); if (!b) return;
    tab = b.dataset.tab;
    $$('#pfTabs .chip').forEach(c => { const on = c === b; c.classList.toggle('on', on); c.setAttribute('aria-selected', String(on)); c.tabIndex = on ? 0 : -1; });
    $('#pfPanel').setAttribute('aria-labelledby', b.id); draw();
    if (tab === 'liked' && !liked) { try { liked = await API.byIds(API.likedIds()); } catch { liked = []; } if (tab === 'liked') draw(); }
    if (tab === 'mod') loadQueue();
    if (tab === 'home' && !home) loadHome();
  };
  bindProfileTabKeys($('#pfTabs'));
  $('#pfList').onclick = async e => {
    const act = e.target.closest('[data-wact]');
    if (act) {
      e.preventDefault();
      const id = act.dataset.id, w = works.find(x => x.id === id); if (!w) return;
      try {
        if (act.dataset.wact === 'del') {
          if (!confirm(`Удалить «${w.title}» из твоих работ? Это нельзя отменить.`)) return;
          await ACC.projects.remove(id); works = works.filter(x => x.id !== id); draw(); head(); toast('Работа удалена', 'ok');
        } else if (act.dataset.wact === 'ren') {
          const t = prompt('Новое название работы', w.title); if (!t || !t.trim()) return;
          const r = await ACC.projects.save({ id, title: t.trim().slice(0, 60) }); Object.assign(w, r); draw(); toast('Переименовано', 'ok');
        } else if (act.dataset.wact === 'dl') {
          const full = await ACC.projects.get(id);
          download('hero_grid_config.json', workToConfig(full)); toast('Файл скачан — положи его в Steam\\userdata\\<ID>\\570\\remote\\cfg', 'ok');
        }
      } catch (er) { toast(er.message, 'err'); }
      return;
    }
    if (tab === 'home') {
      const b = e.target.closest('.bcard[data-bg]'); if (!b) return;
      e.preventDefault();
      if (b.dataset.busy) return;
      const id = b.dataset.bg, on = !home.ids.has(id);
      b.dataset.busy = '1';
      try {
        await API.admin.feature(id, on);
        on ? home.ids.add(id) : home.ids.delete(id);
        const y = scrollY; draw(); scrollTo(0, y);
        toast(on ? 'Фон будет на главной сайта' : 'Фон убран с главной', 'ok');
      } catch (er) { toast(er.message, 'err'); delete b.dataset.busy; }
      return;
    }
    if (tab === 'mod') {
      // в модерации после любого действия просто перечитываем список
      const g = e.target.closest('.gcard[data-id]'), b = e.target.closest('.bcard[data-bg]');
      if (b) goBg(b.dataset.bg, e);
      else if (g) goGrid(g.dataset.id, e);
      return;
    }
    if (tab === 'pub' && bgLikeClick(e)) return;
    const bgc = e.target.closest('.bcard[data-bg]');
    if (bgc && tab === 'pub') { goBg(bgc.dataset.bg, e); return; }
    const c = e.target.closest('.gcard[data-id]');
    if (c && tab !== 'works') goGrid(c.dataset.id, e);
  };
  try {
    [works, pub] = await Promise.all([ACC.projects.list(), ACC.userGrids(ACC.user().id)]);
    pubBg = (await API.bg.list({ userId: ACC.user().id, sort: 'new', limit: 60 }).catch(() => ({ items: [] }))).items;
    head(); draw();
    // число на вкладке «Модерация» видно сразу, не дожидаясь клика
    if (adm) API.admin.queue().then(q => { queue = q; if (tab === 'mod') draw(); else $('#pfModN').textContent = q.grids.length + q.backgrounds.length; }).catch(() => {});
  } catch (e) { $('#pfList').setAttribute('aria-busy', 'false'); $('#pfList').innerHTML = `<div class="cards-empty"><span class="pf-empty-icon">${icon('alert')}</span><b>Не удалось загрузить работы</b><span>${esc(e.message)}</span><button class="btn" id="pfRetry">Попробовать ещё раз</button></div>`; $('#pfRetry').onclick = () => renderMyProfile(box); }
}
function bindProfileTabKeys(tabs) {
  tabs.onkeydown = e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const buttons = $$('[role="tab"]', tabs), current = buttons.indexOf(document.activeElement);
    if (current < 0) return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (current + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus(); buttons[next].click();
  };
}
const workCard = (w, k) => `<a class="gcard wcard" href="editor.html?project=${encodeURIComponent(w.id)}" style="animation-delay:${Math.min(k, 12) * 40}ms">
  <span class="gthumb">${w.thumb ? `<img src="${esc(w.thumb)}" alt="" loading="lazy">` : ''}
    <span class="gkind">${w.grid_id ? `${icon('globe')}В Мастерской` : `${icon('lock')}Приватная`} · ${num(w.cats)} кат.</span>
    <span class="w-acts">
      <button data-wact="ren" data-id="${esc(w.id)}" title="Переименовать" aria-label="Переименовать">${icon('edit')}</button>
      <button data-wact="dl" data-id="${esc(w.id)}" title="Скачать hero_grid_config.json" aria-label="Скачать">${icon('download')}</button>
      <button data-wact="del" data-id="${esc(w.id)}" title="Удалить работу" aria-label="Удалить" class="danger">${icon('trash')}</button>
    </span></span>
  <span class="gbody"><span class="gtitle">${esc(w.title)}</span>
    <span class="gmeta"><span class="by">${icon('clock')}изменена ${ago(w.updated_at)}</span><span class="w-open">Открыть ${icon('arrow')}</span></span></span>
</a>`;
async function renderPublicProfile(box, id) {
  box.innerHTML = `<div class="loading" role="status">Загружаю профиль…</div>`;
  try {
    const [p, grids, bgs] = await Promise.all([ACC.getProfile(id), ACC.userGrids(id), API.bg.list({ userId: id, sort: 'new', limit: 60 }).then(r => r.items, () => [])]);
    if (!p) throw new Error('Такого профиля нет.');
    document.title = `${p.nick} · Grid Studio`;
    box.innerHTML = `${profileHead(p, { me: false, grids, backgrounds: bgs })}
      <div class="pf-tabs chips" id="pfPublicTabs" role="tablist" aria-label="Публикации автора">
        <button class="chip on" id="pfPublic-all" role="tab" aria-selected="true" aria-controls="pfPublicPanel" data-kind="all">${icon('globe')}Все работы <b>${num(grids.length + bgs.length)}</b></button>
        <button class="chip" id="pfPublic-grids" role="tab" aria-selected="false" aria-controls="pfPublicPanel" tabindex="-1" data-kind="grids">${icon('grid')}Сетки <b>${num(grids.length)}</b></button>
        <button class="chip" id="pfPublic-backgrounds" role="tab" aria-selected="false" aria-controls="pfPublicPanel" tabindex="-1" data-kind="backgrounds">${icon('image')}Фоны <b>${num(bgs.length)}</b></button>
      </div>
      <section class="pf-collection" id="pfPublicPanel" role="tabpanel" aria-labelledby="pfPublic-all" tabindex="0">
        <div class="pf-section-head"><div><h2>Работы автора</h2><p>Сделано по-своему. Опубликовано для всех.</p></div><span class="pf-visibility">${icon('globe')}В Мастерской</span></div>
        <div class="cards" id="pfList"></div>
      </section>`;
    const drawPublic = (kind = 'all') => {
      const showGrids = kind !== 'backgrounds' ? grids : [], showBgs = kind !== 'grids' ? bgs : [];
      $('#pfList').innerHTML = showGrids.length + showBgs.length ? showGrids.map(cardHTML).join('') + showBgs.map((x, i) => bgCardHTML(x, i)).join('') : `<div class="cards-empty"><span class="pf-empty-icon">${icon(kind === 'backgrounds' ? 'image' : 'grid')}</span><b>${kind === 'all' ? 'Первые работы ещё впереди' : kind === 'grids' ? 'Пока нет опубликованных сеток' : 'Пока нет опубликованных фонов'}</b><span>Загляни в Мастерскую — там есть работы других авторов.</span><a class="btn" href="workshop.html">Открыть Мастерскую ${icon('arrow')}</a></div>`;
      applyIcons($('#pfList'));
    };
    drawPublic();
    $('#pfPublicTabs').onclick = e => {
      const tab = e.target.closest('[role="tab"]'); if (!tab) return;
      $$('#pfPublicTabs .chip').forEach(b => { const on = b === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
      $('#pfPublicPanel').setAttribute('aria-labelledby', tab.id); drawPublic(tab.dataset.kind);
    };
    bindProfileTabKeys($('#pfPublicTabs'));
    applyIcons(box);
    $('#pfShare').onclick = e => copyText(e.currentTarget.dataset.copy, 'Ссылка на профиль скопирована');
    $('#pfList').onclick = e => {
      if (bgLikeClick(e)) return;
      const b = e.target.closest('.bcard[data-bg]'); if (b) { goBg(b.dataset.bg, e); return; }
      const c = e.target.closest('.gcard[data-id]'); if (c) goGrid(c.dataset.id, e);
    };
    for (const b of $$('[data-clear]', box)) b.onclick = async () => {
      const what = b.dataset.clear === 'banner' ? 'баннер' : 'аватар';
      if (!confirm(`Убрать ${what} у «${p.nick}»?`)) return;
      try { await ACC.adminClear(p.id, b.dataset.clear); toast(`${what[0].toUpperCase() + what.slice(1)} убран`, 'ok'); renderPublicProfile(box, id); } catch (e) { toast(e.message, 'err'); }
    };
  } catch (e) { box.innerHTML = `<div class="auth-card pf-sent"><span class="pf-auth-symbol">${icon('user')}</span><span class="pf-eyebrow">Профиль недоступен</span><h1>Не удалось открыть профиль</h1><p>${esc(e.message)}</p><a class="btn" href="workshop.html">В Мастерскую ${icon('arrow')}</a></div>`; }
}

// ---------- запуск ----------
renderNav();
renderBottomBars();
applyIcons();
initNav();
// блоки с data-reveal проявляются, когда доезжают до экрана
function reveal(root = document) {
  const els = $$('[data-reveal]:not(.in)', root);
  if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('in')); return; }
  const io = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }, { threshold: .15, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => io.observe(el));
}
if (PAGE === 'home') initHome();
if (PAGE === 'workshop') initWorkshop();
if (PAGE === 'grid') initGridPage();
if (PAGE === 'bg') initBgPage();
if (PAGE === 'guides') initGuides();
if (PAGE === 'profile') initProfile();
reveal();
// профиль подтягивается в фоне — меню обновится само
if (ACC?.enabled && PAGE !== 'profile') ACC.ready();
// число сеток в меню на страницах, где Мастерская сама его не грузит
if (PAGE === 'guides' || PAGE === 'game' || PAGE === 'profile' || PAGE === 'grid' || PAGE === 'bg') API.list({ limit: 1 }).then(r => setCatCount(r.total)).catch(() => {});
