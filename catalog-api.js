'use strict';
/* Каталог сеток: Supabase REST (PostgREST) без SDK.
   Читать можно всем, а публикация, лайки, скачивания, жалобы и удаление идут через функции из supabase/schema.sql.
   У каждого браузера свой случайный ключ: им подписываются лайки и им же можно удалить свою сетку.
   Если Supabase не настроен (config.js), всё то же самое работает локально в localStorage — «демо-режим». */
window.CatalogAPI = (() => {
  const cfg = window.GRID_CATALOG || {};
  const remote = !!(cfg.url && cfg.key);
  const base = remote ? cfg.url.replace(/\/+$/, '') + '/rest/v1' : '';
  const LIST_COLS = 'id,title,author,description,thumb,kind,cats,heroes,likes,downloads,created_at';

  const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));

  const browserKey = (() => { let k = load('gs.key', null); if (!k) { k = uuid(); save('gs.key', k); } return k; })();
  const mine = new Set(load('gs.mine', []));
  const liked = new Set(load('gs.liked', []));
  const reported = new Set(load('gs.reported', []));
  const remember = (set, key) => save(key, [...set]);

  const ERRORS = {
    rate_limit: 'Слишком часто. Подожди пару минут и попробуй снова.',
    bad_title: 'Название — от 1 до 60 символов.',
    bad_author: 'Ник — до 32 символов.',
    bad_description: 'Описание — до 500 символов.',
    bad_config: 'Сетка пустая или повреждена.',
    too_big: 'Сетка слишком большая для каталога.',
    bad_thumb: 'Не удалось сохранить превью.',
  };
  function niceError(msg) {
    for (const k in ERRORS) if (String(msg).includes(k)) return ERRORS[k];
    return msg;
  }

  async function rest(path, { method = 'GET', body, count = false } = {}) {
    // новые ключи sb_publishable_… — не JWT, их передают только в apikey; старый anon key — ещё и в Authorization
    const headers = { apikey: cfg.key };
    if (!cfg.key.startsWith('sb_')) headers.Authorization = 'Bearer ' + cfg.key;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (count) headers.Prefer = 'count=exact';
    let res;
    try { res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch { throw new Error('Нет связи с каталогом. Проверь интернет.'); }
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(niceError(data?.message || data?.hint || res.statusText));
    const range = res.headers.get('Content-Range');
    return { data, total: range ? +range.split('/')[1] || 0 : undefined };
  }
  const rpc = (fn, args) => rest('/rpc/' + fn, { method: 'POST', body: args }).then(r => r.data);

  // ---------- демо-режим: то же самое в localStorage ----------
  const LOCAL = 'gs.catalog.local';
  const localAll = () => load(LOCAL, []);
  function localSave(list) {
    if (!save(LOCAL, list)) throw new Error('В браузере закончилось место для демо-каталога. Удали пару своих сеток.');
  }
  const pick = g => { const o = {}; for (const k of LIST_COLS.split(',')) o[k] = g[k]; return o; };

  // ---------- общий интерфейс ----------
  const clean = q => String(q || '').replace(/[,()*%\\"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

  async function list({ q = '', kind = 'all', sort = 'new', offset = 0, limit = 24, onlyMine = false } = {}) {
    q = clean(q);
    if (!remote) {
      let all = localAll().filter(g => !g.hidden);
      if (onlyMine) all = all.filter(g => mine.has(g.id));
      if (kind !== 'all') all = all.filter(g => g.kind === kind);
      if (q) { const s = q.toLowerCase(); all = all.filter(g => g.title.toLowerCase().includes(s) || g.author.toLowerCase().includes(s)); }
      const by = sort === 'top' ? 'likes' : sort === 'downloads' ? 'downloads' : null;
      all.sort((a, b) => (by ? b[by] - a[by] : 0) || b.created_at.localeCompare(a.created_at));
      return { items: all.slice(offset, offset + limit).map(pick), total: all.length };
    }
    const p = new URLSearchParams({ select: LIST_COLS });
    if (kind !== 'all') p.set('kind', 'eq.' + kind);
    if (q) p.set('or', `(title.ilike.*${q}*,author.ilike.*${q}*)`);
    if (onlyMine) { if (!mine.size) return { items: [], total: 0 }; p.set('id', `in.(${[...mine].join(',')})`); }
    p.set('order', sort === 'top' ? 'likes.desc,created_at.desc' : sort === 'downloads' ? 'downloads.desc,created_at.desc' : 'created_at.desc');
    p.set('offset', offset); p.set('limit', limit);
    const r = await rest('/grids?' + p, { count: true });
    return { items: r.data, total: r.total ?? r.data.length };
  }

  async function get(id) {
    if (!remote) {
      const g = localAll().find(x => x.id === id && !x.hidden);
      if (!g) throw new Error('Сетка не найдена — возможно, её удалили.');
      return g;
    }
    const r = await rest(`/grids?select=${LIST_COLS},config&id=eq.${encodeURIComponent(id)}`);
    if (!r.data?.length) throw new Error('Сетка не найдена — возможно, её удалили.');
    return r.data[0];
  }

  async function publish({ title, author, description, config, thumb }) {
    const st = window.GridRender.stats(config.categories);
    let id;
    if (!remote) {
      title = String(title).trim(); author = String(author || '').trim() || 'Аноним';
      if (!title || title.length > 60) throw new Error(ERRORS.bad_title);
      id = uuid();
      const list = localAll();
      list.unshift({ id, title, author, description: String(description || '').trim(), thumb, kind: st.kind, cats: st.cats, heroes: st.ids,
        likes: 0, downloads: 0, created_at: new Date().toISOString(), config: { config_name: title, categories: config.categories } });
      localSave(list);
    } else {
      id = await rpc('publish_grid', { p_title: title, p_author: author, p_description: description, p_config: config, p_thumb: thumb, p_key: browserKey });
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
    else if (!await rpc('grid_delete', { p_id: id, p_key: browserKey })) throw new Error('Удалить можно только свою сетку и только из того браузера, где её выложили.');
    mine.delete(id); remember(mine, 'gs.mine');
  }

  return {
    remote, list, get, publish, like, hit, report, remove,
    isMine: id => mine.has(id), isLiked: id => liked.has(id), isReported: id => reported.has(id), mineCount: () => mine.size,
    author: () => load('gs.author', ''), setAuthor: a => save('gs.author', a),
    KINDS: { ascii: 'ASCII', mosaic: 'Мозаика', mixed: 'Смешанная' },
  };
})();
