'use strict';
/* Мастерская: сетки и фоны. Supabase REST (PostgREST) без SDK.
   Читать можно всем, а публикация, лайки, скачивания, жалобы и удаление идут через функции из supabase/schema.sql.
   У каждого браузера свой случайный ключ: им подписываются лайки и им же можно удалить свою сетку.
   Если Supabase не настроен (config.js), сетки работают локально в localStorage — «демо-режим».
   Фоны: файлы лежат в Supabase Storage (бакет backgrounds, у каждого автора своя папка), список — в таблице backgrounds. */
window.CatalogAPI = (() => {
  const cfg = window.GRID_CATALOG || {};
  const remote = !!(cfg.url && cfg.key);
  const base = remote ? cfg.url.replace(/\/+$/, '') + '/rest/v1' : '';
  const storage = remote ? cfg.url.replace(/\/+$/, '') + '/storage/v1/object' : '';
  // config (сама сетка) в список не входит — его тянет живое превью карточки, когда та доезжает до экрана
  const BASE_COLS = 'id,title,author,description,kind,cats,heroes,likes,downloads,created_at';
  // колонки появляются по мере того, как в Supabase выполняют новые куски schema.sql; если какой-то нет — живём без неё
  let userCol = remote && !!cfg.accounts, tagCols = remote;
  const cols = () => BASE_COLS + (userCol ? ',user_id' : '') + (tagCols ? ',tags,nsfw' : '');
  const missingCol = e => {
    if (userCol && /user_id/.test(e.message)) { userCol = false; return true; }
    if (tagCols && /tags|nsfw/.test(e.message)) { tagCols = false; return true; }
    return false;
  };

  const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));

  const browserKey = (() => { let k = load('gs.key', null); if (!k) { k = uuid(); save('gs.key', k); } return k; })();
  const mine = new Set(load('gs.mine', []));
  const liked = new Set(load('gs.liked', []));
  const reported = new Set(load('gs.reported', []));
  const remember = (set, key) => save(key, [...set]);

  const ERRORS = {
    rate_limit: 'Слишком часто. Подожди немного и попробуй снова.',
    bad_title: 'Название — от 1 до 60 символов.',
    bad_author: 'Ник — до 32 символов.',
    bad_description: 'Описание — до 500 символов.',
    bad_config: 'Сетка пустая или повреждена.',
    too_big: 'Файл слишком большой: картинка — до 5 МБ, видео — до 15 МБ.',
    bad_thumb: 'Не удалось сохранить превью.',
    bad_file: 'Этот файл не подходит: нужны PNG, JPEG, WebP, GIF, MP4 или WebM.',
    not_signed_in: 'Войди в профиль, чтобы выкладывать фоны.',
    not_yours: 'Удалить можно только свой фон.',
    not_admin: 'Это может только админ.',
  };
  function niceError(msg) {
    for (const k in ERRORS) if (String(msg).includes(k)) return ERRORS[k];
    return msg;
  }

  async function headers(json) {
    // новые ключи sb_publishable_… — не JWT, их передают только в apikey; старый anon key — ещё и в Authorization
    const h = { apikey: cfg.key };
    // вошёл в аккаунт — запрос от его имени: публикация привяжется к профилю, удалить можно с любого устройства
    const userToken = window.Accounts?.enabled ? await window.Accounts.token() : null;
    if (userToken) h.Authorization = 'Bearer ' + userToken;
    else if (!cfg.key.startsWith('sb_')) h.Authorization = 'Bearer ' + cfg.key;
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }
  async function rest(path, { method = 'GET', body, count = false } = {}) {
    const h = await headers(body !== undefined);
    if (count) h.Prefer = 'count=exact';
    let res;
    try { res = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch { throw new Error('Нет связи с Мастерской. Проверь интернет.'); }
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(niceError(data?.message || data?.hint || res.statusText));
    const range = res.headers.get('Content-Range');
    return { data, total: range ? +range.split('/')[1] || 0 : undefined };
  }
  const rpc = (fn, args) => rest('/rpc/' + fn, { method: 'POST', body: args }).then(r => r.data);
  // запрос, который переживает отсутствие новых колонок: убираем их и пробуем ещё раз
  async function tolerant(make) {
    for (let i = 0; i < 3; i++) {
      try { return await make(); } catch (e) { if (!missingCol(e)) throw e; }
    }
    return make();
  }

  // ---------- демо-режим: то же самое в localStorage ----------
  const LOCAL = 'gs.catalog.local';
  const localAll = () => load(LOCAL, []);
  function localSave(list) {
    if (!save(LOCAL, list)) throw new Error('В браузере закончилось место для демо-Мастерской. Удали пару своих сеток.');
  }
  const pick = g => { const o = {}; for (const k of BASE_COLS.split(',').concat('tags', 'nsfw')) o[k] = g[k]; return o; };

  // ---------- общий интерфейс ----------
  const clean = q => String(q || '').replace(/[,()*%\\"{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  const WEEK = () => new Date(Date.now() - 7 * 864e5).toISOString();
  const tagList = tag => `{"${String(tag).replace(/["\\]/g, '')}"}`;

  // sort: popular | week (популярные за 7 дней) | new | downloads; tag: один из TAGS.grid или '18+'
  async function list({ q = '', tag = '', sort = 'new', offset = 0, limit = 24, onlyMine = false } = {}) {
    q = clean(q);
    if (sort === 'top') sort = 'popular';
    if (!remote) {
      let all = localAll().filter(g => !g.hidden);
      if (onlyMine) all = all.filter(g => mine.has(g.id));
      if (tag === '18+') all = all.filter(g => g.nsfw);
      else if (tag) all = all.filter(g => (g.tags || []).includes(tag));
      if (sort === 'week') all = all.filter(g => g.created_at >= WEEK());
      if (q) { const s = q.toLowerCase(); all = all.filter(g => g.title.toLowerCase().includes(s) || g.author.toLowerCase().includes(s)); }
      const by = sort === 'popular' || sort === 'week' ? 'likes' : sort === 'downloads' ? 'downloads' : null;
      all.sort((a, b) => (by ? b[by] - a[by] : 0) || b.created_at.localeCompare(a.created_at));
      return { items: all.slice(offset, offset + limit).map(pick), total: all.length };
    }
    const build = () => {
      // в базе ещё нет тегов — ни одна сетка им не соответствует
      if (tag && !tagCols) return null;
      // админ по правилам базы видит и скрытое жалобами — в обычных списках оно не нужно
      const p = new URLSearchParams({ select: cols(), hidden: 'is.false' });
      if (tagCols && tag === '18+') p.set('nsfw', 'is.true');
      else if (tagCols && tag) p.set('tags', 'cs.' + tagList(tag));
      if (sort === 'week') p.set('created_at', 'gte.' + WEEK());
      // «Мои» — выложенные из этого браузера или из моего аккаунта
      const conds = [];
      if (q) conds.push(`or(title.ilike.*${q}*,author.ilike.*${q}*)`);
      if (onlyMine) {
        const uid = userCol && window.Accounts?.user()?.id, own = [];
        if (mine.size) own.push(`id.in.(${[...mine].join(',')})`);
        if (uid) own.push(`user_id.eq.${uid}`);
        if (!own.length) return null;
        conds.push(`or(${own.join(',')})`);
      }
      if (conds.length) p.set('and', `(${conds.join(',')})`);
      p.set('order', sort === 'popular' || sort === 'week' ? 'likes.desc,created_at.desc' : sort === 'downloads' ? 'downloads.desc,created_at.desc' : 'created_at.desc');
      p.set('offset', offset); p.set('limit', limit);
      return p;
    };
    const r = await tolerant(async () => { const p = build(); return p ? rest('/grids?' + p, { count: true }) : { data: [], total: 0 }; });
    return { items: r.data, total: r.total ?? r.data.length };
  }

  // сетка целиком (с config); config кэшируется — карточка и окно сетки качают его один раз
  const configs = new Map();
  async function get(id) {
    if (!remote) {
      const g = localAll().find(x => x.id === id && !x.hidden);
      if (!g) throw new Error('Сетка не найдена — возможно, её удалили.');
      return g;
    }
    const r = await tolerant(() => rest(`/grids?select=${cols()},reports,hidden,config&id=eq.${encodeURIComponent(id)}`));
    if (!r.data?.length) throw new Error('Сетка не найдена — возможно, её удалили.');
    configs.set(id, Promise.resolve(r.data[0].config));
    return r.data[0];
  }
  // только сетка — для живого превью карточки; не больше 4 загрузок одновременно
  let active = 0;
  const queue = [];
  const slot = () => new Promise(res => { if (active < 4) { active++; res(); } else queue.push(res); });
  const release = () => { const next = queue.shift(); if (next) next(); else active--; };
  function config(id) {
    if (!configs.has(id)) {
      const p = (async () => {
        if (!remote) return (localAll().find(x => x.id === id) || {}).config || { categories: [] };
        await slot();
        try { return (await rest(`/grids?select=config&id=eq.${encodeURIComponent(id)}`)).data?.[0]?.config || { categories: [] }; }
        finally { release(); }
      })();
      p.catch(() => configs.delete(id));
      configs.set(id, p);
    }
    return configs.get(id);
  }
  // сохранённая картинка-превью — запасной вариант, если сетку скачать не вышло
  async function thumb(id) {
    if (!remote) return (localAll().find(x => x.id === id) || {}).thumb || '';
    return (await rest(`/grids?select=thumb&id=eq.${encodeURIComponent(id)}`)).data?.[0]?.thumb || '';
  }

  // несколько сеток по id — например, понравившиеся
  async function byIds(ids) {
    ids = ids.filter(id => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 100);
    if (!ids.length) return [];
    if (!remote) return localAll().filter(g => ids.includes(g.id) && !g.hidden).map(pick);
    return (await tolerant(() => rest(`/grids?select=${cols()}&id=in.(${ids.join(',')})&hidden=is.false&order=created_at.desc`))).data;
  }

  async function publish({ title, author, description, config, thumb, tags = [], nsfw = false }) {
    const st = window.GridRender.stats(config.categories);
    tags = tags.filter(t => TAGS.grid.includes(t)).slice(0, 5);
    let id;
    if (!remote) {
      title = String(title).trim(); author = String(author || '').trim() || 'Аноним';
      if (!title || title.length > 60) throw new Error(ERRORS.bad_title);
      id = uuid();
      const list = localAll();
      list.unshift({ id, title, author, description: String(description || '').trim(), thumb, kind: st.kind, cats: st.cats, heroes: st.ids, tags, nsfw: !!nsfw,
        likes: 0, downloads: 0, created_at: new Date().toISOString(), config: { config_name: title, categories: config.categories } });
      localSave(list);
    } else {
      const args = { p_title: title, p_author: author, p_description: description, p_config: config, p_thumb: thumb, p_key: browserKey };
      try { id = await rpc('publish_grid', { ...args, p_tags: tags, p_nsfw: !!nsfw }); }
      catch (e) {
        // база ещё без тегов (не выполнен свежий schema.sql) — публикуем по-старому
        if (!/p_tags|p_nsfw|publish_grid/.test(e.message)) throw e;
        id = await rpc('publish_grid', args);
      }
    }
    mine.add(id); remember(mine, 'gs.mine');
    return id;
  }

  async function like(id) {
    let r;
    if (!remote) {
      const all = localAll(), g = all.find(x => x.id === id); if (!g) return { likes: 0, liked: false };
      const on = !liked.has(id); g.likes = Math.max(0, g.likes + (on ? 1 : -1)); localSave(all);
      r = { likes: g.likes, liked: on };
    } else r = await rpc('grid_like', { p_id: id, p_key: browserKey });
    r.liked ? liked.add(id) : liked.delete(id); remember(liked, 'gs.liked');
    return r;
  }

  async function hit(id) {
    try {
      if (!remote) { const all = localAll(), g = all.find(x => x.id === id); if (g) { g.downloads++; localSave(all); } return; }
      await rpc('grid_hit', { p_id: id });
    } catch { /* счётчик — не повод ломать скачивание */ }
  }

  async function report(id) {
    if (reported.has(id)) return;
    if (remote) await rpc('grid_report', { p_id: id, p_key: browserKey });
    reported.add(id); remember(reported, 'gs.reported');
  }

  async function remove(id) {
    if (!remote) localSave(localAll().filter(g => g.id !== id));
    else if (!await rpc('grid_delete', { p_id: id, p_key: browserKey })) throw new Error('Удалить можно только свою сетку: из того браузера, где её выложили, или войдя в свой профиль.');
    mine.delete(id); remember(mine, 'gs.mine');
  }

  // ---------- фоны главного меню ----------
  const bgLiked = new Set(load('gs.bg.liked', []));
  const bgReported = new Set(load('gs.bg.reported', []));
  const BG_COLS = 'id,created_at,user_id,title,author,tags,nsfw,kind,aspect,width,height,duration,size,file,poster,likes,downloads';
  // в базе — пути внутри бакета; наружу отдаём готовые публичные адреса
  const bgUrl = path => `${storage}/public/backgrounds/${String(path).split('/').map(encodeURIComponent).join('/')}`;
  const withUrls = b => ({ ...b, path: b.file, posterPath: b.poster, file: bgUrl(b.file), poster: bgUrl(b.poster) });
  const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm' };
  // один файл в Storage; XMLHttpRequest, а не fetch — ради полоски прогресса
  function put(path, blob, token, onProgress) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('POST', `${storage}/backgrounds/${path}`);
      x.setRequestHeader('apikey', cfg.key);
      x.setRequestHeader('Authorization', 'Bearer ' + token);
      x.setRequestHeader('Content-Type', blob.type);
      x.setRequestHeader('Cache-Control', 'max-age=31536000');
      if (onProgress) x.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      x.onload = () => {
        if (x.status >= 200 && x.status < 300) return resolve();
        let d = null; try { d = JSON.parse(x.responseText); } catch {}
        const m = String(d?.message || d?.error || '');
        reject(new Error(/size|large/i.test(m) || x.status === 413 ? ERRORS.too_big : /mime|type/i.test(m) ? ERRORS.bad_file
          : /bucket/i.test(m) ? 'Хранилище фонов ещё не настроено.' : m || 'Не удалось загрузить фон.'));
      };
      x.onerror = () => reject(new Error('Нет связи с хранилищем фонов. Проверь интернет.'));
      x.send(blob);
    });
  }
  async function unlink(paths, token) {
    await fetch(`${storage}/backgrounds`, {
      method: 'DELETE', headers: { apikey: cfg.key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: paths }),
    }).catch(() => {});
  }
  const bg = {
    // смотреть можно, когда есть база; выкладывать — ещё и с аккаунтами
    enabled: remote,
    canUpload: () => remote && !!window.Accounts?.enabled,
    async list({ q = '', tag = '', aspect = '', sort = 'popular', offset = 0, limit = 24, onlyMine = false, userId = '' } = {}) {
      if (!remote) return { items: [], total: 0 };
      q = clean(q);
      const p = new URLSearchParams({ select: BG_COLS, hidden: 'is.false' });
      if (tag === '18+') p.set('nsfw', 'is.true');
      else if (tag) p.set('tags', 'cs.' + tagList(tag));
      if (aspect) p.set('aspect', 'eq.' + aspect);
      if (userId) p.set('user_id', 'eq.' + userId);
      if (sort === 'week') p.set('created_at', 'gte.' + WEEK());
      if (q) p.set('or', `(title.ilike.*${q}*,author.ilike.*${q}*)`);
      if (onlyMine) {
        const uid = window.Accounts?.user()?.id;
        if (!uid) return { items: [], total: 0 };
        p.set('user_id', 'eq.' + uid);
      }
      p.set('order', sort === 'new' ? 'created_at.desc' : sort === 'downloads' ? 'downloads.desc,created_at.desc' : 'likes.desc,created_at.desc');
      p.set('offset', offset); p.set('limit', limit);
      try {
        const r = await rest('/backgrounds?' + p, { count: true });
        return { items: r.data.map(withUrls), total: r.total ?? r.data.length };
      } catch (e) {
        // таблицы ещё нет — фоны просто пустые, а не ошибка на всю страницу
        if (/backgrounds/.test(e.message)) return { items: [], total: 0, missing: true };
        throw e;
      }
    },
    async get(id) {
      // featured появляется после schema.sql 2.6 — без неё фон всё равно открывается
      const one = extra => rest(`/backgrounds?select=${BG_COLS},reports,hidden${extra}&id=eq.${encodeURIComponent(id)}`);
      const r = await one(',featured').catch(e => { if (/featured/.test(e.message)) return one(''); throw e; });
      if (!r.data?.length) throw new Error('Фон не найден — возможно, его удалили.');
      return withUrls(r.data[0]);
    },
    // фоны, которые админ отметил «На главную»: без 18+ и скрытых, новые первыми
    async featured(limit = 12) {
      if (!remote) return [];
      const p = new URLSearchParams({ select: BG_COLS, featured: 'is.true', hidden: 'is.false', nsfw: 'is.false', order: 'created_at.desc', limit });
      try { return (await rest('/backgrounds?' + p)).data.map(withUrls); } catch { return []; }
    },
    // скачать с понятным именем файла: Storage сам ставит Content-Disposition
    downloadUrl: (b, name) => b.file + '?download=' + encodeURIComponent(name),
    // загрузка: файл и постер в свою папку бакета, потом запись в базе; onProgress(0…1)
    async upload({ file, poster, meta }, onProgress) {
      if (!bg.canUpload()) throw new Error('Загрузка фонов ещё не подключена.');
      const token = await window.Accounts.token(), uid = window.Accounts.user()?.id;
      if (!token || !uid) throw new Error(ERRORS.not_signed_in);
      const ext = EXT[file.type]; if (!ext) throw new Error(ERRORS.bad_file);
      const id = uuid(), path = `${uid}/${id}.${ext}`, posterPath = `${uid}/${id}.poster.${poster.type === 'image/webp' ? 'webp' : 'jpg'}`;
      await put(posterPath, poster, token);
      try {
        await put(path, file, token, onProgress);
        return await rpc('publish_background', {
          p_title: meta.title, p_tags: meta.tags, p_nsfw: !!meta.nsfw, p_aspect: meta.aspect,
          p_width: meta.width | 0, p_height: meta.height | 0, p_duration: +meta.duration || 0, p_file: path, p_poster: posterPath,
        });
      } catch (e) {
        // не опубликовалось — загруженное не нужно
        await unlink([path, posterPath], token);
        throw e;
      }
    },
    async remove(id) {
      const token = await window.Accounts?.token();
      if (!token) throw new Error(ERRORS.not_signed_in);
      const r = await rpc('delete_background', { p_id: id });
      if (!r) throw new Error(ERRORS.not_yours);
      await unlink([r.file, r.poster], token);
    },
    async like(id) {
      const r = await rpc('bg_like', { p_id: id, p_key: browserKey });
      r.liked ? bgLiked.add(id) : bgLiked.delete(id); remember(bgLiked, 'gs.bg.liked');
      return r;
    },
    async hit(id) { try { await rpc('bg_hit', { p_id: id }); } catch { /* счётчик */ } },
    async report(id) {
      if (bgReported.has(id)) return;
      await rpc('bg_report', { p_id: id, p_key: browserKey });
      bgReported.add(id); remember(bgReported, 'gs.bg.reported');
    },
    isLiked: id => bgLiked.has(id),
    isReported: id => bgReported.has(id),
    isMine: b => !!b.user_id && b.user_id === window.Accounts?.user()?.id,
  };

  // ---------- модерация (только админы: права проверяет база) ----------
  const admin = {
    // всё, на что жаловались, и всё скрытое: сначала скрытое, потом по числу жалоб
    async queue() {
      const q = '&or=(reports.gt.0,hidden.is.true)&order=hidden.desc,reports.desc,created_at.desc&limit=100';
      const [g, b] = await Promise.all([
        tolerant(() => rest(`/grids?select=${cols()},reports,hidden${q}`)),
        rest(`/backgrounds?select=${BG_COLS},reports,hidden${q}`).catch(() => ({ data: [] })),
      ]);
      return { grids: g.data, backgrounds: b.data.map(withUrls) };
    },
    // kind: 'grid' | 'bg'; hidden: true — спрятать, false — вернуть в Мастерскую
    moderate: (kind, id, hidden) => rpc('admin_moderate', { p_kind: kind, p_id: id, p_hidden: !!hidden }),
    // фон на главной сайта: on — показывать, false — убрать
    feature: (id, on) => rpc('admin_feature', { p_id: id, p_on: !!on }).catch(e => {
      throw /admin_feature/.test(e.message) ? new Error('Сначала выполни свежий supabase/schema.sql — в базе ещё нет «На главную».') : e;
    }),
  };

  // теги: автор выбирает до 5 при публикации; «18+» — отдельная пометка
  const TAGS = {
    grid: ['Аниме', 'Милота', 'Рамки', 'С упором на героя', 'Мемы', 'Dead inside', 'Надписи', 'Игры'],
    bg: ['Аниме', 'Dota 2', 'Игры', 'Милота', 'Мемы', 'Dead inside', 'Природа', 'Космос', 'Абстракция'],
    aspects: ['16:9', '16:10', '21:9', '4:3'],
  };

  return {
    remote, rpc, list, get, config, thumb, byIds, publish, like, hit, report, remove, likedIds: () => [...liked],
    isMine: (id, userId) => mine.has(id) || (!!userId && userId === window.Accounts?.user()?.id), isLiked: id => liked.has(id), isReported: id => reported.has(id), mineCount: () => mine.size,
    author: () => load('gs.author', ''), setAuthor: a => save('gs.author', a),
    KINDS: { ascii: 'ASCII', mosaic: 'Мозаика', mixed: 'Смешанная' },
    TAGS, bg, admin,
    // 18+: размытые карточки открываются по клику; «мне есть 18» запоминается
    adult: () => load('gs.adult', false), setAdult: v => save('gs.adult', !!v),
  };
})();
