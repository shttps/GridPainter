'use strict';
/* Гайды: список, читалка в стиле Telegraph и редактор, в котором игроки пишут свои гайды.
   Гайды команды — guides-data.js, гайды игроков — Supabase (CatalogAPI.guides, таблица guides).
   И те и другие хранятся одинаково — списком блоков; здесь они собираются в страницу.
   Адреса: guides.html#start — гайд команды, #g/<id> — гайд игрока, #write — новый гайд, #edit/<id> — правка своего. */
(() => {
  const G = API.guides;
  const OFFICIAL = window.GUIDES_OFFICIAL || [];
  const tg = $('#tg');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const save = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const signedIn = () => !!ACC?.enabled && ACC.signedIn();
  const myId = () => ACC?.enabled ? ACC.user()?.id : null;

  Object.assign(ICONS, {
    folder: 'M3.5 7A1.5 1.5 0 015 5.5h4.2l2 2.2H19A1.5 1.5 0 0120.5 9.2V17.5A1.5 1.5 0 0119 19H5a1.5 1.5 0 01-1.5-1.5z',
    back: 'M19 12H5M11 6l-6 6 6 6',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    moon: 'M19.5 14.5A8 8 0 019.5 4.5a8 8 0 1010 10z',
    flag: 'M5.5 21V4.5M5.5 4.5h11l-2 4 2 4h-11',
    quote: 'M6 17c-1.5-1-2.5-2.6-2.5-5 0-3 2-5.5 5-6.5M14 17c-1.5-1-2.5-2.6-2.5-5 0-3 2-5.5 5-6.5',
    list: 'M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01',
    minus: 'M5 12h14',
    bulb: 'M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z',
    code: 'M8.5 7l-5 5 5 5M15.5 7l5 5-5 5',
  });

  // ======================= текст гайда: **жирный**, *курсив*, `код`, [[клавиша]], [ссылка](адрес) =======================
  const safeHref = h => {
    h = String(h || '').trim();
    if (/^https?:\/\/[^\s"'<>()]+$/i.test(h)) return h;
    if (/^[\w-]+\.html([?#][^\s"'<>()]*)?$/.test(h)) return h;
    if (/^#[\w/-]+$/.test(h)) return h;
    return '';
  };
  function inline(s) {
    s = String(s ?? '');
    let out = '', i = 0;
    const st = [];
    const open = t => { st.push(t); out += `<${t}>`; };
    // закрываем тег, даже если он не верхний: верхние закрываем и открываем снова
    const close = t => {
      const re = st.splice(st.lastIndexOf(t));
      for (let j = re.length - 1; j >= 0; j--) out += `</${re[j]}>`;
      re.shift(); for (const r of re) open(r);
    };
    const toggle = t => st.includes(t) ? close(t) : open(t);
    while (i < s.length) {
      const c = s[i];
      if (c === '\\' && i + 1 < s.length) { out += esc(s[i + 1]); i += 2; continue; }
      if (c === '*' && s[i + 1] === '*') { toggle('b'); i += 2; continue; }
      if (c === '*') { toggle('i'); i++; continue; }
      if (c === '`') { const j = s.indexOf('`', i + 1); if (j > i) { out += `<code>${esc(s.slice(i + 1, j))}</code>`; i = j + 1; continue; } }
      if (c === '[' && s[i + 1] === '[') { const j = s.indexOf(']]', i + 2); if (j > i) { out += `<kbd>${esc(s.slice(i + 2, j))}</kbd>`; i = j + 2; continue; } }
      if (c === '[') {
        const m = /^\[((?:\\.|[^\]\\])*)\]\(([^)\s]+)\)/.exec(s.slice(i));
        if (m) {
          const h = safeHref(m[2]);
          out += h ? `<a href="${esc(h)}"${/^https?:/i.test(h) ? ' target="_blank" rel="noopener nofollow ugc"' : ''}>${inline(m[1])}</a>` : inline(m[1]);
          i += m[0].length; continue;
        }
      }
      out += esc(c); i++;
    }
    for (let j = st.length - 1; j >= 0; j--) out += `</${st[j]}>`;
    return out;
  }
  const plain = s => String(s || '').replace(/\\(.)/g, '$1').replace(/[*`]|\[\[|\]\]/g, '');
  // обратно: из разметки редактора — в строку с **…**
  function ser(n) {
    if (n.nodeType === 3) return n.data.replace(/ /g, ' ').replace(/[\\*`[\]]/g, '\\$&');
    if (n.nodeType !== 1) return '';
    const tag = n.tagName, kids = () => [...n.childNodes].map(ser).join('');
    const wrap = (m, k) => k.trim() ? m + k + m : k;
    if (tag === 'BR') return ' ';
    if (tag === 'B' || tag === 'STRONG') return wrap('**', kids());
    if (tag === 'I' || tag === 'EM') return wrap('*', kids());
    if (tag === 'CODE') { const t = n.textContent.replace(/`/g, "'"); return t ? '`' + t + '`' : ''; }
    if (tag === 'KBD') { const t = n.textContent.replace(/]]/g, ''); return t ? `[[${t}]]` : ''; }
    if (tag === 'A') { const h = safeHref(n.getAttribute('href')); const k = kids(); return h && k.trim() ? `[${k}](${h})` : k; }
    if (n.style && /^(bold|[6-9]00)$/.test(n.style.fontWeight)) return wrap('**', kids());
    return kids();
  }
  const clip = (s, n) => s.length > n ? s.slice(0, n) : s;
  const fmtDate = iso => new Date(iso).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' });

  // ======================= блоки → страница =======================
  // картинки: у гайдов команды — файлы сайта (docs/…), у гайдов игроков — только их бакет
  const media = (src, official) => !src ? '' : official ? (/^docs\/[\w./-]+$/.test(src) ? src : '') : G.url(src);
  const imgTag = (src, alt = '') => `<img src="${esc(src)}" alt="${esc(plain(alt))}" loading="lazy" decoding="async" onload="this.classList.add('ok')">`;
  function blockHTML(b, official) {
    switch (b?.t) {
      case 'p': return `<p>${inline(b.x)}</p>`;
      case 'h': return `<h2>${inline(b.x)}</h2>`;
      case 'h3': return `<h3>${inline(b.x)}</h3>`;
      case 'quote': return `<blockquote>${inline(b.x)}</blockquote>`;
      case 'ul': case 'ol': return `<${b.t}>${(b.items || []).map(x => `<li>${inline(x)}</li>`).join('')}</${b.t}>`;
      case 'img': {
        const u = media(b.src, official); if (!u) return '';
        return `<figure class="tg-fig${b.wide ? ' wide' : ''}"><button class="tg-img" data-zoom aria-label="Открыть картинку крупно">${imgTag(u, b.cap)}</button>${b.cap ? `<figcaption>${inline(b.cap)}</figcaption>` : ''}</figure>`;
      }
      case 'compare': {
        const a = media(b.a, official), c = media(b.b, official); if (!a || !c) return '';
        return `<figure class="tg-fig wide"><div class="tg-cmp" style="--cut:50%">${imgTag(a, 'До')}<div class="tg-cmp-b">${imgTag(c, 'После')}</div>
          <span class="tg-cmp-tag l">До</span><span class="tg-cmp-tag r">После</span>
          <span class="tg-cmp-h" role="slider" tabindex="0" aria-label="Шторка «до/после»" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"><i>${icon('swap')}</i></span></div>
          ${b.cap ? `<figcaption>${inline(b.cap)}</figcaption>` : ''}</figure>`;
      }
      case 'tip': case 'warn': return `<aside class="tg-note ${b.t}"><i>${icon(b.t === 'tip' ? 'bulb' : 'alert')}</i><div>${inline(b.x)}</div></aside>`;
      case 'code': return `<div class="tg-code"><pre><code>${esc(b.x)}</code></pre><button class="tg-copy" data-copy="${esc(b.copy || b.x)}" aria-label="Скопировать">${icon('copy')}<span>Копировать</span></button></div>`;
      case 'hr': return '<hr>';
      case 'cta': return official ? `<div class="tg-cta">${(b.links || []).map(([t, h, main]) => `<a class="btn${main ? ' primary' : ''}" href="${esc(h)}">${esc(t)}${main ? icon('arrow') : ''}</a>`).join('')}</div>` : '';
      case 'path': return official ? `<div class="tg-path" aria-label="${esc(b.items.join(' › '))}">${b.items.map((x, i) => `${i ? '<i class="sep">›</i>' : ''}<span style="--i:${i}">${icon(i === b.items.length - 1 ? 'file' : 'folder')}${esc(x)}</span>`).join('')}</div>` : '';
      default: return '';
    }
  }

  // ======================= список =======================
  const TEAM = { name: 'Grid Studio', ava: '<span class="ava gava tg-team"><img src="logo.svg" alt=""></span>' };
  const L = { filter: 'all', q: '', items: [], total: 0, offset: 0, loading: false, missing: false, err: '' };
  const coverOf = (g, official) => official ? g.cover : g.cover ? G.url(g.cover) : '';
  // у гайда без обложки — своя: первая буква заголовка на градиенте
  const coverHTML = (g, official) => {
    const u = coverOf(g, official);
    if (u) return `<img src="${esc(u)}" alt="" loading="lazy" decoding="async" onload="this.classList.add('ok')">`;
    const hue = [...String(g.id)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    return `<span class="gcd-art" style="--hue:${hue}"><b>${esc([...g.title.trim()][0] || 'G')}</b></span>`;
  };
  const metaHTML = (g, official) => official
    ? `${TEAM.ava}<span>${TEAM.name}</span><i>·</i><span>${g.minutes} мин</span>`
    : `${authorAva(g.user_id, g.author)}<span>${nickHTML(g.user_id, g.author)}</span><i>·</i><span>${g.minutes} мин</span>${g.likes ? `<i>·</i><span class="gcd-likes">${icon('heart')}${num(g.likes)}</span>` : ''}${g.hidden ? '<span class="gcd-hidden">скрыт</span>' : g.reports ? `<span class="gcd-hidden">жалоб: ${g.reports}</span>` : ''}`;
  const card = (g, official, k) => `<a class="gcd" href="#${official ? esc(g.id) : 'g/' + esc(g.id)}" data-reveal style="--d:${(k % 3) * 0.07}s">
    <span class="gcd-cover">${coverHTML(g, official)}<span class="gc-tag">${esc(g.tag)}</span></span>
    <span class="gcd-body"><b>${esc(g.title)}</b>${g.subtitle ? `<span class="gcd-sub">${esc(g.subtitle)}</span>` : ''}<span class="gcd-meta">${metaHTML(g, official)}</span></span></a>`;
  const writeCard = () => `<a class="gcd gcd-write" href="#write" data-reveal><span class="gcd-plus">${icon('plus')}</span><b>Напиши свой гайд</b><span>Заголовок, текст, картинки и GIF — как в Telegraph. Выложишь от своего имени.</span></a>`;
  const skel = n => Array.from({ length: n }, () => '<div class="gcd sk"><span class="gcd-cover"></span><span class="gcd-body"><b></b><span></span></span></div>').join('');
  const officialMatch = g => !L.q || [g.title, g.subtitle, g.tag].join(' ').toLowerCase().includes(L.q.toLowerCase());

  function renderFeature() {
    const g = OFFICIAL[0]; if (!g) return;
    $('#gFeature').innerHTML = `<a class="gf" href="#${esc(g.id)}">
      <span class="gf-cover">${imgTag(g.cover)}</span>
      <span class="gf-body"><span class="gc-tag">С чего начать</span><b>${esc(g.title)}</b><span class="gf-sub">${esc(g.subtitle)}</span>
        <span class="gcd-meta">${TEAM.ava}<span>${TEAM.name}</span><i>·</i><span>${g.minutes} мин чтения</span></span>
        <span class="btn primary gf-go">Читать${icon('arrow')}</span></span></a>`;
  }
  function renderFilters() {
    const f = [['all', 'Все'], ['team', 'От команды'], ['people', 'От игроков']];
    if (signedIn()) f.push(['mine', 'Мои']);
    if (isAdmin()) f.push(['queue', 'На проверке']);
    if (!f.some(([k]) => k === L.filter)) L.filter = 'all';
    $('#gFilter').innerHTML = f.map(([k, t]) => `<button class="chip${k === L.filter ? ' on' : ''}" role="tab" aria-selected="${k === L.filter}" data-f="${k}">${t}</button>`).join('');
  }
  function renderGrid() {
    const grid = $('#gGrid'), more = $('#gMore');
    const team = L.filter === 'all' || L.filter === 'team' ? OFFICIAL.filter(officialMatch) : [];
    const people = L.filter !== 'team';
    let html = '';
    if (team.length) html += `<h2 class="gl-h">${icon('star')}От команды Grid Studio <small>${team.length}</small></h2><div class="gl-cards">${team.map((g, k) => card(g, true, k)).join('')}</div>`;
    if (people) {
      const title = { mine: 'Мои гайды', queue: 'На проверке' }[L.filter] || 'От игроков';
      html += `<h2 class="gl-h">${icon(L.filter === 'queue' ? 'shield' : 'user')}${title} ${L.total ? `<small>${L.total}</small>` : ''}</h2><div class="gl-cards">`;
      if (L.filter !== 'queue' && !L.q) html += writeCard();
      if (L.loading && !L.items.length) html += skel(3);
      else if (L.err) html += `<div class="gl-empty">${icon('alert')}<b>Не удалось загрузить гайды</b><span>${esc(L.err)}</span></div>`;
      else if (!L.items.length) html += `<div class="gl-empty">${icon('book')}<b>${L.q ? 'Ничего не нашлось' : L.filter === 'queue' ? 'Жалоб нет' : L.filter === 'mine' ? 'Ты ещё не писал гайдов' : 'Гайдов от игроков пока нет'}</b><span>${L.q ? 'Попробуй другое слово.' : L.missing ? 'Гайды игроков появятся, как только их подключат на сервере.' : L.filter === 'queue' ? 'Всё спокойно.' : 'Будь первым — расскажи, как ты сделал свою сетку.'}</span></div>`;
      else html += L.items.map((g, k) => card(g, false, k + 1)).join('');
      html += '</div>';
    }
    grid.innerHTML = html;
    more.innerHTML = people && L.items.length < L.total ? `<button class="btn" id="gMoreBtn"${L.loading ? ' disabled' : ''}>Показать ещё</button>` : '';
    reveal(grid); fillAvatars();
  }
  let reqN = 0;
  async function loadPeople(append = false) {
    if (L.filter === 'team') { renderGrid(); return; }
    const n = ++reqN;
    L.loading = true; L.err = '';
    if (!append) { L.items = []; L.total = 0; L.offset = 0; }
    renderGrid();
    try {
      const opt = { q: L.q, offset: L.offset, limit: 24 };
      if (L.filter === 'mine') opt.userId = myId();
      if (L.filter === 'queue') opt.queue = true;
      const r = await G.list(opt);
      if (n !== reqN) return;
      L.items = append ? [...L.items, ...r.items] : r.items; L.total = r.total; L.offset = L.items.length; L.missing = !!r.missing;
    } catch (e) { if (n === reqN) L.err = e.message; }
    if (n !== reqN) return;
    L.loading = false; renderGrid();
  }
  function initList() {
    renderFeature(); renderFilters(); loadPeople();
    $('#gFilter').onclick = e => {
      const b = e.target.closest('[data-f]'); if (!b || b.dataset.f === L.filter) return;
      L.filter = b.dataset.f; renderFilters(); loadPeople();
    };
    let t = 0;
    $('#gSearch').oninput = e => { clearTimeout(t); t = setTimeout(() => { L.q = e.target.value.trim(); loadPeople(); }, 300); };
    $('#gMore').onclick = e => { if (e.target.closest('#gMoreBtn')) loadPeople(true); };
    ACC?.enabled && ACC.onChange(() => { renderFilters(); });
  }

  // ======================= страница поверх списка: открыть / закрыть =======================
  let fromCard = null;     // карточка, с которой открыли гайд: из её обложки «вырастает» обложка статьи
  let opened = false, cleanup = [];
  document.addEventListener('click', e => { const a = e.target.closest('#gList a[href^="#"]'); if (a) fromCard = a; }, true);
  // плавная смена «кадра» страницы; в фоновой вкладке кадры не рисуются — там меняем сразу
  const canVT = () => !reduce && !!document.startViewTransition && document.visibilityState === 'visible';
  const vt = fn => {
    if (!canVT()) { fn(); return null; }
    const t = document.startViewTransition(fn);
    t.ready.catch(() => {}); t.updateCallbackDone.catch(() => {});
    return t;
  };
  const cardImg = el => el && $('.gcd-cover img, .gf-cover img', el);
  function mount(html, cls) {
    cleanup.forEach(f => f()); cleanup = [];
    tg.className = 'tg ' + cls;
    tg.dataset.theme = load('gs.tg.theme', 'dark');
    tg.innerHTML = html;
    tg.hidden = false; tg.scrollTop = 0;
    document.documentElement.classList.add('tg-on');
    applyIcons(tg);
    opened = true;
  }
  function show(html, cls, after) {
    const img = cardImg(fromCard);
    if (opened || !img) {
      mount(html, cls + (opened ? '' : ' enter')); after?.();
    } else {
      img.style.viewTransitionName = 'gcover';
      const t = vt(() => { img.style.viewTransitionName = ''; mount(html, cls + ' morph'); after?.(); });
      if (!t) tg.classList.add('enter');
      t?.finished.finally(() => { const c = $('.tg-cover img', tg); if (c) c.style.viewTransitionName = ''; });
    }
    fromCard = null;
  }
  function unmount() {
    cleanup.forEach(f => f()); cleanup = [];
    tg.hidden = true; tg.innerHTML = ''; opened = false;
    document.documentElement.classList.remove('tg-on');
  }
  function hide() {
    if (!opened) return;
    const href = tg.dataset.href, card = href && $(`#gList a[href="${CSS.escape(href)}"]`);
    const img = cardImg(card), cover = $('.tg-cover img', tg);
    if (img && cover && canVT() && tg.scrollTop < innerHeight * .8) {
      cover.style.viewTransitionName = 'gcover';
      vt(() => { cover.style.viewTransitionName = ''; unmount(); img.style.viewTransitionName = 'gcover'; })
        .finished.finally(() => { img.style.viewTransitionName = ''; });
    } else if (reduce || document.visibilityState !== 'visible') unmount();
    else { tg.classList.add('leave'); setTimeout(unmount, 260); }
  }
  // «назад»: если пришли со списка — по истории, иначе просто убираем адрес гайда
  let depth = 0;
  const goList = () => { if (depth > 0) history.back(); else { history.replaceState(null, '', location.pathname + location.search); route(); } };
  const go = hash => { location.hash = hash; };

  // ======================= читалка =======================
  function topBar(extra = '') {
    const dark = tg.dataset.theme === 'dark' || load('gs.tg.theme', 'dark') === 'dark';
    return `<div class="tg-top"><div class="tg-top-in">
      <button class="tg-btn tg-back" data-act="back">${icon('back')}<span>Гайды</span></button>
      <span class="tg-top-mid"></span>${extra}
      <button class="tg-btn ic" data-act="theme" aria-label="Тема: светлая или тёмная" title="Светлая / тёмная">${icon(dark ? 'sun' : 'moon')}</button>
    </div><div class="tg-progress"><i></i></div></div>`;
  }
  function readerHTML(g, official) {
    const mine = !official && G.isMine(g), adm = !official && isAdmin();
    const tools = official ? `<button class="tg-btn ic" data-act="link" aria-label="Скопировать ссылку" title="Скопировать ссылку">${icon('link')}</button>`
      : `<button class="tg-btn ic" data-act="link" aria-label="Скопировать ссылку" title="Скопировать ссылку">${icon('link')}</button>
        ${mine ? `<a class="tg-btn" href="#edit/${esc(g.id)}">${icon('edit')}<span>Править</span></a>` : ''}
        ${mine || adm ? `<button class="tg-btn ic danger" data-act="del" aria-label="Удалить гайд" title="Удалить">${icon('trash')}</button>` : ''}
        ${adm ? `<button class="tg-btn" data-act="mod">${icon('shield')}<span>${g.hidden ? 'Вернуть' : 'Скрыть'}</span></button>` : ''}`;
    const author = official ? `${TEAM.ava}<b>${TEAM.name}</b>` : `<a href="profile.html?u=${esc(g.user_id)}">${authorAva(g.user_id, g.author)}<b>${nickHTML(g.user_id, g.author)}</b></a>`;
    const when = official ? '' : `<i>·</i><time datetime="${esc(g.created_at)}">${fmtDate(g.created_at)}</time>`;
    const cover = coverOf(g, official);
    // картинку, которая уже стоит обложкой, второй раз не показываем
    const body = (g.body || []).filter(b => !(b.t === 'img' && g.cover && b.src === g.cover)).map(b => blockHTML(b, official)).join('');
    const nexts = (() => {
      const i = official ? OFFICIAL.findIndex(x => x.id === g.id) : -1;
      return [1, 2].map(k => OFFICIAL[(i + k + OFFICIAL.length) % OFFICIAL.length]).filter(x => x && x.id !== g.id);
    })();
    const liked = !official && G.isLiked(g.id);
    return `${topBar(tools)}
      <article class="tg-page">
        <header class="tg-head">
          <span class="tg-tag">${esc(g.tag)}</span>
          <h1>${esc(g.title)}</h1>
          ${g.subtitle ? `<p class="tg-lead">${esc(g.subtitle)}</p>` : ''}
          <address>${author}${when}<i>·</i><span>${g.minutes} мин чтения</span>${!official && g.views ? `<i>·</i><span>${icon('eye')}${num(g.views)}</span>` : ''}</address>
          ${g.hidden ? `<div class="tg-note warn"><i>${icon('alert')}</i><div>Гайд скрыт из списка${g.reports ? ` — жалоб: ${g.reports}` : ''}. Его видят только автор и админы.</div></div>` : ''}
        </header>
        ${cover ? `<figure class="tg-cover"><img src="${esc(cover)}" alt="" decoding="async" style="view-transition-name:gcover" onload="this.classList.add('ok')"></figure>` : ''}
        <div class="tg-body">${body}</div>
        <footer class="tg-foot">
          ${official ? `<span class="tg-foot-note">${icon('book')}Гайд от команды Grid Studio</span>` : `<button class="tg-like${liked ? ' on' : ''}" data-act="like" aria-pressed="${liked}">${icon('heart')}<span>${liked ? 'Полезно' : 'Было полезно'}</span><b>${num(g.likes)}</b></button>`}
          <button class="tg-btn" data-act="link">${icon('link')}<span>Поделиться</span></button>
          ${!official && !G.isMine(g) ? `<button class="tg-btn ghost" data-act="report"${G.isReported(g.id) ? ' disabled' : ''}>${icon('flag')}<span>${G.isReported(g.id) ? 'Жалоба отправлена' : 'Пожаловаться'}</span></button>` : ''}
        </footer>
        <section class="tg-next">
          <div class="tg-next-h"><b>Читать дальше</b><a href="#write" class="tg-btn">${icon('edit')}<span>Написать свой гайд</span></a></div>
          <div class="tg-next-cards">${nexts.map((x, k) => card(x, true, k)).join('')}</div>
        </section>
      </article>`;
  }
  function readerSkeleton() {
    return `${topBar()}<article class="tg-page tg-sk"><header class="tg-head"><span class="tg-tag">&nbsp;</span><h1>&nbsp;</h1><p class="tg-lead">&nbsp;</p></header><div class="tg-body"><p>&nbsp;</p><p>&nbsp;</p><p>&nbsp;</p></div></article>`;
  }
  function bindReader(g, official) {
    // прогресс чтения и шапка, которая прячется при прокрутке вниз
    const bar = $('.tg-progress i', tg), top = $('.tg-top', tg);
    let last = 0;
    const onScroll = () => {
      const max = tg.scrollHeight - tg.clientHeight, y = tg.scrollTop;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
      top.classList.toggle('away', y > last && y > 160);
      top.classList.toggle('solid', y > 8);
      last = y;
    };
    tg.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    cleanup.push(() => tg.removeEventListener('scroll', onScroll));
    // блоки проявляются по мере чтения
    const blocks = $$('.tg-body > *, .tg-foot, .tg-next', tg);
    if ('IntersectionObserver' in window && !reduce) {
      const io = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }, { root: tg, rootMargin: '0px 0px -8% 0px' });
      blocks.forEach(b => { b.classList.add('rv'); io.observe(b); });
      cleanup.push(() => io.disconnect());
    }
    $$('.tg-cmp', tg).forEach(bindCompare);
    reveal(tg); fillAvatars();
    tg.onclick = async e => {
      const z = e.target.closest('[data-zoom]'); if (z) { zoom($('img', z)); return; }
      const c = e.target.closest('[data-copy]'); if (c) { copyText(c.dataset.copy, 'Скопировано'); return; }
      const a = e.target.closest('[data-act]'); if (!a) { const l = e.target.closest('a[href^="#"]'); if (l) fromCard = null; return; }
      const act = a.dataset.act;
      if (act === 'back') goList();
      else if (act === 'theme') toggleTheme(a);
      else if (act === 'link') copyText(location.href, 'Ссылка на гайд скопирована');
      else if (act === 'like') {
        a.disabled = true;
        try {
          const r = await G.like(g.id); g.likes = r.likes;
          a.classList.toggle('on', r.liked); a.setAttribute('aria-pressed', r.liked);
          $('span', a).textContent = r.liked ? 'Полезно' : 'Было полезно'; $('b', a).textContent = num(r.likes);
          if (r.liked) { a.classList.remove('pop'); void a.offsetWidth; a.classList.add('pop'); }
        } catch (er) { toast(er.message, 'err'); }
        a.disabled = false;
      } else if (act === 'report') {
        if (!confirm('Пожаловаться на гайд? Пять жалоб прячут его из списка до проверки.')) return;
        try { await G.report(g.id); a.disabled = true; $('span', a).textContent = 'Жалоба отправлена'; toast('Спасибо, посмотрим', 'ok'); } catch (er) { toast(er.message, 'err'); }
      } else if (act === 'del') {
        if (!confirm(`Удалить гайд «${g.title}»? Это нельзя отменить.`)) return;
        try { await G.remove(g.id); toast('Гайд удалён', 'ok'); L.items = L.items.filter(x => x.id !== g.id); L.total = Math.max(0, L.total - 1); renderGrid(); goList(); } catch (er) { toast(er.message, 'err'); }
      } else if (act === 'mod') {
        try { await API.admin.moderate('guide', g.id, !g.hidden); g.hidden = !g.hidden; toast(g.hidden ? 'Гайд скрыт' : 'Гайд снова виден всем', 'ok'); $('span', a).textContent = g.hidden ? 'Вернуть' : 'Скрыть'; loadPeople(); } catch (er) { toast(er.message, 'err'); }
      }
    };
  }
  function toggleTheme(btn) {
    const t = tg.dataset.theme === 'dark' ? 'light' : 'dark';
    const set = () => { tg.dataset.theme = t; save('gs.tg.theme', t); btn.innerHTML = icon(t === 'dark' ? 'sun' : 'moon'); };
    vt(set);
  }
  async function openReader(id, official) {
    tg.dataset.href = official ? '#' + id : '#g/' + id;
    if (official) {
      const g = OFFICIAL.find(x => x.id === id);
      show(readerHTML(g, true), 'tg-read', () => bindReader(g, true));
      document.title = g.title + ' · Гайды Grid Studio';
      return;
    }
    const cached = L.items.find(x => x.id === id);
    show(readerSkeleton(), 'tg-read', () => {
      tg.onclick = e => { const a = e.target.closest('[data-act]'); if (a?.dataset.act === 'back') goList(); else if (a?.dataset.act === 'theme') toggleTheme(a); };
      if (cached?.cover) $('.tg-sk .tg-head', tg).insertAdjacentHTML('afterend', `<figure class="tg-cover"><img src="${esc(G.url(cached.cover))}" alt="" style="view-transition-name:gcover"></figure>`);
    });
    try {
      const g = await G.get(id);
      if (tg.dataset.href !== '#g/' + id) return;
      const html = readerHTML(g, false);
      cleanup.forEach(f => f()); cleanup = [];
      tg.innerHTML = html; applyIcons(tg);
      const c = $('.tg-cover img', tg); if (c) c.style.viewTransitionName = '';
      bindReader(g, false);
      document.title = g.title + ' · Гайды Grid Studio';
      G.view(id);
    } catch (e) {
      if (tg.dataset.href !== '#g/' + id) return;
      $('.tg-page', tg).innerHTML = `<div class="tg-gone">${icon('book')}<h1>Гайд не открылся</h1><p>${esc(e.message)}</p><button class="btn primary" data-act="back">К гайдам</button></div>`;
      applyIcons(tg);
    }
  }

  // картинка крупно: вырастает из своего места на странице
  function zoom(img) {
    if (!img) return;
    const r = img.getBoundingClientRect();
    const box = document.createElement('div');
    box.className = 'tg-zoom';
    box.innerHTML = `<img src="${esc(img.currentSrc || img.src)}" alt="${esc(img.alt)}">${img.alt ? `<p>${esc(img.alt)}</p>` : ''}`;
    document.body.appendChild(box);
    const big = $('img', box);
    const place = () => {
      const b = big.getBoundingClientRect();
      const k = r.width / b.width;
      return `translate(${r.left + r.width / 2 - (b.left + b.width / 2)}px, ${r.top + r.height / 2 - (b.top + b.height / 2)}px) scale(${k})`;
    };
    const from = place();
    if (!reduce) big.animate([{ transform: from }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
    requestAnimationFrame(() => box.classList.add('on'));
    const close = () => {
      document.removeEventListener('keydown', key);
      box.classList.remove('on');
      if (reduce) { box.remove(); return; }
      big.animate([{ transform: 'none' }, { transform: place() }], { duration: 320, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).finished.then(() => box.remove());
    };
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', key);
    box.onclick = close;
  }

  // шторка «до/после»: тянуть мышью или пальцем, стрелками с клавиатуры; при первом показе сама покачивается
  function bindCompare(el) {
    const h = $('.tg-cmp-h', el);
    let p = 50;
    const set = v => { p = Math.max(0, Math.min(100, v)); el.style.setProperty('--cut', p + '%'); h.setAttribute('aria-valuenow', Math.round(p)); };
    const at = e => { const r = el.getBoundingClientRect(); set((e.clientX - r.left) / r.width * 100); };
    el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); el.classList.add('drag'); at(e); stop = true; });
    el.addEventListener('pointermove', e => { if (el.classList.contains('drag')) at(e); });
    el.addEventListener('pointerup', () => el.classList.remove('drag'));
    el.addEventListener('pointercancel', () => el.classList.remove('drag'));
    h.addEventListener('keydown', e => { const d = { ArrowLeft: -5, ArrowRight: 5 }[e.key]; if (d) { e.preventDefault(); set(p + d); stop = true; } });
    let stop = reduce;
    if (stop || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(es => {
      if (!es[0].isIntersecting) return; io.disconnect();
      const t0 = performance.now();
      const step = t => {
        if (stop) return;
        const k = (t - t0) / 2200; if (k >= 1) { set(50); return; }
        set(50 + Math.sin(k * Math.PI * 2) * 28 * (1 - k));
        requestAnimationFrame(step);
      };
      setTimeout(() => requestAnimationFrame(step), 250);
    }, { root: tg, threshold: .6 });
    io.observe(el);
    cleanup.push(() => io.disconnect());
  }

  // ======================= редактор гайда =======================
  const W = { id: null, uploaded: new Set(), before: new Set(), busy: 0, tag: 'Другое', cover: '', saveT: 0 };
  const draftKey = () => 'gs.guide.draft.' + (W.id || 'new');
  const PH = { title: 'Заголовок', lead: 'Коротко: о чём гайд и кому он пригодится', body: 'Расскажи по шагам, как это сделать. Выдели текст — появятся кнопки оформления; «+» на пустой строке — картинки, GIF и блоки.' };

  // блок → разметка редактора (картинки и шторки — не редактируемые «островки» с подписью)
  function editHTML(b) {
    switch (b?.t) {
      case 'p': return `<p>${inline(b.x) || '<br>'}</p>`;
      case 'h': return `<h2>${inline(b.x)}</h2>`;
      case 'h3': return `<h3>${inline(b.x)}</h3>`;
      case 'quote': return `<blockquote>${inline(b.x)}</blockquote>`;
      case 'ul': case 'ol': return `<${b.t}>${(b.items || []).map(x => `<li>${inline(x)}</li>`).join('')}</${b.t}>`;
      case 'img': return figImg(b.src, b.cap, b.wide);
      case 'compare': return figCmp(b.a, b.b, b.cap);
      case 'tip': case 'warn': return noteHTML(b.t, inline(b.x));
      case 'code': return `<pre class="tw-code" data-t="code">${esc(b.x)}</pre>`;
      case 'hr': return '<hr contenteditable="false">';
      default: return '';
    }
  }
  const figBar = extra => `<div class="tw-fig-bar" contenteditable="false">${extra}<button type="button" data-fa="up" title="Выше">↑</button><button type="button" data-fa="down" title="Ниже">↓</button><button type="button" data-fa="del" title="Убрать">${icon('x')}</button></div>`;
  const figImg = (src = '', cap = '', wide = false) => `<figure class="tw-fig${wide ? ' wide' : ''}" contenteditable="false" data-t="img" data-src="${esc(src)}">
    <div class="tw-fig-img">${src ? `<img src="${esc(G.url(src))}" alt="">` : ''}<span class="tw-up"><i></i></span></div>
    <figcaption contenteditable="true" data-ph="Подпись — необязательно">${inline(cap)}</figcaption>
    ${figBar(`<button type="button" data-fa="wide" title="Во всю ширину">${wide ? 'Обычная' : 'Шире'}</button>`)}</figure>`;
  const slot = (k, src) => `<button type="button" class="tw-slot" data-k="${k}" data-src="${esc(src || '')}">${src ? `<img src="${esc(G.url(src))}" alt="">` : `${icon('image')}<span>${k === 'a' ? 'Картинка «до»' : 'Картинка «после»'}</span>`}<span class="tw-up"><i></i></span></button>`;
  const figCmp = (a = '', b = '', cap = '') => `<figure class="tw-fig tw-cmp wide" contenteditable="false" data-t="compare">
    <div class="tw-slots">${slot('a', a)}${slot('b', b)}</div>
    <figcaption contenteditable="true" data-ph="Подпись — например, что поменялось">${inline(cap)}</figcaption>${figBar('')}</figure>`;
  const noteHTML = (t, x = '') => `<aside class="tg-note ${t}" data-t="${t}"><i contenteditable="false">${icon(t === 'tip' ? 'bulb' : 'alert')}</i><div>${x || '<br>'}</div></aside>`;

  // разметка редактора → блоки
  function readBody(body) {
    const out = [];
    const text = el => [...el.childNodes].map(n => n.nodeType === 1 && /^(P|DIV|LI)$/.test(n.tagName) ? ser(n) + ' ' : ser(n)).join('').replace(/\s+/g, ' ').trim();
    for (const el of body.childNodes) {
      if (el.nodeType === 3) { const x = ser(el).trim(); if (x) out.push({ t: 'p', x }); continue; }
      if (el.nodeType !== 1) continue;
      const tag = el.tagName, t = el.dataset.t;
      if (tag === 'FIGURE' && t === 'img') { if (el.dataset.src) out.push({ t: 'img', src: el.dataset.src, cap: clip(text($('figcaption', el)), 300), ...(el.classList.contains('wide') ? { wide: true } : {}) }); }
      else if (tag === 'FIGURE' && t === 'compare') { const [a, b] = $$('.tw-slot', el).map(s => s.dataset.src); if (a && b) out.push({ t: 'compare', a, b, cap: clip(text($('figcaption', el)), 300) }); }
      else if (tag === 'ASIDE') { const x = text($('div', el) || el); if (x) out.push({ t: t === 'warn' ? 'warn' : 'tip', x: clip(x, 2000) }); }
      else if (tag === 'PRE') { const x = el.innerText.trim(); if (x) out.push({ t: 'code', x: clip(x, 2000) }); }
      else if (tag === 'HR') out.push({ t: 'hr' });
      else if (tag === 'UL' || tag === 'OL') { const items = $$('li', el).map(li => clip(text(li), 2000)).filter(Boolean); if (items.length) out.push({ t: tag.toLowerCase(), items: items.slice(0, 60) }); }
      else { const x = text(el); if (x) out.push({ t: tag === 'H2' ? 'h' : tag === 'H3' ? 'h3' : tag === 'BLOCKQUOTE' ? 'quote' : 'p', x: clip(x, 4000) }); }
    }
    return out.slice(0, 400);
  }
  const usedFiles = (cover, body) => new Set(G.files(cover, body));
  const readMinutes = body => {
    const words = body.reduce((n, b) => n + plain([b.x, b.cap, ...(b.items || [])].filter(Boolean).join(' ')).split(/\s+/).filter(Boolean).length, 0);
    const pics = body.filter(b => b.t === 'img' || b.t === 'compare').length;
    return Math.max(1, Math.round(words / 180 + pics * 0.2));
  };

  function writerHTML(d) {
    const p = ACC?.enabled ? ACC.profile() : null;
    const nick = p?.nick || 'Ты';
    const pub = W.id ? 'Сохранить' : 'Опубликовать';
    return `${topBar(`<span class="tw-status" id="twStatus"></span><button class="tg-btn ic" data-act="help" aria-label="Как оформлять" title="Как оформлять">${icon('alert')}</button>
        <button class="btn primary sm tw-pub" data-act="publish">${signedIn() ? pub : 'Войти и опубликовать'}</button>`)}
      <article class="tg-page tw">
        <div class="tw-cover${d.cover ? ' has' : ''}" id="twCover">${coverEditHTML(d.cover)}</div>
        <div class="tw-tags" id="twTags" role="radiogroup" aria-label="Тема гайда">${G.TAGS.map(t => `<button type="button" class="tw-tag${t === d.tag ? ' on' : ''}" role="radio" aria-checked="${t === d.tag}" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>
        <h1 class="tw-title" id="twTitle" contenteditable="true" spellcheck="true" data-ph="${PH.title}">${esc(d.title)}</h1>
        <p class="tg-lead tw-lead" id="twLead" contenteditable="true" data-ph="${PH.lead}">${esc(d.subtitle)}</p>
        <address>${avatarHTML(p?.avatar, nick, 'ava gava')}<b>${esc(nick)}</b><i>·</i><span>${W.id ? 'правка гайда' : 'черновик'}</span></address>
        <div class="tg-body tw-body" id="twBody" contenteditable="true" spellcheck="true" data-ph="${PH.body}">${(d.body?.length ? d.body : [{ t: 'p', x: '' }]).map(editHTML).join('')}</div>
        <div class="tw-foot">${icon('lock')}<span>Черновик сохраняется в этом браузере сам. Публикуешь — гайд видят все, править и удалить его можешь только ты.</span></div>
      </article>
      <div class="tw-tool" id="twTool" role="toolbar" aria-label="Оформление текста">
        <button type="button" data-cmd="bold" title="Жирный (Ctrl+B)"><b>Ж</b></button><button type="button" data-cmd="italic" title="Курсив (Ctrl+I)"><i>К</i></button>
        <button type="button" data-cmd="code" title="Код">${icon('code')}</button><button type="button" data-cmd="link" title="Ссылка">${icon('link')}</button>
        <span class="sep"></span>
        <button type="button" data-cmd="h2" title="Заголовок">H</button><button type="button" data-cmd="h3" title="Подзаголовок" class="sm">h</button><button type="button" data-cmd="quote" title="Цитата">${icon('quote')}</button>
        <form class="tw-link" id="twLink"><input type="url" placeholder="Вставь ссылку и нажми Enter" aria-label="Адрес ссылки"></form>
      </div>
      <div class="tw-plus" id="twPlus">
        <button type="button" class="tw-plus-btn" aria-label="Вставить блок" aria-expanded="false">${icon('plus')}</button>
        <div class="tw-menu" role="menu">
          <button type="button" role="menuitem" data-ins="img">${icon('image')}<span>Картинка или GIF</span></button>
          <button type="button" role="menuitem" data-ins="compare">${icon('swap')}<span>До / после</span></button>
          <button type="button" role="menuitem" data-ins="tip">${icon('bulb')}<span>Совет</span></button>
          <button type="button" role="menuitem" data-ins="warn">${icon('alert')}<span>Важно</span></button>
          <button type="button" role="menuitem" data-ins="code">${icon('code')}<span>Путь или код</span></button>
          <button type="button" role="menuitem" data-ins="ul">${icon('list')}<span>Список</span></button>
          <button type="button" role="menuitem" data-ins="hr">${icon('minus')}<span>Разделитель</span></button>
        </div>
      </div>
      <input type="file" id="twFile" accept="image/png,image/jpeg,image/webp,image/gif" hidden>`;
  }
  const coverEditHTML = c => c
    ? `<img src="${esc(G.url(c))}" alt=""><span class="tw-up"><i></i></span><div class="tw-cover-bar"><button type="button" class="tg-btn" data-cv="pick">${icon('image')}<span>Заменить</span></button><button type="button" class="tg-btn" data-cv="drop">${icon('x')}<span>Убрать</span></button></div>`
    : `<button type="button" class="tw-cover-add" data-cv="pick">${icon('image')}<b>Добавить обложку</b><span>Широкая картинка или GIF, до 5 МБ — она же будет на карточке</span></button><span class="tw-up"><i></i></span>`;

  // картинки: обычные — в WebP до 1600 px (меньше весят и без метаданных), GIF — как есть
  async function prepImage(file) {
    if (!file || !/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error('Нужна картинка: PNG, JPEG, WebP или GIF.');
    if (file.type === 'image/gif') { if (file.size > 5242880) throw new Error('GIF больше 5 МБ — сожми его или обрежь.'); return file; }
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600 / bmp.width), c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    let blob = await new Promise(r => c.toBlob(r, 'image/webp', .86));
    if (!blob || blob.type !== 'image/webp') blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .88));
    return blob;
  }
  function needLogin() {
    if (signedIn()) return false;
    const m = openSheet(`<div class="sh-body"><div class="sh-ico">${icon('user')}</div><h2>Войди, чтобы добавить картинки</h2>
      <p>Картинки гайда хранятся в твоём профиле. Текст уже сохранён в черновике — после входа просто вернись сюда.</p>
      <div class="sh-actions"><a class="btn primary block" href="profile.html?next=guides.html">${icon('user')}Войти</a></div></div>`);
    return !!m;
  }
  // загрузка с полоской прогресса прямо на картинке; host — элемент с .tw-up внутри
  async function upload(file, host, onDone) {
    if (needLogin()) return false;
    let blob;
    try { blob = await prepImage(file); } catch (e) { toast(e.message, 'err'); return false; }
    const local = URL.createObjectURL(blob);
    onDone(null, local);
    host.classList.add('busy'); W.busy++; status('Загружаю картинку…');
    const bar = $('.tw-up i', host);
    try {
      const path = await G.upload(blob, k => { if (bar) bar.style.transform = `scaleX(${k})`; });
      W.uploaded.add(path);
      onDone(path, local);
      return true;
    } catch (e) { toast(e.message, 'err'); onDone(false, local); return false; }
    finally { host.classList.remove('busy'); W.busy--; touch(); }
  }
  const pick = () => new Promise(res => {
    const f = $('#twFile', tg); f.value = '';
    f.onchange = () => res(f.files[0] || null);
    f.click();
  });

  let statusT = 0;
  function status(s, ok) {
    const el = $('#twStatus', tg); if (!el) return;
    el.textContent = s; el.classList.toggle('ok', !!ok); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    clearTimeout(statusT);
  }
  function snapshot() {
    const body = $('#twBody', tg);
    return { title: $('#twTitle', tg).textContent.replace(/\s+/g, ' ').trim(), subtitle: $('#twLead', tg).textContent.replace(/\s+/g, ' ').trim(), tag: W.tag, cover: W.cover, body: readBody(body), saved: Date.now() };
  }
  function touch() {
    clearTimeout(W.saveT);
    W.saveT = setTimeout(() => {
      if (!$('#twBody', tg)) return;
      const d = snapshot();
      save(draftKey(), { ...d, uploaded: [...W.uploaded] });
      status(W.busy ? 'Загружаю картинку…' : 'Черновик сохранён', !W.busy);
    }, 500);
  }

  async function openWriter(id = null) {
    tg.dataset.href = id ? '#edit/' + id : '#write';
    if (!G.canWrite()) {
      show(`${topBar()}<article class="tg-page"><div class="tg-gone">${icon('edit')}<h1>Гайды игроков скоро</h1><p>Писать свои гайды можно будет, как только на сайте включат профили.</p><button class="btn primary" data-act="back">К гайдам</button></div></article>`, 'tg-read', () => { tg.onclick = e => { const a = e.target.closest('[data-act]'); if (a?.dataset.act === 'back') goList(); else if (a?.dataset.act === 'theme') toggleTheme(a); }; });
      return;
    }
    Object.assign(W, { id, uploaded: new Set(), before: new Set(), busy: 0, tag: 'Другое', cover: '' });
    let d = load(draftKey(), null);
    if (id) {
      show(readerSkeleton(), 'tg-write');
      try {
        const g = await G.get(id);
        if (!G.isMine(g)) throw new Error('Править можно только свой гайд.');
        W.before = usedFiles(g.cover, g.body);
        if (!d || d.saved < new Date(g.updated_at).getTime()) d = { title: g.title, subtitle: g.subtitle, tag: g.tag, cover: g.cover, body: g.body };
        else toast('Открыт несохранённый черновик правки', 'ok');
      } catch (e) {
        $('.tg-page', tg).innerHTML = `<div class="tg-gone">${icon('alert')}<h1>Не получилось открыть</h1><p>${esc(e.message)}</p><button class="btn primary" data-act="back">К гайдам</button></div>`;
        applyIcons(tg); tg.onclick = e2 => { if (e2.target.closest('[data-act="back"]')) goList(); };
        return;
      }
    } else if (d && (d.title || d.body?.length)) toast('Черновик на месте — продолжай', 'ok');
    d = { title: '', subtitle: '', tag: 'Другое', cover: '', body: [], ...(d || {}) };
    (d.uploaded || []).forEach(p => W.uploaded.add(p));
    W.tag = G.TAGS.includes(d.tag) ? d.tag : 'Другое'; W.cover = d.cover || '';
    const html = writerHTML(d);
    if (id) { tg.innerHTML = html; applyIcons(tg); bindWriter(); }
    else show(html, 'tg-write', bindWriter);
    document.title = (id ? 'Правка гайда' : 'Новый гайд') + ' · Grid Studio';
    status(d.saved ? 'Черновик' : 'Новый гайд');
  }

  function bindWriter() {
    const body = $('#twBody', tg), title = $('#twTitle', tg), lead = $('#twLead', tg);
    const tool = $('#twTool', tg), plus = $('#twPlus', tg), linkForm = $('#twLink', tg);
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); document.execCommand('styleWithCSS', false, false); } catch {}
    const top = $('.tg-top', tg);
    const onScroll = () => { top.classList.toggle('solid', tg.scrollTop > 8); placeTool(); placePlus(); };
    tg.addEventListener('scroll', onScroll, { passive: true });
    cleanup.push(() => tg.removeEventListener('scroll', onScroll));
    if (!title.textContent.trim()) setTimeout(() => title.focus(), 350);

    // заголовок и подзаголовок — одна строка простого текста; Enter переводит дальше
    for (const [el, next, max] of [[title, lead, 90], [lead, body, 200]]) {
      el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); next.focus(); } });
      el.addEventListener('paste', e => { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData.getData('text/plain') || '').replace(/\s+/g, ' ').slice(0, max)); });
      el.addEventListener('input', () => { if (el.textContent.length > max) { el.textContent = el.textContent.slice(0, max); placeCaretEnd(el); } el.classList.toggle('empty', !el.textContent.trim()); touch(); });
      el.classList.toggle('empty', !el.textContent.trim());
    }
    $('#twTags', tg).onclick = e => {
      const b = e.target.closest('[data-tag]'); if (!b) return;
      W.tag = b.dataset.tag;
      $$('.tw-tag', tg).forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
      touch();
    };

    // обложка
    const cov = $('#twCover', tg);
    const setCover = c => { W.cover = c; cov.classList.toggle('has', !!c); cov.innerHTML = coverEditHTML(c); applyIcons(cov); touch(); };
    const coverFile = async file => {
      if (!file) return;
      const prev = W.cover;
      await upload(file, cov, (path, local) => {
        if (path === null) { cov.classList.add('has'); cov.innerHTML = `<img src="${local}" alt=""><span class="tw-up"><i></i></span>`; }
        else if (path === false) setCover(prev);
        else { setCover(path); URL.revokeObjectURL(local); }
      });
    };
    cov.onclick = async e => {
      const b = e.target.closest('[data-cv]'); if (!b) return;
      if (b.dataset.cv === 'drop') setCover('');
      else coverFile(await pick());
    };
    cov.addEventListener('dragover', e => { e.preventDefault(); cov.classList.add('over'); });
    cov.addEventListener('dragleave', () => cov.classList.remove('over'));
    cov.addEventListener('drop', e => { e.preventDefault(); cov.classList.remove('over'); coverFile([...e.dataTransfer.files].find(f => f.type.startsWith('image/'))); });

    // ---- тело ----
    const blockOf = n => { while (n && n.parentNode !== body) n = n.parentNode; return n && n.parentNode === body ? n : null; };
    // браузер иногда кладёт список или заголовок внутрь абзаца — вынимаем блоки на верхний уровень
    const BLOCK = /^(UL|OL|H2|H3|BLOCKQUOTE|P|DIV|PRE|ASIDE|FIGURE|HR)$/;
    const flatten = () => {
      for (const el of [...body.children]) {
        if (!/^(P|DIV)$/.test(el.tagName) || ![...el.children].some(c => BLOCK.test(c.tagName))) continue;
        const s = getSelection(), r = s.rangeCount ? s.getRangeAt(0) : null;
        const frag = document.createDocumentFragment();
        for (const n of [...el.childNodes]) {
          if (n.nodeType === 1 && BLOCK.test(n.tagName)) frag.appendChild(n);
          else if (n.nodeType === 3 && !n.data.trim()) continue;
          else { const p = document.createElement('p'); p.appendChild(n); frag.appendChild(p); }
        }
        el.replaceWith(frag);
        if (r) { s.removeAllRanges(); s.addRange(r); }
      }
    };
    const ensure = () => {
      flatten();
      if (!body.firstElementChild) body.innerHTML = '<p><br></p>';
      // после острова (картинка, разделитель) в конце всегда есть строка, куда можно писать дальше
      const last = body.lastElementChild;
      if (last && (last.isContentEditable === false || last.getAttribute('contenteditable') === 'false' || last.tagName === 'ASIDE' || last.tagName === 'PRE')) body.insertAdjacentHTML('beforeend', '<p><br></p>');
      body.classList.toggle('empty', body.children.length === 1 && body.firstElementChild.tagName === 'P' && !body.textContent.trim());
    };
    ensure();
    // быстрые пометки в начале строки: «- » список, «1. » нумерация, «> » цитата, «## » заголовок
    const SHORT = [[/^[-*]\s$/, 'insertUnorderedList'], [/^1[.)]\s$/, 'insertOrderedList'], [/^>\s$/, 'quote'], [/^##\s$/, 'h2'], [/^###\s$/, 'h3']];
    body.addEventListener('input', () => {
      const b = blockOf(getSelection().anchorNode);
      if (b && b.tagName === 'P') {
        const tx = b.textContent.replace(/ /g, ' ');
        for (const [re, cmd] of SHORT) if (re.test(tx)) {
          b.textContent = ''; b.innerHTML = '<br>'; placeCaretEnd(b);
          if (cmd.startsWith('insert')) document.execCommand(cmd); else formatBlock(cmd);
          break;
        }
      }
      ensure(); touch(); placePlus();
    });
    body.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openLink(); }
      // Enter в пустом совете/коде — выйти из блока
      if (e.key === 'Enter' && !e.shiftKey) {
        const b = blockOf(getSelection().anchorNode);
        if (b && (b.tagName === 'ASIDE' || b.tagName === 'PRE') && !b.textContent.replace(/\s/g, '').length) { e.preventDefault(); const p = document.createElement('p'); p.innerHTML = '<br>'; b.replaceWith(p); placeCaretEnd(p); touch(); }
        else if (b && b.tagName === 'PRE') { e.preventDefault(); document.execCommand('insertText', false, '\n'); }
      }
    });
    body.addEventListener('paste', e => {
      const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
      e.preventDefault();
      if (files.length) { files.forEach(f => insertImage(f)); return; }
      const t = (e.clipboardData.getData('text/plain') || '').replace(/\r/g, '');
      const paras = t.split(/\n{2,}|\n(?=\s*[-*•]\s)/).map(s => s.trim()).filter(Boolean);
      if (paras.length <= 1) document.execCommand('insertText', false, t.replace(/\n/g, ' '));
      else document.execCommand('insertHTML', false, paras.map(x => `<p>${esc(x.replace(/\n/g, ' '))}</p>`).join(''));
    });
    body.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); body.classList.add('over'); } });
    body.addEventListener('dragleave', e => { if (!body.contains(e.relatedTarget)) body.classList.remove('over'); });
    body.addEventListener('drop', e => {
      const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
      body.classList.remove('over'); if (!files.length) return;
      e.preventDefault();
      const r = document.caretRangeFromPoint?.(e.clientX, e.clientY);
      if (r) { const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      files.forEach(f => insertImage(f));
    });

    // кнопки на картинках: шире, выше/ниже, убрать; клик по пустой шторке — загрузить
    body.addEventListener('click', async e => {
      const fa = e.target.closest('[data-fa]');
      if (fa) {
        const fig = fa.closest('figure'), a = fa.dataset.fa;
        if (a === 'del') { fig.classList.add('bye'); setTimeout(() => { fig.remove(); ensure(); touch(); }, 220); }
        else if (a === 'wide') { const w = fig.classList.toggle('wide'); fa.textContent = w ? 'Обычная' : 'Шире'; touch(); }
        else if (a === 'up' && fig.previousElementSibling) { fig.previousElementSibling.before(fig); touch(); }
        else if (a === 'down' && fig.nextElementSibling) { fig.nextElementSibling.after(fig); ensure(); touch(); }
        fig.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
        return;
      }
      const sl = e.target.closest('.tw-slot');
      if (sl) { const f = await pick(); if (f) fillSlot(sl, f); }
    });
    const fillSlot = (sl, file) => upload(file, sl, (path, local) => {
      if (path === null) sl.innerHTML = `<img src="${local}" alt=""><span class="tw-up"><i></i></span>`;
      else if (path === false) { const t = document.createElement('div'); t.innerHTML = slot(sl.dataset.k, ''); sl.replaceWith(t.firstElementChild); }
      else { sl.dataset.src = path; URL.revokeObjectURL(local); }
    });

    // вставка блока на место текущей строки (пустая строка заменяется блоком)
    function placeBlock(html) {
      let b = blockOf(getSelection().anchorNode) || plusTarget;
      const tmp = document.createElement('div'); tmp.innerHTML = html;
      const el = tmp.firstElementChild;
      if (b && b.tagName === 'P' && !b.textContent.trim()) b.replaceWith(el);
      else if (b) b.after(el);
      else body.appendChild(el);
      applyIcons(el); ensure();
      el.classList.add('born');
      return el;
    }
    async function insertImage(file) {
      if (needLogin()) return;
      const fig = placeBlock(figImg());
      const ok = await upload(file, $('.tw-fig-img', fig), (path, local) => {
        if (path === null) $('.tw-fig-img', fig).insertAdjacentHTML('afterbegin', `<img src="${local}" alt="">`);
        else if (path) { fig.dataset.src = path; }
      });
      if (!ok) { fig.remove(); ensure(); }
      else { const cap = $('figcaption', fig); placeCaretEnd(cap); }
      touch();
    }
    async function insert(kind) {
      closeMenu();
      if (kind === 'img') { if (needLogin()) return; const f = await pick(); if (f) insertImage(f); return; }
      if (kind === 'compare') { if (needLogin()) return; placeBlock(figCmp()); touch(); return; }
      if (kind === 'tip' || kind === 'warn') { const el = placeBlock(noteHTML(kind)); placeCaretEnd($('div', el)); touch(); return; }
      if (kind === 'code') { const el = placeBlock('<pre class="tw-code" data-t="code"><br></pre>'); placeCaretEnd(el); touch(); return; }
      if (kind === 'hr') { const el = placeBlock('<hr contenteditable="false">'); const n = el.nextElementSibling; if (n) placeCaretEnd(n); touch(); return; }
      if (kind === 'ul') { const el = placeBlock('<ul><li><br></li></ul>'); placeCaretEnd($('li', el)); touch(); }
    }

    // ---- «+» у пустой строки ----
    let plusTarget = null;
    const menuBtn = $('.tw-plus-btn', plus);
    const closeMenu = () => { plus.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); };
    function placePlus() {
      if (plus.classList.contains('open')) return;
      const s = getSelection(), b = s.rangeCount && body.contains(s.anchorNode) ? blockOf(s.anchorNode) : null;
      if (!b || b.tagName !== 'P' || b.textContent.trim() || !s.isCollapsed) { plus.classList.remove('show'); return; }
      plusTarget = b;
      const r = b.getBoundingClientRect(), pr = $('.tg-page', tg).getBoundingClientRect();
      plus.style.top = (r.top + r.height / 2) + 'px';
      plus.style.left = Math.max(8, pr.left + (innerWidth < 760 ? pr.width - 52 : -54)) + 'px';
      plus.classList.add('show');
    }
    menuBtn.onmousedown = e => e.preventDefault();
    menuBtn.onclick = () => { const o = plus.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', o); };
    $('.tw-menu', plus).onmousedown = e => e.preventDefault();
    $('.tw-menu', plus).onclick = e => { const b = e.target.closest('[data-ins]'); if (b) insert(b.dataset.ins); };

    // ---- панель оформления над выделением ----
    let saved = null;
    function placeTool() {
      if (tool.classList.contains('linking')) return;
      const s = getSelection();
      if (!s.rangeCount || s.isCollapsed || !body.contains(s.anchorNode) || !body.contains(s.focusNode)) { tool.classList.remove('show'); return; }
      const r = s.getRangeAt(0).getBoundingClientRect();
      if (!r.width && !r.height) { tool.classList.remove('show'); return; }
      const w = tool.offsetWidth || 300;
      tool.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
      tool.style.top = Math.max(64, r.top - 52) + 'px';
      tool.classList.add('show');
      const blk = blockOf(s.anchorNode)?.tagName;
      const on = { bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic'), h2: blk === 'H2', h3: blk === 'H3', quote: blk === 'BLOCKQUOTE', code: !!s.anchorNode?.parentElement?.closest('code'), link: !!s.anchorNode?.parentElement?.closest('a') };
      $$('[data-cmd]', tool).forEach(b => b.classList.toggle('on', !!on[b.dataset.cmd]));
    }
    const onSel = () => { placeTool(); placePlus(); };
    document.addEventListener('selectionchange', onSel);
    cleanup.push(() => document.removeEventListener('selectionchange', onSel));
    const onResize = () => { placeTool(); placePlus(); };
    addEventListener('resize', onResize); cleanup.push(() => removeEventListener('resize', onResize));
    const offMenu = e => { if (!plus.contains(e.target)) closeMenu(); };
    document.addEventListener('mousedown', offMenu); cleanup.push(() => document.removeEventListener('mousedown', offMenu));

    function formatBlock(tag) {
      const b = blockOf(getSelection().anchorNode);
      const cur = b?.tagName.toLowerCase();
      const want = { h2: 'h2', h3: 'h3', quote: 'blockquote' }[tag] || tag;
      document.execCommand('formatBlock', false, `<${cur === want ? 'p' : want}>`);
    }
    function openLink() {
      const s = getSelection(); if (!s.rangeCount || s.isCollapsed) return;
      const a = s.anchorNode?.parentElement?.closest('a');
      if (a) { document.execCommand('unlink'); touch(); return; }
      saved = s.getRangeAt(0).cloneRange();
      tool.classList.add('linking', 'show');
      const inp = $('input', linkForm); inp.value = ''; inp.focus();
    }
    tool.onmousedown = e => { if (!e.target.closest('input')) e.preventDefault(); };
    tool.onclick = e => {
      const b = e.target.closest('[data-cmd]'); if (!b) return;
      const c = b.dataset.cmd;
      if (c === 'bold' || c === 'italic') document.execCommand(c);
      else if (c === 'code') {
        const s = getSelection(), inCode = s.anchorNode?.parentElement?.closest('code');
        if (inCode) inCode.replaceWith(document.createTextNode(inCode.textContent));
        else document.execCommand('insertHTML', false, `<code>${esc(s.toString())}</code>`);
      } else if (c === 'link') { openLink(); return; }
      else formatBlock(c);
      touch(); placeTool();
    };
    linkForm.onsubmit = e => {
      e.preventDefault();
      let v = $('input', linkForm).value.trim();
      if (v && !/^https?:\/\//i.test(v) && !/^[\w-]+\.html/.test(v)) v = 'https://' + v;
      tool.classList.remove('linking');
      const s = getSelection(); s.removeAllRanges(); if (saved) s.addRange(saved);
      if (v && safeHref(v)) { document.execCommand('createLink', false, v); touch(); }
      else if (v) toast('Такую ссылку вставить нельзя: нужен адрес вида https://…', 'err');
    };
    $('input', linkForm).onkeydown = e => { if (e.key === 'Escape') { tool.classList.remove('linking', 'show'); const s = getSelection(); s.removeAllRanges(); if (saved) s.addRange(saved); } };
    $('input', linkForm).onblur = () => setTimeout(() => tool.classList.remove('linking'), 150);

    // ---- кнопки сверху ----
    tg.onclick = async e => {
      const a = e.target.closest('.tg-top [data-act]'); if (!a) return;
      const act = a.dataset.act;
      if (act === 'back') { touch(); goList(); }
      else if (act === 'theme') toggleTheme(a);
      else if (act === 'help') openHelp();
      else if (act === 'publish') publish(a);
    };
  }
  function placeCaretEnd(el) {
    if (!el) return;
    el.focus?.();
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function openHelp() {
    openSheet(`<div class="sh-body tw-help"><div class="sh-ico">${icon('edit')}</div><h2>Как оформить гайд</h2>
      <ul>
        <li><b>Выдели текст</b> — появятся кнопки: жирный, курсив, код, ссылка, заголовок, цитата.</li>
        <li><b>«+» на пустой строке</b> — картинка или GIF, шторка «до/после», совет, важное, путь к файлу, список, разделитель.</li>
        <li>Картинки можно <b>перетащить</b> прямо в текст или <b>вставить</b> из буфера — <kbd>Ctrl V</kbd>.</li>
        <li>Быстро в начале строки: <code>- </code> список, <code>1. </code> нумерация, <code>&gt; </code> цитата, <code>## </code> заголовок.</li>
        <li><kbd>Ctrl B</kbd> жирный, <kbd>Ctrl I</kbd> курсив, <kbd>Ctrl K</kbd> ссылка.</li>
      </ul>
      <p>Хороший гайд — один вопрос и ответ по шагам, со скриншотами. Обложка и понятный заголовок помогают его найти.</p></div>`);
  }
  async function publish(btn) {
    if (!signedIn()) { touch(); location.href = 'profile.html?next=guides.html'; return; }
    if (W.busy) { toast('Подожди, картинки ещё загружаются', 'err'); return; }
    const d = snapshot();
    if (d.title.length < 3) { toast('Добавь заголовок — хотя бы пару слов', 'err'); $('#twTitle', tg).focus(); return; }
    const words = plain(d.body.map(b => [b.x, ...(b.items || [])].join(' ')).join(' ')).split(/\s+/).filter(Boolean).length;
    if (words < 15) { toast('Гайд пока слишком короткий — расскажи чуть подробнее', 'err'); $('#twBody', tg).focus(); return; }
    btn.disabled = true; const label = btn.textContent; btn.textContent = W.id ? 'Сохраняю…' : 'Публикую…';
    try {
      const id = await G.save({ id: W.id, title: d.title, subtitle: d.subtitle, tag: d.tag, cover: d.cover, body: d.body, minutes: readMinutes(d.body) });
      const used = usedFiles(d.cover, d.body);
      const unused = [...W.uploaded, ...W.before].filter(p => !used.has(p));
      G.forget(unused).catch(() => {});
      save(draftKey(), null);
      toast(W.id ? 'Гайд обновлён' : 'Гайд опубликован — его уже видят все', 'ok');
      loadPeople();
      history.replaceState(null, '', '#g/' + id); route();
    } catch (e) { toast(e.message, 'err'); btn.disabled = false; btn.textContent = label; }
  }

  // ======================= адреса =======================
  function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h) { hide(); document.title = 'Гайды · Grid Studio — как оформить Dota 2 под себя'; return; }
    if (h === 'write') return openWriter();
    if (h.startsWith('edit/')) return openWriter(h.slice(5));
    if (h.startsWith('g/')) return openReader(h.slice(2), false);
    if (OFFICIAL.some(x => x.id === h)) return openReader(h, true);
    hide();
  }
  addEventListener('hashchange', e => {
    const was = new URL(e.oldURL).hash, now = location.hash;
    if (!now) depth = 0; else if (!was) depth = 1;
    route();
  });
  addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !opened || $('#modalRoot').children.length || $('.tg-zoom')) return;
    if (tg.classList.contains('tg-write') && document.activeElement?.closest('#twBody, #twTitle, #twLead')) { document.activeElement.blur(); return; }
    goList();
  });

  initList();
  route();
})();
