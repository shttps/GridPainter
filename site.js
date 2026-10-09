'use strict';
/* Сайт: главная, каталог, гайды, профиль (и общее меню для «Угадайки»).
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
  github: 'M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 00-1.3-3.2 4.3 4.3 0 00-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 00-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.3 4.3 0 00-.1 3.2A4.6 4.6 0 004 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21',
  user: '<circle cx="12" cy="8" r="3.75"/><path d="M4.5 20a7.5 7.5 0 0115 0"/>',
  book: 'M4 5.5A1.5 1.5 0 015.5 4H11v15.5H5.5A1.5 1.5 0 014 18zM20 5.5A1.5 1.5 0 0018.5 4H13v15.5h5.5A1.5 1.5 0 0020 18z',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.1" fill="currentColor"/><circle cx="15" cy="15" r="1.1" fill="currentColor"/><circle cx="15" cy="9" r="1.1" fill="currentColor"/><circle cx="9" cy="15" r="1.1" fill="currentColor"/>',
  send: 'M20.5 3.5L3.5 10.5l6.5 2.5 2.5 6.5zM10 13l5-5',
  megaphone: 'M4 10v4h3l7 4.5v-13L7 10zM17.5 9a4 4 0 010 6M7 14l1.5 5.5h2.5L10 15.5',
  logout: 'M14 4h4.5A1.5 1.5 0 0120 5.5v13a1.5 1.5 0 01-1.5 1.5H14M9.5 8L5.5 12l4 4M5.5 12H15',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.7 3.5 5.5 3.5 8.5s-1 5.8-3.5 8.5c-2.5-2.7-3.5-5.5-3.5-8.5s1-5.8 3.5-8.5z"/>',
  trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
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
// «Угадайка»: номер дня — сколько дней прошло с запуска игры (по местному времени), с единицы
const GAME_START = new Date(2026, 9, 9);
const gameDay = (d = new Date()) => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - GAME_START) / 864e5) + 1;
// куда можно вернуться после входа: только страницы этого сайта
const safeNext = s => /^(index|catalog|editor|guides|game|profile)\.html(\?[\w=&%.-]*)?$/.test(s || '') ? s : '';

// ---------- меню сверху ----------
const NAV = [['catalog', 'catalog.html', 'grid', 'Каталог'], ['guides', 'guides.html', 'book', 'Гайды'], ['game', 'game.html', 'dice', 'Угадайка']];
function renderNav() {
  const bar = document.createElement('header');
  bar.className = 'navbar'; bar.id = 'navbar';
  bar.innerHTML = `<nav class="nav-pill" aria-label="Главное меню">
    <a class="logo" href="index.html" aria-label="Grid Studio — на главную">${LOGO}<span>Grid<b>Studio</b></span></a>
    <div class="nav-links" id="navLinks">
      <span class="nav-hl" aria-hidden="true"></span>
      ${NAV.map(([k, href, ic, label]) => `<a href="${href}"${k === PAGE ? ' aria-current="page"' : ''}>${icon(ic)}${label}${k === 'catalog' ? '<b class="nav-badge" data-cat-count hidden></b>' : ''}</a>`).join('')}
      <a href="editor.html" class="nav-studio">${icon('brush')}Редактор${icon('arrow')}</a>
    </div>
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

  const onScroll = () => bar.classList.toggle('scrolled', scrollY > 12);
  onScroll(); addEventListener('scroll', onScroll, { passive: true });

  const burger = $('#navBurger');
  const setOpen = on => { bar.classList.toggle('open', on); burger.setAttribute('aria-expanded', on); burger.setAttribute('aria-label', on ? 'Закрыть меню' : 'Открыть меню'); };
  burger.onclick = e => { e.stopPropagation(); setOpen(!bar.classList.contains('open')); };
  document.addEventListener('click', e => { if (!bar.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
}
// число сеток в каталоге — в меню и в блоках главной
function setCatCount(total) {
  for (const el of $$('[data-cat-count]')) { el.textContent = num(total); el.hidden = !total && el.classList.contains('nav-badge'); }
}

// ---------- полоса снизу: автор, поддержка, Telegram, реклама, GitHub, версия ----------
function renderBottomBars() {
  const a = SITE.author || {};
  const html = `<div class="bb-left">
      <span class="bb-authors">Автор <button class="bb-author" data-info="author">${avatarHTML(a.avatar, a.nick)}@${esc(a.nick || 'ahttps')}</button></span>
      <button class="bb-link" data-info="support">${icon('heart')}Поддержать разработку</button>
      ${SITE.telegram ? `<a class="bb-link" href="${esc(SITE.telegram)}" target="_blank" rel="noopener">${icon('send')}Чат и новости</a>` : ''}
      <button class="bb-link" data-info="ads">${icon('megaphone')}Реклама</button>
    </div>
    <div class="bb-right">
      <div class="bb-themes" role="radiogroup" aria-label="Цвет сайта"><span>Цвет</span>${THEMES.map(([v, name]) => `<button data-accent-v="${v}" role="radio" title="${name}" aria-label="${name}"></button>`).join('')}</div>
      ${SITE.repo ? `<a class="bb-link" href="${esc(SITE.repo)}" target="_blank" rel="noopener">${icon('github')}GitHub${icon('ext')}</a>` : ''}
      <a class="bb-ver" href="${esc(SITE.repo || '#')}/commits/main" target="_blank" rel="noopener" title="Что нового — история изменений">v${esc(SITE.version || '1.0.0')}</a>
    </div>`;
  for (const el of $$('[data-bottom-bar]')) el.innerHTML = html;
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-info]'); if (b) openInfo(b.dataset.info);
    const t = e.target.closest('[data-accent-v]'); if (t) setAccent(t.dataset.accentV);
  });
  markAccent();
}
// ---------- цвет сайта: четыре темы, выбор запоминается ----------
const THEMES = [['fire', 'Огонь'], ['arcana', 'Аркана'], ['radiant', 'Рэдиант'], ['frost', 'Лёд']];
const accent = () => document.documentElement.dataset.accent || 'fire';
const markAccent = () => $$('[data-accent-v]').forEach(b => { const on = b.dataset.accentV === accent(); b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
function setAccent(v) {
  if (v === accent()) return;
  const root = document.documentElement;
  root.classList.add('theme-anim');
  v === 'fire' ? delete root.dataset.accent : root.dataset.accent = v;
  try { localStorage.setItem('gs.accent', v); } catch {}
  markAccent();
  dispatchEvent(new Event('accentchange'));
  clearTimeout(setAccent.t); setAccent.t = setTimeout(() => root.classList.remove('theme-anim'), 650);
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
  return { root, close };
}
function openInfo(kind) {
  const a = SITE.author || {};
  const discord = `<button class="btn block" data-copy="${esc(a.discord || 'ahttps')}">${icon('discord')}Discord: ${esc(a.discord || 'ahttps')}<span class="sh-note">скопировать</span></button>`;
  const tg = SITE.telegram ? `<a class="btn block" href="${esc(SITE.telegram)}" target="_blank" rel="noopener">${icon('send')}Telegram: чат и новости</a>` : '';
  const sheets = {
    author: `${avatarHTML(a.avatar, a.nick, 'sh-ava')}<h2>@${esc(a.nick || 'ahttps')}</h2>
      <p>Автор Grid Studio. Пиши по вопросам, насчёт заказа сеток и с интересными предложениями.</p>
      <div class="sh-actions">${discord}${a.github ? `<a class="btn block" href="https://github.com/${esc(a.github)}" target="_blank" rel="noopener">${icon('github')}GitHub: ${esc(a.github)}</a>` : ''}${tg}</div>`,
    support: `<div class="sh-ico">${icon('heart')}</div><h2>Поддержать разработку</h2>
      <p>Grid Studio бесплатный и таким останется. Если сайт пригодился — помоги ему расти: новые режимы, гайды и игры появляются быстрее.</p>
      <div class="sh-actions">
        ${SITE.support ? `<a class="btn primary block" href="${esc(SITE.support)}" target="_blank" rel="noopener">${icon('heart')}Поддержать рублём</a>` : ''}
        ${SITE.repo ? `<a class="btn block" href="${esc(SITE.repo)}" target="_blank" rel="noopener">${icon('star')}Поставить звезду на GitHub</a>` : ''}
        <button class="btn block" data-copy="${esc(new URL('index.html', location.href).href)}">${icon('link')}Поделиться сайтом с друзьями<span class="sh-note">скопировать ссылку</span></button>
        <a class="btn block" href="editor.html?publish">${icon('upload')}Выложить свою сетку в каталог</a>
      </div>`,
    ads: `<div class="sh-ico">${icon('megaphone')}</div><h2>Реклама на Grid Studio</h2>
      <p>Аудитория — игроки Dota 2, которые настраивают игру под себя. Места: главная, каталог сеток, гайды и «Угадайка». Обсудим формат и цену.</p>
      <div class="sh-actions">${SITE.ads ? `<a class="btn primary block" href="${esc(SITE.ads)}" target="_blank" rel="noopener">${icon('send')}Написать насчёт рекламы</a>` : ''}${discord}${tg}</div>`,
  };
  const m = openSheet(`<div class="sh-body">${sheets[kind]}</div>`);
  m.root.addEventListener('click', e => { const b = e.target.closest('[data-copy]'); if (b) copyText(b.dataset.copy, 'Скопировано'); });
}

// ---------- карточка сетки ----------
function cardHTML(g, k = 0) {
  return `<button class="gcard" data-id="${esc(g.id)}" style="animation-delay:${Math.min(k, 12) * 40}ms">
    <span class="gthumb"><img src="${esc(g.thumb)}" alt="" loading="lazy">
      <span class="gkind">${esc(API.KINDS[g.kind] || 'Сетка')} · ${num(g.cats)} кат.</span>
      ${API.isMine(g.id, g.user_id) ? '<span class="gkind gmine">моя</span>' : ''}</span>
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
  const mine = API.isMine(g.id, g.user_id);
  // у сеток из аккаунта автор — ссылка на его профиль
  const author = g.user_id && ACC?.enabled ? `<a href="profile.html?u=${encodeURIComponent(g.user_id)}">${esc(g.author)}</a>` : `<b>${esc(g.author)}</b>`;
  root.innerHTML = `<div class="modal" role="dialog" aria-label="${esc(g.title)}">
    <button class="modal-x" data-icon="x" aria-label="Закрыть"></button>
    <div class="modal-view"><canvas id="gv"></canvas></div>
    <div class="modal-side">
      <div><h2>${esc(g.title)}</h2><div class="by">от ${author} · ${ago(g.created_at)}</div></div>
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
  if (PAGE !== 'catalog') return;
  const u = new URL(location.href);
  id ? u.searchParams.set('id', id) : u.searchParams.delete('id');
  history.replaceState(null, '', u);
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
  ['share', 'Каталог', 'Профиль, «Мои работы» и каталог', 'Как хранить работы приватно, возвращаться к ним и выкладывать сетки от своего имени.', 3],
];
const guideCard = ([id, tag, title, desc, min], k) => `<a class="guide-card" href="guides.html#${id}" data-reveal style="--d:${(k % 3) * 0.06}s">
  <span class="gc-tag">${esc(tag)}</span><b>${esc(title)}</b><span>${esc(desc)}</span><small>${icon('clock')}${min} мин чтения</small></a>`;

// ---------- главная ----------
const BRAILLE = `⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣶⣶⣶⣆⣀⣤⣄⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣤⣤⣶⣶⣞⢿⢿⣿⣿⡿⣯⡉⠉⠁⠀⠀⠀⠀
⠀⠀⣠⣴⣦⣤⠈⠲⣀⣀⠀⢁⡶⠿⠛⠉⢻⣏⡙⣿⣿⣿⣾⣿⣷⣄⠀⠀⠀⠀
⣀⡤⠎⠉⠁⠀⠈⠁⣶⡶⠚⠋⠉⠀⠘⣲⣬⣵⣶⣿⠿⠿⠿⠿⠿⢿⣿⣄⠀⠀
⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣏⣻⣞⠋⠛⢿⡇⠀⠀⠈⠻⢿⢻⣷⣤
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣽⠽⠷⣾⠶⠒⣒⡀⠀⠀⣠⣤⣍⣛`;
function initHome() {
  const heroes = window.HEROES || [], still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // карточки разделов: портреты героев, Брайль
  $('#fcFacesGrid').innerHTML = shuffled(heroes, 5).slice(0, 10).map(h => heroImgTag(h, false)).join('');
  $('#fcBraille').textContent = BRAILLE;

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
    $('.big-num span').textContent = total ? plural(total, 'сетка', 'сетки', 'сеток') + ' в каталоге' : 'стань первым автором';
    box.innerHTML = items.length ? items.slice(0, 6).map(cardHTML).join('') : `<div class="cards-empty">${MARK}<b>Здесь пока пусто</b><span>Стань первым: нарисуй сетку в редакторе и нажми «В каталог».</span><a class="btn primary sm" href="editor.html">Открыть редактор</a></div>`;
    // плашка «случайная сетка из каталога» поверх ноутбука
    if (items.length) {
      const g = items[Math.floor(Math.random() * items.length)], rg = $('#randomGrid');
      rg.href = 'catalog.html?id=' + encodeURIComponent(g.id);
      rg.innerHTML = `<span class="rg-likes">${icon('heart')}${num(g.likes)}</span><b>«${esc(g.title)}» — ${esc(g.author)}</b><span class="rg-note">случайная сетка из каталога</span>`;
      rg.hidden = false;
    }
  }).catch(() => { box.closest('.section').hidden = true; $('#catNum').textContent = '∞'; setCatCount(0); });
  box.onclick = e => { const c = e.target.closest('.gcard[data-id]'); if (c) location.href = 'catalog.html?id=' + encodeURIComponent(c.dataset.id); };
}

// Фон главной: поле ASCII-символов. Яркость клетки — сумма нескольких бегущих волн, у курсора светлее;
// цвет — градиент темы по диагонали. ~24 кадра в секунду, только пока первый экран виден.
function glyphField(cv) {
  if (!cv) return;
  const ctx = cv.getContext('2d'), RAMP = ' .·:-=+*#%@', CW = 15, CH = 24;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, cols = 0, rows = 0, mx = -1e4, my = -1e4, sx = -1e4, sy = -1e4, fill = null, raf = 0, last = 0, visible = true;
  const paintStyle = () => {
    const cs = getComputedStyle(document.documentElement), g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, cs.getPropertyValue('--c1').trim()); g.addColorStop(.55, cs.getPropertyValue('--c2').trim()); g.addColorStop(1, cs.getPropertyValue('--c3').trim());
    fill = g;
  };
  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(W / CW); rows = Math.ceil(H / CH);
    paintStyle();
    if (still) draw(0);
  };
  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    ctx.font = '600 13px "JetBrains Mono", Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = fill;
    // курсор догоняется плавно — пятно света не дёргается
    sx += (mx - sx) * 0.12; sy += (my - sy) * 0.12;
    const cx = cols * 0.68, cy = rows * 0.35;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * CW, y = (r + 0.5) * CH;
      let v = Math.sin(c * 0.11 + t * 0.55) + Math.sin(r * 0.19 - t * 0.4) + Math.sin((c + r) * 0.07 + t * 0.3) + Math.sin(Math.hypot(c - cx, (r - cy) * 1.6) * 0.32 - t * 0.9);
      v = (v + 4) / 8;
      const d = Math.hypot(x - sx, y - sy), glow = d < 260 ? (1 - d / 260) ** 1.6 : 0;
      const lvl = Math.min(1, v ** 2.4 + glow * 0.85);
      const k = Math.round(lvl * (RAMP.length - 1));
      if (k < 1) continue;
      ctx.globalAlpha = Math.min(0.95, 0.1 + lvl * 0.6 + glow * 0.4);
      ctx.fillText(RAMP[k], x, y);
    }
    ctx.globalAlpha = 1;
  }
  const loop = now => {
    raf = requestAnimationFrame(loop);
    if (now - last < 42) return;
    last = now; draw(now / 1000);
  };
  resize();
  addEventListener('resize', resize);
  addEventListener('accentchange', () => { setTimeout(() => { paintStyle(); if (still) draw(0); }, 30); });
  if (still) return;
  addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; if (sx < -1e3) { sx = mx; sy = my; } }, { passive: true });
  new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); cancelAnimationFrame(raf); if (visible && !document.hidden) raf = requestAnimationFrame(loop); }).observe(cv);
  document.addEventListener('visibilitychange', () => { cancelAnimationFrame(raf); if (visible && !document.hidden) raf = requestAnimationFrame(loop); });
}

// ---------- каталог ----------
function initCatalog() {
  $('#demoNote').hidden = API.remote;
  const PAGE_SIZE = 24;
  const f = { q: '', kind: 'all', sort: 'new' };
  let offset = 0, total = 0, seq = 0;
  const cards = $('#cards'), more = $('#more');

  async function load(reset = true) {
    const my = ++seq;
    if (reset) { offset = 0; cards.innerHTML = skeletons(6); }
    more.disabled = true;
    try {
      const r = await API.list({ q: f.q, kind: f.kind === 'mine' ? 'all' : f.kind, onlyMine: f.kind === 'mine', sort: f.sort, offset, limit: PAGE_SIZE });
      if (my !== seq) return;
      total = r.total;
      if (f.kind === 'all' && !f.q) setCatCount(total);
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
    ? `<div class="cards-empty"><b>Ничего не нашлось</b><span>${f.kind === 'mine' ? 'Ты ещё ничего не выкладывал из этого браузера или аккаунта.' : 'Попробуй другой запрос или фильтр.'}</span></div>`
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
  box.innerHTML = `<div class="auth-card">${LOGO}
    <h1>Вход в Grid Studio</h1>
    <p>Сохраняй работы в профиль и возвращайся к ним с любого устройства. Выкладывай сетки в каталог от своего имени.</p>
    ${ACC.providers.length ? `<div class="auth-prov">${ACC.providers.map(p => `<button class="btn block" data-prov="${p}">${icon(PROV[p]?.[0] || 'user')}Войти через ${PROV[p]?.[1] || p}</button>`).join('')}</div><div class="auth-or"><span>или по почте</span></div>` : ''}
    <form class="auth-form" id="authForm">
      <label class="auth-field">${icon('mail')}<input class="input" id="authEmail" type="email" required placeholder="почта@пример.ru" autocomplete="email"></label>
      <button class="btn primary block" id="authGo">Получить ссылку для входа</button>
    </form>
    <div class="hint">Пароль не нужен — пришлём письмо со ссылкой. Почту никто не увидит: в профиле только ник.</div>
  </div>`;
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
  box.innerHTML = `<div class="auth-card"><div class="sh-ico">${icon('mail')}</div>
    <h1>Проверь почту</h1>
    <p>Письмо со ссылкой отправлено на <b>${esc(email)}</b>. Открой ссылку в этом браузере — и сразу окажешься в профиле. Письма нет — загляни в «Спам».</p>
    <form class="auth-form" id="codeForm">
      <input class="input code" id="authCode" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="Код из письма, если есть">
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

// шапка профиля: аватар, ник, «о себе», Steam, цифры
function profileHead(p, { me, grids = [], works = null }) {
  const likes = grids.reduce((a, g) => a + (+g.likes || 0), 0), dls = grids.reduce((a, g) => a + (+g.downloads || 0), 0);
  const steam = p.steam ? `<a class="pf-steam" href="${esc(p.steam)}" target="_blank" rel="noopener">${icon('ext')}Профиль Steam</a>` : '';
  return `<section class="pf-head">
    <div class="pf-ava-wrap">${avatarHTML(p.avatar, p.nick, 'pf-ava')}${me ? `<button class="pf-ava-edit" id="pfAva" title="Сменить аватар" aria-label="Сменить аватар">${icon('image')}</button>` : ''}</div>
    <div class="pf-info">
      ${me ? `<input class="pf-nick" id="pfNick" value="${esc(p.nick)}" maxlength="32" spellcheck="false" title="Ник — его видят в каталоге">` : `<h1 class="pf-nick">${esc(p.nick || 'Игрок')}</h1>`}
      ${me && ACC.ext() ? `<textarea class="pf-bio" id="pfBio" maxlength="200" rows="1" placeholder="Пара слов о себе: какие сетки делаешь, за кого играешь…">${esc(p.bio || '')}</textarea>` : p.bio ? `<p class="pf-bio">${esc(p.bio)}</p>` : ''}
      <span class="pf-meta">${me ? `${icon('lock')}${esc(ACC.user()?.email || '')} — видишь только ты` : ''} ${p.created_at ? `с ${new Date(p.created_at).toLocaleDateString('ru', { month: 'long', year: 'numeric' })}` : ''} ${steam}</span>
    </div>
    <div class="pf-side">
      <div class="pf-stats">
        ${works ? `<div><b>${num(works.length)}</b><span>${plural(works.length, 'работа', 'работы', 'работ')}</span></div>` : ''}
        <div><b>${num(grids.length)}</b><span>в каталоге</span></div>
        <div><b>${num(likes)}</b><span>${plural(likes, 'лайк', 'лайка', 'лайков')}</span></div>
        <div><b>${num(dls)}</b><span>скачиваний</span></div>
      </div>
      <div class="pf-actions">
        ${me ? `<a class="btn primary sm" href="editor.html?new">${icon('brush')}Новая сетка</a>${ACC.ext() ? `<button class="btn sm" id="pfSteam">${icon('link')}Steam</button>` : ''}` : ''}
        <button class="btn sm" id="pfShare" data-copy="${esc(new URL('profile.html?u=' + p.id, location.href).href)}">${icon('link')}Ссылка на профиль</button>
        ${me ? `<button class="btn sm ghost" id="pfOut">${icon('logout')}Выйти</button>` : ''}
      </div>
    </div>
  </section>`;
}

// работа → hero_grid_config.json (как экспорт в редакторе)
function workToConfig(w) {
  const r6 = v => Math.round(v * 1e6) / 1e6, d = w.data || {};
  const categories = (d.els || []).map(e => e.t === 'hero'
    ? { category_name: e.name, x_position: r6(e.x), y_position: r6(e.y), width: r6(e.w), height: r6(e.h), hero_ids: (e.heroes || []).slice() }
    : { category_name: e.name, x_position: r6(e.x), y_position: r6(e.y), width: 0, height: 0, hero_ids: [] });
  return JSON.stringify({ version: 3, configs: [{ config_name: d.settings?.configName || w.title, categories }] }, null, '\t');
}

// аватар: своя картинка (квадрат 160 px, webp), портрет героя или картинка из Discord/GitHub
function openAvatarSheet(p, onDone) {
  const heroes = (window.HEROES || []).slice().sort((a, b) => a.n.localeCompare(b.n));
  const prov = ACC.user()?.meta?.avatar;
  const m = openSheet(`<div class="sh-body ava-sheet">
    ${avatarHTML(p.avatar, p.nick, 'sh-ava')}
    <h2>Аватар</h2>
    <div class="sh-actions">
      ${ACC.ext() ? `<button class="btn primary block" data-av="upload">${icon('upload')}Загрузить картинку<span class="sh-note">png, jpg, webp</span></button>` : ''}
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
    try {
      const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('Не удалось открыть картинку')); im.src = URL.createObjectURL(f); });
      // квадрат из середины, 160 × 160
      const S = 160, side = Math.min(img.naturalWidth, img.naturalHeight), cv = document.createElement('canvas');
      cv.width = cv.height = S;
      const c = cv.getContext('2d'); c.imageSmoothingQuality = 'high';
      c.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, S, S);
      let url = cv.toDataURL('image/webp', 0.86);
      if (!url.startsWith('data:image/webp')) url = cv.toDataURL('image/jpeg', 0.86);
      await set(url);
    } catch (er) { toast(er.message, 'err'); }
  };
}

async function renderMyProfile(box) {
  let p = ACC.profile() || await ACC.loadProfile();
  let works = [], pub = [], liked = null, tab = 'works';
  const head = () => {
    $('#pfHeadBox').innerHTML = profileHead(p, { me: true, grids: pub, works });
    applyIcons($('#pfHeadBox'));
    bindHead();
  };
  box.innerHTML = `<div id="pfHeadBox"></div>
    <div class="pf-tabs chips" id="pfTabs"><i class="chip-ind" id="pfInd"></i>
      <button class="chip on" data-tab="works">${icon('lock')}Мои работы <b id="pfWorksN"></b></button>
      <button class="chip" data-tab="pub">${icon('globe')}Опубликованные <b id="pfPubN"></b></button>
      <button class="chip" data-tab="liked">${icon('heart')}Понравившиеся <b id="pfLikedN"></b></button>
    </div>
    <div class="cards" id="pfList">${skeletons(3)}</div>`;
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
    $('#pfOut').onclick = async () => { await ACC.signOut(); location.href = 'index.html'; };
    $('#pfShare').onclick = e => copyText(e.currentTarget.dataset.copy, 'Ссылка на профиль скопирована');
    const st = $('#pfSteam');
    if (st) st.onclick = async () => {
      const v = prompt('Ссылка на профиль Steam (https://steamcommunity.com/…). Пусто — убрать.', p.steam || '');
      if (v === null) return;
      try { p = await ACC.updateProfile({ steam: v.trim() }); head(); toast(v.trim() ? 'Steam добавлен в профиль' : 'Ссылка убрана', 'ok'); } catch (e) { toast(e.message, 'err'); }
    };
  }

  const ind = () => { const b = $('#pfTabs .chip.on'); $('#pfInd').style.cssText = `width:${b.offsetWidth}px;transform:translateX(${b.offsetLeft}px)`; };
  const draw = () => {
    $('#pfWorksN').textContent = works.length; $('#pfPubN').textContent = pub.length; $('#pfLikedN').textContent = liked ? liked.length : API.likedIds().length;
    const list = $('#pfList');
    if (tab === 'works') list.innerHTML = works.length ? works.map(workCard).join('')
      : `<div class="cards-empty">${MARK}<b>Пока нет сохранённых работ</b><span>В редакторе открой меню у названия сетки → «Сохранить в мои работы». Работы видишь только ты.</span><a class="btn primary sm" href="editor.html">Открыть редактор</a></div>`;
    else if (tab === 'pub') list.innerHTML = pub.length ? pub.map(cardHTML).join('')
      : `<div class="cards-empty"><b>Ничего не опубликовано</b><span>Сетки, которые ты выложишь в каталог, войдя в профиль, появятся здесь.</span></div>`;
    else list.innerHTML = !liked ? skeletons(3) : liked.length ? liked.map(cardHTML).join('')
      : `<div class="cards-empty"><b>Пока пусто</b><span>Ставь лайки сеткам в каталоге — они соберутся здесь.</span><a class="btn sm" href="catalog.html">В каталог</a></div>`;
    applyIcons(list);
  };
  $('#pfTabs').onclick = async e => {
    const b = e.target.closest('.chip'); if (!b) return;
    tab = b.dataset.tab; $$('#pfTabs .chip').forEach(c => c.classList.toggle('on', c === b)); ind(); draw();
    if (tab === 'liked' && !liked) { try { liked = await API.byIds(API.likedIds()); } catch { liked = []; } if (tab === 'liked') draw(); }
  };
  ind(); document.fonts?.ready.then(ind);
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
    const c = e.target.closest('.gcard[data-id]');
    if (c && tab !== 'works') openGrid(c.dataset.id, { onChange: (g, removed) => { if (removed) { pub = pub.filter(x => x.id !== g.id); draw(); head(); } } });
  };
  try {
    [works, pub] = await Promise.all([ACC.projects.list(), ACC.userGrids(ACC.user().id)]);
    head(); draw();
  } catch (e) { $('#pfList').innerHTML = `<div class="cards-empty"><b>Не удалось загрузить работы</b><span>${esc(e.message)}</span></div>`; }
}
const workCard = (w, k) => `<a class="gcard wcard" href="editor.html?project=${encodeURIComponent(w.id)}" style="animation-delay:${Math.min(k, 12) * 40}ms">
  <span class="gthumb">${w.thumb ? `<img src="${esc(w.thumb)}" alt="" loading="lazy">` : ''}
    <span class="gkind">${w.grid_id ? `${icon('globe')}В каталоге` : `${icon('lock')}Приватная`} · ${num(w.cats)} кат.</span>
    <span class="w-acts">
      <button data-wact="ren" data-id="${esc(w.id)}" title="Переименовать" aria-label="Переименовать">${icon('edit')}</button>
      <button data-wact="dl" data-id="${esc(w.id)}" title="Скачать hero_grid_config.json" aria-label="Скачать">${icon('download')}</button>
      <button data-wact="del" data-id="${esc(w.id)}" title="Удалить работу" aria-label="Удалить" class="danger">${icon('trash')}</button>
    </span></span>
  <span class="gbody"><span class="gtitle">${esc(w.title)}</span>
    <span class="gmeta"><span class="by">${icon('clock')}изменена ${ago(w.updated_at)}</span><span class="w-open">Открыть ${icon('arrow')}</span></span></span>
</a>`;
async function renderPublicProfile(box, id) {
  box.innerHTML = `<div class="loading">Загружаю профиль…</div>`;
  try {
    const [p, grids] = await Promise.all([ACC.getProfile(id), ACC.userGrids(id)]);
    if (!p) throw new Error('Такого профиля нет.');
    document.title = `${p.nick} · Grid Studio`;
    box.innerHTML = `${profileHead(p, { me: false, grids })}
      <div class="cards" id="pfList">${grids.length ? grids.map(cardHTML).join('') : `<div class="cards-empty"><b>Сеток пока нет</b><span>Автор ещё ничего не выложил в каталог.</span></div>`}</div>`;
    applyIcons(box);
    $('#pfShare').onclick = e => copyText(e.currentTarget.dataset.copy, 'Ссылка на профиль скопирована');
    $('#pfList').onclick = e => { const c = e.target.closest('.gcard[data-id]'); if (c) openGrid(c.dataset.id); };
  } catch (e) { box.innerHTML = `<div class="auth-card"><h1>Профиль не найден</h1><p>${esc(e.message)}</p><a class="btn" href="catalog.html">В каталог</a></div>`; }
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
if (PAGE === 'catalog') initCatalog();
if (PAGE === 'guides') initGuides();
if (PAGE === 'profile') initProfile();
reveal();
// профиль подтягивается в фоне — меню обновится само
if (ACC?.enabled && PAGE !== 'profile') ACC.ready();
// число сеток в меню на страницах, где каталог сам его не грузит
if (PAGE === 'guides' || PAGE === 'game' || PAGE === 'profile') API.list({ limit: 1 }).then(r => setCatCount(r.total)).catch(() => {});
