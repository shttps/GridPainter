'use strict';
/* Dota 2 Grid Studio — редактор сетки героев Dota 2.
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
const CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/';
const BRAILLE_BLANK = '⠀';

// ---------- иконки ----------
// Одна система: 24px, линия 1.75, скруглённые концы, цвет — currentColor.
// Строка без «<» — это просто d у <path>, иначе — готовая разметка внутри <svg>.
const ICONS = {
  cursor: 'M5.5 3.5L19 11.5 12.5 13 9.5 19.5z',
  hand: 'M12 3v18M3 12h18M9.5 5.5L12 3l2.5 2.5M9.5 18.5L12 21l2.5-2.5M5.5 9.5L3 12l2.5 2.5M18.5 9.5L21 12l-2.5 2.5',
  pencil: 'M4 20l1-5L16 4l4 4L9 19zM13.5 6.5l4 4',
  line: '<path d="M6.5 17.5l11-11"/><circle cx="5" cy="19" r="1.75"/><circle cx="19" cy="5" r="1.75"/>',
  hv: 'M12 5v14M5 12h14',
  rect: '<rect x="4" y="5.5" width="16" height="13" rx="1.5"/>',
  ellipse: '<circle cx="12" cy="12" r="7.5"/>',
  rhombus: 'M12 3.5l8.5 8.5-8.5 8.5-8.5-8.5z',
  triangle: 'M12 4.5l8.5 14.5h-17z',
  eraser: 'M8.5 19.5L4 15l9.5-9.5 5.5 5.5-9 8.5zM9 10.5l5 5M8.5 19.5H20',
  text: 'M5 6.5V4.5h14v2M12 4.5v15M9 19.5h6',
  heroes: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" fill="currentColor"/>',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11',
  redo: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 000 11H13',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M20.5 16l-5-5-8.5 8"/>',
  folder: 'M3.5 7.5a2 2 0 012-2h4l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2h-13a2 2 0 01-2-2z',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 16V5M7 10l5-5 5 5M5 20h14',
  eye: '<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.75"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  layers: 'M12 4l9 4.5-9 4.5-9-4.5zM3 13l9 4.5 9-4.5',
  grid: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 3.5v17M14.5 3.5v17"/>',
  font: 'M4 20V6.5M4 6.5h16M8 4v5M20 20H8M11 20v-7h9',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.5 2.5 0 113.5 2.3c-.6.3-1 .8-1 1.5v.4M12 16.8v.1"/>',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  chev: 'M8 10l4 4 4-4',
  home: 'M4 11l8-7 8 7M6.5 9v11h11V9',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
  moon: 'M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z',
  ascii: 'M5 7h1M9 7h1M13 7h1M5 12h1M17 12h1M9 17h1M13 17h1M17 7h1M9 12h1',
  lines: 'M7 4v2M7 9v2M7 14v2M7 19v1M12 4v16M17 4v2M17 9v2M17 14v2M17 19v1',
  rotl: 'M4 4v5h5M5 9a7.5 7.5 0 11-.5 5',
  rotr: 'M20 4v5h-5M19 9a7.5 7.5 0 10.5 5',
  fliph: 'M12 3v18M9 7l-5 5 5 5zM15 7l5 5-5 5z',
  flipv: 'M3 12h18M7 9l5-5 5 5zM7 15l5 5 5-5z',
  fill: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M5 15.5V6.5a2 2 0 012-2h8.5"/>',
  group: 'M4 4h7v7H4zM13 13h7v7h-7zM11 7.5h5.5V13',
  ungroup: 'M4 4h7v7H4zM13 13h7v7h-7z',
  dup: 'M8 8h12v12H8zM4 16V4h12M14 11v6M11 14h6',
  x: 'M6 6l12 12M18 6L6 18',
  save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5M9 12h6',
  trashAll: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5',
};
const icon = n => { const v = ICONS[n] || ''; return `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${v.startsWith('<') ? v : `<path d="${v}"/>`}</svg>`; };
function applyIcons(root = document) {
  for (const el of $$('[data-icon]', root)) {
    if (el.dataset.iconDone) continue;
    el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
    el.dataset.iconDone = 1;
  }
}

// ---------- герои ----------
// В сетке Дота показывает вертикальный портрет героя с saturation 0.7 (hero_grid_new.css).
// Подбор мозаики сравнивает цвета уже приглушённых портретов — как их увидят в игре.
const SAT = 0.7;
function saturate(r, g, b, k = SAT) {
  return [
    (0.213 + 0.787 * k) * r + (0.715 - 0.715 * k) * g + (0.072 - 0.072 * k) * b,
    (0.213 - 0.213 * k) * r + (0.715 + 0.285 * k) * g + (0.072 - 0.072 * k) * b,
    (0.213 - 0.213 * k) * r + (0.715 - 0.715 * k) * g + (0.072 + 0.928 * k) * b,
  ].map(v => clamp(Math.round(v), 0, 255));
}
const HEROES = window.HEROES.map(h => {
  const [r, g, b] = saturate(parseInt(h.c.slice(0, 2), 16), parseInt(h.c.slice(2, 4), 16), parseInt(h.c.slice(4, 6), 16));
  const wide = CDN + 'dota_react/heroes/' + h.s + '.png';
  return { ...h, lab: Convert.rgbToLab(r, g, b), wide, url: h.v ? CDN + 'heroes/' + h.s + '_vert.jpg' : wide };
});
const HERO_IDX = new Map(HEROES.map((h, i) => [h.id, i]));
const heroImgs = new Map();
function heroImg(i) {
  let im = heroImgs.get(i);
  if (!im) {
    im = new Image(); im.onload = requestRender;
    im.onerror = () => { if (im.src !== HEROES[i].wide) im.src = HEROES[i].wide; };
    im.src = HEROES[i].url; heroImgs.set(i, im);
  }
  return im;
}

// ---------- настройки и состояние ----------
const S = Object.assign({
  configName: 'Моя сетка',
  areaW: 1204, areaH: 612,
  cellW: 10, cellH: 10,
  showGrid: true, snap: true,
}, load('gp2.settings', {}));
// старый размер по умолчанию → настоящий размер сетки в Доте (DOTAHeroGridNew 1204 × 678 минус подвал 66)
if (S.areaW === 1200 && S.areaH === 600) { S.areaW = 1204; S.areaH = 612; }
delete S.fontSize;

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
  setSaveState('сохраняю', true);
  saveTimer = setTimeout(() => {
    store('gp2.settings', S);
    const ok = store('gp2.els', st.els);
    setSaveState(ok ? 'сохранено' : 'не сохранено', false);
    if (!ok && !saveWarned) { saveWarned = true; toast('Проект слишком большой для автосохранения в браузере — не забудь экспорт.', 'err'); }
  }, 600);
}
function setSaveState(text, saving) {
  const el = document.getElementById('saveState');
  if (!el) return;
  el.textContent = text; el.classList.toggle('saving', saving);
}

// ---------- шрифт и размеры ----------
// Подпись категории в Доте (#HeroCategoryName): Radiance 16px semi-bold, ЗАГЛАВНЫМИ, разрядка 2px,
// отступ слева 4px. Она стоит в строке высотой 20px, а список героев начинается под ней.
// x/y элемента = x_position/y_position категории; подпись и герои рисуются со сдвигом, как в игре.
const LBL = { size: 16, ls: 2, dx: 4, dy: 3 }, HEAD = 20;
const fontFamily = () => (st.userFont ? '"GPUserFont", ' : '') + '"Radiance", "Segoe UI", Arial, sans-serif';
const labelFont = () => `600 ${LBL.size}px ${fontFamily()}`;
const up = s => String(s).toUpperCase();
const HAS_LS = 'letterSpacing' in CanvasRenderingContext2D.prototype;
const mctx = document.createElement('canvas').getContext('2d');
let mcache = new Map();
function measure(s) {
  let w = mcache.get(s);
  if (w === undefined) { mctx.font = labelFont(); w = mctx.measureText(up(s)).width + LBL.ls * Math.max(0, [...s].length - 1); mcache.set(s, w); }
  return w;
}
function resetMeasure() { mcache = new Map(); }
// подпись с разрядкой; где canvas не умеет letterSpacing — по буквам
function drawLabel(c, s, x, y) {
  const t = up(s);
  if (HAS_LS || t.length < 2) { c.fillText(t, x, y); return; }
  for (const ch of t) { c.fillText(ch, x, y); x += c.measureText(ch).width + LBL.ls; }
}
function bounds(e) {
  if (e.t === 'hero') return { x: e.x, y: e.y, w: e.w, h: e.h + HEAD };
  return { x: e.x + LBL.dx, y: e.y + LBL.dy, w: Math.max(2, measure(e.name)), h: LBL.size };
}
// сдвиг видимой рамки относительно x/y элемента
const boundsOff = e => e.t === 'hero' ? [0, 0] : [LBL.dx, LBL.dy];
// центр видимого символа — по нему символ привязан к клетке сетки плотности
const glyphCenter = e => ({ x: e.x + LBL.dx + measure(e.name) / 2, y: e.y + LBL.dy + LBL.size / 2 });
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

// Картинка карточки: 51×83 минус отступ 4px с каждой стороны, обрезка «cover», saturation 0.7.
// Готовим один раз на героя — дальше рисуем уже обрезанную и приглушённую картинку.
const IMG_W = CARD_W - PAD, IMG_H = CARD_H - PAD, INSET = PAD / 2;
const cardArts = new Map();
function cardArt(i) {
  const im = heroImg(i);
  let cv = cardArts.get(i);
  if (cv && cv.src === im.src) return cv;
  if (!im.complete || !im.naturalWidth) return null;
  const W = im.naturalWidth, H = im.naturalHeight, k = IMG_W / IMG_H;
  const sw = W / H > k ? H * k : W, sh = W / H > k ? H : W / k;
  cv = document.createElement('canvas'); cv.width = Math.round(sw); cv.height = Math.round(sh); cv.src = im.src;
  const x = cv.getContext('2d');
  x.filter = `saturate(${SAT})`;
  x.drawImage(im, (W - sw) / 2, (H - sh) / 2, sw, sh, 0, 0, cv.width, cv.height);
  cardArts.set(i, cv);
  return cv;
}
function drawCard(c, i, x, y, w, h) {
  const art = cardArt(i);
  if (art) c.drawImage(art, x, y, w, h);
  else { c.fillStyle = '#' + HEROES[i].c; c.fillRect(x, y, w, h); }
}

// Цвета холста для светлой и тёмной темы. Превью всегда как в игре: светлым по тёмному.
// Тёплый графит из макета 1b: oklch(0.13 / 0.16 / 0.3 0.005 60) и акцент oklch(0.68 0.19 38), переведённые в hex.
const CANVAS_THEMES = {
  light: { bg: '#f3efed', dot: '#d1cdc9', sheet: '#fdfcfb', shadow: 'rgba(40,30,20,.14)', grid: 'rgba(40,30,20,.06)', border: 'rgba(40,30,20,.1)',
    label: '#8b8580', glyph: '#1c1a18', text: '#353230', dash: '#1c1a18', fade: '253,252,251', accent: '#e04f1a',
    box: 'rgba(224,79,26,.55)', boxFill: 'rgba(224,79,26,.045)', boxLabel: '#bf4213', hover: 'rgba(224,79,26,.35)' },
  dark: { bg: '#080706', dot: '#302d2b', sheet: '#0f0d0c', shadow: 'rgba(0,0,0,.5)', grid: 'rgba(255,255,255,.04)', border: 'rgba(255,255,255,.07)',
    label: '#76706c', glyph: '#f1eeeb', text: '#d3ccc7', dash: '#f1eeeb', fade: '15,13,12', accent: '#f56333',
    box: 'rgba(245,99,51,.6)', boxFill: 'rgba(245,99,51,.06)', boxLabel: '#fb784f', hover: 'rgba(245,99,51,.4)' },
};
let T = CANVAS_THEMES[document.documentElement.dataset.theme] || CANVAS_THEMES.dark;
const INK = { get glyph() { return T.glyph; }, get text() { return T.text; }, get box() { return T.box; }, get boxFill() { return T.boxFill; }, get label() { return T.boxLabel; } };
function renderEls(c, list, o) {
  c.imageSmoothingQuality = 'high';
  for (const e of list) {
    if (e.t !== 'hero') continue;
    if (o.fade) c.globalAlpha = o.fade(e);
    const ly = e.y + HEAD; // список героев — под строкой с названием
    if (o.editor) {
      c.fillStyle = INK.boxFill; c.fillRect(e.x, ly, e.w, e.h);
      c.strokeStyle = INK.box; c.lineWidth = 1 / o.zoom; c.strokeRect(e.x, ly, e.w, e.h);
    }
    const n = e.heroes.length;
    if (n) {
      const L = heroLayout(e), s = L.s;
      for (let k = 0; k < n; k++) {
        const i = HERO_IDX.get(e.heroes[k]);
        if (i === undefined) continue;
        drawCard(c, i, e.x + (PAD / 2 + (k % L.c) * CARD_W + INSET) * s, ly + (PAD / 2 + Math.floor(k / L.c) * CARD_H + INSET) * s, IMG_W * s, IMG_H * s);
      }
    }
    // в редакторе — число героев рядом с названием, у безымянных одиночных категорий — пометка
    if (o.editor && (e.name || !e.g)) {
      c.fillStyle = INK.label; c.font = `500 ${11 / o.zoom}px Onest, sans-serif`; c.textBaseline = 'middle';
      c.fillText(e.name ? `${n}` : `без названия · ${n}`, e.x + LBL.dx + (e.name ? measure(e.name) + 6 : 0), e.y + LBL.dy + LBL.size / 2);
    }
  }
  // подписи: текст, символы и названия категорий героев — одним шрифтом, как в игре
  c.font = labelFont(); c.textBaseline = 'top';
  if (HAS_LS) c.letterSpacing = LBL.ls + 'px';
  for (const e of list) {
    if (!e.name) continue;
    if (o.fade) c.globalAlpha = o.fade(e);
    c.fillStyle = o.editor ? (e.t === 'glyph' ? INK.glyph : INK.text) : GAME.label;
    drawLabel(c, e.name, e.x + LBL.dx, e.y + LBL.dy);
  }
  if (HAS_LS) c.letterSpacing = '0px';
  c.globalAlpha = 1;
}

// ---------- превью «как в игре» ----------
// Экран «Герои» в Доте. Размеры сетки и подвала — из panorama/styles/hero_grid_new.css
// (DOTAHeroGridNew 1204 × 678, из них подвал #Footer 66), остальное снято со скриншотов 16:9.
// Всё в единицах сетки (x_position/y_position), поэтому зум и пан работают как в редакторе.
const GAME = { label: '#808fa6', bg: '#1d140e' };
const GRID = { w: 1204, h: 612, foot: 66 };
const GAME_FRAME = { x: -237, y: -150, w: 1667, h: 938 };
const viewRect = () => st.preview ? GAME_FRAME : { x: 0, y: 0, w: S.areaW, h: S.areaH };
const heroWord = n => n % 10 === 1 && n % 100 !== 11 ? 'ГЕРОЯ' : 'ГЕРОЕВ';

function drawDotaScreen(c) {
  const F = GAME_FRAME, W = GRID.w, H = GRID.h, FB = H + GRID.foot;
  const ui = fontFamily(), serif = 'Georgia, "Times New Roman", serif';
  const font = (f, ls = 0) => { c.font = f; c.letterSpacing = ls + 'px'; };
  const text = (s, x, y, color, align = 'left') => { c.fillStyle = color; c.textAlign = align; c.fillText(s, x, y); };
  const box = (x, y, w, h, fill, stroke, r = 0) => {
    c.beginPath(); r ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h);
    c.fillStyle = fill; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.beginPath(); r ? c.roundRect(x + .5, y + .5, w - 1, h - 1, r) : c.rect(x + .5, y + .5, w - 1, h - 1); c.stroke(); }
  };
  const vgrad = (y0, y1, stops) => { const g = c.createLinearGradient(0, y0, 0, y1); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; };
  c.save();
  c.beginPath(); c.rect(F.x, F.y, F.w, F.h); c.clip();
  c.textBaseline = 'middle';

  // фон страницы: тёплый коричневый, светлее под меню, к низу темнее
  c.fillStyle = GAME.bg; c.fillRect(F.x, F.y, F.w, F.h);
  let g = c.createRadialGradient(W / 2, -60, 0, W / 2, -60, F.w * .7);
  g.addColorStop(0, 'rgba(64,46,28,.32)'); g.addColorStop(1, 'rgba(64,46,28,0)');
  c.fillStyle = g; c.fillRect(F.x, F.y, F.w, F.h);
  c.fillStyle = vgrad(H, F.y + F.h, ['#1b1715', '#150d09', '#0d0805', '#050302']); c.fillRect(F.x, H, F.w, F.y + F.h - H);

  // верхнее меню
  const ty = F.y, th = 52;
  c.fillStyle = vgrad(ty, ty + th, ['#1d232d', '#11151c']); c.fillRect(F.x, ty, F.w, th);
  box(F.x, ty + th - 1, F.w, 1, 'rgba(255,255,255,.05)');
  // слот логотипа и активная вкладка — скошенные плашки
  const slant = (x0, x1, fill) => { c.beginPath(); c.moveTo(x0 + 8, ty); c.lineTo(x1 + 8, ty); c.lineTo(x1, ty + th); c.lineTo(x0, ty + th); c.closePath(); c.fillStyle = fill; c.fill(); };
  slant(-14, 60, vgrad(ty, ty + th, ['#2a303a', '#1a1f27']));
  slant(94, 238, vgrad(ty, ty + th, ['#3b4654', '#252d38']));
  c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1;
  for (const x of [60, 238, 383, 525, 675, 816]) { c.beginPath(); c.moveTo(x + 8, ty + 4); c.lineTo(x, ty + th - 4); c.stroke(); }
  font(`bold 17px ${serif}`);
  [['ГЕРОИ', 171], ['АРСЕНАЛ', 313], ['ПРОСМОТР', 456], ['БАЗА ЗНАНИЙ', 598], ['ИГРОТЕКА', 743]]
    .forEach(([s, x], k) => text(s, x, ty + th / 2 + 1, k ? '#9aa3ae' : '#eef1f4', 'center'));
  // справа — валюта и иконки профиля, приглушённо
  c.fillStyle = '#c9772a'; c.beginPath(); c.moveTo(1090, ty + 14); c.lineTo(1099, ty + 20); c.lineTo(1099, ty + 33); c.lineTo(1090, ty + 38); c.lineTo(1081, ty + 33); c.lineTo(1081, ty + 20); c.fill();
  font(`bold 17px ${ui}`); text('3 900', 1106, ty + 25, '#e7c27a');
  c.fillStyle = '#3b5e9c'; c.beginPath(); c.arc(1195, ty + 29, 10, 0, 7); c.fill();
  box(1250, ty + 14, 14, 22, '#59616d'); box(1268, ty + 12, 4, 26, '#59616d');

  // подменю «ГЕРОИ / РУКОВОДСТВА / ТРЕНДЫ»
  const sy = ty + th, sh = 44, sm = sy + sh / 2;
  c.fillStyle = vgrad(sy, sy + sh, ['#130c07', '#0f0905']); c.fillRect(F.x, sy, F.w, sh);
  box(F.x, sy + sh - 1, F.w, 1, 'rgba(255,220,180,.05)');
  font(`600 15px ${ui}`, 3.4);
  text('ГЕРОИ', 135, sm, '#ece9e4'); text('/', 216, sm, '#77736d'); text('РУКОВОДСТВА', 236, sm, '#a8a49e');
  text('/', 399, sm, '#77736d'); text('ТРЕНДЫ', 442, sm, '#a8a49e');
  c.strokeStyle = '#d9a441'; c.lineWidth = 1.6; c.beginPath();
  for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k + Math.PI / 6; c.lineTo(427 + 8 * Math.cos(a), sm + 8 * Math.sin(a)); }
  c.closePath(); c.stroke();
  c.fillStyle = '#d9a441'; c.fillRect(424.5, sm - 1, 5, 2); c.fillRect(426, sm - 2.5, 2, 5);

  // баны
  font(`600 14px ${ui}`, 2.6); text('БАНЫ', 918, -22, '#b9bec6', 'right');
  for (let k = 0; k < 4; k++) {
    const x = 932 + k * 67.5, y = -41;
    box(x, y, 60, 35, vgrad(y, y + 35, ['#232b37', '#161b23']), 'rgba(140,160,185,.22)');
    c.strokeStyle = '#6d7887'; c.lineWidth = 1.8;
    c.beginPath(); c.arc(x + 30, y + 17.5, 7.5, 0, 7); c.moveTo(x + 24.7, y + 12.2); c.lineTo(x + 35.3, y + 22.8); c.stroke();
  }

  // #MissingHeroesButton: «НЕ ВИДНО N ГЕРОЕВ» внизу по центру сетки, фон #00000060, отступы 8 × 15
  const used = new Set();
  for (const e of st.els) if (e.t === 'hero') for (const id of e.heroes) if (HERO_IDX.has(id)) used.add(id);
  const hidden = HEROES.length - used.size;
  if (hidden > 0) {
    font(`500 16px ${ui}`, 1);
    const s = `НЕ ВИДНО ${hidden} ${heroWord(hidden)}`, w = c.measureText(s).width + 30;
    box(W / 2 - w / 2, H - 36, w, 36, 'rgba(0,0,0,.376)');
    text(s, W / 2, H - 17, '#b0bcc2', 'center');
  }
  // #Footer: верхняя граница — светлая линия, гаснущая к краям
  g = c.createLinearGradient(0, 0, W, 0);
  [[0, 0], [.06, .05], [.5, .1], [.94, .05], [1, 0]].forEach(([o, a]) => g.addColorStop(o, `rgba(225,238,255,${a})`));
  c.fillStyle = g; c.fillRect(0, H, W, 1);

  // «СОРТИРОВКА:» (обрезана по ширине 80, как в игре), кнопка с названием сетки и кнопка правки
  const by = H + 20, bh = 34;
  c.save(); c.beginPath(); c.rect(-4, by, 72, bh); c.clip();
  font(`500 11px ${ui}`, 1); text('СОРТИРОВКА:', 68, by + bh / 2, 'rgba(128,143,166,.85)', 'right');
  c.restore();
  const btn = (x, w) => box(x, by, w, bh, vgrad(by, by + bh, ['#262c30', '#121719']), 'rgba(255,255,255,.16)', 3);
  btn(75, 183); btn(265, 49);
  c.save(); c.beginPath(); c.rect(80, by, 150, bh); c.clip();
  font(`16px ${ui}`); text(S.configName || 'Моя сетка', 86, by + bh / 2 + 1, '#dae2e5');
  c.restore();
  c.fillStyle = '#dae2e5'; c.beginPath(); c.moveTo(235, by + 14); c.lineTo(249, by + 14); c.lineTo(242, by + 21); c.fill();
  // карандаш на кнопке правки
  c.save(); c.translate(289.5, by + bh / 2); c.rotate(Math.PI / 4);
  c.fillStyle = '#dae2e5'; c.fillRect(-2.5, -9, 5, 13); c.beginPath(); c.moveTo(-2.5, 5); c.lineTo(2.5, 5); c.lineTo(0, 9); c.fill();
  c.restore();

  // фильтры: подписи и серые плашки с иконками (wash-color #616d7e)
  const fy = H + 28, fh = 25;
  const tile = (x, w, kind) => {
    c.beginPath(); c.moveTo(x + 3, fy); c.lineTo(x + w, fy); c.lineTo(x + w - 3, fy + fh); c.lineTo(x, fy + fh); c.closePath();
    c.fillStyle = '#7d8797'; c.fill();
    const cx = x + w / 2, cy = fy + fh / 2;
    c.fillStyle = c.strokeStyle = '#22272f'; c.lineWidth = 2; c.beginPath();
    if (kind === 'd') { c.moveTo(cx, cy - 6); c.lineTo(cx + 6, cy); c.lineTo(cx, cy + 6); c.lineTo(cx - 6, cy); c.fill(); }
    else if (kind === 'x') { c.moveTo(cx - 6, cy - 6); c.lineTo(cx + 6, cy + 6); c.moveTo(cx + 6, cy - 6); c.lineTo(cx - 6, cy + 6); c.stroke(); }
    else if (kind === 'o') { c.arc(cx, cy, 6, 0, 7); c.stroke(); }
    else if (kind === 's') { c.moveTo(cx - 6, cy - 6); c.lineTo(cx + 6, cy - 6); c.lineTo(cx + 5, cy + 2); c.lineTo(cx, cy + 7); c.lineTo(cx - 5, cy + 2); c.fill(); }
    else { c.moveTo(cx - 6, cy + 6); c.lineTo(cx + 6, cy - 6); c.stroke(); c.beginPath(); c.arc(cx - 4, cy + 4, 2.5, 0, 7); c.fill(); }
  };
  font(`500 13px ${ui}`, 1.6);
  const groups = [['ТИП', 611, 585, 29.5, 'x/'], ['СЛОЖНОСТЬ', 704, 677, 27.5, 'ddd'], ['МЕТКИ', 879, 769, 29.3, '/x/os/xs'], ['БИЛЕТЫ', 1143, 1129, 30, 'o']];
  for (const [name, lx, x0, step, kinds] of groups) {
    text(name, lx, H + 16, '#aab4c3', 'center');
    [...kinds].forEach((k, i) => tile(x0 + i * step, step - 2, k));
  }
  text('НАКЛЕЙКИ', 1044, H + 16, '#aab4c3', 'center');
  c.setLineDash([2.5, 2.5]); c.strokeStyle = '#7d8797'; c.lineWidth = 1.3;
  c.beginPath(); c.arc(1044, fy + fh / 2, 11, 0, 7); c.stroke(); c.setLineDash([]);

  // нижняя панель: группа, чат, «ИГРАТЬ»
  const py = FB + 30;
  box(-208, py, 316, 63, '#0e1014', 'rgba(255,255,255,.07)');
  box(-198, py + 8, 40, 46, vgrad(py + 8, py + 54, ['#565b62', '#2f3338']));
  c.fillStyle = '#c9ccd0'; c.beginPath(); c.arc(-178, py + 24, 8, 0, 7); c.fill(); c.fillRect(-190, py + 34, 24, 16);
  for (let k = 0; k < 4; k++) {
    box(-156 + k * 40, py + 8, 38, 46, '#1c2027');
    c.fillStyle = '#343a43'; c.beginPath(); c.arc(-137 + k * 40, py + 24, 6, 0, 7); c.fill(); c.fillRect(-146 + k * 40, py + 32, 18, 12);
  }
  box(52, py + 9, 44, 44, '#1b1915', '#b99b5b');
  c.strokeStyle = '#b99b5b'; c.lineWidth = 2.5;
  for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(62 + k * 9, py + 45); c.lineTo(80 + k * 9, py + 17); c.stroke(); }
  c.fillStyle = '#15181d'; c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 1.5;
  c.beginPath(); c.arc(142, py + 34, 23, 0, 7); c.fill(); c.stroke();
  c.fillStyle = '#e6e8eb';
  for (const dx of [-8, 0, 8]) { c.beginPath(); c.arc(142 + dx, py + 29, 3.2, 0, 7); c.fill(); c.fillRect(142 + dx - 3.5, py + 33, 7, 7); }

  const cw = 596, cx0 = W / 2 - 6 - cw / 2, cy0 = FB + 62;
  box(cx0, cy0, cw, 29, 'rgba(6,7,9,.9)', 'rgba(255,255,255,.06)');
  font(`13px ${ui}`);
  text('(Группа):', cx0 + 6, cy0 + 15, '#8fb3e4');
  const lw = c.measureText('(Группа): ').width;
  text('Введите сообщение или символ "/" для команд.', cx0 + 6 + lw, cy0 + 15, '#777d86');
  c.fillStyle = '#9aa0a8'; c.beginPath(); c.arc(cx0 + cw - 68, cy0 + 14.5, 6.5, 0, 7); c.fill();
  box(cx0 + cw - 50, cy0 + 4, 22, 21, '#2a2f37'); box(cx0 + cw - 25, cy0 + 4, 22, 21, '#2a2f37');
  text('?', cx0 + cw - 14, cy0 + 15, '#b8bdc4', 'center');

  const bx = 1093, bw = 288, bt = FB + 48, bh2 = 44;
  box(bx, bt, bw, bh2, vgrad(bt, bt + bh2, ['#4f8f47', '#3a7437', '#2d5b2b']), 'rgba(170,220,150,.45)');
  c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(bx + 20, bt + bh2); c.lineTo(bx + 70, bt); c.moveTo(bx + bw - 60, bt + bh2); c.lineTo(bx + bw - 10, bt); c.stroke();
  font(`bold 22px ${serif}`, 4.5); text('ИГРАТЬ', bx + bw / 2 + 2, bt + bh2 / 2 + 1, '#eef4ea', 'center');

  c.letterSpacing = '0px'; c.textAlign = 'left';
  c.restore();
}

// Всё, что за пределами сетки, Дота прячет под прокрутку (#GridCategories { overflow: scroll }).
function drawGameScrollbars(c) {
  const bb = bboxOf(st.els);
  if (!bb) return;
  const bottom = bb.y + bb.h, right = bb.x + bb.w;
  c.fillStyle = 'rgba(150,165,185,.55)';
  if (bottom > GRID.h + 1) { c.beginPath(); c.roundRect(GRID.w + 2, 0, 5, GRID.h * GRID.h / bottom, 2.5); c.fill(); }
  if (right > GRID.w + 1) { c.beginPath(); c.roundRect(0, GRID.h - 7, GRID.w * GRID.w / right, 5, 2.5); c.fill(); }
}

// Лист холста: белая бумага в редакторе, экран героев Доты в превью (подложки в игре нет).
function drawArea(c, editor) {
  if (!editor) { drawDotaScreen(c); return; }
  c.fillStyle = T.sheet; c.fillRect(0, 0, S.areaW, S.areaH);
  const bg = st.bg;
  if (bg.img && bg.show) {
    const f = Convert.fitRect(bg.img.naturalWidth, bg.img.naturalHeight, S.areaW, S.areaH);
    c.globalAlpha = bg.opacity; c.drawImage(bg.img, f.x, f.y, f.w, f.h); c.globalAlpha = 1;
    // «приглушение» уводит подложку в цвет листа, чтобы рисунок поверх читался
    if (bg.dim > 0) { c.fillStyle = `rgba(${T.fade},${bg.dim})`; c.fillRect(0, 0, S.areaW, S.areaH); }
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
  let gap = 20; while (gap * z < 14) gap *= 2; while (gap * z > 40) gap /= 2;
  const sg = gap * z, ox = ((st.panX % sg) + sg) % sg, oy = ((st.panY % sg) + sg) % sg;
  ctx.fillStyle = T.dot;
  for (let y = oy; y < H; y += sg) for (let x = ox; x < W; x += sg) ctx.fillRect(x - 1, y - 1, 2, 2);

  // тень листа (в превью — тень всего «экрана» игры)
  const V = viewRect();
  const RAD = 6; // скругление листа в экранных пикселях
  ctx.save();
  ctx.shadowColor = editor ? T.shadow : 'rgba(0,0,0,.5)'; ctx.shadowBlur = editor ? 80 : 60; ctx.shadowOffsetY = editor ? 30 : 16;
  ctx.fillStyle = editor ? T.sheet : GAME.bg;
  ctx.beginPath(); ctx.roundRect(st.panX + V.x * z, st.panY + V.y * z, V.w * z, V.h * z, RAD); ctx.fill();
  ctx.restore();

  ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * st.panX, dpr * st.panY);
  ctx.save();
  if (editor) { ctx.beginPath(); ctx.roundRect(0, 0, S.areaW, S.areaH, RAD / z); ctx.clip(); }
  drawArea(ctx, editor);

  if (editor && S.showGrid && S.cellW * z >= 6 && S.cellH * z >= 6) {
    ctx.strokeStyle = T.grid; ctx.lineWidth = 1 / z; ctx.beginPath();
    for (let x = S.cellW; x < S.areaW; x += S.cellW) { ctx.moveTo(x, 0); ctx.lineTo(x, S.areaH); }
    for (let y = S.cellH; y < S.areaH; y += S.cellH) { ctx.moveTo(0, y); ctx.lineTo(S.areaW, y); }
    ctx.stroke();
  }
  ctx.restore();
  // только что добавленные элементы проявляются плавно
  let fade = null;
  if (st.fade) {
    const t = (performance.now() - st.fade.t0) / 360;
    if (t >= 1) st.fade = null;
    else { const a = 1 - (1 - t) ** 3, ids = st.fade.ids; fade = e => ids.has(e.id) ? a : 1; requestRender(); }
  }
  if (editor) renderEls(ctx, st.els, { editor, zoom: z, fade });
  else {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, GRID.w, GRID.h); ctx.clip();
    renderEls(ctx, st.els, { editor, zoom: z, fade });
    ctx.restore();
    drawGameScrollbars(ctx);
  }

  if (st.ghost) {
    ctx.globalAlpha = 0.7; ctx.fillStyle = T.accent;
    ctx.font = labelFont(); ctx.textBaseline = 'top';
    const ch = currentPen(), w = measure(ch);
    for (const [cx, cy] of st.ghost) ctx.fillText(up(ch), cx * S.cellW + (S.cellW - w) / 2, cy * S.cellH + (S.cellH - LBL.size) / 2);
    ctx.globalAlpha = 1;
  }

  // оверлеи в экранных координатах — чтобы линии были чёткими при любом зуме
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sx = x => x * z + st.panX, sy = y => y * z + st.panY;
  ctx.strokeStyle = T.border; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(Math.round(sx(V.x)) + .5, Math.round(sy(V.y)) + .5, Math.round(V.w * z), Math.round(V.h * z), RAD); ctx.stroke();
  // наведение на строку в «Категориях» — пунктирная рамка вокруг объекта
  if (editor && st.hoverIds) {
    const list = st.els.filter(e => st.hoverIds.has(e.id));
    if (list.length) {
      const bb = bboxOf(list);
      ctx.setLineDash([3, 3]); ctx.strokeStyle = T.hover;
      ctx.strokeRect(Math.round(sx(bb.x)) - 3.5, Math.round(sy(bb.y)) - 3.5, bb.w * z + 7, bb.h * z + 7); ctx.setLineDash([]);
    }
  }
  // подпись листа, как в макете: «Холст · 1200 × 600»
  ctx.fillStyle = T.label; ctx.font = '11px "JetBrains Mono", Consolas, monospace'; ctx.textBaseline = 'bottom';
  ctx.fillText(editor ? `Холст · ${S.areaW} × ${S.areaH}` : 'Как в игре · экран «Герои», 16:9', Math.round(sx(V.x)), Math.round(sy(V.y)) - 8);
  if (editor && st.sel.size) {
    const list = selEls();
    ctx.strokeStyle = T.accent; ctx.lineWidth = 1;
    if (list.length <= 150) for (const e of list) { const b = bounds(e); ctx.strokeRect(sx(b.x) + .5, sy(b.y) + .5, b.w * z, b.h * z); }
    const bb = bboxOf(list);
    if (list.length > 1) {
      ctx.setLineDash([4, 4]); ctx.strokeStyle = T.dash;
      ctx.strokeRect(Math.round(sx(bb.x)) - 4.5, Math.round(sy(bb.y)) - 4.5, bb.w * z + 9, bb.h * z + 9); ctx.setLineDash([]);
    }
    if (list.length === 1 && list[0].t === 'hero') {
      const e = list[0], hx = sx(e.x + e.w), hy = sy(e.y + HEAD + e.h);
      ctx.fillStyle = T.sheet; ctx.strokeStyle = T.accent; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.rect(hx - 4.5, hy - 4.5, 9, 9); ctx.fill(); ctx.stroke();
    }
  }
  if (st.rect) {
    const r = st.rect;
    ctx.fillStyle = r.kind === 'erase' ? 'rgba(239,104,86,.08)' : T.boxFill;
    ctx.strokeStyle = r.kind === 'erase' ? '#ef6856' : T.accent; ctx.lineWidth = 1;
    ctx.fillRect(sx(r.x), sy(r.y), r.w * z, r.h * z);
    ctx.setLineDash(r.kind === 'hero' ? [] : [4, 3]); ctx.strokeRect(sx(r.x) + .5, sy(r.y) + .5, r.w * z, r.h * z); ctx.setLineDash([]);
  }
  updateChrome();
}

let lastCount = -1;
function updateChrome() {
  $('#zoomVal').textContent = Math.round(st.zoom * 100) + '%';
  const n = st.els.length, b = $('#catCount');
  b.textContent = n.toLocaleString('ru');
  if (n !== lastCount) { b.classList.remove('bump'); void b.offsetWidth; if (lastCount >= 0) b.classList.add('bump'); lastCount = n; }
  b.classList.toggle('bad', n > 6000); b.classList.toggle('warn', n > 2500 && n <= 6000);
  // пустое состояние лежит прямо на листе
  const es = $('#emptyState');
  es.hidden = n > 0 || !!st.bg.img || st.preview;
  if (!es.hidden) Object.assign(es.style, { left: st.panX + 'px', top: st.panY + 'px', width: S.areaW * st.zoom + 'px', height: S.areaH * st.zoom + 'px' });
  $('#btnUndo').disabled = !st.undo.length; $('#btnRedo').disabled = !st.redo.length;
  $('#stSel').textContent = st.sel.size ? `выделено: ${st.sel.size}` : '';
}

// ---------- вид ----------
// Вписываем лист в свободное место между плавающими панелями.
function fitView(animate = true) {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  const V = viewRect();
  // в превью панели и док спрятаны — экран игры занимает всё место
  const inset = el => !st.preview && el.offsetWidth && W > 700 ? el.offsetWidth + 28 : 0;
  // без панели категорий слева стоит столбик «отмена / масштаб» — лист не должен под него заезжать
  const left = inset($('#layers')) || (!st.preview && W <= 1180 ? 48 : 0), right = inset($('#inspector'));
  // отступ сверху — от нижнего края верхних панелей (на узком экране их два ряда)
  const top = Math.max(...['#brandPill', '#viewSwitch', '.top-actions'].map(q => $(q).getBoundingClientRect().bottom)) + (st.preview ? 30 : 40);
  const bottom = st.preview ? 36 : 96, side = st.preview ? 28 : 40;
  const aw = W - left - right - side * 2, ah = H - top - bottom;
  const z = clamp(Math.min(aw / V.w, ah / V.h), 0.05, 20);
  animateView(z, left + side + (aw - V.w * z) / 2 - V.x * z, top + (ah - V.h * z) / 2 - V.y * z, animate);
}
function setPreview(on) {
  if (st.preview === on) return;
  st.preview = on;
  document.body.classList.toggle('previewing', on);
  // при возврате панели въезжают обратно, а не просто появляются
  document.body.classList.toggle('was-previewing', !on);
  clearTimeout(setPreview.t); if (!on) setPreview.t = setTimeout(() => document.body.classList.remove('was-previewing'), 600);
  for (const b of $$('#viewSwitch [data-view]')) b.classList.toggle('on', (b.dataset.view === 'game') === on);
  moveSegInd();
  canvas.style.cursor = on ? 'grab' : '';
  fitView();
}
// «таблетка» переключателя переезжает под активную вкладку
function moveSegInd() {
  const b = $('#viewSwitch .on'), ind = $('#segInd');
  if (!b || !ind) return;
  ind.style.width = b.offsetWidth + 'px';
  ind.style.transform = `translateX(${b.offsetLeft}px)`;
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
    const nb = bounds(e), [ox, oy] = boundsOff(e);
    e.x = cx + nx - nb.w / 2 - ox; e.y = cy + ny - nb.h / 2 - oy;
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
    const nb = bounds(e), [bx, by] = boundsOff(e);
    e.x = ncx - nb.w / 2 - bx; e.y = ncy - nb.h / 2 - by;
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
  const cells = glyphs.map(e => { const p = glyphCenter(e); return { c: Math.floor(p.x / S.cellW), r: Math.floor(p.y / S.cellH), ch: e.name }; });
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
const glyphKey = e => { const p = glyphCenter(e); return Math.floor(p.x / S.cellW) + ',' + Math.floor(p.y / S.cellH); };
// позиция категории, при которой символ встанет по центру клетки (подпись в игре сдвинута на LBL.dx/dy)
const cellX = (cx, w) => cx * S.cellW + (S.cellW - w) / 2 - LBL.dx;
const cellY = cy => cy * S.cellH + (S.cellH - LBL.size) / 2 - LBL.dy;
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
  if (old) { if (old.name === ch) return false; old.name = ch; old.x = cellX(cx, w); return true; }
  const [e] = addEls([{ t: 'glyph', name: ch, x: cellX(cx, w), y: cellY(cy), g }], { group: false, select: false });
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
  return Math.abs(w.x - (e.x + e.w)) < t && Math.abs(w.y - (e.y + HEAD + e.h)) < t ? e : null;
}

canvas.addEventListener('pointerdown', e => {
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  canvas.setPointerCapture(e.pointerId);
  const w = toWorld(e), tool = st.tool;
  // в превью холст только двигается — редактировать нечем, панели спрятаны
  if (e.button === 1 || spaceDown || tool === 'pan' || st.preview) {
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
    addEls([{ t: 'text', name: 'Текст', x: w.x - LBL.dx, y: w.y - LBL.size / 2 - LBL.dy }], { group: false });
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
      // рамка — это список героев; строка с названием стоит над ним
      addEls([{ t: 'hero', name: 'Категория', ...r, y: r.y - HEAD, heroes: [] }], { group: false });
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
  if (spaceDown || st.tool === 'pan' || st.preview) c = 'grab';
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
  Object.assign(ind.style, { width: b.offsetWidth + 'px', height: b.offsetHeight + 'px', top: b.offsetTop + 'px', transform: `translateX(${b.offsetLeft}px)` });
}

// ---------- тема ----------
const themeName = () => document.documentElement.dataset.theme === 'dark' ? 'Светлая тема' : 'Тёмная тема';
function applyThemeIcon() {
  const b = $('#menuTheme'), dark = document.documentElement.dataset.theme === 'dark';
  b.innerHTML = `${icon(dark ? 'sun' : 'moon')}${themeName()} <kbd>Shift T</kbd>`;
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
    ${sw('showGrid', 'Сетка плотности', S.showGrid)}
    ${sw('snap', 'Привязка ASCII к сетке', S.snap)}
    <button class="font-drop" id="btnFont"><b>Шрифт Radiance${st.userFont ? ' <i>загружен</i>' : ''}</b><span>${st.userFont ? 'Клик — загрузить другой. ' : 'Загрузи .ttf, чтобы превью совпадало с игрой. '}Цвет и шрифт подписей в Доте не меняются — редактор показывает их как в игре.</span></button>
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
  renderLayers();
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


// ---------- «Категории»: объекты холста слева ----------
// Группа (картинка, фигура, штрих карандаша) — одна строка; одиночные символы собраны в «Символы»,
// категории героев и тексты — по строке на каждую. Клик выделяет объект, Shift — добавляет к выделению.
const LAYER_MAX = 120;
let layerRows = [], layerKeys = new Set();
function buildLayers() {
  const groups = new Map(), loose = [], rows = [];
  for (const e of st.els) {
    if (e.g) { let g = groups.get(e.g); if (!g) groups.set(e.g, g = { key: 'g' + e.g, ids: [], kinds: new Set() }); g.ids.push(e.id); g.kinds.add(e.t); }
    else if (e.t === 'glyph') loose.push(e.id);
    else rows.push({ key: 'e' + e.id, ids: [e.id], kind: e.t, name: e.t === 'hero' ? (e.name || 'Без названия') : `«${e.name}»`, n: e.t === 'hero' ? e.heroes.length : 1 });
  }
  const num = { glyph: 0, hero: 0, mixed: 0 };
  for (const g of groups.values()) {
    const k = g.kinds.size > 1 ? 'mixed' : g.kinds.has('hero') ? 'hero' : 'glyph';
    const title = k === 'hero' ? 'Мозаика' : k === 'mixed' ? 'Группа' : 'Рисунок';
    rows.push({ key: g.key, ids: g.ids, kind: k === 'hero' ? 'mosaic' : k, name: `${title} ${++num[k]}`, n: g.ids.length });
  }
  if (loose.length) rows.push({ key: 'loose', ids: loose, kind: 'glyph', name: 'Символы', n: loose.length });
  return rows;
}
const LAYER_ICON = { hero: 'heroes', mosaic: 'heroes', text: 'text', glyph: 'pencil', mixed: 'layers' };
function renderLayers() {
  const box = $('#layersList');
  if (!box) return;
  layerRows = buildLayers();
  const shown = layerRows.slice(0, LAYER_MAX), fresh = new Set(shown.map(r => r.key));
  box.innerHTML = shown.map((r, k) => {
    const on = r.ids.every(id => st.sel.has(id));
    // новые строки въезжают, старые стоят на месте — чтобы список не «мигал» при каждой правке
    const anim = layerKeys.has(r.key) ? ' style="animation:none"' : '';
    return `<button class="lrow${on ? ' on' : ''}" data-k="${k}"${anim}>${icon(LAYER_ICON[r.kind])}<span>${esc(r.name)}</span><b>${r.n.toLocaleString('ru')}</b></button>`;
  }).join('') + (layerRows.length > LAYER_MAX ? `<div class="lmore">и ещё ${layerRows.length - LAYER_MAX}…</div>` : '');
  layerKeys = fresh;
}
{
  const box = $('#layersList');
  const rowOf = ev => { const b = ev.target.closest('.lrow'); return b ? layerRows[+b.dataset.k] : null; };
  box.addEventListener('click', ev => {
    const r = rowOf(ev); if (!r) return;
    if (st.tool !== 'select') setTool('select');
    if (ev.shiftKey) { const all = r.ids.every(id => st.sel.has(id)); for (const id of r.ids) all ? st.sel.delete(id) : st.sel.add(id); }
    else st.sel = new Set(r.ids);
    requestRender(); renderInspector();
  });
  const hover = r => { const key = r ? r.key : null; if (key === hover.key) return; hover.key = key; st.hoverIds = r ? new Set(r.ids) : null; requestRender(); };
  box.addEventListener('mouseover', ev => hover(rowOf(ev)));
  box.addEventListener('mouseleave', () => hover(null));
}

// ---------- модальные окна ----------
function openModal(html, { wide = false, cls = '', onClose } = {}) {
  const root = $('#modalRoot'), token = {};
  root._token = token; root.classList.remove('closing');
  root.innerHTML = `<div class="modal ${wide ? 'wide' : ''} ${cls}">${html}</div>`;
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
      <div class="hint">Границы ищутся Canny (как в Photoshop), сшиваются в линии, и символы ставятся вдоль них с шагом «Плотность», повёрнутые по линии. Короткие обрывки и двойные контуры отбрасываются. Лимит 0 — без ограничения.</div>`,
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
      const len = cols => [...steamText(Convert.ascii(img, { ...IP, mode: 'braille', cols }, { w: S.areaW, h: S.areaH }, measure, LBL.size).lines)].length;
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
    const toCategories = els => { for (const e of els) { e.x -= LBL.dx; e.y -= LBL.dy; } };
    let info = '';
    if (IP.mode === 'mosaic') {
      const pool = HEROES.map((h, i) => i).filter(i => !disabledHeroes.has(HEROES[i].id));
      // над каждой полосой мозаики есть строка названия 20px — оставляем под неё место сверху
      result = Convert.mosaic(img, IP, { w: area.w - 3, h: area.h - HEAD - 3 }, HEROES, pool); // −3: запас на SLACK, чтобы не появилась прокрутка
      const n = result.els.reduce((a, e) => a + e.heroes.length, 0);
      info = `${result.cols}×${result.rows} · ${n} героев (${result.uniq} разных) · ${result.els.length} категорий`;
      if (!pool.length) info = 'В палитре нет ни одного героя';
    } else if (IP.mode === 'ascii') {
      result = Convert.ascii(img, { ...IP, mode: IP.amode, cols: IP.bcols }, area, measure, LBL.size);
      toCategories(result.els);
      if (result.th !== undefined && IP.autoThreshold) { const t = $('#threshold'); if (t) { t.value = IP.threshold = result.th; syncRange(t); } }
      info = `${result.els.length} категорий`;
      if (result.lines) {
        steam = steamText(result.lines);
        const n = [...steam].length, c = $('#steamCount');
        if (c) { c.textContent = `${n.toLocaleString('ru')} / 8 000`; c.classList.toggle('bad', n > STEAM_LIMIT); }
      }
    } else {
      result = Convert.lineart(img, { ...IP, step: IP.lstep }, area, measure, LBL.size, labelFont());
      toCategories(result.els);
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
    c.fillStyle = GAME.bg; c.fillRect(0, 0, S.areaW, S.areaH);
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
        els.push({ t: 'glyph', name: ch, x: c * sx + (sx - measure(ch)) / 2, y: r * sy + (sy - LBL.size) / 2 });
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
async function importJsonFiles(items, { remember = true } = {}) {
  const files = [];
  for (const { file, handle } of items) {
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.configs)) throw new Error('нет поля configs');
      files.push({ name: file.name, data, handle });
    } catch (e) { toast(`${file.name}: не похоже на hero_grid_config.json (${e.message})`, 'err'); }
  }
  if (!files.length) return;
  if (remember && !st.gridFile) st.gridFile = files[0];
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
      ${remember ? `<div class="hint">Файл <b>${esc(st.gridFile.name)}</b> запомнен: при экспорте сетку можно дописать в него, не трогая остальные.</div>` : ''}
    </div>
    <div class="modal-foot"><button class="btn sm" id="imAll">Выбрать все</button><span class="info"></span><button class="btn" data-close>Отмена</button><button class="btn primary" id="imGo" data-icon="download">Импортировать</button></div>`);
  $('#imAll').onclick = () => $$('.cfg-list input').forEach(i => i.checked = true);
  $('#imGo').onclick = () => {
    const chosen = $$('.cfg-list input').filter(i => i.checked).map(i => all[+i.dataset.k]);
    if (!chosen.length) return;
    snapshot();
    if (document.querySelector('input[name=imMode]:checked').value === 'replace') { st.els = []; S.configName = chosen[0].c.config_name || S.configName; $('#configName').value = S.configName; }
    const ids = [];
    for (const x of chosen) ids.push(...addEls((x.c.categories || []).map(categoryToEl), { select: false, group: false }).map(e => e.id));
    st.sel.clear();
    changed(true); m.close(); setTool('select');
    toast(`Импортировано ${ids.length} категорий из ${chosen.length} сет. Каждую можно двигать отдельно, рамкой — выделить несколько.`, 'ok');
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

// ----- каталог сеток -----
function openPublishModal() {
  if (!st.els.length) { toast('Холст пустой — нарисуй что-нибудь или открой JSON, потом выкладывай', 'err'); return; }
  const API = CatalogAPI, cats = st.els.map(elToCategory), info = GridRender.stats(cats);
  let thumb;
  try { thumb = GridRender.thumb(cats, { font: fontFamily() }); } catch (e) { toast('Не удалось сделать превью: ' + e.message, 'err'); return; }
  const m = openModal(`
    ${modalHead('Выложить в каталог')}
    <div class="modal-body" id="pbBody">
      <div class="pub-thumb"><img src="${thumb}" alt="Превью сетки"><span>${API.KINDS[info.kind]} · ${info.cats.toLocaleString('ru')} кат.</span></div>
      <label class="field"><span>Название</span><input class="input" id="pbTitle" maxlength="60" value="${esc(S.configName)}"></label>
      <label class="field"><span>Ник автора</span><input class="input" id="pbAuthor" maxlength="32" placeholder="Аноним" value="${esc(API.author())}"></label>
      <label class="field"><span>Описание · необязательно</span><textarea class="input plain" id="pbDesc" maxlength="500" rows="3" placeholder="Что нарисовано, как лучше смотрится, пожелания"></textarea></label>
      <div class="hint">${API.remote ? 'Сетку увидят все посетители каталога. Удалить её можно из этого же браузера.' : '<b>Демо-режим:</b> каталог ещё не подключён к базе, поэтому сетка сохранится только в этом браузере.'}
        На карточке герои показаны цветными плитками, на странице сетки — настоящими портретами.</div>
    </div>
    <div class="modal-foot"><span class="info" id="pbInfo"></span><button class="btn" data-close>Отмена</button><button class="btn primary" id="pbGo" data-icon="upload">Опубликовать</button></div>`);
  applyIcons(m.root);
  const go = $('#pbGo');
  go.onclick = async () => {
    const title = $('#pbTitle').value.trim(), author = $('#pbAuthor').value.trim();
    if (!title) { $('#pbTitle').focus(); toast('Дай сетке название', 'err'); return; }
    go.disabled = true; $('#pbInfo').textContent = 'Публикую…';
    try {
      API.setAuthor(author);
      const id = await API.publish({ title, author, description: $('#pbDesc').value, config: { config_name: title, categories: cats }, thumb });
      const url = new URL('catalog.html?id=' + id, location.href).href;
      $('#pbBody').innerHTML = `<div class="pub-done"><div class="pub-ok">✓</div><b>«${esc(title)}» в каталоге</b><span>Поделись ссылкой — по ней сетку можно посмотреть, скачать и открыть в редакторе.</span>
        <div class="pub-link"><input class="input" readonly value="${esc(url)}"><button class="btn" id="pbCopy" data-icon="link">Копировать</button></div></div>`;
      m.root.querySelector('.modal-foot').innerHTML = `<button class="btn" data-close>Закрыть</button><a class="btn primary" href="catalog.html?id=${id}" data-icon="grid">Открыть в каталоге</a>`;
      applyIcons(m.root);
      for (const b of $$('[data-close]', m.root)) b.onclick = m.close;
      $('#pbCopy').onclick = () => copyText(url, 'Ссылка скопирована');
    } catch (e) {
      go.disabled = false; $('#pbInfo').textContent = '';
      toast(e.message, 'err');
    }
  };
}
// editor.html?grid=<id> — сетка из каталога
async function openCatalogGrid(id) {
  try {
    const g = await CatalogAPI.get(id);
    CatalogAPI.hit(id);
    const text = JSON.stringify({ version: 3, configs: [g.config] });
    importJsonFiles([{ file: { name: g.title, text: async () => text }, handle: null }], { remember: false });
  } catch (e) { toast(e.message, 'err'); }
}

function openHelp() {
  const K = [['Все команды', 'Ctrl+K'], ['Выделение / рука', 'V / H, пробел'], ['Карандаш, линия, гор./верт.', 'B, L, X'], ['Прямоуг., эллипс, ромб, треуг.', 'R, O, D, Y'], ['Ластик, текст, герои', 'E, T, G'],
    ['Ровно / квадрат', 'Shift при рисовании'], ['Стереть карандашом', 'ПКМ'], ['Выделить один элемент группы', 'Alt + клик'], ['Добавить к выделению', 'Shift + клик'],
    ['Группировать / разгруппировать', 'Ctrl+G / Ctrl+Shift+G'], ['Дублировать', 'Ctrl+D'], ['Копировать / вставить', 'Ctrl+C / Ctrl+V'], ['Удалить', 'Delete'],
    ['Сдвиг', 'Стрелки (Shift ×10)'], ['Отменить / повторить', 'Ctrl+Z / Ctrl+Shift+Z'], ['Зум', 'колесо, + / −'], ['Вписать холст', 'Shift+1'], ['Как в игре / назад', 'Tab, Esc'], ['Вставить картинку', 'Ctrl+V'], ['Тема', 'Shift+T']];
  openModal(`${modalHead('Горячие клавиши')}<div class="modal-body"><div class="keys">${K.map(([a, b]) => `<span>${a}</span><span><kbd>${b}</kbd></span>`).join('')}</div></div>
    <div class="modal-foot"><span class="info">Автор · Discord <b style="color:var(--ink)">@ahttps</b> — связь, заказы, предложения</span><button class="btn sm" id="copyDiscord">Скопировать ник</button></div>`);
  $('#copyDiscord').onclick = () => copyText('ahttps', 'Ник Discord скопирован');
}


// ---------- палитра команд (Ctrl K) ----------
// Всё, что умеет редактор, — в одном списке с поиском. Стрелки выбирают, Enter выполняет.
function commandList() {
  const tools = Object.entries(TOOL_NAMES).map(([id, name]) => {
    const key = $(`#rail [data-tool="${id}"] kbd`)?.textContent || '';
    return { g: 'Инструменты', icon: $(`#rail [data-tool="${id}"]`)?.dataset.icon, label: name, key, run: () => { setPreview(false); setTool(id); } };
  });
  const sel = st.sel.size > 0;
  return [
    { g: 'Файл', icon: 'folder', label: 'Открыть hero_grid_config.json', words: 'json импорт', run: openJson },
    { g: 'Файл', icon: 'download', label: 'Экспорт', key: 'Ctrl S', words: 'скачать сохранить json', run: openExportModal },
    { g: 'Файл', icon: 'upload', label: 'Выложить в каталог', words: 'опубликовать публикация', run: openPublishModal },
    { g: 'Добавить', icon: 'image', label: 'Картинку — мозаика, ASCII, line-art', key: 'Ctrl V', run: () => doAdd('image') },
    { g: 'Добавить', icon: 'ascii', label: 'ASCII из буфера', words: 'текст арт', run: () => doAdd('ascii') },
    { g: 'Добавить', icon: 'lines', label: 'Генератор линий', run: () => doAdd('lines') },
    { g: 'Добавить', icon: 'font', label: 'Арт для профиля Steam', words: 'брайль витрина', run: () => doAdd('steam') },
    { g: 'Добавить', icon: 'heroes', label: 'Категорию героев', run: () => doAdd('hero') },
    { g: 'Добавить', icon: 'text', label: 'Текст', run: () => doAdd('text') },
    ...tools,
    { g: 'Вид', icon: st.preview ? 'pencil' : 'eye', label: st.preview ? 'Вернуться в редактор' : 'Как в игре', key: 'Tab', words: 'превью игра дота', run: () => setPreview(!st.preview) },
    { g: 'Вид', icon: 'fit', label: 'Вписать холст', key: 'Shift 1', words: 'зум масштаб', run: () => fitView() },
    { g: 'Вид', icon: 'plus', label: 'Приблизить', key: '+', words: 'зум', run: () => zoomBy(1.25) },
    { g: 'Вид', icon: 'minus', label: 'Отдалить', key: '−', words: 'зум', run: () => zoomBy(0.8) },
    { g: 'Вид', icon: 'grid', label: S.showGrid ? 'Скрыть сетку плотности' : 'Показать сетку плотности', run: () => { S.showGrid = !S.showGrid; persist(); renderInspector(); requestRender(); } },
    { g: 'Вид', icon: document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', label: themeName(), key: 'Shift T', words: 'тема светлая тёмная', run: toggleTheme },
    { g: 'Правка', icon: 'undo', label: 'Отменить', key: 'Ctrl Z', run: undo, off: !st.undo.length },
    { g: 'Правка', icon: 'redo', label: 'Повторить', key: 'Ctrl Shift Z', run: redo, off: !st.redo.length },
    { g: 'Правка', icon: 'cursor', label: 'Выделить всё', key: 'Ctrl A', run: selectAll, off: !st.els.length },
    { g: 'Правка', icon: 'copy', label: 'Копировать выделение как ASCII', run: () => copyText(selAsAscii(), 'ASCII скопирован'), off: !sel },
    { g: 'Правка', icon: 'dup', label: 'Дублировать', key: 'Ctrl D', run: duplicateSel, off: !sel },
    { g: 'Правка', icon: 'trash', label: 'Удалить выделенное', key: 'Del', run: deleteSel, off: !sel },
    { g: 'Правка', icon: 'trashAll', label: 'Очистить холст', words: 'удалить всё', run: () => { if (!st.els.length) return; snapshot(); st.els = []; st.sel.clear(); changed(true); toast('Холст очищен. Ctrl+Z — вернуть.'); }, off: !st.els.length },
    { g: 'Холст', icon: 'image', label: 'Загрузить фон-подложку', words: 'фон картинка обвести', run: () => $('#fileBg').click() },
    { g: 'Холст', icon: 'font', label: 'Загрузить шрифт Radiance', words: 'ttf шрифт', run: () => $('#fileFont').click() },
    { g: 'Прочее', icon: 'help', label: 'Горячие клавиши', key: '?', run: openHelp },
    { g: 'Прочее', icon: 'grid', label: 'Каталог сеток', words: 'шаблоны готовые', run: () => { location.href = 'catalog.html'; } },
    { g: 'Прочее', icon: 'home', label: 'На главную', run: () => { location.href = 'index.html'; } },
  ].filter(c => !c.off);
}
function openCommands() {
  const all = commandList();
  const m = openModal(`<div class="cmdk-in">${icon('search')}<input id="cmdQ" placeholder="Команда или инструмент…" autocomplete="off" spellcheck="false"><kbd>Esc</kbd></div>
    <div class="cmdk-list" id="cmdList"></div>
    <div class="cmdk-foot"><span>↑↓ выбрать</span><span>Enter выполнить</span></div>`, { cls: 'cmdk' });
  const q = $('#cmdQ'), box = $('#cmdList');
  let list = all, cur = 0;
  const draw = () => {
    let html = '', g = '';
    list.forEach((c, k) => {
      if (c.g !== g) { g = c.g; html += `<div class="cmdk-group">${g}</div>`; }
      html += `<button class="cmdk-item${k === cur ? ' on' : ''}" data-k="${k}">${icon(c.icon)}<span>${esc(c.label)}</span>${c.key ? `<kbd>${c.key}</kbd>` : ''}</button>`;
    });
    box.innerHTML = html || '<div class="cmdk-empty">Ничего не нашлось</div>';
  };
  const mark = () => { $$('.cmdk-item', box).forEach(b => b.classList.toggle('on', +b.dataset.k === cur)); box.querySelector('.cmdk-item.on')?.scrollIntoView({ block: 'nearest' }); };
  const run = k => { const c = list[k]; if (!c) return; m.close(); c.run(); };
  q.oninput = () => {
    const words = q.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    list = all.filter(c => { const hay = (c.label + ' ' + c.g + ' ' + (c.words || '')).toLowerCase(); return words.every(w => hay.includes(w)); });
    cur = 0; draw();
  };
  q.onkeydown = e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (list.length) { cur = (cur + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length; mark(); } }
    else if (e.key === 'Enter') { e.preventDefault(); run(cur); }
  };
  box.onmousemove = e => { const b = e.target.closest('.cmdk-item'); if (b && +b.dataset.k !== cur) { cur = +b.dataset.k; mark(); } };
  box.onclick = e => { const b = e.target.closest('.cmdk-item'); if (b) run(+b.dataset.k); };
  draw(); q.focus();
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
    if (!silent) toast('Шрифт загружен — превью «В игре» теперь точнее', 'ok');
    return true;
  } catch (e) { if (!silent) toast('Не удалось загрузить шрифт: ' + e.message, 'err'); return false; }
}

// ---------- верхняя панель и файлы ----------
$('#configName').value = S.configName;
$('#configName').oninput = e => { S.configName = e.target.value; persist(); };
const openJson = async () => importJsonFiles(await pickJsonFiles());
$('#esOpen').onclick = openJson;
$('#btnExport').onclick = openExportModal;
$('#btnPublish').onclick = openPublishModal;
$('#btnUndo').onclick = undo; $('#btnRedo').onclick = redo;
const zoomBy = k => zoomAt(k, canvas.clientWidth / 2, canvas.clientHeight / 2, true);
$('#zoomIn').onclick = () => zoomBy(1.25);
$('#zoomOut').onclick = () => zoomBy(0.8);
$('#zoomVal').onclick = () => fitView();
for (const b of $$('#viewSwitch [data-view]')) b.onclick = () => setPreview(b.dataset.view === 'game');
$('#btnHelp').onclick = openHelp;
$('#btnCmd').onclick = openCommands;

// выпадающие меню: «+» у категорий и стрелка у названия
const addMenu = $('#addMenu'), mainMenu = $('#mainMenu');
const menusOpen = () => addMenu.classList.contains('open') || mainMenu.classList.contains('open');
function closeMenus() { addMenu.classList.remove('open'); mainMenu.classList.remove('open'); $('#btnMenu').classList.remove('open'); }
function toggleMenu(m, btn) { const o = !m.classList.contains('open'); closeMenus(); m.classList.toggle('open', o); btn.classList.toggle('open', o); }
$('#btnAdd').onclick = e => { e.stopPropagation(); toggleMenu(addMenu, e.currentTarget); };
$('#btnMenu').onclick = e => { e.stopPropagation(); toggleMenu(mainMenu, e.currentTarget); };
document.addEventListener('click', closeMenus);
const CMD = { open: openJson, export: openExportModal, publish: openPublishModal, theme: toggleTheme, help: openHelp };
for (const b of $$('[data-cmd]')) b.addEventListener('click', () => CMD[b.dataset.cmd]());
function doAdd(kind) {
  closeMenus();
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
stage.addEventListener('dragover', e => { e.preventDefault(); $('#emptyState').classList.add('drag-over'); });
stage.addEventListener('dragleave', e => { if (!stage.contains(e.relatedTarget)) $('#emptyState').classList.remove('drag-over'); });
stage.addEventListener('drop', e => {
  e.preventDefault();
  $('#emptyState').classList.remove('drag-over');
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
// B и X — как подписано в доке; P и I оставлены для тех, кто привык к старым клавишам
const TOOL_KEYS = { v: 'select', h: 'pan', b: 'pencil', p: 'pencil', l: 'line', x: 'hv', i: 'hv', r: 'rect', o: 'ellipse', d: 'rhombus', y: 'triangle', e: 'eraser', t: 'text', g: 'hero' };
document.addEventListener('keydown', e => {
  const t = e.target;
  if (t.tagName === 'INPUT' && t.type !== 'range' && t.type !== 'checkbox' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return;
  if ($('#modalRoot').children.length) return;
  const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
  const code = e.code;
  if (ctrl && code === 'KeyK') { e.preventDefault(); closeMenus(); openCommands(); return; }
  if (e.key === 'Escape' && menusOpen()) { closeMenus(); return; }
  // в превью работают только вид, тема и выход — правки вслепую не нужны
  if (st.preview && !['Tab', 'Escape', '+', '=', '-', '?'].includes(e.key) && code !== 'Space'
    && !(e.shiftKey && (code === 'Digit1' || code === 'KeyT')) && !(ctrl && code === 'KeyS')) return;
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
  if (e.key === 'Escape') { if (st.preview) setPreview(false); else clearSel(); return; }
  if (e.key === 'Tab') { e.preventDefault(); setPreview(!st.preview); return; }
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
  const code2tool = { KeyV: 'v', KeyH: 'h', KeyB: 'b', KeyP: 'p', KeyL: 'l', KeyX: 'x', KeyI: 'i', KeyR: 'r', KeyO: 'o', KeyD: 'd', KeyY: 'y', KeyE: 'e', KeyT: 't', KeyG: 'g' }[code];
  if (code2tool && TOOL_KEYS[code2tool]) setTool(TOOL_KEYS[code2tool]);
});
document.addEventListener('keyup', e => { if (e.code === 'Space') { spaceDown = false; canvas.style.cursor = ''; } });
window.addEventListener('blur', () => { spaceDown = false; });
document.addEventListener('input', e => { if (e.target.type === 'range') syncRange(e.target); });

// ---------- старт ----------
(function init() {
  applyIcons();
  const saved = load('gp2.els', null);
  if (Array.isArray(saved) && saved.length) {
    st.els = saved;
    // генераторы дают группы одного типа; смешанная группа — это склеенный старым импортом файл
    if (!load('gp2.fixImportGroups', false)) {
      const types = new Map();
      for (const e of st.els) if (e.g) (types.get(e.g) || types.set(e.g, new Set()).get(e.g)).add(e.t === 'hero' ? 'hero' : 'label');
      for (const e of st.els) if (e.g && types.get(e.g).size > 1) e.g = 0;
      store('gp2.fixImportGroups', true);
    }
    reindex();
  }
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
  document.fonts.ready.then(() => { moveDockInd(); moveSegInd(); });
  moveSegInd();
  addEventListener('resize', () => { moveDockInd(); moveSegInd(); });
  // ссылки из каталога: ?grid=<id> — открыть сетку, ?publish — сразу окно публикации
  const qs = new URLSearchParams(location.search);
  if (qs.has('grid') || qs.has('publish')) {
    history.replaceState(null, '', location.pathname);
    if (qs.get('grid')) openCatalogGrid(qs.get('grid'));
    else if (st.els.length) setTimeout(openPublishModal, 250);
    else toast('Нарисуй сетку или открой свой JSON, потом нажми «В каталог» сверху', 'ok');
  }
})();
