'use strict';
/* Аккаунты: вход через Supabase Auth (без SDK), профиль и «Мои работы».
   Сессия (access/refresh token) лежит в localStorage и обновляется сама, когда токен истекает.
   Вход по ссылке из письма и через Discord/GitHub возвращает на сайт с токенами в #хеше —
   их подхватывает этот файл при загрузке любой страницы.
   Выключено, пока в config.js не стоит accounts: true (нужна настройка Supabase, см. README). */
window.Accounts = (() => {
  const cfg = window.GRID_CATALOG || {};
  const enabled = !!(cfg.url && cfg.key && cfg.accounts);
  const base = enabled ? cfg.url.replace(/\/+$/, '') : '';
  const providers = Object.entries(cfg.providers || {}).filter(([, on]) => on).map(([p]) => p);

  const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const save = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  let session = enabled ? load('gs.session', null) : null;  // { access_token, refresh_token, expires_at, user: { id, email } }
  let profile = enabled ? load('gs.profile', null) : null;  // { id, nick, avatar }
  let admin = enabled && !!session && load('gs.admin', false);  // есть в таблице admins (см. конец schema.sql)
  let lastError = '';
  const listeners = new Set();
  const emit = () => { for (const f of listeners) try { f(); } catch (e) { console.error(e); } };
  const setSession = s => { session = s; save('gs.session', s); if (!s) { profile = null; admin = false; save('gs.profile', null); save('gs.admin', null); } emit(); };

  const ERRORS = {
    over_email_send_rate_limit: 'Слишком много писем подряд. Подожди минуту и попробуй снова.',
    email_address_invalid: 'Похоже, в адресе почты опечатка.',
    otp_expired: 'Ссылка или код устарели. Запроси новое письмо.',
    validation_failed: 'Проверь адрес почты.',
    provider_disabled: 'Этот способ входа ещё не включён.',
    not_admin: 'Это может только админ.',
    too_many_projects: 'В профиле уже 200 работ — удали старые, чтобы сохранить новую.',
    projects_size: 'Работа слишком большая для сохранения в профиль.',
    profiles_nick: 'Ник — до 32 символов.',
    profiles_avatar: 'Картинка для аватара слишком большая — выбери другую.',
    profiles_bio: '«О себе» — до 200 символов.',
    profiles_steam: 'Ссылка на Steam должна начинаться с https://steamcommunity.com/',
    profiles_banner: 'Баннер должен быть загружен через сайт.',
    profiles_tg: 'Ник в Telegram — 5–32 символа: латиница, цифры и _, начинается с буквы.',
    JWT: 'Сессия истекла — войди ещё раз.',
  };
  const nice = (msg, code) => {
    for (const k in ERRORS) if (String(code).includes(k) || String(msg).includes(k)) return ERRORS[k];
    return msg || 'Что-то пошло не так. Попробуй ещё раз.';
  };

  async function call(path, { method = 'GET', body, token, headers = {} } = {}) {
    const h = { apikey: cfg.key, ...headers };
    if (token) h.Authorization = 'Bearer ' + token;
    if (body !== undefined) h['Content-Type'] = 'application/json';
    let res;
    try { res = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch { throw new Error('Нет связи с сервером. Проверь интернет.'); }
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      if (res.status === 401 && token) { setSession(null); throw new Error(ERRORS.JWT); }
      const e = new Error(nice(data?.msg || data?.message || data?.error_description || data?.error || res.statusText, data?.error_code || data?.code));
      e.status = res.status; throw e;
    }
    return data;
  }

  // ---------- возврат со ссылки из письма или от Discord/GitHub ----------
  {
    const h = enabled && location.hash.length > 1 ? new URLSearchParams(location.hash.slice(1)) : null;
    if (h && (h.has('access_token') || h.has('error_description'))) {
      if (h.get('access_token')) {
        const now = Math.floor(Date.now() / 1000);
        session = { access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_at: +h.get('expires_at') || now + (+h.get('expires_in') || 3600), user: null };
        save('gs.session', session);
      } else lastError = nice(h.get('error_description'), h.get('error_code'));
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  // свежий access token (обновляется за минуту до конца), null — если не вошли
  let refreshing = null;
  async function token() {
    if (!session) return null;
    if (session.expires_at - 60 > Date.now() / 1000) return session.access_token;
    refreshing ||= call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token } })
      .then(r => { setSession({ access_token: r.access_token, refresh_token: r.refresh_token, expires_at: r.expires_at || Math.floor(Date.now() / 1000) + r.expires_in, user: pickUser(r.user) || session?.user }); })
      .catch(() => setSession(null))
      .finally(() => { refreshing = null; });
    await refreshing;
    return session?.access_token || null;
  }
  const pickUser = u => u && { id: u.id, email: u.email || '', meta: { name: u.user_metadata?.custom_claims?.global_name || u.user_metadata?.full_name || u.user_metadata?.user_name || '', avatar: u.user_metadata?.avatar_url || '' } };
  const rest = async (path, opts = {}) => call('/rest/v1' + path, { ...opts, token: await token() });

  // ---------- вход и выход ----------
  // redirect — куда вернуться после входа (адрес должен быть разрешён в Supabase → Auth → URL Configuration)
  const sendLink = (email, redirect) => call('/auth/v1/otp?redirect_to=' + encodeURIComponent(redirect), { method: 'POST', body: { email: String(email).trim(), create_user: true } });
  async function verifyCode(email, code) {
    const r = await call('/auth/v1/verify', { method: 'POST', body: { type: 'email', email: String(email).trim(), token: String(code).replace(/\D/g, '') } });
    setSession({ access_token: r.access_token, refresh_token: r.refresh_token, expires_at: r.expires_at || Math.floor(Date.now() / 1000) + r.expires_in, user: pickUser(r.user) });
    await ready();
  }
  const oauth = (provider, redirect) => { location.href = `${base}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirect)}`; };
  async function signOut() {
    const t = session?.access_token;
    setSession(null);
    if (t) call('/auth/v1/logout', { method: 'POST', token: t }).catch(() => {});
  }

  // ---------- профиль ----------
  // bio и steam появляются после обновления базы (SQL из README); до этого профиль работает без них.
  // Не запоминаем «колонок нет» навсегда: иначе после обновления базы у старых посетителей
  // так и не появлялись «о себе», Steam и загрузка своей аватарки
  let ext = true, bext = true, text = true;   // bext — колонка banner и бакет profiles (2.4), text — колонка tg (2.5)
  try { localStorage.removeItem('gs.profileExt'); } catch {}
  const pcols = () => 'id,nick,avatar,created_at' + (ext ? ',bio,steam' : '') + (bext ? ',banner' : '') + (text ? ',tg' : '');
  async function prest(path, opts) {
    for (let i = 0; ; i++) {
      try { return await rest(path.replace('{cols}', pcols()), opts); }
      catch (e) {
        if (i < 3 && text && /(^|\W)tg(\W|$)/.test(e.message)) { text = false; continue; }
        if (i < 3 && bext && /banner/.test(e.message)) { bext = false; continue; }
        if (i < 3 && ext && /bio|steam/.test(e.message)) { ext = false; continue; }
        throw e;
      }
    }
  }
  // админ ли аккаунт; таблицы admins ещё нет (не выполнен свежий schema.sql) — значит, нет
  const isAdminId = async id => { try { return !!(await rest(`/admins?select=user_id&user_id=eq.${encodeURIComponent(id)}`)).length; } catch { return false; } };
  async function loadProfile() {
    const u = session?.user; if (!u) return null;
    let p = (await prest(`/profiles?select={cols}&id=eq.${u.id}`))[0];
    // профиль создаёт триггер при регистрации; если его нет (аккаунт старше таблицы) — создаём сами
    if (!p) p = (await prest('/profiles?select={cols}', { method: 'POST', headers: { Prefer: 'return=representation' },
      body: { id: u.id, nick: (u.meta.name || 'Игрок ' + u.id.replace(/-/g, '').slice(0, 4).toUpperCase()).slice(0, 32), avatar: /^https:\/\//.test(u.meta.avatar) ? u.meta.avatar.slice(0, 500) : '' } }))[0];
    admin = await isAdminId(u.id); save('gs.admin', admin);
    profile = p; save('gs.profile', p); emit();
    return p;
  }
  async function updateProfile(fields) {
    const p = (await prest(`/profiles?id=eq.${session.user.id}&select={cols}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: fields }))[0];
    profile = p; save('gs.profile', p); emit();
    // сменили аватар или баннер — старый файл из бакета больше не нужен
    if ('avatar' in fields || 'banner' in fields) tidyMedia();
    return p;
  }

  // ---------- файлы профиля: GIF-аватар и баннер (Storage, бакет profiles) ----------
  // у каждого своя папка <id аккаунта>/; в ней живут только текущие аватар и баннер, остальное стираем
  const store = base + '/storage/v1/object', PUB = store + '/public/profiles/';
  const MEDIA_EXT = { 'image/gif': 'gif', 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
  const inBucket = url => typeof url === 'string' && url.startsWith(PUB) ? decodeURIComponent(url.slice(PUB.length)) : null;
  const storeHeaders = async () => ({ apikey: cfg.key, Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json' });
  async function unlinkMedia(paths) {
    paths = paths.filter(Boolean); if (!paths.length) return;
    await fetch(store + '/profiles', { method: 'DELETE', headers: await storeHeaders(), body: JSON.stringify({ prefixes: paths }) }).catch(() => {});
  }
  async function tidyMedia() {
    const uid = session?.user?.id; if (!uid) return;
    try {
      const r = await fetch(store + '/list/profiles', { method: 'POST', headers: await storeHeaders(), body: JSON.stringify({ prefix: uid + '/', limit: 100 }) });
      if (!r.ok) return;
      const keep = new Set([inBucket(profile?.avatar), inBucket(profile?.banner)]);
      await unlinkMedia((await r.json()).map(f => `${uid}/${f.name}`).filter(f => !keep.has(f)));
    } catch { /* уборка — не повод ломать профиль */ }
  }
  // kind: 'avatar' | 'banner'; blob — готовый файл (GIF как есть, картинка уже пережата), null — убрать
  async function setMedia(kind, blob) {
    if (!blob) return updateProfile({ [kind]: '' });
    const uid = session?.user?.id, t = await token();
    if (!uid || !t) throw new Error(ERRORS.JWT);
    const ext = MEDIA_EXT[blob.type]; if (!ext) throw new Error('Подойдут PNG, JPEG, WebP и GIF.');
    const path = `${uid}/${kind}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`;
    let res;
    try { res = await fetch(`${store}/profiles/${path}`, { method: 'POST', headers: { apikey: cfg.key, Authorization: 'Bearer ' + t, 'Content-Type': blob.type, 'Cache-Control': 'max-age=31536000' }, body: blob }); }
    catch { throw new Error('Нет связи с сервером. Проверь интернет.'); }
    if (!res.ok) {
      const d = await res.json().catch(() => ({})), m = String(d.message || d.error || '');
      throw new Error(res.status === 413 || /size|large/i.test(m) ? 'Файл слишком большой: GIF-аватар — до 2 МБ, баннер — до 5 МБ.'
        : /bucket/i.test(m) ? 'Хранилище профилей ещё не настроено — нужен свежий schema.sql.'
        : /security|policy/i.test(m) ? 'Не получилось сохранить файл — попробуй ещё раз через минуту.' : m || 'Не удалось загрузить файл.');
    }
    try { return await updateProfile({ [kind]: PUB + path }); }
    catch (e) { tidyMedia(); throw e; }
  }
  // админ: убрать чужой аватар или баннер (и стереть файл, если он в бакете)
  async function adminClear(uid, kind) {
    const old = await rest('/rpc/admin_clear_media', { method: 'POST', body: { p_user: uid, p_what: kind } });
    await unlinkMedia([inBucket(old)]);
  }
  async function getProfile(id) {
    const [p, adm] = await Promise.all([prest(`/profiles?select={cols}&id=eq.${encodeURIComponent(id)}`), isAdminId(id)]);
    return p[0] ? { ...p[0], admin: adm } : null;
  }
  // ник и аватар авторов для карточек Мастерской: одним запросом на пачку, с кэшем на страницу
  const people = new Map();
  async function authors(ids) {
    const need = [...new Set(ids)].filter(id => /^[0-9a-f-]{36}$/i.test(id) && !people.has(id)).slice(0, 100);
    if (need.length) {
      const req = rest(`/profiles?select=id,nick,avatar&id=in.(${need.join(',')})`)
        .then(rows => { const m = new Map(rows.map(r => [r.id, r])); return id => m.get(id) || null; })
        .catch(() => () => null);
      for (const id of need) people.set(id, req.then(get => get(id)));
    }
    const out = new Map();
    await Promise.all(ids.map(async id => { const p = await people.get(id); if (p) out.set(id, p); }));
    return out;
  }

  // ---------- мои работы (приватные) ----------
  const PROJECT_COLS = 'id,title,thumb,cats,grid_id,created_at,updated_at';
  const projects = {
    list: () => rest(`/projects?select=${PROJECT_COLS}&order=updated_at.desc`),
    get: async id => { const r = (await rest(`/projects?select=${PROJECT_COLS},data&id=eq.${encodeURIComponent(id)}`))[0]; if (!r) throw new Error('Работа не найдена — возможно, её удалили.'); return r; },
    // id есть — обновляем эту работу, нет — создаём новую
    async save({ id, ...fields }) {
      const opts = { headers: { Prefer: 'return=representation' }, body: fields };
      const r = id ? await rest(`/projects?id=eq.${encodeURIComponent(id)}&select=${PROJECT_COLS}`, { ...opts, method: 'PATCH' })
        : await rest('/projects?select=' + PROJECT_COLS, { ...opts, method: 'POST' });
      if (!r?.[0]) throw new Error('Работа не найдена — возможно, её удалили из профиля.');
      return r[0];
    },
    remove: id => rest(`/projects?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }),
  };
  // опубликованные сетки автора (Мастерская видна всем); превью рисуется живьём, поэтому thumb не нужен.
  // tags/nsfw появляются после свежего schema.sql — без них просто без тегов
  const GRID_COLS = 'id,title,author,description,kind,cats,heroes,likes,downloads,created_at,user_id';
  const userGrids = async uid => {
    const q = c => rest(`/grids?select=${c}&user_id=eq.${encodeURIComponent(uid)}&hidden=is.false&order=created_at.desc`);
    try { return await q(GRID_COLS + ',tags,nsfw'); } catch (e) { if (!/tags|nsfw/.test(e.message)) throw e; return q(GRID_COLS); }
  };

  // при загрузке: подтянуть пользователя и профиль (после входа по ссылке user ещё пустой)
  let readyP = null;
  function ready() {
    if (!enabled || !session) return Promise.resolve(null);
    readyP ||= (async () => {
      try {
        if (!session.user) { const u = await call('/auth/v1/user', { token: await token() }); session = { ...session, user: pickUser(u) }; save('gs.session', session); }
        await loadProfile();
      } catch (e) { if (!session) lastError = e.message; }
      finally { readyP = null; emit(); }
      return profile;
    })();
    return readyP;
  }

  return {
    enabled, providers,
    signedIn: () => !!session?.user, user: () => session?.user || null, profile: () => profile, isAdmin: () => !!session && admin,
    error: () => { const e = lastError; lastError = ''; return e; },
    onChange: f => { listeners.add(f); return () => listeners.delete(f); },
    ready, token, sendLink, verifyCode, oauth, signOut, loadProfile, updateProfile, getProfile, authors, projects, userGrids,
    setMedia, adminClear,
    ext: () => ext, media: () => bext, tg: () => text,
  };
})();
