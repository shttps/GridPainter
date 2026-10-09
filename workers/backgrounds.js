/* Grid Studio — фоны Мастерской: Cloudflare Worker + R2.
   Как развернуть — README, раздел «Фоны: Cloudflare R2».

   Привязки (Settings → Bindings / Variables and Secrets):
     BG                    — R2-бакет с файлами фонов
     SUPABASE_URL          — https://<проект>.supabase.co
     SUPABASE_SECRET_KEY   — секретный ключ Supabase (sb_secret_… или старый service_role). Только как Secret!
     ALLOWED_ORIGINS       — откуда можно загружать, через запятую: https://shttps.github.io,http://localhost:5173

   Что умеет:
     GET    /f/<key>         — отдать файл (с Range — видео можно перематывать); ?dl=<имя> — скачать с этим именем
     POST   /upload          — загрузить фон: multipart (file, poster, meta) + Authorization: Bearer <токен входа Supabase>
     DELETE /bg/<id>         — удалить свой фон (запись в базе и файлы) — тоже с токеном входа
   Писать в базу браузер не может: publish_background / delete_background открыты только secret-ключу. */

const LIMITS = { image: 10 * 1024 * 1024, video: 30 * 1024 * 1024, poster: 700 * 1024 };
// тип файла узнаём по первым байтам, а не по тому, что прислал браузер: так под видом картинки не залить HTML
const SNIFF = [
  { kind: 'image', type: 'image/png', ext: 'png', test: b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { kind: 'image', type: 'image/jpeg', ext: 'jpg', test: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { kind: 'image', type: 'image/gif', ext: 'gif', test: b => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 },
  { kind: 'image', type: 'image/webp', ext: 'webp', test: b => str(b, 0, 4) === 'RIFF' && str(b, 8, 12) === 'WEBP' },
  { kind: 'video', type: 'video/webm', ext: 'webm', test: b => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
  { kind: 'video', type: 'video/mp4', ext: 'mp4', test: b => str(b, 4, 8) === 'ftyp' },
];
const str = (b, from, to) => String.fromCharCode(...b.subarray(from, to));
const sniff = bytes => SNIFF.find(t => t.test(bytes));

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      if (req.method === 'GET' || req.method === 'HEAD') {
        if (url.pathname.startsWith('/f/')) return await serve(req, env, decodeURIComponent(url.pathname.slice(3)), url.searchParams.get('dl'));
        return new Response('Grid Studio backgrounds', { headers: cors });
      }
      if (req.method === 'POST' && url.pathname === '/upload') return json(await upload(req, env, url), 200, cors);
      const del = url.pathname.match(/^\/bg\/([0-9a-f-]{36})$/i);
      if (req.method === 'DELETE' && del) return json(await remove(req, env, del[1]), 200, cors);
      return json({ error: 'not_found' }, 404, cors);
    } catch (e) {
      return json({ error: e.code || 'server_error', message: e.message }, e.status || 500, cors);
    }
  },
};

function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = !allowed.length || allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin || '*' : allowed[0],
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
const fail = (code, status = 400, message = code) => Object.assign(new Error(message), { code, status });

// ---------- отдача файлов ----------
async function serve(req, env, key, dl) {
  if (!/^bg\/[0-9a-f-]{36}(\.poster)?\.(png|jpg|gif|webp|webm|mp4)$/i.test(key)) return new Response('Not found', { status: 404 });
  const obj = await env.BG.get(key, { range: req.headers, onlyIf: req.headers });
  if (!obj) return new Response('Not found', { status: 404 });
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set('ETag', obj.httpEtag);
  h.set('Cache-Control', 'public, max-age=31536000, immutable');
  h.set('Accept-Ranges', 'bytes');
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  if (dl) h.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(dl.slice(0, 80))}`);
  if (!('body' in obj)) return new Response(null, { status: 304, headers: h });
  if (obj.range && req.headers.has('Range')) {
    const { offset = 0, length = obj.size - offset } = obj.range;
    h.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${obj.size}`);
    h.set('Content-Length', String(length));
    return new Response(req.method === 'HEAD' ? null : obj.body, { status: 206, headers: h });
  }
  h.set('Content-Length', String(obj.size));
  return new Response(req.method === 'HEAD' ? null : obj.body, { headers: h });
}

// ---------- Supabase ----------
function sbHeaders(env, extra = {}) {
  const key = env.SUPABASE_SECRET_KEY;
  // новые ключи sb_secret_… передаются только в apikey, старый service_role (JWT) — ещё и в Authorization
  return { apikey: key, ...(key.startsWith('sb_') ? {} : { Authorization: 'Bearer ' + key }), ...extra };
}
async function userOf(req, env) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw fail('not_signed_in', 401, 'Войди в профиль, чтобы выкладывать фоны.');
  const r = await fetch(env.SUPABASE_URL.replace(/\/+$/, '') + '/auth/v1/user', { headers: sbHeaders(env, { Authorization: 'Bearer ' + token }) });
  if (!r.ok) throw fail('not_signed_in', 401, 'Вход устарел — войди в профиль ещё раз.');
  const u = await r.json();
  if (!u?.id) throw fail('not_signed_in', 401);
  return u.id;
}
async function rpc(env, fn, args) {
  const r = await fetch(env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/' + fn, {
    method: 'POST', headers: sbHeaders(env, { 'Content-Type': 'application/json' }), body: JSON.stringify(args),
  });
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) {
    // свои ошибки база отдаёт кодом (rate_limit, bad_title…) — браузер переведёт их в понятный текст
    const msg = String(data?.message || r.statusText || 'db_error');
    throw fail(/^[a-z_]+$/.test(msg) ? msg : 'db_error', 400, msg);
  }
  return data;
}

// ---------- загрузка ----------
async function upload(req, env, url) {
  const user = await userOf(req, env);
  const form = await req.formData();
  const file = form.get('file'), poster = form.get('poster');
  let meta;
  try { meta = JSON.parse(form.get('meta') || '{}'); } catch { throw fail('bad_meta'); }
  if (!(file instanceof File) || !(poster instanceof File)) throw fail('bad_file', 400, 'Нужны файл фона и постер.');

  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const t = sniff(head);
  if (!t) throw fail('bad_file', 400, 'Подходят PNG, JPEG, WebP, GIF, MP4 и WebM.');
  if (file.size > LIMITS[t.kind]) throw fail('too_big', 400, t.kind === 'video' ? 'Видео — до 30 МБ.' : 'Картинка — до 10 МБ.');
  const ph = sniff(new Uint8Array(await poster.slice(0, 16).arrayBuffer()));
  if (!ph || ph.kind !== 'image' || poster.size > LIMITS.poster) throw fail('bad_file', 400, 'Постер не подошёл.');

  const id = crypto.randomUUID();
  const fileKey = `bg/${id}.${t.ext}`, posterKey = `bg/${id}.poster.${ph.ext}`;
  const base = url.origin + '/f/';
  await env.BG.put(fileKey, file.stream(), { httpMetadata: { contentType: t.type } });
  await env.BG.put(posterKey, poster.stream(), { httpMetadata: { contentType: ph.type } });
  try {
    const bgId = await rpc(env, 'publish_background', {
      p_user: user, p_title: String(meta.title || '').slice(0, 60), p_tags: Array.isArray(meta.tags) ? meta.tags.slice(0, 5).map(String) : [],
      p_nsfw: !!meta.nsfw, p_kind: t.kind, p_aspect: String(meta.aspect || 'other'),
      p_width: meta.width | 0, p_height: meta.height | 0, p_duration: Math.max(0, +meta.duration || 0), p_size: file.size,
      p_file: base + fileKey, p_poster: base + posterKey,
    });
    return { id: bgId };
  } catch (e) {
    // в базу не попало — файлы не нужны
    await env.BG.delete([fileKey, posterKey]);
    throw e;
  }
}

// ---------- удаление ----------
async function remove(req, env, id) {
  const user = await userOf(req, env);
  const r = await rpc(env, 'delete_background', { p_id: id, p_user: user });
  if (!r) throw fail('not_yours', 403, 'Удалить можно только свой фон.');
  const keys = [r.file, r.poster].map(u => { try { return decodeURIComponent(new URL(u).pathname.replace(/^\/f\//, '')); } catch { return null; } }).filter(Boolean);
  if (keys.length) await env.BG.delete(keys);
  return { ok: true };
}
