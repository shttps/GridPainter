'use strict';
/* Фон главного меню Dota 2: пак pak02_dir.vpk, собранный прямо в браузере — файл никуда не загружается.

   Как это работает в игре (меню от обновления в dota-menu/menu.json):
   • фон меню показывает DOTADashboardBackgroundManager из panorama/layout/dashboard.xml — ту разметку,
     что записана в его override-background (Valve ставит туда разметку текущего ивента);
   • Dota подключает все pak*_dir.vpk из game/dota_<язык озвучки>/ раньше своих файлов. Поэтому пак
     кладут в game/dota_russian/ (рядом pak01_dir.vpk — сама русская озвучка), а язык озвучки — русский;
   • в паке: dashboard.xml Valve, где override-background ведёт на нашу разметку, сама разметка
     с MoviePanel на весь экран и её стиль, и видео .webm (VP8/VP9 без звука: декодера Opus у Доты нет,
     а слишком большое видео даёт чёрное меню — держим до ~12 МБ).
   • Ещё по галочке — домашняя страница Valve без колонки новостей справа (#TodayPages), чтобы видео не закрывала.
   Правила, после которых Dota не падает с «Unable to load layout file»: в разметках и стилях только ASCII,
   а в наших новых разметках нет обработчиков событий (on…="…"). build() проверяет оба.

   Разметки и стили кладутся в «классическом» скомпилированном виде: ресурс Source 2 из двух блоков —
   REDI (сведения о сборке) и DATA (CRC32 и исходный текст). Формат — по ValveResourceFormat и
   developer.valvesoftware.com/wiki/VPK_(file_format), сверен байт в байт с файлами Valve.
   Видео пережимает Mediabunny (WebCodecs) — грузится с CDN, только когда собирают фон. */
window.DotaBG = (() => {
  const MEDIABUNNY = 'https://cdn.jsdelivr.net/npm/mediabunny@1.60.0/dist/bundles/mediabunny.min.mjs';
  const VIDEO = 'panorama/videos/gp_menu_bg.webm';
  const LAYOUT = 'panorama/layout/gp_menu_bg.vxml_c';
  const STYLE = 'panorama/styles/gp_menu_bg.vcss_c';
  // экран игрока → размер видео (Dota растягивает MoviePanel на весь экран, поэтому пропорции важны)
  const SCREENS = { '16:9': [1920, 1080], '16:10': [1920, 1200], '21:9': [2560, 1080], '4:3': [1440, 1080] };
  // секунды видео, цель и потолок размера, битрейт
  const LIMIT = { seconds: 30, target: 12e6, max: 14.5e6, bitrate: 4e6 };

  const enc = s => new TextEncoder().encode(s);
  const cat = parts => {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0; for (const p of parts) { out.set(p, at); at += p.length; }
    return out;
  };

  // ---------- CRC32 и MD5 ----------
  const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  function crc32(b) {
    let c = ~0;
    for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8);
    return ~c >>> 0;
  }
  const MD5_S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  const MD5_K = new Int32Array(64).map((_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32));
  function md5(bytes) {
    const n = bytes.length, size = Math.ceil((n + 9) / 64) * 64, buf = new Uint8Array(size);
    buf.set(bytes); buf[n] = 0x80;
    const v = new DataView(buf.buffer);
    v.setUint32(size - 8, (n * 8) >>> 0, true); v.setUint32(size - 4, Math.floor(n / 2 ** 29), true);
    const h = new Int32Array([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476]), M = new Int32Array(16);
    for (let off = 0; off < size; off += 64) {
      for (let i = 0; i < 16; i++) M[i] = v.getInt32(off + i * 4, true);
      let [a, b, c, d] = h;
      for (let i = 0; i < 64; i++) {
        const r = i >> 4;
        const f = r === 0 ? (b & c) | (~b & d) : r === 1 ? (d & b) | (~d & c) : r === 2 ? b ^ c ^ d : c ^ (b | ~d);
        const g = r === 0 ? i : r === 1 ? (5 * i + 1) & 15 : r === 2 ? (3 * i + 5) & 15 : (7 * i) & 15;
        const x = (a + f + MD5_K[i] + M[g]) | 0, s = MD5_S[r * 4 + (i & 3)];
        a = d; d = c; c = b; b = (b + ((x << s) | (x >>> (32 - s)))) | 0;
      }
      h[0] += a; h[1] += b; h[2] += c; h[3] += d;
    }
    return new Uint8Array(h.buffer.slice(0));
  }

  // ---------- ресурс Panorama (.vxml_c / .vcss_c) ----------
  const KINDS = {
    vxml_c: { ext: 'vxml', src: 'xml', compiler: 'Panorama Layout Compiler Version' },
    vcss_c: { ext: 'vcss', src: 'css', compiler: 'Panorama Style Compiler Version' },
  };
  // REDI — десять списков записей: заголовок (смещение, число) на каждый, дальше записи списка и сразу за ними
  // их строки. В записи строка — смещение от самого поля; `order` — в каком порядке строки записи лежат за записями.
  function editInfo(path, crc) {
    const K = KINDS[path.split('.').pop()], stem = path.replace(/\.[^./]+$/, '');
    const lists = [
      { rows: [[`${stem}.${K.ext}`, 'dota', 0, 1], [`${stem}.${K.src}`, 'dota', crc, 2]], order: [0, 1] }, // входные файлы
      null,
      { rows: [['___OverrideInputData___', 'BinaryBlobArg', 0, 0]], order: [0, 1] },                     // аргументы
      { rows: [[K.compiler, 'CompilePanorama', 1, 0]], order: [1, 0] },                                   // компилятор
      null, null, null,
      { rows: [['IsChildResource', 0]], order: [0], align: 8 },                                           // доп. числа
      null, null,
    ];
    const buf = new Uint8Array(1024 + path.length * 4), v = new DataView(buf.buffer);
    let at = lists.length * 8;
    lists.forEach((l, i) => {
      if (!l) return;
      const a = l.align || 4, w = l.rows[0].length * 4;
      at = Math.ceil(at / a) * a;
      const start = at;
      v.setUint32(i * 8, start - i * 8, true); v.setUint32(i * 8 + 4, l.rows.length, true);
      at += l.rows.length * w;
      l.rows.forEach((row, k) => {
        row.forEach((x, j) => { if (typeof x === 'number') v.setUint32(start + k * w + j * 4, x >>> 0, true); });
        for (const j of l.order) {
          const field = start + k * w + j * 4, s = enc(row[j]);
          v.setUint32(field, at - field, true); buf.set(s, at); at += s.length + 1;
        }
      });
    });
    return buf.slice(0, at);
  }
  // srcCrc — только для сверки с файлами Valve (у них CRC в REDI считан по исходнику до компиляции)
  function resource(path, text, srcCrc) {
    if (!KINDS[path.split('.').pop()]) throw new Error('Не ресурс Panorama: ' + path);
    const body = typeof text === 'string' ? enc(text) : text, crc = crc32(body);
    const redi = editInfo(path, srcCrc ?? crc);
    const rediAt = 40, dataAt = Math.ceil((rediAt + redi.length) / 16) * 16, size = dataAt + 6 + body.length;
    const out = new Uint8Array(size), v = new DataView(out.buffer);
    v.setUint32(0, size, true);
    v.setUint16(4, 12, true);   // версия заголовка
    v.setUint16(6, 3, true);    // версия ресурса
    v.setUint32(8, 8, true);    // таблица блоков — сразу за этим полем
    v.setUint32(12, 2, true);   // блоков два
    const block = (at, name, off, len) => { out.set(enc(name), at); v.setUint32(at + 4, off - (at + 4), true); v.setUint32(at + 8, len, true); };
    block(16, 'REDI', rediAt, redi.length);
    block(28, 'DATA', dataAt, 6 + body.length);
    out.set(redi, rediAt);
    v.setUint32(dataAt, crc, true); // u16 после CRC — число картинок, у нас 0
    out.set(body, dataAt + 6);
    return out;
  }

  // ---------- VPK v2: один _dir.vpk, данные сразу за деревом ----------
  function vpk(files) {
    const tree = new Map(); // расширение → папка → файлы: в таком порядке их пишет дерево
    for (const f of files) {
      const path = f.path.toLowerCase();
      if (!/^[a-z0-9_./-]+$/.test(path) || path.includes('..')) throw new Error('Плохой путь в паке: ' + f.path);
      const cut = path.lastIndexOf('/'), dir = cut < 0 ? ' ' : path.slice(0, cut), file = path.slice(cut + 1);
      const dot = file.lastIndexOf('.'), ext = dot < 0 ? ' ' : file.slice(dot + 1), name = dot < 0 ? file : file.slice(0, dot);
      if (!tree.has(ext)) tree.set(ext, new Map());
      const dirs = tree.get(ext);
      if (!dirs.has(dir)) dirs.set(dir, []);
      dirs.get(dir).push({ name, data: f.data });
    }
    const parts = [], blobs = [], zero = new Uint8Array(1), str = s => parts.push(enc(s), zero);
    let offset = 0;
    for (const [ext, dirs] of tree) {
      str(ext);
      for (const [dir, list] of dirs) {
        str(dir);
        for (const f of list) {
          str(f.name);
          const e = new Uint8Array(18), v = new DataView(e.buffer);
          v.setUint32(0, crc32(f.data), true);
          v.setUint16(4, 0, true);        // байт в самом дереве (preload) — нет
          v.setUint16(6, 0x7fff, true);   // архив: этот же файл, после дерева
          v.setUint32(8, offset, true);
          v.setUint32(12, f.data.length, true);
          v.setUint16(16, 0xffff, true);  // конец записи
          parts.push(e); blobs.push(f.data); offset += f.data.length;
        }
        parts.push(zero);
      }
      parts.push(zero);
    }
    parts.push(zero);
    const treeBytes = cat(parts), data = cat(blobs);
    const head = new Uint8Array(28), v = new DataView(head.buffer);
    v.setUint32(0, 0x55aa1234, true);
    v.setUint32(4, 2, true);
    v.setUint32(8, treeBytes.length, true);
    v.setUint32(12, data.length, true);
    v.setUint32(16, 0, true);    // MD5 архивов: архивов нет
    v.setUint32(20, 48, true);   // три MD5: дерева, раздела архивов и всего файла
    v.setUint32(24, 0, true);    // подписи нет
    const body = cat([head, treeBytes, data, md5(treeBytes), md5(new Uint8Array(0))]);
    return cat([body, md5(body)]);
  }

  // ---------- наши файлы и файлы Valve ----------
  const LAYOUT_XML = `<root>
	<styles>
		<include src="s2r://panorama/styles/dotastyles.vcss_c" />
		<include src="s2r://${STYLE}" />
	</styles>
	<Panel class="GpMenuBg" hittest="false">
		<MoviePanel id="GpMenuMovie" src="s2r://${VIDEO}" repeat="true" autoplay="onload" hittest="false" />
	</Panel>
</root>
`;
  const STYLE_CSS = `.GpMenuBg
{
	width: 100%;
	height: 100%;
	background-color: black;
}

#GpMenuMovie
{
	width: 100%;
	height: 100%;
}
`;
  let menuInfo = null;
  async function menuFile(name) {
    const r = await fetch('dota-menu/' + name, { cache: 'no-cache' });
    if (!r.ok) throw new Error('Не загрузились файлы меню Доты. Обнови страницу.');
    return r.text();
  }
  // дата обновления Доты, с которого взяты файлы меню
  async function info() {
    if (!menuInfo) menuInfo = menuFile('menu.json').then(JSON.parse).catch(() => ({}));
    return menuInfo;
  }
  function withOurBackground(dashboard) {
    const re = /(<DOTADashboardBackgroundManager\b[^>]*\boverride-background=")[^"]*(")/g;
    if ((dashboard.match(re) || []).length !== 1) throw new Error('Меню Доты изменилось — сборщик нужно обновить (update_menu.py).');
    return dashboard.replace(re, `$1s2r://${LAYOUT}$2`);
  }
  function withoutNews(home) {
    const re = /\n(\t*)<Panel id="TodayPages"[^>]*>[\s\S]*?\n\1<\/Panel>/;
    if (!re.test(home)) throw new Error('Главная Доты изменилась — убрать новости пока нельзя.');
    return home.replace(re, '');
  }
  function panorama(path, text, valve) {
    if (/[^\x00-\x7f]/.test(text)) throw new Error(`Не-ASCII в ${path}: Dota не загрузит меню.`);
    if (!valve && path.endsWith('.vxml_c') && /\son[a-z]+="/.test(text)) throw new Error(`Обработчик событий в ${path}: Dota не загрузит меню.`);
    return { path, data: resource(path, text) };
  }

  // ---------- видео ----------
  let mbLoad = null;
  const mediabunny = () => mbLoad || (mbLoad = import(MEDIABUNNY).catch(e => { mbLoad = null; throw new Error('Не загрузился кодировщик видео. Проверь интернет и попробуй ещё раз.'); }));
  async function pickCodec(MB, w, h) {
    for (const c of ['vp9', 'vp8']) if (await MB.canEncodeVideo(c, { width: w, height: h })) return c;
    throw new Error('Этот браузер не умеет кодировать WebM. Открой сайт в свежем Chrome, Edge или Firefox.');
  }
  // что за файл — по первым байтам, а не по имени
  async function sniff(blob) {
    const b = new Uint8Array(await blob.slice(0, 16).arrayBuffer()), s = String.fromCharCode(...b);
    if (s.startsWith('GIF8')) return 'gif';
    if (b[0] === 0x89 && s.slice(1, 4) === 'PNG' || b[0] === 0xff && b[1] === 0xd8 || s.startsWith('RIFF') && s.slice(8, 12) === 'WEBP') return 'image';
    if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 || s.slice(4, 8) === 'ftyp') return 'video';
    throw new Error('Не похоже на картинку или видео. Подходят PNG, JPEG, WebP, GIF, MP4 и WebM.');
  }
  // Кадр фона: как картинка ляжет на экран. fit — 'cover' (заполнить, края обрежутся) или 'contain' (целиком,
  // по бокам чёрное); blur 0…1 — размытие до 24 px на 1080 строк (одинаково на любом экране), dim 0…1 — чёрная
  // вуаль до 80 %. Размытую картинку чуть увеличиваем, чтобы размытие не тянуло чёрное с краёв.
  // paint(ctx, x, y, w, h) рисует исходник — картинку, кадр видео или VideoSample. Тем же рисуется превью сборщика.
  const LOOK = { blur: 24, dim: 0.8 };
  function drawFrame(ctx, paint, sw, sh, W, H, { fit = 'cover', blur = 0, dim = 0 } = {}) {
    const sigma = Math.min(1, Math.max(0, blur)) * LOOK.blur * H / 1080;
    const k = (fit === 'contain' ? Math.min(W / sw, H / sh) : Math.max(W / sw, H / sh) * (1 + 5 * sigma / H));
    const w = sw * k, h = sh * k;
    ctx.save();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (sigma > 0.3) ctx.filter = `blur(${sigma.toFixed(1)}px)`;
    paint(ctx, (W - w) / 2, (H - h) / 2, w, h);
    ctx.restore();
    if (dim > 0) { ctx.fillStyle = `rgba(0,0,0,${(Math.min(1, dim) * LOOK.dim).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
  }
  // fade > 0 — плавный повтор: Дота крутит ролик по кругу, и чтобы стык не дёргался, видео начинается с fade-й секунды
  // отрезка, а последние fade секунд на него постепенно накладывается начало отрезка. Последний кадр ролика тогда
  // совпадает с первым — круг замыкается без рывка. Начало берём вторым проходом по тому же файлу (VideoSampleSink).
  async function fromVideo(MB, blob, W, H, codec, look, from, onProgress, job, fade = 0) {
    const input = new MB.Input({ formats: MB.ALL_FORMATS, source: new MB.BlobSource(blob) });
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error('В файле нет видео.');
    const duration = await input.computeDuration() || LIMIT.seconds;
    const start = Math.max(0, Math.min(+from || 0, duration - 1)), end = Math.min(duration, start + LIMIT.seconds);
    const F = fade > 0 && end - start >= fade * 3 ? fade : 0;
    const fps = (await track.computePacketStats(90).catch(() => null))?.averagePacketRate || 30;
    let bitrate = Math.min(LIMIT.bitrate, LIMIT.target * 8 / Math.max(1, end - start));
    // каждый кадр рисуется заново — с кадрированием, размытием и затемнением, как в превью
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    let cv2 = null, ctx2 = null, head = null, headIt = null, base = null;
    const drawTo = (c, sample) => drawFrame(c, (x, ...a) => sample.draw(x, ...a), sample.displayWidth, sample.displayHeight, W, H, look);
    // кадр начала отрезка на нужной секунде: итератор идёт только вперёд, держим последний подходящий кадр
    const headAt = async t => {
      while (!head || head.timestamp + (head.duration || 0) / 2 < t) {
        const r = await headIt.next(); if (r.done) break;
        head?.close(); head = r.value;
      }
      return head;
    };
    const process = async sample => {
      drawTo(ctx, sample);
      if (!F) return cv;
      if (base === null) base = sample.timestamp;
      const u = sample.timestamp - base, tail = end - start - 2 * F;      // u — секунда выходного ролика
      if (u < tail) return cv;
      const h = await headAt(start + (u - tail));
      if (h) { drawTo(ctx2, h); ctx.globalAlpha = Math.min(1, (u - tail) / F); ctx.drawImage(cv2, 0, 0); ctx.globalAlpha = 1; }
      return cv;
    };
    const openHead = () => {
      if (!F) return;
      cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; ctx2 = cv2.getContext('2d');
      head?.close(); head = null; base = null;
      headIt = headSink.samples(start, start + F + 0.5);
    };
    let headSink = null;
    if (F) {
      const input2 = new MB.Input({ formats: MB.ALL_FORMATS, source: new MB.BlobSource(blob) });
      headSink = new MB.VideoSampleSink(await input2.getPrimaryVideoTrack());
    }
    // шум и зерно кодировщик ужимает хуже, чем обещает битрейт: перебор — собираем ещё раз, последний раз строго
    for (let attempt = 0; ; attempt++) {
      const output = new MB.Output({ format: new MB.WebMOutputFormat(), target: new MB.BufferTarget() });
      const conv = await MB.Conversion.init({
        input, output, audio: { discard: true }, trim: { start: start + F, end },
        video: { codec, process, processedWidth: W, processedHeight: H, forceTranscode: true, keyFrameInterval: 10, hardwareAcceleration: 'prefer-software',
          ...(fps > 31 ? { frameRate: 30 } : {}), quality: new MB.Quality({ bitrate: Math.round(bitrate), bitrateMode: attempt >= 2 ? 'constant' : 'variable' }) },
      });
      if (!conv.isValid) throw new Error('Браузер не смог прочитать это видео. Попробуй MP4 (H.264) или WebM.');
      openHead();
      job.cancel = () => conv.cancel();
      conv.onProgress = p => onProgress((attempt ? 0.85 : 0) + p * (attempt ? 0.15 : 1));
      await conv.execute();
      head?.close(); head = null; await headIt?.return?.(); headIt = null;
      const out = new Uint8Array(output.target.buffer);
      if (out.length <= LIMIT.max || attempt >= 2) return out;
      bitrate *= Math.min(0.7, (LIMIT.target / out.length) ** 2);
    }
  }
  // картинка — неподвижное видео: кадр в секунду, полминуты (одинаковые кадры почти ничего не весят);
  // GIF — его кадры с их длительностью, по кругу, пока не наберётся хотя бы 6 секунд
  async function fromImage(MB, blob, gif, W, H, codec, look, onProgress) {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const frames = [];
    if (gif && 'ImageDecoder' in window) {
      const dec = new ImageDecoder({ data: await blob.arrayBuffer(), type: 'image/gif' });
      await dec.tracks.ready;
      const count = dec.tracks.selectedTrack.frameCount;
      for (let i = 0; i < count; i++) {
        const { image } = await dec.decode({ frameIndex: i });
        frames.push({ bmp: await createImageBitmap(image), d: Math.max(0.02, (image.duration || 1e5) / 1e6) });
        image.close();
      }
      dec.close();
    } else {
      frames.push({ bmp: await createImageBitmap(blob), d: 1 });
    }
    const once = frames.reduce((s, f) => s + f.d, 0);
    const total = frames.length === 1 ? LIMIT.seconds : Math.min(LIMIT.seconds, once * Math.max(1, Math.ceil(6 / once)));
    const output = new MB.Output({ format: new MB.WebMOutputFormat(), target: new MB.BufferTarget() });
    const src = new MB.CanvasSource(cv, { codec, keyFrameInterval: 10, quality: new MB.Quality({ bitrate: frames.length === 1 ? 2e6 : LIMIT.bitrate }) });
    output.addVideoTrack(src, { frameRate: frames.length === 1 ? 1 : 30 });
    await output.start();
    for (let t = 0, k = 0; t < total - 1e-6; k++) {
      const f = frames[k % frames.length], d = Math.min(f.d, total - t);
      drawFrame(ctx, (c, x, y, w, h) => c.drawImage(f.bmp, x, y, w, h), f.bmp.width, f.bmp.height, W, H, look);
      await src.add(t, d);
      t += d; onProgress(t / total);
    }
    await output.finalize();
    frames.forEach(f => f.bmp.close());
    return new Uint8Array(output.target.buffer);
  }

  // blob — картинка, GIF или видео; screen — '16:9' | '16:10' | '21:9' | '4:3'; clean — убрать колонку новостей;
  // look — { fit, blur, dim } (см. drawFrame); start — с какой секунды видео брать отрезок до 30 с;
  // fade — секунды плавного повтора (0 — ролик просто начинается заново, см. fromVideo).
  // onProgress(0…1, подпись). Вернёт { blob: pak02_dir.vpk, video: байт видео }. job.cancel() — прервать.
  function build(blob, { screen = '16:9', clean = false, look = {}, start = 0, fade = 0, onProgress = () => {} } = {}) {
    const job = { cancel: () => {} };
    job.done = (async () => {
      const [W, H] = SCREENS[screen] || SCREENS['16:9'];
      const kind = await sniff(blob);
      onProgress(0, 'Загружаю кодировщик…');
      const [MB, dashboard, home] = await Promise.all([mediabunny(), menuFile('dashboard.xml'), clean ? menuFile('dashboard_page_home.xml') : null]);
      const codec = await pickCodec(MB, W, H);
      const step = p => onProgress(0.02 + p * 0.95, kind === 'video' ? 'Пережимаю видео…' : 'Собираю видео из картинки…');
      step(0);
      const video = kind === 'video' ? await fromVideo(MB, blob, W, H, codec, look, start, step, job, fade) : await fromImage(MB, blob, kind === 'gif', W, H, codec, look, step);
      onProgress(0.98, 'Собираю пак…');
      const files = [
        panorama('panorama/layout/dashboard.vxml_c', withOurBackground(dashboard), true),
        ...(clean ? [panorama('panorama/layout/dashboard_page_home.vxml_c', withoutNews(home), true)] : []),
        panorama(LAYOUT, LAYOUT_XML),
        panorama(STYLE, STYLE_CSS),
        { path: VIDEO, data: video },
      ];
      const out = new Blob([vpk(files)], { type: 'application/octet-stream' });
      onProgress(1, 'Готово');
      return { blob: out, video: video.length };
    })();
    return job;
  }
  // пропорции экрана этого компьютера — ближайшие из SCREENS
  function guessScreen() {
    const r = Math.max(screen.width, screen.height) / Math.min(screen.width, screen.height) || 16 / 9;
    return Object.entries(SCREENS).reduce((a, [k, [w, h]]) => Math.abs(w / h - r) < Math.abs(a[1] - r) ? [k, w / h] : a, ['16:9', 99])[0];
  }

  return { build, info, guessScreen, drawFrame, sniff, SCREENS: Object.keys(SCREENS), SIZES: SCREENS, LIMIT, _test: { crc32, md5, resource, vpk, withOurBackground, withoutNews } };
})();
