'use strict';
/* GridPainter — редактор сетки героев Dota 2.
   Элемент холста = одна категория в hero_grid_config.json:
     hero  — категория с героями (прямоугольник x/y/w/h + hero_ids)
     text  — текст в названии пустой категории (width = height = 0)
     glyph — то же, что text, но один символ: «пиксель» ASCII/line-art рисунков */

const $ = s => document.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r6 = v => Math.round(v * 1e6) / 1e6;
const { CARD_W, CARD_H, PAD } = Convert;
const CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/';
const BRAILLE_BLANK = '⠀';

// ---------- иконки ----------
const ICONS = {
  cursor: 'M5 3l14 8-6.5 1.8L9.7 19z',
  hand: 'M8 12V5.5a1.5 1.5 0 013 0V11m0-6.5V4a1.5 1.5 0 013 0v7m0-5.5a1.5 1.5 0 013 0V14a6 6 0 01-6 6h-1.2a6 6 0 01-4.9-2.6L4 14.6a1.5 1.5 0 012.4-1.8L8 14.5',
  pencil: 'M4 20l4.2-1L19 8.2 15.8 5 5 15.8zM13.5 7.3l3.2 3.2',
  line: 'M5 19L19 5',
  hv: 'M4 12h16M12 4v16',
  rect: 'M4.5 5.5h15v13h-15z',
  ellipse: 'M12 5.5c4.4 0 8 2.9 8 6.5s-3.6 6.5-8 6.5-8-2.9-8-6.5 3.6-6.5 8-6.5z',
  rhombus: 'M12 3.5l8 8.5-8 8.5-8-8.5z',
  triangle: 'M12 4.5l8.5 15h-17z',
  eraser: 'M15.5 4l4.5 4.5-9.5 9.5H6.5L4 15.5zM9 20h11M11 8.5l4.5 4.5',
  text: 'M5 7V5h14v2M12 5v14M9 19h6',
  heroes: 'M4 4.5h4.5v7H4zM9.75 4.5h4.5v7h-4.5zM15.5 4.5H20v7h-4.5zM4 13h4.5v7H4zM9.75 13h4.5v7h-4.5z',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11',
  redo: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 000 11H13',
  image: 'M4 5h16v14H4zM4 16l4.5-4.5 4 4 2.5-2.5L20 18M15.5 9.5h.01',
  folder: 'M3.5 6.5h6l2 2h9v10h-17z',
  download: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z',
  plus: 'M12 5v14M5 12h14',
  ascii: 'M5 7h1M9 7h1M13 7h1M5 12h1M17 12h1M9 17h1M13 17h1M17 7h1M9 12h1',
  lines: 'M7 4v2M7 9v2M7 14v2M7 19v1M12 4v16M17 4v2M17 9v2M17 14v2M17 19v1',
  rotl: 'M4 4v5h5M5 9a7.5 7.5 0 11-.5 5',
  rotr: 'M20 4v5h-5M19 9a7.5 7.5 0 10.5 5',
  fliph: 'M12 3v18M9 7l-5 5 5 5zM15 7l5 5-5 5z',
  flipv: 'M3 12h18M7 9l5-5 5 5zM7 15l5 5 5-5z',
  fill: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13',
  copy: 'M8.5 8.5h11v11h-11zM5 15.5V4.5h11',
  group: 'M4 4h7v7H4zM13 13h7v7h-7zM11 7.5h5.5V13',
  ungroup: 'M4 4h7v7H4zM13 13h7v7h-7z',
  dup: 'M8 8h12v12H8zM4 16V4h12M14 11v6M11 14h6',
  x: 'M6 6l12 12M18 6L6 18',
  save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6',
  font: 'M5 19L10.5 5h3L19 19M7.5 13.5h9',
};
const icon = n => `<svg class="i" viewBox="0 0 24 24"><path d="${ICONS[n] || ''}"/></svg>`;
function applyIcons(root = document) {
  for (const el of $$('[data-icon]', root)) {
    if (el.dataset.iconDone) continue;
    el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
    el.dataset.iconDone = 1;
  }
}

// ---------- герои ----------
const HEROES = window.HEROES.map(h => {
  const r = parseInt(h.c.slice(0, 2), 16), g = parseInt(h.c.slice(2, 4), 16), b = parseInt(h.c.slice(4, 6), 16);
  return { ...h, lab: Convert.rgbToLab(r, g, b), url: CDN + h.s + '.png' };
});
const HERO_IDX = new Map(HEROES.map((h, i) => [h.id, i]));
const heroImgs = new Map();
function heroImg(i) {
  let im = heroImgs.get(i);
  if (!im) { im = new Image(); im.onload = requestRender; im.src = HEROES[i].url; heroImgs.set(i, im); }
  return im;
}

// ---------- настройки и состояние ----------
const S = Object.assign({
  configName: 'Моя сетка',
  areaW: 1200, areaH: 600,
  fontSize: 16,
  glyphColor: '#f3efe6', textColor: '#e8e2d6',
  cellW: 10, cellH: 10,
  showGrid: true, snap: true,
}, load('gp2.settings', {}));

const st = {
  els: [], sel: new Set(), nextId: 1, nextGroup: 1,
  tool: 'select', pen: '•', customPen: '', fill: false,
  zoom: 1, panX: 0, panY: 0, preview: false,
  bg: { img: null, show: true, opacity: 0.55, dim: 0.35 },
  undo: [], redo: [],
  ghost: null, rect: null,
  gridFile: null,      // { name, data, handle } — открытый hero_grid_config.json для слияния
  userFont: false,
};

function load(key, def) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } }
function store(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch { return false; } }
let saveTimer = 0, saveWarned = false;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    store('gp2.settings', S);
    if (!store('gp2.els', st.els) && !saveWarned) { saveWarned = true; toast('Проект слишком большой для автосохранения в браузере — не забудь экспорт.', 'err'); }
  }, 600);
}

// ---------- шрифт и размеры ----------
const fontFamily = () => (st.userFont ? '"GPUserFont", ' : '') + '"Radiance", "Segoe UI", Arial, sans-serif';
const mctx = document.createElement('canvas').getContext('2d');
let mcache = new Map();
function measure(s) {
  let w = mcache.get(s);
  if (w === undefined) { mctx.font = `${S.fontSize}px ${fontFamily()}`; w = mctx.measureText(s).width; mcache.set(s, w); }
  return w;
}
function resetMeasure() { mcache = new Map(); }
function bounds(e) {
  if (e.t === 'hero') return { x: e.x, y: e.y, w: e.w, h: e.h };
  return { x: e.x, y: e.y, w: Math.max(2, measure(e.name)), h: S.fontSize };
}
function bboxOf(list) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const e of list) { const b = bounds(e); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
  return list.length ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}
const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const contains = (a, b) => b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h;
const normRect = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });

// Раскладка карточек: Дота берёт максимальный масштаб, при котором все герои влезают.
const layoutCache = new WeakMap();
function heroLayout(e) {
  const n = e.heroes.length, sig = n + ':' + e.w + ':' + e.h;
  const c = layoutCache.get(e);
  if (c && c.sig === sig) return c;
  let best = { s: 0, c: 1, sig };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const s = Math.min(e.w / (CARD_W * cols + PAD), e.h / (CARD_H * rows + PAD));
    if (s > best.s) best = { s, c: cols, sig };
  }
  layoutCache.set(e, best);
  return best;
}

// ---------- отрисовка ----------
const canvas = $('#canvas'), ctx = canvas.getContext('2d');
let renderQueued = false;
function requestRender() { if (!renderQueued) { renderQueued = true; requestAnimationFrame(() => { renderQueued = false; render(); }); } }

function drawCard(c, i, x, y, w, h) {
  const im = heroImg(i);
  if (im.complete && im.naturalWidth) {
    const sh = im.naturalHeight, sw = sh * CARD_W / CARD_H;
    c.drawImage(im, (im.naturalWidth - sw) / 2, 0, sw, sh, x, y, w, h);
  } else { c.fillStyle = '#' + HEROES[i].c; c.fillRect(x, y, w, h); }
}

// Цвета холста для светлой и тёмной темы. Превью всегда как в игре: светлым по тёмному.
const CANVAS_THEMES = {
  light: { bg: '#efeee9', dot: '#d2d0c8', sheet: '#ffffff', shadow: 'rgba(20,20,18,.08)', grid: 'rgba(20,20,18,.055)', border: 'rgba(20,20,18,.1)',
    label: '#9a988f', glyph: '#1b1b19', text: '#34332f', dash: '#141413', fade: '255,255,255', accent: '#ef5a36',
    box: 'rgba(239,90,54,.55)', boxFill: 'rgba(239,90,54,.045)', boxLabel: '#c8431f' },
  dark: { bg: '#121211', dot: '#2e2d2a', sheet: '#1a1a18', shadow: 'rgba(0,0,0,.55)', grid: 'rgba(255,255,255,.05)', border: 'rgba(255,255,255,.09)',
    label: '#6f6d66', glyph: '#ecebe5', text: '#cfcdc5', dash: '#f1f0eb', fade: '26,26,24', accent: '#ff6a45',
    box: 'rgba(255,106,69,.6)', boxFill: 'rgba(255,106,69,.06)', boxLabel: '#ff8d6d' },
};
let T = CANVAS_THEMES[document.documentElement.dataset.theme] || CANVAS_THEMES.light;
const INK = { get glyph() { return T.glyph; }, get text() { return T.text; }, get box() { return T.box; }, get boxFill() { return T.boxFill; }, get label() { return T.boxLabel; } };
function renderEls(c, list, o) {
  c.imageSmoothingQuality = 'high';
  for (const e of list) {
    if (e.t !== 'hero') continue;
    if (o.fade) c.globalAlpha = o.fade(e);
    if (o.editor) {
      c.fillStyle = INK.boxFill; c.fillRect(e.x, e.y, e.w, e.h);
      c.strokeStyle = INK.box; c.lineWidth = 1 / o.zoom; c.strokeRect(e.x, e.y, e.w, e.h);
    }
    const n = e.heroes.length;
    if (n) {
      const L = heroLayout(e), s = L.s;
      for (let k = 0; k < n; k++) {
        const i = HERO_IDX.get(e.heroes[k]);
        if (i === undefined) continue;
        drawCard(c, i, e.x + (PAD / 2 + (k % L.c) * CARD_W) * s, e.y + (PAD / 2 + Math.floor(k / L.c) * CARD_H) * s, CARD_W * s, CARD_H * s);
      }
    }
    if (o.editor && (e.name || !e.g)) {
      c.fillStyle = INK.label; c.font = `500 ${11 / o.zoom}px Geist, Inter, sans-serif`; c.textBaseline = 'bottom';
      c.fillText(`${e.name || 'Без названия'} (${n})`, e.x, e.y - 3 / o.zoom);
    }
  }
  c.font = `${S.fontSize}px ${fontFamily()}`; c.textBaseline = 'top';
  for (const e of list) {
    if (e.t === 'hero') continue;
    if (o.fade) c.globalAlpha = o.fade(e);
    c.fillStyle = o.editor ? (e.t === 'glyph' ? INK.glyph : INK.text) : (e.t === 'glyph' ? S.glyphColor : S.textColor);
    c.fillText(e.name, e.x, e.y);
  }
  c.globalAlpha = 1;
}

// Лист холста: белая бумага в редакторе, тёмная панель Доты в превью.
function drawArea(c, editor) {
  if (editor) { c.fillStyle = T.sheet; c.fillRect(0, 0, S.areaW, S.areaH); }
  else {
    const g = c.createLinearGradient(0, 0, 0, S.areaH);
    g.addColorStop(0, '#1b1813'); g.addColorStop(1, '#100e0b');
    c.fillStyle = g; c.fillRect(0, 0, S.areaW, S.areaH);
  }
  const bg = st.bg;
  if (bg.img && bg.show) {
    const f = Convert.fitRect(bg.img.naturalWidth, bg.img.naturalHeight, S.areaW, S.areaH);
    c.globalAlpha = bg.opacity; c.drawImage(bg.img, f.x, f.y, f.w, f.h); c.globalAlpha = 1;
    // «приглушение» уводит подложку в цвет листа, чтобы рисунок поверх читался
    if (bg.dim > 0) { c.fillStyle = editor ? `rgba(${T.fade},${bg.dim})` : `rgba(0,0,0,${bg.dim})`; c.fillRect(0, 0, S.areaW, S.areaH); }
  }
}

function render() {
  const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
  const z = st.zoom, editor = !st.preview;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = T.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);

  // точечная «бумага» вокруг листа — двигается вместе с холстом
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  let gap = 24; while (gap * z < 14) gap *= 2; while (gap * z > 40) gap /= 2;
  const sg = gap * z, ox = ((st.panX % sg) + sg) % sg, oy = ((st.panY % sg) + sg) % sg;
  ctx.fillStyle = T.dot;
  for (let y = oy; y < H; y += sg) for (let x = ox; x < W; x += sg) ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);

  // тень листа
  ctx.save();
  ctx.shadowColor = T.shadow; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
  ctx.fillStyle = editor ? T.sheet : '#100e0b';
  ctx.fillRect(st.panX, st.panY, S.areaW * z, S.areaH * z);
  ctx.restore();

  ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * st.panX, dpr * st.panY);
  drawArea(ctx, editor);

  if (editor && S.showGrid && S.cellW * z >= 6 && S.cellH * z >= 6) {
    ctx.strokeStyle = T.grid; ctx.lineWidth = 1 / z; ctx.beginPath();
    for (let x = S.cellW; x < S.areaW; x += S.cellW) { ctx.moveTo(x, 0); ctx.lineTo(x, S.areaH); }
    for (let y = S.cellH; y < S.areaH; y += S.cellH) { ctx.moveTo(0, y); ctx.lineTo(S.areaW, y); }
    ctx.stroke();
  }
  // только что добавленные элементы проявляются плавно
  let fade = null;
  if (st.fade) {
    const t = (performance.now() - st.fade.t0) / 360;
    if (t >= 1) st.fade = null;
    else { const a = 1 - (1 - t) ** 3, ids = st.fade.ids; fade = e => ids.has(e.id) ? a : 1; requestRender(); }
  }
  renderEls(ctx, st.els, { editor, zoom: z, fade });

  if (st.ghost) {
    ctx.globalAlpha = 0.7; ctx.fillStyle = T.accent;
    ctx.font = `${S.fontSize}px ${fontFamily()}`; ctx.textBaseline = 'top';
    const ch = currentPen(), w = measure(ch);
    for (const [cx, cy] of st.ghost) ctx.fillText(ch, cx * S.cellW + (S.cellW - w) / 2, cy * S.cellH + (S.cellH - S.fontSize) / 2);
    ctx.globalAlpha = 1;
  }

  // оверлеи в экранных координатах — чтобы линии были чёткими при любом зуме
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sx = x => x * z + st.panX, sy = y => y * z + st.panY;
  ctx.strokeStyle = T.border; ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(sx(0)) + .5, Math.round(sy(0)) + .5, Math.round(S.areaW * z), Math.round(S.areaH * z));
  // подпись листа, как в макете: «Холст · 1200 × 600»
  ctx.fillStyle = T.label; ctx.font = '11px "Geist Mono", Consolas, monospace'; ctx.textBaseline = 'bottom';
  ctx.fillText(`${st.preview ? 'Превью' : 'Холст'} · ${S.areaW} × ${S.areaH}`, Math.round(sx(0)), Math.round(sy(0)) - 8);
  if (editor && st.sel.size) {
    const list = selEls();
    ctx.strokeStyle = T.accent; ctx.lineWidth = 1;
    if (list.length <= 3000) for (const e of list) { const b = bounds(e); ctx.strokeRect(sx(b.x) + .5, sy(b.y) + .5, b.w * z, b.h * z); }
    const bb = bboxOf(list);
    if (list.length > 1) {
      ctx.setLineDash([4, 4]); ctx.strokeStyle = T.dash;
      ctx.strokeRect(Math.round(sx(bb.x)) - 4.5, Math.round(sy(bb.y)) - 4.5, bb.w * z + 9, bb.h * z + 9); ctx.setLineDash([]);
    }
    if (list.length === 1 && list[0].t === 'hero') {
      const e = list[0], hx = sx(e.x + e.w), hy = sy(e.y + e.h);
      ctx.fillStyle = T.sheet; ctx.strokeStyle = T.accent; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.rect(hx - 4.5, hy - 4.5, 9, 9); ctx.fill(); ctx.stroke();
    }
  }
  if (st.rect) {
    const r = st.rect;
    ctx.fillStyle = r.kind === 'erase' ? 'rgba(217,59,43,.07)' : 'rgba(239,90,54,.06)';
    ctx.strokeStyle = r.kind === 'erase' ? '#d93b2b' : '#ef5a36'; ctx.lineWidth = 1;
    ctx.fillRect(sx(r.x), sy(r.y), r.w * z, r.h * z);
    ctx.setLineDash(r.kind === 'hero' ? [] : [4, 3]); ctx.strokeRect(sx(r.x) + .5, sy(r.y) + .5, r.w * z, r.h * z); ctx.setLineDash([]);
  }
  updateChrome();
}

let lastCount = -1;
function updateChrome() {
  $('#zoomVal').textContent = Math.round(st.zoom * 100) + '%';
  const n = st.els.length, b = $('#catCount');
  b.textContent = n.toLocaleString('ru') + ' кат.';
  if (n !== lastCount) { b.classList.remove('bump'); void b.offsetWidth; if (lastCount >= 0) b.classList.add('bump'); lastCount = n; }
  b.classList.toggle('bad', n > 6000); b.classList.toggle('warn', n > 2500 && n <= 6000);
  // пустое состояние лежит прямо на листе
  const es = $('#emptyState');
  es.hidden = n > 0 || !!st.bg.img || st.preview;
  if (!es.hidden) Object.assign(es.style, { left: st.panX + 'px', top: st.panY + 'px', width: S.areaW * st.zoom + 'px', height: S.areaH * st.zoom + 'px' });
  $('#btnUndo').disabled = !st.undo.length; $('#btnRedo').disabled = !st.redo.length;
  $('#btnPreview').classList.toggle('on', st.preview);
  $('#stSel').textContent = st.sel.size ? `выделено: ${st.sel.size}` : '';
}

// ---------- вид ----------
// Вписываем лист в свободное место между плавающими панелями.
function fitView(animate = true) {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  const ins = $('#inspector');
  const right = ins.offsetWidth && W > 900 ? ins.offsetWidth + 28 : 0;
  // отступ сверху — от нижнего края плавающих панелей (на узком экране их два ряда)
  const top = Math.max(...$$('.bar').map(el => el.getBoundingClientRect().bottom)) + 42, bottom = 90, side = 40;
  const aw = W - right - side * 2, ah = H - top - bottom;
  const z = clamp(Math.min(aw / S.areaW, ah / S.areaH), 0.05, 20);
  animateView(z, side + (aw - S.areaW * z) / 2, top + (ah - S.areaH * z) / 2, animate);
}
// Плавный переход вида: зум интерполируется логарифмически, чтобы скорость ощущалась ровной.
let viewAnim = 0;
function animateView(z, px, py, animate = true) {
  cancelAnimationFrame(viewAnim);
  if (!animate) { st.zoom = z; st.panX = px; st.panY = py; requestRender(); return; }
  const z0 = st.zoom, x0 = st.panX, y0 = st.panY, t0 = performance.now(), D = 260;
  // неподвижная точка экрана — чтобы при зуме лист не «плыл» по дуге
  const k = z / z0, fx = Math.abs(k - 1) > 1e-6 ? (px - x0 * k) / (1 - k) : null, fy = fx !== null ? (py - y0 * k) / (1 - k) : null;
  const step = now => {
    const t = Math.min(1, (now - t0) / D), e = 1 - (1 - t) ** 3;
    const zt = z0 * Math.pow(z / z0, e);
    if (fx !== null && isFinite(fx) && isFinite(fy)) { st.panX = fx - (fx - x0) * zt / z0; st.panY = fy - (fy - y0) * zt / z0; }
    else { st.panX = x0 + (px - x0) * e; st.panY = y0 + (py - y0) * e; }
    if (t === 1) { st.panX = px; st.panY = py; }
    st.zoom = t === 1 ? z : zt;
    render();
    if (t < 1) viewAnim = requestAnimationFrame(step);
  };
  viewAnim = requestAnimationFrame(step);
  // если вкладка в фоне и кадры не идут — всё равно приходим к цели
  const id = viewAnim;
  setTimeout(() => { if (viewAnim === id && st.zoom !== z) { cancelAnimationFrame(viewAnim); st.zoom = z; st.panX = px; st.panY = py; requestRender(); } }, D + 150);
}
function zoomAt(k, sx, sy, animate = false) {
  const z = clamp(st.zoom * k, 0.05, 30);
  animateView(z, sx - (sx - st.panX) * z / st.zoom, sy - (sy - st.panY) * z / st.zoom, animate);
}
function toWorld(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left - st.panX) / st.zoom, y: (e.clientY - r.top - st.panY) / st.zoom };
}

// ---------- история ----------
function snapshot() {
  st.undo.push(JSON.stringify(st.els)); if (st.undo.length > 80) st.undo.shift();
  st.redo = [];
}
function restore(json) {
  st.els = JSON.parse(json);
  const ids = new Set(st.els.map(e => e.id));
  st.sel = new Set([...st.sel].filter(id => ids.has(id)));
  reindex();
}
function undo() { if (!st.undo.length) return; st.redo.push(JSON.stringify(st.els)); restore(st.undo.pop()); changed(true); }
function redo() { if (!st.redo.length) return; st.undo.push(JSON.stringify(st.els)); restore(st.redo.pop()); changed(true); }
function reindex() {
  st.nextId = st.els.reduce((m, e) => Math.max(m, e.id), 0) + 1;
  st.nextGroup = st.els.reduce((m, e) => Math.max(m, e.g || 0), 0) + 1;
}
// любое изменение элементов: перерисовать, сохранить, при необходимости пересобрать инспектор
function changed(rebuild) { persist(); requestRender(); if (rebuild) renderInspector(); }

// ---------- элементы ----------
function normalize(e) {
  const o = { id: st.nextId++, t: e.t, name: e.name ?? '', x: +e.x || 0, y: +e.y || 0, g: e.g || 0 };
  if (e.t === 'hero') { o.w = Math.max(1, +e.w || 1); o.h = Math.max(1, +e.h || 1); o.heroes = (e.heroes || []).slice(); }
  return o;
}
function addEls(list, { group = list.length > 1, select = true } = {}) {
  const g = group ? st.nextGroup++ : 0;
  const added = list.map(e => normalize({ ...e, g: group ? g : e.g || 0 }));
  st.els.push(...added);
  if (select) { st.sel = new Set(added.map(e => e.id)); st.fade = { ids: new Set(st.sel), t0: performance.now() }; }
  return added;
}
const selEls = () => st.els.filter(e => st.sel.has(e.id));
function groupIds(e) { return e.g ? st.els.filter(x => x.g === e.g).map(x => x.id) : [e.id]; }
function deleteSel() {
  if (!st.sel.size) return;
  snapshot();
  st.els = st.els.filter(e => !st.sel.has(e.id)); st.sel.clear();
  changed(true);
}
function selectAll() { st.sel = new Set(st.els.map(e => e.id)); requestRender(); renderInspector(); }
function clearSel() { if (st.sel.size) { st.sel.clear(); requestRender(); renderInspector(); } }

function duplicateSel() {
  const list = selEls(); if (!list.length) return;
  snapshot();
  const groups = new Map();
  const copies = list.map(e => {
    let g = 0;
    if (e.g) { if (!groups.has(e.g)) groups.set(e.g, st.nextGroup++); g = groups.get(e.g); }
    return { ...e, x: e.x + S.cellW * 2, y: e.y + S.cellH * 2, g };
  });
  addEls(copies, { group: false });
  changed(true);
}
function groupSel() {
  if (st.sel.size < 2) return;
  snapshot(); const g = st.nextGroup++;
  for (const e of selEls()) e.g = g;
  changed(true); toast('Сгруппировано');
}
function ungroupSel() {
  snapshot(); for (const e of selEls()) e.g = 0;
  changed(true); toast('Группа разбита');
}

// Поворот/отражение: позиции вокруг центра выделения + замена символов на повёрнутые.
const ROT = { '|': '-', '-': '|', '—': '|', '–': '|', '/': '\\', '\\': '/', '_': '|', ':': '‥', '‥': ':', '¦': '-', '│': '─', '─': '│', '╱': '╲', '╲': '╱' };
const FLIP_H = { '/': '\\', '\\': '/', '(': ')', ')': '(', '<': '>', '>': '<', '[': ']', ']': '[', '{': '}', '}': '{', '«': '»', '»': '«', '╱': '╲', '╲': '╱', '▌': '▐', '▐': '▌' };
const FLIP_V = { '/': '\\', '\\': '/', '^': 'v', 'v': '^', "'": '.', '.': "'", '`': ',', ',': '`', '‾': '_', '_': '‾', '╱': '╲', '╲': '╱', '▀': '▄', '▄': '▀' };
const mapChars = (s, m) => [...s].map(c => m[c] ?? c).join('');

function transformSel(fn, charMap, swap) {
  const list = selEls(); if (!list.length) return;
  snapshot();
  const bb = bboxOf(list), cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
  for (const e of list) {
    const b = bounds(e);
    const [nx, ny] = fn(b.x + b.w / 2 - cx, b.y + b.h / 2 - cy);
    if (e.t === 'hero' && swap) [e.w, e.h] = [e.h, e.w];
    if (e.t === 'glyph' && charMap) e.name = mapChars(e.name, charMap);
    const nb = bounds(e);
    e.x = cx + nx - nb.w / 2; e.y = cy + ny - nb.h / 2;
  }
  changed(true);
}
const rotateSel = cw => transformSel(cw ? (x, y) => [-y, x] : (x, y) => [y, -x], ROT, true);
const flipSel = horiz => transformSel(horiz ? (x, y) => [-x, y] : (x, y) => [x, -y], horiz ? FLIP_H : FLIP_V, false);

function scaleList(list, k, ox, oy) {
  for (const e of list) {
    const b = bounds(e);
    const ncx = ox + (b.x + b.w / 2 - ox) * k, ncy = oy + (b.y + b.h / 2 - oy) * k;
    if (e.t === 'hero') { e.w *= k; e.h *= k; }
    const nb = bounds(e);
    e.x = ncx - nb.w / 2; e.y = ncy - nb.h / 2;
  }
}
function scaleSel(k) {
  const list = selEls(); if (!list.length || !(k > 0)) return;
  snapshot();
  const bb = bboxOf(list);
  scaleList(list, k, bb.x + bb.w / 2, bb.y + bb.h / 2);
  changed(true);
}
function fillCanvasSel() {
  const list = selEls(); if (!list.length) return;
  snapshot();
  let bb = bboxOf(list);
  scaleList(list, Math.min(S.areaW / bb.w, S.areaH / bb.h), bb.x, bb.y);
  // после масштаба символы не растут, поэтому довыравниваем по центру ещё раз
  bb = bboxOf(list);
  const k2 = Math.min(S.areaW / bb.w, S.areaH / bb.h);
  if (k2 < 1) { scaleList(list, k2, bb.x, bb.y); bb = bboxOf(list); }
  const dx = (S.areaW - bb.w) / 2 - bb.x, dy = (S.areaH - bb.h) / 2 - bb.y;
  for (const e of list) { e.x += dx; e.y += dy; }
  changed(true);
}
function moveSelTo(x, y) {
  const list = selEls(); if (!list.length) return;
  snapshot(); const bb = bboxOf(list);
  for (const e of list) { e.x += x - bb.x; e.y += y - bb.y; }
  changed(true);
}

// Выделенные символы → текст ASCII по сетке плотности.
function selAsAscii() {
  const glyphs = selEls().filter(e => e.t === 'glyph');
  // строки текста (например, Брайль строками) — просто сверху вниз, как для профиля Steam
  if (!glyphs.length) return steamText(selEls().filter(e => e.t === 'text').sort((a, b) => a.y - b.y).map(e => e.name));
  const cells = glyphs.map(e => ({ c: Math.floor((e.x + measure(e.name) / 2) / S.cellW), r: Math.floor((e.y + S.fontSize / 2) / S.cellH), ch: e.name }));
  const c0 = Math.min(...cells.map(q => q.c)), r0 = Math.min(...cells.map(q => q.r));
  const rows = [];
  for (const q of cells) {
    const row = rows[q.r - r0] || (rows[q.r - r0] = []);
    row[q.c - c0] = q.ch;
  }
  return Array.from(rows, row => Array.from(row || [], ch => ch || ' ').join('').replace(/\s+$/, '')).join('\n');
}

// ---------- пиксельные инструменты ----------
const PENS = ['•', '·', '.', ':', '*', '+', '#', '@', '█', '▓', '▒', '░', '■', '♥'];
const currentPen = () => st.customPen || st.pen;
const DRAW_TOOLS = ['pencil', 'line', 'hv', 'rect', 'ellipse', 'rhombus', 'triangle'];
const SHAPE_TOOLS = ['rect', 'ellipse', 'rhombus', 'triangle'];
const cellOf = w => ({ x: Math.floor(w.x / S.cellW), y: Math.floor(w.y / S.cellH) });
const glyphKey = e => Math.floor((e.x + measure(e.name) / 2) / S.cellW) + ',' + Math.floor((e.y + S.fontSize / 2) / S.cellH);
function glyphIndex() { const m = new Map(); for (const e of st.els) if (e.t === 'glyph') m.set(glyphKey(e), e); return m; }

function lineCells(a, b) {
  const out = []; let x0 = a.x, y0 = a.y;
  const dx = Math.abs(b.x - x0), dy = -Math.abs(b.y - y0), sx = x0 < b.x ? 1 : -1, sy = y0 < b.y ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push([x0, y0]);
    if (x0 === b.x && y0 === b.y) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return out;
}
// Фигуры: предикат «внутри», контур = клетки внутри, у которых есть сосед снаружи.
function shapeCells(kind, a, b, fill) {
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2 + 0.5, ry = (y1 - y0) / 2 + 0.5;
  const inside = {
    rect: (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1,
    ellipse: (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1,
    rhombus: (x, y) => Math.abs(x - cx) / rx + Math.abs(y - cy) / ry <= 1.0001,
    triangle: (x, y) => y >= y0 && y <= y1 && Math.abs(x - cx) <= rx * (y - y0 + 0.5) / (y1 - y0 + 1) + 0.0001,
  }[kind];
  const out = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!inside(x, y)) continue;
    if (fill || !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) out.push([x, y]);
  }
  return out;
}
function constrain(tool, a, b, shift) {
  if (tool === 'hv') return Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
  if (tool === 'line' && shift) {
    const dx = b.x - a.x, dy = b.y - a.y, ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), len = Math.max(Math.abs(dx), Math.abs(dy));
    return { x: a.x + Math.round(Math.cos(ang) * len), y: a.y + Math.round(Math.sin(ang) * len) };
  }
  if (SHAPE_TOOLS.includes(tool) && shift) {
    const d = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    return { x: a.x + Math.sign(b.x - a.x || 1) * d, y: a.y + Math.sign(b.y - a.y || 1) * d };
  }
  return b;
}
function toolCells(tool, a, b, shift) {
  const e = constrain(tool, a, b, shift);
  return tool === 'line' || tool === 'hv' ? lineCells(a, e) : shapeCells(tool, a, e, st.fill);
}
function placeGlyph(idx, cx, cy, ch, g) {
  const key = cx + ',' + cy, old = idx.get(key);
  const w = measure(ch);
  if (old) { if (old.name === ch) return false; old.name = ch; old.x = cx * S.cellW + (S.cellW - w) / 2; return true; }
  const [e] = addEls([{ t: 'glyph', name: ch, x: cx * S.cellW + (S.cellW - w) / 2, y: cy * S.cellH + (S.cellH - S.fontSize) / 2, g }], { group: false, select: false });
  idx.set(key, e);
  return true;
}
function eraseGlyph(idx, cx, cy) {
  const e = idx.get(cx + ',' + cy); if (!e) return false;
  idx.delete(cx + ',' + cy);
  st.els.splice(st.els.indexOf(e), 1); st.sel.delete(e.id);
  return true;
}

// ---------- мышь ----------
let drag = null, spaceDown = false;
function hitTest(w) {
  const tol = 3 / st.zoom;
  for (let i = st.els.length - 1; i >= 0; i--) {
    const e = st.els[i], b = bounds(e);
    if (w.x >= b.x - tol && w.x <= b.x + b.w + tol && w.y >= b.y - tol && w.y <= b.y + b.h + tol) return e;
  }
  return null;
}
function onHandle(w) {
  if (st.sel.size !== 1) return null;
  const e = selEls()[0];
  if (e.t !== 'hero') return null;
  const t = 7 / st.zoom;
  return Math.abs(w.x - (e.x + e.w)) < t && Math.abs(w.y - (e.y + e.h)) < t ? e : null;
}

canvas.addEventListener('pointerdown', e => {
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  canvas.setPointerCapture(e.pointerId);
  const w = toWorld(e), tool = st.tool;
  if (e.button === 1 || spaceDown || tool === 'pan') {
    drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, px: st.panX, py: st.panY };
    canvas.style.cursor = 'grabbing'; return;
  }
  if (tool === 'select') {
    const h = onHandle(w);
    if (h) { snapshot(); drag = { kind: 'resize', el: h, w0: h.w, h0: h.h, start: w }; return; }
    const hit = hitTest(w);
    if (hit) {
      const ids = e.altKey ? [hit.id] : groupIds(hit);
      if (e.shiftKey) { const has = st.sel.has(hit.id); for (const id of ids) has ? st.sel.delete(id) : st.sel.add(id); }
      else if (!st.sel.has(hit.id)) st.sel = new Set(ids);
      const orig = new Map(selEls().map(x => [x.id, { x: x.x, y: x.y }]));
      drag = { kind: 'move', start: w, orig, moved: false, glyphsOnly: selEls().every(x => x.t === 'glyph') };
      renderInspector();
    } else {
      if (!e.shiftKey) st.sel.clear();
      drag = { kind: 'marquee', a: w, alt: e.altKey };
      st.rect = { kind: 'sel', x: w.x, y: w.y, w: 0, h: 0 };
      renderInspector();
    }
  } else if (tool === 'pencil') {
    snapshot();
    const c = cellOf(w), idx = glyphIndex(), erase = e.button === 2;
    drag = { kind: 'pencil', idx, last: c, erase, g: st.nextGroup++, any: false };
    drag.any = erase ? eraseGlyph(idx, c.x, c.y) : placeGlyph(idx, c.x, c.y, currentPen(), drag.g);
  } else if (DRAW_TOOLS.includes(tool)) {
    const c = cellOf(w);
    drag = { kind: 'shape', a: c };
    st.ghost = toolCells(tool, c, c, e.shiftKey);
  } else if (tool === 'eraser') {
    drag = { kind: 'erase', a: w };
    st.rect = { kind: 'erase', x: w.x, y: w.y, w: 0, h: 0 };
  } else if (tool === 'text') {
    snapshot();
    addEls([{ t: 'text', name: 'Текст', x: w.x, y: w.y - S.fontSize / 2 }], { group: false });
    changed(true);
    setTimeout(() => { const f = $('#fName'); if (f) { f.focus(); f.select(); } });
  } else if (tool === 'hero') {
    drag = { kind: 'newhero', a: w };
    st.rect = { kind: 'hero', x: w.x, y: w.y, w: 0, h: 0 };
  }
  requestRender();
});

canvas.addEventListener('pointermove', e => {
  const w = toWorld(e);
  $('#stCoords').textContent = `x ${Math.round(w.x)}  y ${Math.round(w.y)}` + (DRAW_TOOLS.includes(st.tool) ? `  ·  клетка ${Math.floor(w.x / S.cellW)}, ${Math.floor(w.y / S.cellH)}` : '');
  if (!drag) { updateCursor(w); return; }
  switch (drag.kind) {
    case 'pan':
      st.panX = drag.px + e.clientX - drag.sx; st.panY = drag.py + e.clientY - drag.sy; break;
    case 'move': {
      let dx = w.x - drag.start.x, dy = w.y - drag.start.y;
      if (S.snap && drag.glyphsOnly) { dx = Math.round(dx / S.cellW) * S.cellW; dy = Math.round(dy / S.cellH) * S.cellH; }
      if (!drag.moved && (dx || dy)) { snapshot(); drag.moved = true; }
      for (const x of selEls()) { const o = drag.orig.get(x.id); if (o) { x.x = o.x + dx; x.y = o.y + dy; } }
      break;
    }
    case 'resize':
      drag.el.w = Math.max(20, drag.w0 + w.x - drag.start.x); drag.el.h = Math.max(20, drag.h0 + w.y - drag.start.y); break;
    case 'marquee': case 'erase': case 'newhero':
      st.rect = { kind: st.rect.kind, ...normRect(drag.a, w) }; break;
    case 'pencil': {
      const c = cellOf(w);
      for (const [x, y] of lineCells(drag.last, c)) drag.any = (drag.erase ? eraseGlyph(drag.idx, x, y) : placeGlyph(drag.idx, x, y, currentPen(), drag.g)) || drag.any;
      drag.last = c; break;
    }
    case 'shape':
      st.ghost = toolCells(st.tool, drag.a, cellOf(w), e.shiftKey); break;
  }
  requestRender();
});

function endDrag(e) {
  if (!drag) return;
  const d = drag; drag = null;
  const w = toWorld(e);
  switch (d.kind) {
    case 'pan': canvas.style.cursor = ''; break;
    case 'move': if (d.moved) changed(true); break;
    case 'resize': changed(true); break;
    case 'marquee': {
      const r = st.rect;
      for (const x of st.els) if (intersects(bounds(x), r)) for (const id of d.alt ? [x.id] : groupIds(x)) st.sel.add(id);
      renderInspector(); break;
    }
    case 'erase': {
      const r = st.rect;
      let kill;
      if (r.w * st.zoom < 3 && r.h * st.zoom < 3) { const h = hitTest(w); kill = new Set(h ? [h.id] : []); }
      else kill = new Set(st.els.filter(x => x.t === 'hero' ? contains(r, bounds(x)) : intersects(bounds(x), r)).map(x => x.id));
      if (kill.size) { snapshot(); st.els = st.els.filter(x => !kill.has(x.id)); for (const id of kill) st.sel.delete(id); changed(true); }
      break;
    }
    case 'newhero': {
      let r = st.rect;
      if (r.w < 20 || r.h < 20) r = { x: d.a.x, y: d.a.y, w: (CARD_W * 4 + PAD), h: (CARD_H * 2 + PAD) };
      snapshot();
      addEls([{ t: 'hero', name: 'Категория', ...r, heroes: [] }], { group: false });
      changed(true); break;
    }
    case 'pencil': if (d.any) changed(true); else st.undo.pop(); break;
    case 'shape': {
      const cells = st.ghost || [];
      if (cells.length) {
        snapshot();
        const idx = glyphIndex(), g = cells.length > 1 ? st.nextGroup++ : 0;
        for (const [x, y] of cells) placeGlyph(idx, x, y, currentPen(), g);
        changed(true);
      }
      break;
    }
  }
  st.rect = null; st.ghost = null;
  requestRender();
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });

function updateCursor(w) {
  let c = '';
  if (spaceDown || st.tool === 'pan') c = 'grab';
  else if (st.tool === 'select') c = onHandle(w) ? 'nwse-resize' : hitTest(w) ? 'move' : 'default';
  else if (st.tool === 'text') c = 'text';
  else c = 'crosshair';
  canvas.style.cursor = c;
}

// ---------- инструменты ----------
// Чёрная «таблетка» дока переезжает под активный инструмент.
function moveDockInd() {
  const ind = $('#dockInd'), b = $(`#rail [data-tool="${st.tool}"]`);
  if (!ind || !b) return;
  ind.style.transform = `translateX(${b.offsetLeft}px)`;
}

// ---------- тема ----------
const THEME_ICONS = { light: 'M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z', dark: 'M12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4' };
function applyThemeIcon() {
  const th = document.documentElement.dataset.theme;
  $('#btnTheme').innerHTML = `<svg class="i" viewBox="0 0 24 24"><path d="${THEME_ICONS[th]}"/></svg>`;
  $('#btnTheme').dataset.tip = (th === 'dark' ? 'Светлая тема' : 'Тёмная тема') + ' · Shift+T';
}
function toggleTheme() {
  const root = document.documentElement, next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  // старый кадр холста растворяется поверх нового — канвас не умеет CSS-переходы
  const snap = document.createElement('canvas');
  snap.width = canvas.width; snap.height = canvas.height; snap.className = 'canvas-fade';
  snap.getContext('2d').drawImage(canvas, 0, 0);
  canvas.after(snap);
  root.classList.add('theme-anim');
  root.dataset.theme = next;
  T = CANVAS_THEMES[next];
  try { localStorage.setItem('gp2.theme', next); } catch {}
  applyThemeIcon(); render();
  requestAnimationFrame(() => { snap.style.opacity = 0; });
  setTimeout(() => { snap.remove(); root.classList.remove('theme-anim'); }, 420);
}
const TOOL_NAMES = { select: 'Выделение', pan: 'Рука', pencil: 'Карандаш', line: 'Линия', hv: 'Гор./верт.', rect: 'Прямоугольник', ellipse: 'Эллипс', rhombus: 'Ромб', triangle: 'Треугольник', eraser: 'Ластик', text: 'Текст', hero: 'Категория героев' };
function setTool(t) {
  st.tool = t;
  for (const b of $$('#rail [data-tool]')) b.classList.toggle('on', b.dataset.tool === t);
  moveDockInd();
  $('#stTool').textContent = TOOL_NAMES[t];
  canvas.style.cursor = '';
  renderInspector();
}

// ---------- инспектор ----------
const panelOpen = load('gp2.panels', { sel: true, tool: true, canvas: true, bg: false, stats: false });
const slider = (id, label, min, max, step, val, suffix = '') =>
  `<label class="slider"><span>${label}</span><output id="${id}Out">${val}${suffix}</output><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" data-suffix="${suffix}"></label>`;
const sw = (id, label, on) => `<label class="switch"><span>${label}</span><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><i></i></label>`;
const num = (id, lbl, v, extra = '') => `<label class="num"><b>${lbl}</b><input class="input" type="number" id="${id}" value="${r6(v).toFixed(1).replace(/\.0$/, '')}" ${extra}></label>`;
const panel = (key, title, body, count = '') => `<details class="panel" data-key="${key}" ${panelOpen[key] ? 'open' : ''}><summary>${title}<span class="count">${count}</span></summary><div class="panel-body">${body}</div></details>`;
function syncRange(el) {
  const p = (el.value - el.min) / (el.max - el.min) * 100;
  el.style.setProperty('--p', p + '%');
  const out = document.getElementById(el.id + 'Out');
  if (out) out.textContent = el.value + (el.dataset.suffix || '');
}

let hadSel = false;
function renderInspector() {
  const ins = $('#inspector');
  const list = selEls();
  let html = '';

  if (list.length) {
    let body = '';
    if (list.length === 1) {
      const e = list[0];
      body += `<div class="field"><span>${e.t === 'hero' ? 'Название категории' : e.t === 'glyph' ? 'Символ' : 'Текст'}</span><input class="input" id="fName" value="${esc(e.name)}" spellcheck="false"></div>`;
      body += `<div class="row2">${num('fX', 'X', e.x)}${num('fY', 'Y', e.y)}</div>`;
      if (e.t === 'hero') {
        body += `<div class="row2">${num('fW', 'W', e.w, 'min="10"')}${num('fH', 'H', e.h, 'min="10"')}</div>`;
        body += `<div class="lbl">Герои · ${e.heroes.length}</div><div class="chips" id="chips">${e.heroes.map((id, k) => {
          const i = HERO_IDX.get(id); return i === undefined ? '' : `<div class="chip" data-k="${k}" title="${esc(HEROES[i].n)} — убрать" style="background-image:url(${HEROES[i].url})"></div>`;
        }).join('') || '<span class="hint">Пусто — добавь героев ниже</span>'}</div>`;
        body += `<input class="input" id="heroSearch" placeholder="Найти героя и добавить…"><div class="picker" id="heroPick"></div>`;
      }
    } else {
      const bb = bboxOf(list), counts = { hero: 0, text: 0, glyph: 0 };
      for (const e of list) counts[e.t]++;
      body += `<div class="kv"><span>Герои / текст / ASCII</span><b>${counts.hero} / ${counts.text} / ${counts.glyph}</b></div>`;
      body += `<div class="row2">${num('gX', 'X', bb.x)}${num('gY', 'Y', bb.y)}</div>`;
      body += `<div class="kv"><span>Размер группы</span><b>${Math.round(bb.w)} × ${Math.round(bb.h)}</b></div>`;
    }
    body += `<div class="tools-grid">
      <button class="btn" data-act="rotl" data-icon="rotl">−90°</button>
      <button class="btn" data-act="rotr" data-icon="rotr">+90°</button>
      <button class="btn" data-act="fliph" data-icon="fliph">Гориз.</button>
      <button class="btn" data-act="flipv" data-icon="flipv">Верт.</button>
      <button class="btn" data-act="fill" data-icon="fill">Холст</button>
      <button class="btn" data-act="${list.length > 1 && new Set(list.map(e => e.g)).size === 1 && list[0].g ? 'ungroup' : 'group'}" data-icon="group">${list.length > 1 && new Set(list.map(e => e.g)).size === 1 && list[0].g ? 'Разгр.' : 'Группа'}</button>
      <button class="btn" data-act="dup" data-icon="dup">Копия</button>
      <button class="btn danger" data-act="del" data-icon="trash">Удалить</button>
    </div>`;
    body += `<div class="row2" style="grid-template-columns:1fr auto"><label class="num"><b>%</b><input class="input" type="number" id="scalePct" value="100" min="1" step="5"></label><button class="btn" data-act="scale">Масштаб</button></div>`;
    if (list.some(e => e.t !== 'hero')) body += `<button class="btn block" data-act="copyascii" data-icon="copy">Копировать как ASCII</button>`;
    html += panel('sel', 'Выделение', body, list.length > 1 ? `· ${list.length}` : '').replace('class="panel"', `class="panel${hadSel ? '' : ' enter'}"`);
  }

  if (DRAW_TOOLS.includes(st.tool) || st.tool === 'eraser') {
    let body = '';
    if (st.tool !== 'eraser') {
      body += `<div class="lbl">Перо</div><div class="pens">${PENS.map(p => `<button data-pen="${esc(p)}" class="${!st.customPen && st.pen === p ? 'on' : ''}">${esc(p)}</button>`).join('')}<input class="input" id="customPen" maxlength="4" placeholder="свой" value="${esc(st.customPen)}" title="Свой символ"></div>`;
      if (SHAPE_TOOLS.includes(st.tool)) body += sw('fillShape', 'Заливка фигуры', st.fill);
    } else body += `<div class="hint">Растяни рамку — сотрутся символы и текст, задетые рамкой, и категории героев, целиком попавшие в неё. Клик — стереть один элемент.</div>`;
    body += `<div class="lbl">Плотность (шаг сетки)</div><div class="row2">${num('cellW', '↔', S.cellW, 'min="2" step="1"')}${num('cellH', '↕', S.cellH, 'min="2" step="1"')}</div>`;
    body += `<div class="hint">Shift — ровные линии и фигуры. ПКМ карандашом — стереть.</div>`;
    html += panel('tool', TOOL_NAMES[st.tool], body);
  }

  html += panel('canvas', 'Холст', `
    <div class="row2">${num('areaW', 'W', S.areaW, 'min="100" step="10"')}${num('areaH', 'H', S.areaH, 'min="100" step="10"')}</div>
    ${slider('fontSize', 'Размер символа', 6, 40, 1, S.fontSize, 'px')}
    <div class="row2" title="Цвета в режиме «Превью»"><label class="swatch"><input type="color" id="glyphColor" value="${S.glyphColor}">ASCII</label><label class="swatch"><input type="color" id="textColor" value="${S.textColor}">Текст</label></div>
    ${sw('showGrid', 'Сетка плотности', S.showGrid)}
    ${sw('snap', 'Привязка ASCII к сетке', S.snap)}
    <button class="font-drop" id="btnFont"><b>Шрифт Radiance${st.userFont ? ' <i>загружен</i>' : ''}</b><span>${st.userFont ? 'Клик — загрузить другой. ' : 'Загрузи .ttf, чтобы превью совпадало с игрой. '}Размер и цвет влияют только на превью.</span></button>
    ${st.userFont ? '<button class="link" id="btnFontReset">Сбросить шрифт</button>' : ''}
    <button class="link" id="btnClear">Очистить холст</button>`);

  html += panel('bg', 'Фон-картинка', st.bg.img ? `
    ${sw('bgShow', 'Показывать', st.bg.show)}
    ${slider('bgOpacity', 'Прозрачность', 0, 100, 1, Math.round(st.bg.opacity * 100), '%')}
    ${slider('bgDim', 'Приглушение', 0, 100, 1, Math.round(st.bg.dim * 100), '%')}
    <div class="row2"><button class="btn" id="btnBg" data-icon="image">Заменить</button><button class="btn danger" id="btnBgDel" data-icon="trash">Убрать</button></div>`
    : `<div class="hint">Подложка, чтобы обводить картинку инструментами. В сетку она не попадает.</div><button class="btn block" id="btnBg" data-icon="image">Загрузить фон</button>`);

  const counts = { hero: 0, text: 0, glyph: 0 }, heroSet = new Set();
  for (const e of st.els) { counts[e.t]++; if (e.t === 'hero') for (const h of e.heroes) heroSet.add(h); }
  html += panel('stats', 'Статистика', `
    <div class="kv"><span>Категорий героев</span><b>${counts.hero}</b></div>
    <div class="kv"><span>Текстовых</span><b>${counts.text}</b></div>
    <div class="kv"><span>ASCII-символов</span><b>${counts.glyph}</b></div>
    <div class="kv"><span>Разных героев</span><b>${heroSet.size}</b></div>
    <div class="hint">Точного лимита категорий у Доты нет в документации. Несколько тысяч обычно работают, но чем больше — тем дольше грузится экран выбора героя.</div>`);

  hadSel = list.length > 0;
  const scroll = ins.scrollTop;
  ins.innerHTML = html;
  ins.scrollTop = scroll;
  applyIcons(ins);
  $$('input[type=range]', ins).forEach(syncRange);
  bindInspector(list);
}

function bindInspector(list) {
  const ins = $('#inspector');
  for (const d of $$('details.panel', ins)) d.addEventListener('toggle', () => { panelOpen[d.dataset.key] = d.open; store('gp2.panels', panelOpen); });
  const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };

  if (list.length === 1) {
    const e = list[0];
    let snapped = false;
    on('fName', 'focus', () => { snapped = false; });
    on('fName', 'input', ev => { if (!snapped) { snapshot(); snapped = true; } e.name = ev.target.value; persist(); requestRender(); });
    for (const [id, k] of [['fX', 'x'], ['fY', 'y'], ['fW', 'w'], ['fH', 'h']]) on(id, 'change', ev => { snapshot(); e[k] = Math.max(k === 'w' || k === 'h' ? 10 : -1e6, +ev.target.value || 0); changed(); });
    on('chips', 'click', ev => { const c = ev.target.closest('.chip'); if (!c) return; snapshot(); e.heroes.splice(+c.dataset.k, 1); changed(true); });
    const pick = $('#heroPick');
    const fillPick = () => {
      if (!pick) return;
      const q = $('#heroSearch').value.trim().toLowerCase();
      pick.innerHTML = HEROES.map((h, i) => [h, i]).filter(([h]) => !q || h.n.toLowerCase().includes(q)).slice(0, q ? 60 : 24)
        .map(([h, i]) => `<div class="hero" data-i="${i}" title="${esc(h.n)}" style="background-image:url(${h.url});--c:#${h.c}"></div>`).join('');
    };
    on('heroSearch', 'input', fillPick);
    if (pick) {
      fillPick();
      pick.addEventListener('click', ev => {
        const d = ev.target.closest('.hero'); if (!d) return;
        snapshot(); e.heroes.push(HEROES[+d.dataset.i].id);
        const q = $('#heroSearch').value; changed(true);
        const s = $('#heroSearch'); if (s) { s.value = q; s.dispatchEvent(new Event('input')); }
      });
    }
  }
  on('gX', 'change', ev => moveSelTo(+ev.target.value || 0, bboxOf(selEls()).y));
  on('gY', 'change', ev => moveSelTo(bboxOf(selEls()).x, +ev.target.value || 0));

  for (const b of $$('[data-act]', ins)) b.addEventListener('click', () => {
    ({
      rotl: () => rotateSel(false), rotr: () => rotateSel(true), fliph: () => flipSel(true), flipv: () => flipSel(false),
      fill: fillCanvasSel, group: groupSel, ungroup: ungroupSel, dup: duplicateSel, del: deleteSel,
      scale: () => scaleSel((+$('#scalePct').value || 100) / 100),
      copyascii: () => copyText(selAsAscii(), 'ASCII скопирован — вставь через «+ ASCII» или куда угодно'),
    })[b.dataset.act]();
  });

  for (const b of $$('[data-pen]', ins)) b.addEventListener('click', () => { st.pen = b.dataset.pen; st.customPen = ''; renderInspector(); });
  on('customPen', 'input', ev => { st.customPen = ev.target.value.trim(); $$('[data-pen]', ins).forEach(b => b.classList.toggle('on', !st.customPen && b.dataset.pen === st.pen)); });
  on('fillShape', 'change', ev => { st.fill = ev.target.checked; });
  for (const id of ['cellW', 'cellH']) on(id, 'change', ev => { S[id] = Math.max(2, +ev.target.value || 10); persist(); requestRender(); });

  for (const id of ['areaW', 'areaH']) on(id, 'change', ev => { S[id] = Math.max(100, +ev.target.value || 100); persist(); fitView(); });
  on('fontSize', 'input', ev => { S.fontSize = +ev.target.value; resetMeasure(); syncRange(ev.target); persist(); requestRender(); });
  on('glyphColor', 'input', ev => { S.glyphColor = ev.target.value; persist(); requestRender(); });
  on('textColor', 'input', ev => { S.textColor = ev.target.value; persist(); requestRender(); });
  on('showGrid', 'change', ev => { S.showGrid = ev.target.checked; persist(); requestRender(); });
  on('snap', 'change', ev => { S.snap = ev.target.checked; persist(); });
  on('btnFont', 'click', () => $('#fileFont').click());
  on('btnFontReset', 'click', () => { st.userFont = false; try { localStorage.removeItem('gp2.font'); } catch {} resetMeasure(); renderInspector(); requestRender(); });
  on('btnClear', 'click', () => { if (!st.els.length) return; snapshot(); st.els = []; st.sel.clear(); changed(true); toast('Холст очищен. Ctrl+Z — вернуть.'); });

  on('btnBg', 'click', () => $('#fileBg').click());
  on('btnBgDel', 'click', () => { st.bg.img = null; renderInspector(); requestRender(); });
  on('bgShow', 'change', ev => { st.bg.show = ev.target.checked; requestRender(); });
  on('bgOpacity', 'input', ev => { st.bg.opacity = ev.target.value / 100; syncRange(ev.target); requestRender(); });
  on('bgDim', 'input', ev => { st.bg.dim = ev.target.value / 100; syncRange(ev.target); requestRender(); });
}

// ---------- модальные окна ----------
function openModal(html, { wide = false, onClose } = {}) {
  const root = $('#modalRoot'), token = {};
  root._token = token; root.classList.remove('closing');
  root.innerHTML = `<div class="modal ${wide ? 'wide' : ''}">${html}</div>`;
  applyIcons(root);
  $$('input[type=range]', root).forEach(syncRange);
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    document.removeEventListener('keydown', escClose, true);
    root.classList.add('closing');
    onClose && onClose();
    setTimeout(() => {
      if (root._token !== token) return; // уже открыто другое окно
      root.classList.remove('closing'); root.innerHTML = '';
    }, 160);
  };
  const escClose = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', escClose, true);
  root.onclick = e => { if (e.target === root) close(); };
  for (const b of $$('[data-close]', root)) b.onclick = close;
  return { root, close };
}
const modalHead = (title, extra = '') => `<div class="modal-head"><h2>${title}</h2>${extra}<button class="icon-btn" data-close data-icon="x"></button></div>`;

// ----- импорт картинки -----
const IP = Object.assign({
  mode: 'mosaic',
  brightness: 0, contrast: 0, saturation: 0,
  cols: 36, fit: true, dither: false, bgRemove: false, tolerance: 18,
  amode: 'chars', step: 12, ramp: ' .:-=+*#%@', rampPreset: 'classic', invert: false, threshold: 128, autoThreshold: true, lineH: 14, bcols: 60,
  blur: 1.4, low: 8, high: 22, lstep: 7, limit: 3000, charset: 'lines', custom: '-\\|/', orient: true,
}, load('gp2.import', {}));
const RAMPS = { classic: ' .:-=+*#%@', blocks: ' ░▒▓█', dots: ' .·•●', simple: ' .:*#' };
let disabledHeroes = new Set(load('gp.disabled', []));

function openImageModal(file) {
  let img = null, result = null, split = 0.5, timer = 0, steam = '';
  const m = openModal(`
    ${modalHead('Импорт картинки', `<div class="seg" id="ipMode" style="width:360px;margin-left:16px">
      <button data-m="mosaic">Мозаика из героев</button><button data-m="ascii">ASCII</button><button data-m="lineart">Line-art</button></div>`)}
    <div class="split">
      <div class="split-controls">
        <div class="drop" id="ipDrop">Перетащи картинку, кликни или Ctrl+V</div>
        <div id="ipCtl" style="display:flex;flex-direction:column;gap:12px"></div>
      </div>
      <div class="split-preview"><canvas id="ipCanvas"></canvas><span class="tag" style="left:12px">Оригинал</span><span class="tag" style="right:12px">Результат</span></div>
    </div>
    <div class="modal-foot"><span class="info" id="ipInfo"></span><button class="btn" data-close>Отмена</button><button class="btn primary" id="ipAdd" data-icon="plus" disabled>Добавить на холст</button></div>`, { wide: true, onClose: () => { pasteTarget = null; } });

  const setImg = f => {
    if (!f || !f.type.startsWith('image/')) return;
    const url = URL.createObjectURL(f), im = new Image();
    im.onload = () => {
      img = im;
      $('#ipDrop').innerHTML = `<img src="${url}"><span>${esc(f.name || 'из буфера')} · ${im.naturalWidth}×${im.naturalHeight}</span>`;
      $('#ipAdd').disabled = false; compute();
    };
    im.src = url;
  };
  pasteTarget = setImg;
  const drop = $('#ipDrop');
  drop.onclick = () => { const i = $('#fileImage'); i.value = ''; i.onchange = () => setImg(i.files[0]); i.click(); };
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); setImg(e.dataTransfer.files[0]); };

  const common = () => `${slider('brightness', 'Яркость', -100, 100, 1, IP.brightness)}${slider('contrast', 'Контраст', -100, 100, 1, IP.contrast)}`;
  const bgCtl = () => `${sw('bgRemove', 'Убрать фон (цвет угла)', IP.bgRemove)}${slider('tolerance', 'Допуск фона', 1, 100, 1, IP.tolerance)}`;
  const controls = {
    mosaic: () => `
      ${slider('cols', 'Ширина, героев', 6, 120, 1, IP.cols)}
      ${common()}${slider('saturation', 'Насыщенность', -100, 100, 1, IP.saturation)}
      ${sw('fit', 'Подогнать яркость под палитру', IP.fit)}${sw('dither', 'Дизеринг', IP.dither)}${bgCtl()}
      <div class="lbl">Палитра — клик исключает героя</div><div class="picker" id="ipPal" style="grid-template-columns:repeat(8,1fr)"></div>
      <div class="row2"><button class="btn sm" id="palAll">Все</button><button class="btn sm" id="palNone">Никого</button></div>`,
    ascii: () => `
      <div class="seg" id="amode"><button data-v="chars">Символы по яркости</button><button data-v="braille">Брайль строками</button></div>
      <div id="aChars" ${IP.amode !== 'chars' ? 'hidden' : ''} style="display:flex;flex-direction:column;gap:12px">
        ${slider('step', 'Плотность (шаг)', 3, 40, 1, IP.step)}
        <label class="field"><span>Набор символов</span><select class="input" id="rampPreset">
          <option value="classic">Классика  .:-=+*#%@</option><option value="blocks">Блоки ░▒▓█</option><option value="dots">Точки .·•●</option><option value="simple">Простой .:*#</option><option value="custom">Свой…</option></select></label>
        <input class="input mono" id="ramp" value="${esc(IP.ramp)}" title="От тёмного к светлому; пробел = пусто" ${IP.rampPreset !== 'custom' ? 'hidden' : ''}>
      </div>
      <div id="aBraille" ${IP.amode !== 'braille' ? 'hidden' : ''} style="display:flex;flex-direction:column;gap:12px">
        ${slider('bcols', 'Символов в строке', 10, 200, 1, IP.bcols)}
        ${sw('autoThreshold', 'Авто-порог', IP.autoThreshold)}${slider('threshold', 'Порог', 1, 254, 1, IP.threshold)}
        ${slider('lineH', 'Высота строки', 4, 40, 1, IP.lineH)}
        <div class="hint">Каждая строка — одна категория: очень экономно по количеству категорий.</div>
        <div class="steam-box">
          <div class="steam-head"><b>Steam · Custom Info Box</b><span class="badge" id="steamCount">—</span></div>
          <div class="row2"><button class="btn sm" id="steamW" title="Рекомендуемая ширина Брайль-арта для информационного поля">Ширина 60</button><button class="btn sm" id="steamFit" title="Уменьшить ширину, пока текст не влезет в лимит Steam">Влезть в 8000</button></div>
          <button class="btn primary block" id="steamCopy">Скопировать для Steam</button>
          <div class="hint">Профиль → Редактировать → Витрины → «Своё информационное поле», вставь в поле текста. Если строки переносятся — уменьши ширину на 1–2 символа.</div>
        </div>
      </div>
      ${common()}${sw('invert', 'Инвертировать', IP.invert)}${sw('dither', 'Дизеринг', IP.dither)}${bgCtl()}`,
    lineart: () => `
      ${slider('lstep', 'Плотность (шаг)', 3, 30, 0.5, IP.lstep)}
      ${slider('limit', 'Лимит категорий', 0, 10000, 100, IP.limit)}
      ${slider('blur', 'Blur (размытие)', 0, 6, 0.1, IP.blur)}
      ${slider('low', 'Нижний порог Canny', 1, 60, 1, IP.low, '%')}
      ${slider('high', 'Верхний порог Canny', 1, 80, 1, IP.high, '%')}
      ${common()}
      <label class="field"><span>Набор символов</span><select class="input" id="charset">
        <option value="lines">Линии  - \\ | /</option><option value="dots">Только точки  .</option><option value="mid">Средние точки  ·</option><option value="custom">Свой…</option></select></label>
      <input class="input mono" id="custom" value="${esc(IP.custom)}" title="4 символа: горизонталь, диагональ \\, вертикаль, диагональ /. Один символ — везде он." ${IP.charset !== 'custom' ? 'hidden' : ''}>
      ${sw('orient', 'Автоориентация по углу линии', IP.orient)}
      <div class="hint">Canny edge detection, как в Photoshop: размытие убирает шум, пороги решают, какие границы считать линиями. Лимит 0 — без ограничения.</div>`,
  };

  function buildControls() {
    $$('#ipMode button').forEach(b => b.classList.toggle('on', b.dataset.m === IP.mode));
    const box = $('#ipCtl');
    box.innerHTML = controls[IP.mode]();
    $$('input[type=range]', box).forEach(el => {
      syncRange(el);
      el.addEventListener('input', () => { IP[el.id] = +el.value; if (el.id === 'threshold') { IP.autoThreshold = false; const a = $('#autoThreshold'); if (a) a.checked = false; } syncRange(el); schedule(); });
    });
    $$('input[type=checkbox]', box).forEach(el => el.addEventListener('change', () => { IP[el.id] = el.checked; schedule(); }));
    const sel = (id, fn) => { const el = document.getElementById(id); if (el) { el.value = IP[id]; el.onchange = () => { IP[id] = el.value; fn && fn(); schedule(); }; } };
    sel('rampPreset', () => { const r = $('#ramp'); r.hidden = IP.rampPreset !== 'custom'; if (IP.rampPreset !== 'custom') IP.ramp = r.value = RAMPS[IP.rampPreset]; });
    sel('charset', () => { $('#custom').hidden = IP.charset !== 'custom'; });
    for (const id of ['ramp', 'custom']) { const el = document.getElementById(id); if (el) el.oninput = () => { IP[id] = el.value; schedule(); }; }
    const am = $('#amode');
    if (am) {
      const upd = () => { $$('button', am).forEach(b => b.classList.toggle('on', b.dataset.v === IP.amode)); $('#aChars').hidden = IP.amode !== 'chars'; $('#aBraille').hidden = IP.amode !== 'braille'; $('#aChars').style.display = IP.amode === 'chars' ? 'flex' : 'none'; $('#aBraille').style.display = IP.amode === 'braille' ? 'flex' : 'none'; };
      upd();
      am.onclick = e => { const b = e.target.closest('button'); if (!b) return; IP.amode = b.dataset.v; upd(); schedule(); };
    }
    const pal = $('#ipPal');
    if (pal) {
      const draw = () => {
        pal.innerHTML = HEROES.map((h, i) => i).sort((a, b) => HEROES[a].lab[0] - HEROES[b].lab[0]).map(i => {
          const h = HEROES[i];
          return `<div class="hero ${disabledHeroes.has(h.id) ? 'off' : ''}" data-id="${h.id}" title="${esc(h.n)}" style="background-image:url(${h.url});--c:#${h.c}"></div>`;
        }).join('');
      };
      draw();
      pal.onclick = e => { const d = e.target.closest('.hero'); if (!d) return; const id = +d.dataset.id; disabledHeroes.has(id) ? disabledHeroes.delete(id) : disabledHeroes.add(id); d.classList.toggle('off'); store('gp.disabled', [...disabledHeroes]); schedule(); };
      $('#palAll').onclick = () => { disabledHeroes.clear(); store('gp.disabled', []); draw(); schedule(); };
      $('#palNone').onclick = () => { disabledHeroes = new Set(HEROES.map(h => h.id)); store('gp.disabled', [...disabledHeroes]); draw(); schedule(); };
    }
  }
  // Steam: ширина по умолчанию, подгонка под лимит (бинпоиск по ширине — длина растёт с шириной), копирование
  $('#ipCtl').addEventListener('click', e => {
    const id = e.target.closest('button')?.id;
    if (id === 'steamW') setBcols(60);
    else if (id === 'steamFit') {
      if (!img) return;
      const len = cols => [...steamText(Convert.ascii(img, { ...IP, mode: 'braille', cols }, { w: S.areaW, h: S.areaH }, measure, S.fontSize).lines)].length;
      if (len(IP.bcols) <= STEAM_LIMIT) { toast('Уже влезает в лимит Steam', 'ok'); return; }
      let lo = 10, hi = IP.bcols;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; len(mid) <= STEAM_LIMIT ? lo = mid : hi = mid; }
      setBcols(lo); toast(`Ширина ${lo} — влезает в 8000 символов`, 'ok');
    } else if (id === 'steamCopy') {
      if (!steam) { toast('Сначала загрузи картинку', 'err'); return; }
      const n = [...steam].length;
      copyText(steam, n > STEAM_LIMIT ? `Скопировано, но ${n} символов — больше лимита Steam (8000). Нажми «Влезть в 8000»` : 'Скопировано — вставляй в Custom Info Box');
    }
  });
  function setBcols(v) { IP.bcols = v; const el = $('#bcols'); if (el) { el.value = v; syncRange(el); } schedule(); }
  $('#ipMode').onclick = e => { const b = e.target.closest('button'); if (!b) return; IP.mode = b.dataset.m; buildControls(); schedule(); };

  function schedule() { store('gp2.import', IP); clearTimeout(timer); timer = setTimeout(compute, 70); }
  function compute() {
    if (!img) { draw(); return; }
    const area = { w: S.areaW, h: S.areaH };
    const t0 = performance.now();
    let info = '';
    if (IP.mode === 'mosaic') {
      const pool = HEROES.map((h, i) => i).filter(i => !disabledHeroes.has(HEROES[i].id));
      result = Convert.mosaic(img, IP, area, HEROES, pool);
      const n = result.els.reduce((a, e) => a + e.heroes.length, 0);
      info = `${result.cols}×${result.rows} · ${n} героев (${result.uniq} разных) · ${result.els.length} категорий`;
      if (!pool.length) info = 'В палитре нет ни одного героя';
    } else if (IP.mode === 'ascii') {
      result = Convert.ascii(img, { ...IP, mode: IP.amode, cols: IP.bcols }, area, measure, S.fontSize);
      if (result.th !== undefined && IP.autoThreshold) { const t = $('#threshold'); if (t) { t.value = IP.threshold = result.th; syncRange(t); } }
      info = `${result.els.length} категорий`;
      if (result.lines) {
        steam = steamText(result.lines);
        const n = [...steam].length, c = $('#steamCount');
        if (c) { c.textContent = `${n.toLocaleString('ru')} / 8 000`; c.classList.toggle('bad', n > STEAM_LIMIT); }
      }
    } else {
      result = Convert.lineart(img, { ...IP, step: IP.lstep }, area, measure, S.fontSize);
      info = `${result.els.length} категорий` + (result.step > IP.lstep + 0.01 ? ` · шаг увеличен до ${result.step.toFixed(1)} из-за лимита` : '');
    }
    $('#ipInfo').textContent = info + ` · ${Math.round(performance.now() - t0)} мс`;
    draw();
  }
  const pv = $('#ipCanvas');
  function draw() {
    const dpr = window.devicePixelRatio || 1, W = pv.clientWidth, H = pv.clientHeight;
    pv.width = W * dpr; pv.height = H * dpr;
    const c = pv.getContext('2d');
    const z = Math.min((W - 40) / S.areaW, (H - 40) / S.areaH), ox = (W - S.areaW * z) / 2, oy = (H - S.areaH * z) / 2;
    c.setTransform(dpr * z, 0, 0, dpr * z, dpr * ox, dpr * oy);
    const g = c.createLinearGradient(0, 0, 0, S.areaH); g.addColorStop(0, '#1b1813'); g.addColorStop(1, '#100e0b');
    c.fillStyle = g; c.fillRect(0, 0, S.areaW, S.areaH);
    if (!img) return;
    const sx = S.areaW * split;
    c.save(); c.beginPath(); c.rect(sx, 0, S.areaW - sx, S.areaH); c.clip();
    if (result) renderEls(c, result.els, { editor: false, zoom: z });
    c.restore();
    c.save(); c.beginPath(); c.rect(0, 0, sx, S.areaH); c.clip();
    const f = Convert.fitRect(img.naturalWidth, img.naturalHeight, S.areaW, S.areaH);
    c.drawImage(img, f.x, f.y, f.w, f.h);
    c.restore();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const lx = ox + sx * z;
    c.fillStyle = '#fff'; c.fillRect(lx - 1, oy, 2, S.areaH * z);
    c.beginPath(); c.arc(lx, oy + S.areaH * z / 2, 11, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#111'; c.font = '600 11px Inter'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('⇆', lx, oy + S.areaH * z / 2 + 1);
  }
  let dragging = false;
  const setSplit = e => {
    const r = pv.getBoundingClientRect(), W = r.width, H = r.height;
    const z = Math.min((W - 40) / S.areaW, (H - 40) / S.areaH), ox = (W - S.areaW * z) / 2;
    split = clamp((e.clientX - r.left - ox) / (S.areaW * z), 0, 1); draw();
  };
  pv.onpointerdown = e => { dragging = true; pv.setPointerCapture(e.pointerId); setSplit(e); };
  pv.onpointermove = e => { if (dragging) setSplit(e); };
  pv.onpointerup = () => { dragging = false; };
  new ResizeObserver(draw).observe(pv);

  $('#ipAdd').onclick = () => {
    if (!result || !result.els.length) { toast('Результат пустой — подкрути настройки', 'err'); return; }
    snapshot();
    addEls(result.els);
    changed(true); m.close();
    setTool('select');
    toast(`Добавлено ${result.els.length} элементов одной группой — можно двигать, масштабировать, поворачивать`, 'ok');
  };
  buildControls();
  if (file) setImg(file); else draw();
}

// ----- Steam -----
const STEAM_LIMIT = 8000;
// Текст для Custom Info Box: без пустых строк по краям и хвостовых пустых символов,
// а пустые строки внутри рисунка — одним «пустым Брайлем», чтобы Steam их не схлопнул.
function steamText(lines) {
  const blank = l => !/[^⠀ ]/.test(l);
  let a = 0, b = lines.length;
  while (a < b && blank(lines[a])) a++;
  while (b > a && blank(lines[b - 1])) b--;
  return lines.slice(a, b).map(l => l.replace(/ /g, BRAILLE_BLANK).replace(/⠀+$/, '') || BRAILLE_BLANK).join('\n');
}
function openSteamModal() {
  Object.assign(IP, { mode: 'ascii', amode: 'braille', bcols: 60 });
  openImageModal();
}

// ----- + ASCII -----
function openAsciiModal(prefill = '') {
  let mode = 'chars';
  const m = openModal(`
    ${modalHead('Вставить ASCII')}
    <div class="modal-body">
      <div class="seg" id="asMode"><button data-v="chars" class="on">Посимвольно (символ = категория)</button><button data-v="lines">Строками (строка = категория)</button></div>
      <textarea class="input" id="asText" placeholder="Вставь сюда ASCII-арт…" spellcheck="false">${esc(prefill)}</textarea>
      <div class="row2" id="asStep">${num('asX', 'X шаг', S.cellW, 'min="1" step="0.5"')}${num('asY', 'Y шаг', S.cellH, 'min="1" step="0.5"')}</div>
      <div id="asLine" hidden>${num('asLH', 'Строка', 14, 'min="2" step="0.5"')}</div>
      <button class="btn sm" id="asPaste" data-icon="copy" style="align-self:flex-start">Вставить из буфера обмена</button>
    </div>
    <div class="modal-foot"><span class="info" id="asInfo"></span><button class="btn" data-close>Отмена</button><button class="btn primary" id="asAdd" data-icon="plus">Добавить</button></div>`);
  const ta = $('#asText');
  const build = () => {
    const lines = ta.value.replace(/\r/g, '').split('\n');
    const els = [];
    if (mode === 'chars') {
      const sx = +$('#asX').value || S.cellW, sy = +$('#asY').value || S.cellH;
      lines.forEach((line, r) => [...line].forEach((ch, c) => {
        if (/\s/.test(ch) || ch === BRAILLE_BLANK) return;
        els.push({ t: 'glyph', name: ch, x: c * sx + (sx - measure(ch)) / 2, y: r * sy + (sy - S.fontSize) / 2 });
      }));
    } else {
      const lh = +$('#asLH').value || 14;
      lines.forEach((line, r) => { if (line.trim()) els.push({ t: 'text', name: line.replace(/ /g, BRAILLE_BLANK), x: 0, y: r * lh }); });
    }
    return els;
  };
  const info = () => { $('#asInfo').textContent = `${build().length} категорий`; };
  ta.oninput = info; $('#asX').oninput = $('#asY').oninput = info;
  $('#asMode').onclick = e => {
    const b = e.target.closest('button'); if (!b) return; mode = b.dataset.v;
    $$('#asMode button').forEach(x => x.classList.toggle('on', x === b));
    $('#asStep').hidden = mode !== 'chars'; $('#asLine').hidden = mode !== 'lines'; info();
  };
  $('#asPaste').onclick = async () => { try { ta.value = await navigator.clipboard.readText(); info(); } catch { toast('Браузер не дал доступ к буферу — вставь Ctrl+V в поле', 'err'); } };
  $('#asAdd').onclick = () => {
    const els = build(); if (!els.length) { toast('Нечего добавлять', 'err'); return; }
    centerInArea(els); snapshot(); addEls(els); changed(true); m.close(); setTool('select');
    toast(`Добавлено ${els.length} элементов`, 'ok');
  };
  info(); setTimeout(() => ta.focus());
}
function centerInArea(els) {
  const bb = bboxOf(els);
  const dx = (S.areaW - bb.w) / 2 - bb.x, dy = Math.max(0, (S.areaH - bb.h) / 2) - bb.y;
  for (const e of els) { e.x += dx; e.y += dy; }
}

// ----- генератор линий -----
function openLinesModal() {
  let dir = 'v';
  const m = openModal(`
    ${modalHead('Генератор линий')}
    <div class="modal-body">
      <div class="seg" id="lnDir"><button data-v="v" class="on">Вертикальная</button><button data-v="h">Горизонтальная</button></div>
      <label class="field"><span>Символы (повторяются по кругу)</span><input class="input mono" id="lnPat" value="|"></label>
      <div class="row2">${num('lnN', 'N', 30, 'min="1" step="1"')}${num('lnStep', 'шаг', 12, 'min="1" step="0.5"')}</div>
      <div class="row2">${num('lnCopies', '×', 1, 'min="1" step="1"')}${num('lnGap', '↔', 40, 'min="1" step="1"')}</div>
      <div class="hint">Например «|:» даёт пунктир, «╎» — тонкую линию, «│» — сплошную. Можно сделать несколько параллельных линий с расстоянием между ними.</div>
    </div>
    <div class="modal-foot"><span class="info" id="lnInfo"></span><button class="btn" data-close>Отмена</button><button class="btn primary" id="lnAdd" data-icon="plus">Добавить</button></div>`);
  const build = () => {
    const pat = [...($('#lnPat').value || '|')].filter(c => !/\s/.test(c));
    const n = Math.max(1, +$('#lnN').value | 0), step = +$('#lnStep').value || 12, copies = Math.max(1, +$('#lnCopies').value | 0), gap = +$('#lnGap').value || 40;
    const els = [];
    if (!pat.length) return els;
    for (let k = 0; k < copies; k++) for (let i = 0; i < n; i++) {
      const ch = pat[i % pat.length];
      els.push(dir === 'v' ? { t: 'glyph', name: ch, x: k * gap - measure(ch) / 2, y: i * step } : { t: 'glyph', name: ch, x: i * step - measure(ch) / 2, y: k * gap });
    }
    return els;
  };
  const info = () => { $('#lnInfo').textContent = `${build().length} категорий`; };
  for (const id of ['lnPat', 'lnN', 'lnStep', 'lnCopies', 'lnGap']) $('#' + id).oninput = info;
  $('#lnDir').onclick = e => { const b = e.target.closest('button'); if (!b) return; dir = b.dataset.v; $$('#lnDir button').forEach(x => x.classList.toggle('on', x === b)); info(); };
  $('#lnAdd').onclick = () => { const els = build(); if (!els.length) return; centerInArea(els); snapshot(); addEls(els); changed(true); m.close(); setTool('select'); };
  info();
}

// ----- импорт JSON -----
const fsOk = 'showOpenFilePicker' in window;
async function pickJsonFiles() {
  try {
    if (fsOk) {
      const handles = await window.showOpenFilePicker({ multiple: true, types: [{ description: 'Hero grid', accept: { 'application/json': ['.json'] } }] });
      return Promise.all(handles.map(async h => ({ file: await h.getFile(), handle: h })));
    }
    return await new Promise(res => { const i = $('#fileJson'); i.value = ''; i.onchange = () => res([...i.files].map(file => ({ file, handle: null }))); i.click(); });
  } catch (e) { if (e.name !== 'AbortError') toast('Не удалось открыть: ' + e.message, 'err'); return []; }
}
async function importJsonFiles(items) {
  const files = [];
  for (const { file, handle } of items) {
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.configs)) throw new Error('нет поля configs');
      files.push({ name: file.name, data, handle });
    } catch (e) { toast(`${file.name}: не похоже на hero_grid_config.json (${e.message})`, 'err'); }
  }
  if (!files.length) return;
  if (!st.gridFile) st.gridFile = files[0];
  const all = files.flatMap((f, fi) => f.data.configs.map((c, ci) => ({ f, fi, ci, c })));
  const m = openModal(`
    ${modalHead('Импорт сеток')}
    <div class="modal-body">
      <div class="lbl">Выбери сетки — каждая станет отдельной группой и будет выделена после импорта</div>
      <div class="cfg-list">${all.map((x, k) => `<label class="cfg-item"><input type="checkbox" data-k="${k}" ${k === 0 ? 'checked' : ''}><span>${esc(x.c.config_name || 'Без названия')}</span><small>${files.length > 1 ? esc(x.f.name) + ' · ' : ''}${(x.c.categories || []).length} кат.</small></label>`).join('') || '<div class="hint">В файле нет сеток</div>'}</div>
      <div class="radio-cards">
        <label><input type="radio" name="imMode" value="replace" ${st.els.length ? '' : 'checked'}><b>Заменить холст</b><small>редактировать эти сетки</small></label>
        <label><input type="radio" name="imMode" value="add" ${st.els.length ? 'checked' : ''}><b>Добавить на холст</b><small>к тому, что уже есть</small></label>
      </div>
      <div class="hint">Файл <b>${esc(st.gridFile.name)}</b> запомнен: при экспорте сетку можно дописать в него, не трогая остальные.</div>
    </div>
    <div class="modal-foot"><button class="btn sm" id="imAll">Выбрать все</button><span class="info"></span><button class="btn" data-close>Отмена</button><button class="btn primary" id="imGo" data-icon="download">Импортировать</button></div>`);
  $('#imAll').onclick = () => $$('.cfg-list input').forEach(i => i.checked = true);
  $('#imGo').onclick = () => {
    const chosen = $$('.cfg-list input').filter(i => i.checked).map(i => all[+i.dataset.k]);
    if (!chosen.length) return;
    snapshot();
    if (document.querySelector('input[name=imMode]:checked').value === 'replace') { st.els = []; S.configName = chosen[0].c.config_name || S.configName; $('#configName').value = S.configName; }
    const ids = [];
    for (const x of chosen) ids.push(...addEls((x.c.categories || []).map(categoryToEl), { select: false }).map(e => e.id));
    st.sel = new Set(ids);
    changed(true); m.close(); setTool('select');
    toast(`Импортировано ${ids.length} категорий из ${chosen.length} сет.`, 'ok');
  };
}
function categoryToEl(c) {
  const name = String(c.category_name ?? ''), heroes = Array.isArray(c.hero_ids) ? c.hero_ids : [];
  const w = +c.width || 0, h = +c.height || 0;
  const base = { name, x: +c.x_position || 0, y: +c.y_position || 0 };
  if (heroes.length || (w > 1 && h > 1)) return { ...base, t: 'hero', w: Math.max(w, 10), h: Math.max(h, 10), heroes };
  return { ...base, t: [...name.trim()].length <= 2 ? 'glyph' : 'text' };
}
function elToCategory(e) {
  if (e.t === 'hero') return { category_name: e.name, x_position: r6(e.x), y_position: r6(e.y), width: r6(e.w), height: r6(e.h), hero_ids: e.heroes.slice() };
  return { category_name: e.name, x_position: r6(e.x), y_position: r6(e.y), width: 0, height: 0, hero_ids: [] };
}

// ----- экспорт -----
function openExportModal() {
  const merge0 = !!st.gridFile;
  const m = openModal(`
    ${modalHead('Экспорт сетки')}
    <div class="modal-body">
      <label class="field"><span>Название сетки в Доте</span><input class="input" id="exName" value="${esc(S.configName)}"></label>
      ${st.gridFile ? `<div class="radio-cards">
        <label><input type="radio" name="exMode" value="merge" ${merge0 ? 'checked' : ''}><b>В ${esc(st.gridFile.name)}</b><small>${st.gridFile.data.configs.length} сет. + эта (одноимённая заменится)</small></label>
        <label><input type="radio" name="exMode" value="new" ${merge0 ? '' : 'checked'}><b>Новый файл</b><small>только эта сетка</small></label>
      </div>` : `<div class="hint">Чтобы не потерять свои сетки, сначала открой свой <code>hero_grid_config.json</code> — тогда арт допишется к ним.</div>`}
      <div class="kv"><span>Категорий</span><b>${st.els.length}</b></div>
      <div class="hint">Папка файла: <code>Steam\\userdata\\&lt;ID&gt;\\570\\remote\\cfg\\</code>. Закрой Доту перед заменой, потом в выборе героя открой «Сетка героев» → свою сетку.<br>Текстовые и ASCII-категории пишутся с width = height = 0 — это экспериментально, проверь в игре.</div>
    </div>
    <div class="modal-foot">
      <button class="btn" id="exCopy" data-icon="copy">Копировать JSON</button><span class="info"></span>
      <button class="btn" id="exDl" data-icon="download">Скачать</button>
      ${st.gridFile?.handle ? '<button class="btn primary" id="exWrite" data-icon="save">Записать в файл</button>' : ''}
    </div>`);
  const build = () => {
    S.configName = $('#exName').value.trim() || 'Моя сетка'; $('#configName').value = S.configName; persist();
    const cfg = { config_name: S.configName, categories: st.els.map(elToCategory) };
    const merge = st.gridFile && document.querySelector('input[name=exMode]:checked')?.value === 'merge';
    const base = merge ? structuredClone(st.gridFile.data) : { version: 3, configs: [] };
    const i = base.configs.findIndex(c => c.config_name === cfg.config_name);
    if (i >= 0) base.configs[i] = cfg; else base.configs.push(cfg);
    return { text: JSON.stringify(base, null, '\t'), base, merge, replaced: i >= 0 };
  };
  $('#exCopy').onclick = () => copyText(build().text, 'JSON скопирован');
  $('#exDl').onclick = () => { download('hero_grid_config.json', build().text); toast('Файл скачан — положи его в папку cfg, заменив старый', 'ok'); m.close(); };
  const w = $('#exWrite');
  if (w) w.onclick = async () => {
    const b = build();
    if (!b.merge) { toast('Запись на место доступна для режима «В файл»', 'err'); return; }
    try {
      const wr = await st.gridFile.handle.createWritable(); await wr.write(b.text); await wr.close();
      st.gridFile.data = b.base;
      toast(`Сетка «${S.configName}» ${b.replaced ? 'обновлена' : 'добавлена'} в ${st.gridFile.name}`, 'ok'); m.close();
    } catch (e) { if (e.name !== 'AbortError') toast('Не удалось записать: ' + e.message, 'err'); }
  };
}

function openHelp() {
  const K = [['Выделение / рука', 'V / H, пробел'], ['Карандаш, линия, гор./верт.', 'P, L, I'], ['Прямоуг., эллипс, ромб, треуг.', 'R, O, D, Y'], ['Ластик, текст, герои', 'E, T, G'],
    ['Ровно / квадрат', 'Shift при рисовании'], ['Стереть карандашом', 'ПКМ'], ['Выделить один элемент группы', 'Alt + клик'], ['Добавить к выделению', 'Shift + клик'],
    ['Группировать / разгруппировать', 'Ctrl+G / Ctrl+Shift+G'], ['Дублировать', 'Ctrl+D'], ['Копировать / вставить', 'Ctrl+C / Ctrl+V'], ['Удалить', 'Delete'],
    ['Сдвиг', 'Стрелки (Shift ×10)'], ['Отменить / повторить', 'Ctrl+Z / Ctrl+Shift+Z'], ['Зум', 'колесо, + / −'], ['Вписать холст', 'Shift+1'], ['Превью как в игре', 'Tab'], ['Вставить картинку', 'Ctrl+V']];
  openModal(`${modalHead('Горячие клавиши')}<div class="modal-body"><div class="keys">${K.map(([a, b]) => `<span>${a}</span><span><kbd>${b}</kbd></span>`).join('')}</div></div>
    <div class="modal-foot"><span class="info">Автор · Discord <b style="color:var(--ink)">@ahttps</b> — связь, заказы, предложения</span><button class="btn sm" id="copyDiscord">Скопировать ник</button></div>`);
  $('#copyDiscord').onclick = () => copyText('ahttps', 'Ник Discord скопирован');
}

// ---------- утилиты ----------
function toast(msg, kind = '') {
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 240); }, kind === 'err' ? 5000 : 3000);
}
async function copyText(s, okMsg) {
  if (!s) { toast('Нечего копировать', 'err'); return; }
  try { await navigator.clipboard.writeText(s); toast(okMsg, 'ok'); } catch { toast('Не удалось скопировать в буфер', 'err'); }
}
function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function loadImage(file) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); });
}
async function loadFont(buf, silent) {
  try {
    const f = new FontFace('GPUserFont', buf); await f.load(); document.fonts.add(f);
    st.userFont = true; resetMeasure(); renderInspector(); requestRender();
    if (!silent) toast('Шрифт загружен — превью текста теперь ближе к игре', 'ok');
    return true;
  } catch (e) { if (!silent) toast('Не удалось загрузить шрифт: ' + e.message, 'err'); return false; }
}

// ---------- верхняя панель и файлы ----------
$('#configName').value = S.configName;
$('#configName').oninput = e => { S.configName = e.target.value; persist(); };
$('#btnOpen').onclick = $('#esOpen').onclick = async () => importJsonFiles(await pickJsonFiles());
$('#btnExport').onclick = openExportModal;
$('#btnUndo').onclick = undo; $('#btnRedo').onclick = redo;
$('#zoomIn').onclick = () => zoomAt(1.25, canvas.clientWidth / 2, canvas.clientHeight / 2, true);
$('#zoomOut').onclick = () => zoomAt(0.8, canvas.clientWidth / 2, canvas.clientHeight / 2, true);
$('#zoomVal').onclick = () => fitView();
$('#btnPreview').onclick = () => { st.preview = !st.preview; requestRender(); };
$('#btnHelp').onclick = openHelp;
$('#btnTheme').onclick = toggleTheme;
const addMenu = $('#addMenu');
$('#btnAdd').onclick = e => { e.stopPropagation(); addMenu.classList.toggle('open'); };
document.addEventListener('click', () => addMenu.classList.remove('open'));
function doAdd(kind) {
  addMenu.classList.remove('open');
  if (kind === 'image') openImageModal();
  else if (kind === 'ascii') openAsciiModal();
  else if (kind === 'lines') openLinesModal();
  else if (kind === 'steam') openSteamModal();
  else if (kind === 'hero' || kind === 'text') {
    snapshot();
    const el = kind === 'hero'
      ? { t: 'hero', name: 'Категория', x: S.areaW / 2 - 110, y: S.areaH / 2 - 90, w: CARD_W * 4 + PAD, h: CARD_H * 2 + PAD, heroes: [] }
      : { t: 'text', name: 'Текст', x: S.areaW / 2 - 20, y: S.areaH / 2 - 8 };
    addEls([el], { group: false }); setTool('select'); changed(true);
    setTimeout(() => { const f = $('#fName'); if (f) { f.focus(); f.select(); } });
  }
}
for (const b of $$('[data-add]')) b.addEventListener('click', () => doAdd(b.dataset.add));
for (const b of $$('#rail [data-tool]')) b.addEventListener('click', () => setTool(b.dataset.tool));

$('#fileBg').onchange = async e => { const f = e.target.files[0]; if (!f) return; st.bg.img = await loadImage(f); st.bg.show = true; panelOpen.bg = true; renderInspector(); requestRender(); e.target.value = ''; };
$('#fileFont').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  const buf = await f.arrayBuffer();
  if (await loadFont(buf)) {
    // сохраняем шрифт, чтобы не грузить каждый раз (если влезает в хранилище)
    let bin = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode(...u.subarray(i, i + 0x8000));
    store('gp2.font', btoa(bin));
  }
  e.target.value = '';
};

// перетаскивание файлов на холст
const stage = $('#stage');
stage.addEventListener('dragover', e => e.preventDefault());
stage.addEventListener('drop', e => {
  e.preventDefault();
  const files = [...e.dataTransfer.files];
  const json = files.filter(f => /\.json$/i.test(f.name) || f.type === 'application/json');
  if (json.length) importJsonFiles(json.map(file => ({ file, handle: null })));
  const img = files.find(f => f.type.startsWith('image/'));
  if (img) openImageModal(img);
});

// буфер обмена: картинка → импорт, текст → + ASCII, свои элементы → вставка
let pasteTarget = null, clipEls = null;
const CLIP_MARK = 'gridpainter-clip:';
document.addEventListener('paste', e => {
  const t = e.target;
  const typing = t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t.type !== 'range' && t.type !== 'checkbox');
  const items = [...(e.clipboardData?.items || [])];
  const imgItem = items.find(i => i.type.startsWith('image/'));
  if (imgItem) { e.preventDefault(); const f = imgItem.getAsFile(); pasteTarget ? pasteTarget(f) : openImageModal(f); return; }
  if (typing || $('#modalRoot').children.length) return;
  const text = e.clipboardData.getData('text/plain');
  if (text.startsWith(CLIP_MARK) && clipEls) { e.preventDefault(); pasteEls(); return; }
  if (text.trim()) { e.preventDefault(); openAsciiModal(text); }
});
function copySel() {
  const list = selEls(); if (!list.length) return;
  clipEls = JSON.parse(JSON.stringify(list));
  navigator.clipboard.writeText(CLIP_MARK + Date.now()).catch(() => {});
  toast(`Скопировано: ${list.length}`);
}
function pasteEls() {
  if (!clipEls) return;
  snapshot();
  const groups = new Map();
  addEls(clipEls.map(e => {
    let g = 0; if (e.g) { if (!groups.has(e.g)) groups.set(e.g, st.nextGroup++); g = groups.get(e.g); }
    return { ...e, x: e.x + S.cellW * 2, y: e.y + S.cellH * 2, g };
  }), { group: false });
  changed(true);
}

// ---------- клавиатура ----------
const TOOL_KEYS = { v: 'select', h: 'pan', p: 'pencil', l: 'line', i: 'hv', r: 'rect', o: 'ellipse', d: 'rhombus', y: 'triangle', e: 'eraser', t: 'text', g: 'hero' };
document.addEventListener('keydown', e => {
  const t = e.target;
  if (t.tagName === 'INPUT' && t.type !== 'range' && t.type !== 'checkbox' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return;
  if ($('#modalRoot').children.length) return;
  const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
  const code = e.code;
  if (code === 'Space') { if (!spaceDown) { spaceDown = true; canvas.style.cursor = 'grab'; } e.preventDefault(); return; }
  if (ctrl && code === 'KeyZ') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (ctrl && code === 'KeyY') { e.preventDefault(); redo(); return; }
  if (ctrl && code === 'KeyA') { e.preventDefault(); selectAll(); return; }
  if (ctrl && code === 'KeyD') { e.preventDefault(); duplicateSel(); return; }
  if (ctrl && code === 'KeyG') { e.preventDefault(); e.shiftKey ? ungroupSel() : groupSel(); return; }
  if (ctrl && code === 'KeyC') { if (st.sel.size) { e.preventDefault(); copySel(); } return; }
  if (ctrl && code === 'KeyS') { e.preventDefault(); openExportModal(); return; }
  if (ctrl) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSel(); return; }
  if (e.key === 'Escape') { clearSel(); return; }
  if (e.key === 'Tab') { e.preventDefault(); st.preview = !st.preview; requestRender(); return; }
  if (e.key === '?') { openHelp(); return; }
  if (e.shiftKey && code === 'KeyT') { toggleTheme(); return; }
  if (e.shiftKey && code === 'Digit1') { fitView(); return; }
  if (e.key === '+' || e.key === '=') { zoomAt(1.25, canvas.clientWidth / 2, canvas.clientHeight / 2, true); return; }
  if (e.key === '-') { zoomAt(0.8, canvas.clientWidth / 2, canvas.clientHeight / 2, true); return; }
  if (e.key.startsWith('Arrow') && st.sel.size) {
    e.preventDefault();
    const glyphs = selEls().every(x => x.t === 'glyph') && S.snap;
    const stepX = e.shiftKey ? (glyphs ? S.cellW * 10 : 10) : (glyphs ? S.cellW : 1), stepY = e.shiftKey ? (glyphs ? S.cellH * 10 : 10) : (glyphs ? S.cellH : 1);
    const dx = e.key === 'ArrowLeft' ? -stepX : e.key === 'ArrowRight' ? stepX : 0, dy = e.key === 'ArrowUp' ? -stepY : e.key === 'ArrowDown' ? stepY : 0;
    if (!e.repeat) snapshot();
    for (const x of selEls()) { x.x += dx; x.y += dy; }
    changed(); return;
  }
  const code2tool = { KeyV: 'v', KeyH: 'h', KeyP: 'p', KeyL: 'l', KeyI: 'i', KeyR: 'r', KeyO: 'o', KeyD: 'd', KeyY: 'y', KeyE: 'e', KeyT: 't', KeyG: 'g' }[code];
  if (code2tool && TOOL_KEYS[code2tool]) setTool(TOOL_KEYS[code2tool]);
});
document.addEventListener('keyup', e => { if (e.code === 'Space') { spaceDown = false; canvas.style.cursor = ''; } });
window.addEventListener('blur', () => { spaceDown = false; });
document.addEventListener('input', e => { if (e.target.type === 'range') syncRange(e.target); });

// ---------- старт ----------
(function init() {
  applyIcons();
  const saved = load('gp2.els', null);
  if (Array.isArray(saved) && saved.length) { st.els = saved; reindex(); }
  const font = load('gp2.font', null);
  if (font) {
    const bin = atob(font), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    loadFont(u.buffer, true);
  }
  document.fonts.ready.then(() => { resetMeasure(); requestRender(); });
  // вписываем холст, как только у канваса появится реальный размер
  let fitted = false;
  new ResizeObserver(() => { if (!fitted && canvas.clientWidth > 50) { fitted = true; fitView(false); } else requestRender(); }).observe(canvas);
  applyThemeIcon();
  setTool('select');
  // шрифты меняют ширину кнопок дока — переставим «таблетку», когда они загрузятся
  document.fonts.ready.then(moveDockInd);
})();
