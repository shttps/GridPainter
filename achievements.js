'use strict';
/* Достижения профиля. Считаются по публичным данным — опубликованные работы, лайки, скачивания, сам профиль —
   и по игровым цифрам из profile_feats (schema.sql), поэтому у автора и у гостя его профиля список один и тот же.
   Хранить «выдано» на сервере не нужно: условие выполнено — достижение есть. В браузере помним только,
   какие уже показали с фанфарами (gs.ach.<id аккаунта>), чтобы праздновать каждое один раз.
   Подключается до site.js, а его помощники ($, esc, icon, num, plural, ACC, API) берёт только во время вызова. */
window.Achievements = (() => {
  // редкость как у предметов Доты: цвет кольца, медали и подписи
  const RARITY = {
    common: ['Обычное', '#b0c3d9'],
    uncommon: ['Необычное', '#5e98d9'],
    rare: ['Редкое', '#4b69ff'],
    mythical: ['Мифическое', '#8847ff'],
    legendary: ['Легендарное', '#d32ce6'],
    immortal: ['Бессмертное', '#e4ae39'],
    arcana: ['Аркана', '#ade55c'],
  };
  const RANK = Object.keys(RARITY);
  // свои значки медалей; чего здесь нет — берём из иконок сайта
  const GLYPHS = {
    blood: 'M12 3.5c3 4 5.5 7 5.5 10a5.5 5.5 0 01-11 0c0-3 2.5-6 5.5-10z',
    swords: 'M4.5 4.5l10 10M4.5 4.5H8M4.5 4.5V8M19.5 4.5l-10 10M19.5 4.5H16M19.5 4.5V8M12.5 16.5l3.5 3.5M11.5 16.5L8 20M15.5 13.5l3 3M8.5 13.5l-3 3',
    flame: 'M12 3c1 3.5 5.5 5.5 5.5 10.5a5.5 5.5 0 01-11 0c0-2.8 1.6-4.4 2.7-5.4.3 1.9 1 3 2.1 3.4C12 8.7 11 6 12 3z',
    orbs: '<circle cx="7" cy="8.5" r="2.8"/><circle cx="17" cy="8.5" r="2.8"/><circle cx="12" cy="16.5" r="2.8"/>',
    horns: 'M5 3.5c0 3.2 1.5 5.4 3.6 6M19 3.5c0 3.2-1.5 5.4-3.6 6M7 12a5 5 0 0110 0v2.5a5 5 0 01-10 0zM10 13.4v.1M14 13.4v.1M10.5 17h3',
    crown: 'M4 8.5l4 3.5 4-6.5 4 6.5 4-3.5-1.8 10H5.8zM6 21h12',
    chart: 'M4 19.5h16M6 16l4-5 3 3 5.5-7M15.5 7h3v3',
    infinity: 'M8.5 9a3 3 0 100 6c2.2 0 4.8-6 7-6a3 3 0 110 6c-2.2 0-4.8-6-7-6z',
    sparkle: 'M11 3.5l1.7 4.8 4.8 1.7-4.8 1.7L11 16.5l-1.7-4.8L4.5 10l4.8-1.7zM18 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
    flag: 'M6 20.5V4M6 4.5h11l-2.5 4 2.5 4H6',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".9" fill="currentColor"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4M9 14.5l2 2 4-4"/>',
    key: '<circle cx="8" cy="15.5" r="3.8"/><path d="M10.8 12.8L19.5 4M16.3 7.2l2.6 2.6M13.8 9.7l2 2"/>',
    bomb: '<circle cx="10.5" cy="14" r="6"/><path d="M15 9.5l2.5-2.5M18.2 3.8v1.6M21 6.6h-1.6M20.2 4.6l-1.1 1.1"/>',
  };
  const glyph = n => {
    const v = GLYPHS[n];
    if (!v) return icon(n);
    return `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${v.startsWith('<') ? v : `<path d="${v}"/>`}</svg>`;
  };

  // [id, группа, редкость, значок, название, как получить, сколько нужно, сколько есть (по сводке)]
  const LIST = [
    ['first_blood', 'Мастерская', 'common', 'blood', 'Первая кровь', 'Выложи первую работу в Мастерскую', 1, s => s.pubs],
    ['triple_kill', 'Мастерская', 'uncommon', 'swords', 'Тройное убийство', 'Выложи 3 работы в Мастерскую', 3, s => s.pubs],
    ['rampage', 'Мастерская', 'mythical', 'flame', 'Буйство', 'Выложи 10 работ в Мастерскую', 10, s => s.pubs],
    ['scenery', 'Мастерская', 'common', 'image', 'Новый пейзаж', 'Выложи фон главного меню', 1, s => s.bgs],
    ['director', 'Мастерская', 'rare', 'play', 'Режиссёр', 'Выложи видео-фон для меню', 1, s => s.video],
    ['invoker', 'Мастерская', 'legendary', 'orbs', 'Инвокер', 'Выложи сетки всех трёх видов: ASCII, мозаику и смешанную', 3, s => s.kinds],
    ['roshan', 'Мастерская', 'rare', 'horns', 'Рошан', 'Выложи сетку на 10 000+ категорий', 10000, s => s.maxCats],
    ['full_pool', 'Мастерская', 'rare', 'heroes', 'Весь пул', 'Выложи сетку со 100+ портретами героев', 100, s => s.maxHeroes],
    ['first_fan', 'Признание', 'common', 'heart', 'Первый фанат', 'Получи первый лайк', 1, s => s.likes],
    ['dominating', 'Признание', 'uncommon', 'star', 'Доминирую', 'Собери 25 лайков на своих работах', 25, s => s.likes],
    ['godlike', 'Признание', 'legendary', 'crown', 'Божественно', 'Собери 100 лайков на своих работах', 100, s => s.likes],
    ['aegis', 'Признание', 'immortal', 'shield', 'Аегис чемпиона', 'Одна работа — 50 лайков', 50, s => s.maxLikes],
    ['in_game', 'Признание', 'common', 'download', 'В игре', 'Твои работы скачали 10 раз', 10, s => s.dls],
    ['meta', 'Признание', 'rare', 'chart', 'Мета', 'Твои работы скачали 100 раз', 100, s => s.dls],
    ['beyond_godlike', 'Признание', 'arcana', 'infinity', 'Beyond Godlike', 'Твои работы скачали 1 000 раз', 1000, s => s.dls],
    ['own_style', 'Профиль', 'uncommon', 'sparkle', 'Свой стиль', 'Поставь аватар, баннер и напиши «о себе»', 3, s => s.style],
    ['in_touch', 'Профиль', 'common', 'link', 'На связи', 'Добавь в профиль Steam или Telegram', 1, s => s.contact],
    ['on_fire', 'Профиль', 'uncommon', 'flame', 'В ударе', 'Заходи на сайт 7 дней подряд', 7, s => s.streak],
    ['eternal_flame', 'Профиль', 'legendary', 'flame', 'Неугасимый', 'Заходи на сайт 30 дней подряд', 30, s => s.streak],
    ['veteran', 'Профиль', 'uncommon', 'clock', 'Ветеран', '30 дней в Grid Studio', 30, s => s.days],
    ['pioneer', 'Профиль', 'mythical', 'flag', 'Первопроходец', 'Заведи профиль в 2026 году, в первый год Grid Studio', 1, s => s.pioneer],
    ['seer', 'Игры', 'common', 'eye', 'Провидец', 'Угадай «Героя дня»', 1, s => s.wins],
    ['one_shot', 'Игры', 'mythical', 'target', 'С первого выстрела', 'Угадай «Героя дня» с первой попытки', 1, s => s.aces],
    ['regular', 'Игры', 'uncommon', 'calendar', 'Завсегдатай', 'Сыграй в «Героя дня» 7 раз', 7, s => s.played],
    ['safecracker', 'Игры', 'rare', 'key', 'Медвежатник', 'Набери 15 000 очков во «Взломе замка»', 15000, s => s.lockpick],
    ['sapper', 'Игры', 'rare', 'bomb', 'Сапёр Сплина', 'Набери 25 000 очков в «Сапёре Сплина»', 25000, s => s.sweeper],
    // тайное: в списке появляется, только когда получено
    ['ancient_guard', 'Тайное', 'immortal', 'shield', 'Страж Древних', 'Следит за порядком в Мастерской', 1, s => s.admin, true],
  ].map(([id, group, rarity, ico, name, desc, need, have, secret]) => ({ id, group, rarity, ico, name, desc, need, have, secret: !!secret }));

  // сводка по профилю: всё, из чего считаются условия
  function summary({ profile: p = {}, grids = [], backgrounds = [], feats = null, admin = false, streakBest = 0 }) {
    const pubs = [...grids, ...backgrounds];
    const sum = k => pubs.reduce((a, x) => a + (+x[k] || 0), 0);
    const max = (arr, k) => arr.reduce((a, x) => Math.max(a, +x[k] || 0), 0);
    const born = p.created_at ? new Date(p.created_at) : null;
    const f = feats || {};
    return {
      pubs: pubs.length, bgs: backgrounds.length, video: +backgrounds.some(b => b.kind === 'video'),
      kinds: new Set(grids.map(g => g.kind).filter(Boolean)).size, maxCats: max(grids, 'cats'), maxHeroes: max(grids, 'heroes'),
      likes: sum('likes'), dls: sum('downloads'), maxLikes: max(pubs, 'likes'),
      style: [p.avatar, p.banner, p.bio].filter(Boolean).length, contact: +!!(p.steam || p.tg),
      days: born ? Math.floor((Date.now() - born) / 864e5) : 0, pioneer: +(born?.getFullYear() === 2026),
      admin: +!!admin, games: !!feats, streak: Math.max(+f.streak || 0, +streakBest || 0),
      played: +f.played || 0, wins: +f.wins || 0, aces: +f.aces || 0, lockpick: +f.lockpick || 0, sweeper: +f.sweeper || 0,
    };
  }
  // список с прогрессом; игры прячем, пока в базе нет profile_feats (иначе там вечные нули)
  function evaluate(data) {
    const s = summary(data);
    return LIST.map(a => {
      const have = Math.max(0, +a.have(s) || 0), done = have >= a.need;
      return { ...a, have, done, pct: Math.min(1, have / a.need) };
    }).filter(a => (a.group !== 'Игры' || s.games) && (!a.secret || a.done));
  }

  // ---------- что уже праздновали ----------
  const seenKey = uid => 'gs.ach.' + uid;
  const readSeen = uid => { try { return new Set(JSON.parse(localStorage.getItem(seenKey(uid))) || []); } catch { return new Set(); } };
  function markSeen(uid, list) {
    const s = readSeen(uid);
    for (const a of list) if (a.done) s.add(a.id); // только добавляем: если запрос сорвался, старое не теряется
    try { localStorage.setItem(seenKey(uid), JSON.stringify([...s])); } catch {}
  }
  const freshOf = (uid, list) => { const s = readSeen(uid); return list.filter(a => a.done && !s.has(a.id)); };

  // рекорд огонька из этого браузера (site.js кладёт его в gs.streak) — пока в базе нет visit_ping
  const myStreak = uid => { try { const v = JSON.parse(localStorage.getItem('gs.streak')); return v?.uid === uid ? +v.best || 0 : 0; } catch { return 0; } };
  const feats = uid => (window.CatalogAPI?.rpc ? window.CatalogAPI.rpc('profile_feats', { p_uid: uid }) : Promise.reject()).catch(() => null);

  // ---------- витрина в профиле ----------
  const SHOW = 8; // свёрнуто: столько карточек, остальное — по кнопке
  const order = list => [...list].sort((a, b) => b.done - a.done || (a.done ? RANK.indexOf(b.rarity) - RANK.indexOf(a.rarity) : b.pct - a.pct) || RANK.indexOf(a.rarity) - RANK.indexOf(b.rarity));
  const medal = (a, big = false) => `<span class="ach-medal${big ? ' big' : ''}" style="--p:${a.done ? 1 : a.pct.toFixed(3)}" aria-hidden="true"><i class="ach-ring"></i><span class="ach-core">${glyph(a.ico)}</span>${a.done ? '' : `<span class="ach-lock">${icon('lock')}</span>`}</span>`;
  const progress = a => a.need > 1 ? `${num(Math.min(a.have, a.need))} / ${num(a.need)}` : 'Не получено';
  const itemHTML = (a, k, fresh) => `<div class="ach-item${a.done ? ' done' : ''}${fresh ? ' fresh' : ''}" style="--rc:${RARITY[a.rarity][1]};--k:${k}" tabindex="0" data-ach="${a.id}"
      aria-label="${esc(`${a.name}. ${a.desc}. ${RARITY[a.rarity][0]}. ${a.done ? 'Получено' : progress(a)}`)}">
    ${medal(a)}
    <span class="ach-txt"><b>${esc(a.name)}</b><span>${esc(a.desc)}</span>
      <small><em>${RARITY[a.rarity][0]}</em>${a.done ? `<i>${icon('check')}получено</i>` : `<i>${progress(a)}</i>`}</small></span>
    ${fresh ? '<span class="ach-new">Новое</span>' : ''}
  </div>`;

  // box — контейнер секции; data — как для evaluate; me — свой профиль (тогда празднуем новые)
  function render(box, data, { uid, me = false } = {}) {
    if (!box) return;
    const list = order(evaluate(data)), got = list.filter(a => a.done).length;
    const fresh = me && uid ? new Set(freshOf(uid, list).map(a => a.id)) : new Set();
    const open = box.dataset.open === '1';
    box.innerHTML = `<section class="ach" id="achievements" aria-labelledby="achTitle">
      <div class="pf-section-head ach-head">
        <div><h2 id="achTitle">Достижения</h2><p>${me ? 'Делай сетки, собирай лайки и играй — медали открываются сами.' : 'Чего автор добился в Grid Studio.'}</p></div>
        <div class="ach-sum" title="${got} из ${list.length}"><b>${got}<span>/${list.length}</span></b><i class="ach-bar"><i style="width:${(got / list.length * 100).toFixed(1)}%"></i></i></div>
      </div>
      <div class="ach-grid${open ? ' open' : ''}">${list.map((a, k) => itemHTML(a, k, fresh.has(a.id))).join('')}</div>
      ${list.length > SHOW ? `<button class="btn sm ghost ach-more" aria-expanded="${open}">${open ? 'Свернуть' : `Показать все · ${list.length}`}${icon('chev')}</button>` : ''}
    </section>`;
    const grid = $('.ach-grid', box), more = $('.ach-more', box);
    $$('.ach-item', grid).forEach((el, k) => { el.hidden = !open && k >= SHOW; });
    if (more) more.onclick = () => {
      const on = box.dataset.open !== '1'; box.dataset.open = on ? '1' : '';
      $$('.ach-item', grid).forEach((el, k) => { if (k >= SHOW) { el.hidden = !on; if (on) { el.classList.remove('rise'); void el.offsetWidth; el.classList.add('rise'); el.style.setProperty('--k', k - SHOW); } } });
      grid.classList.toggle('open', on); more.setAttribute('aria-expanded', on);
      more.innerHTML = `${on ? 'Свернуть' : `Показать все · ${list.length}`}${icon('chev')}`;
    };
    // новые раскрываются, когда секция доезжает до экрана
    const freshEls = $$('.ach-item.fresh', grid);
    if (freshEls.length) {
      const play = () => freshEls.forEach((el, i) => setTimeout(() => el.classList.add('play'), 350 + i * 260));
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); play(); } }, { threshold: .2 });
        io.observe(grid);
      } else play();
      celebrate(list.filter(a => fresh.has(a.id)), { here: true });
      markSeen(uid, list);
    } else if (me && uid) markSeen(uid, list);
    if (location.hash === '#achievements' && !box.dataset.scrolled) { box.dataset.scrolled = '1'; setTimeout(() => box.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300); }
  }

  // ---------- фанфары: окно «Достижение открыто» ----------
  const queue = [];
  let showing = false;
  function celebrate(items, { here = false } = {}) {
    if (!items.length) return;
    const top = [...items].sort((a, b) => RANK.indexOf(b.rarity) - RANK.indexOf(a.rarity)).slice(0, 3);
    top.forEach((a, i) => queue.push({ a, rest: i === top.length - 1 ? items.length - top.length : 0, here }));
    if (!showing) next();
  }
  function next() {
    const job = queue.shift(); if (!job) { showing = false; return; }
    showing = true;
    const { a, rest, here } = job, [rname, rc] = RARITY[a.rarity], epic = RANK.indexOf(a.rarity) >= RANK.indexOf('legendary');
    const sparks = Array.from({ length: epic ? 26 : 18 }, (_, i) => `<i style="--a:${(i / (epic ? 26 : 18) * 360 + Math.random() * 14).toFixed(1)}deg;--d:${(46 + Math.random() * 44).toFixed(0)}px;--s:${(.6 + Math.random() * .8).toFixed(2)};--t:${(Math.random() * .12).toFixed(2)}s"></i>`).join('');
    const tag = here ? 'div' : 'a';
    const pop = document.createElement(tag);
    pop.className = 'ach-pop' + (epic ? ' epic' : '');
    if (!here) pop.href = 'profile.html#achievements';
    pop.setAttribute('role', 'status'); pop.setAttribute('aria-live', 'polite');
    pop.style.setProperty('--rc', rc);
    pop.innerHTML = `<span class="ach-pop-medal">${epic ? '<i class="ach-rays"></i>' : ''}<i class="ach-wave"></i><span class="ach-sparks">${sparks}</span>${medal({ ...a, done: false, pct: 0 }, true)}</span>
      <span class="ach-pop-txt"><small>Достижение открыто</small><b>${esc(a.name)}</b><span>${esc(a.desc)}</span><em>${rname}${rest ? ` · и ещё ${rest} ${plural(rest, 'новое', 'новых', 'новых')}` : ''}</em></span>
      <i class="ach-shine"></i>`;
    document.body.appendChild(pop);
    // кольцо заполняется, замок слетает, медаль переворачивается уже в цвете
    const m = $('.ach-medal', pop);
    requestAnimationFrame(() => pop.classList.add('in'));
    setTimeout(() => { m.classList.add('unlock'); pop.classList.add('burst'); }, 1050);
    let gone = false;
    const close = () => {
      if (gone) return; gone = true;
      pop.classList.add('out');
      setTimeout(() => { pop.remove(); setTimeout(next, 180); }, 420);
    };
    const timer = setTimeout(close, 5200);
    pop.addEventListener('click', e => { if (here) { e.preventDefault(); clearTimeout(timer); close(); } });
  }

  // на остальных страницах сайта: раз в минуту проверяем, не открылось ли что-то новое (выложил сетку, набрал лайков…)
  async function watch() {
    const ACC = window.Accounts, API = window.CatalogAPI;
    if (!ACC?.enabled || !API) return;
    try { await ACC.ready(); } catch { return; }
    if (!ACC.signedIn()) return;
    const uid = ACC.user().id, key = 'gs.ach.at.' + uid;
    try { if (Date.now() - (+localStorage.getItem(key) || 0) < 60000) return; localStorage.setItem(key, Date.now()); } catch {}
    const [grids, bgs, f] = await Promise.all([
      ACC.userGrids(uid).catch(() => null),
      API.bg.list({ userId: uid, sort: 'new', limit: 60 }).then(r => r.items, () => []),
      feats(uid),
    ]);
    if (!grids) return;
    const list = evaluate({ profile: ACC.profile() || {}, grids, backgrounds: bgs, feats: f, admin: ACC.isAdmin(), streakBest: myStreak(uid) });
    celebrate(freshOf(uid, list));
    markSeen(uid, list);
  }

  return { LIST, RARITY, evaluate, render, celebrate, feats, watch, myStreak };
})();
