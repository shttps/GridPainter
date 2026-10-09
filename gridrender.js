'use strict';
/* Отрисовка сетки из hero_grid_config.json «как в игре» — для каталога и превью публикации.
   Геометрия та же, что в редакторе (app.js): подписи 16px ЗАГЛАВНЫМИ с разрядкой 2px и отступом 4/3,
   список героев на 20px ниже y_position, карточки 51×83 + 8 отступа, масштаб — максимальный, при котором все влезают.
   Портреты Valve CDN не отдаёт с CORS, поэтому сохранённую картинку-превью рисуем средними цветами героев,
   а карточки Мастерской и окно сетки — живым холстом с настоящими портретами (mount): показывать такой холст можно,
   нельзя только сохранить его в файл. Подложка на выбор: «как в Доте», «классика», тёмная или градиент. */
window.GridRender = (() => {
  const CARD_W = 51, CARD_H = 83, PAD = 8, IMG_W = CARD_W - PAD, IMG_H = CARD_H - PAD, INSET = PAD / 2;
  const LBL = { size: 16, ls: 2, dx: 4, dy: 3 }, HEAD = 20;
  const GRID = { w: 1204, h: 612 }, BG = '#1d140e', LABEL = '#808fa6', SAT = 0.7;
  const CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/';
  const HAS_LS = typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype;
  const HEROES = new Map((window.HEROES || []).map(h => [h.id, h]));
  const FONT = '"Radiance", "Segoe UI", Arial, sans-serif';

  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  function muted(hex) {
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16), k = SAT;
    const v = [
      (0.213 + 0.787 * k) * r + (0.715 - 0.715 * k) * g + (0.072 - 0.072 * k) * b,
      (0.213 - 0.213 * k) * r + (0.715 + 0.285 * k) * g + (0.072 - 0.072 * k) * b,
      (0.213 - 0.213 * k) * r + (0.715 - 0.715 * k) * g + (0.072 + 0.928 * k) * b,
    ].map(x => clamp(Math.round(x), 0, 255));
    return `rgb(${v})`;
  }

  // портреты: обрезка «cover» под 43×75 и saturation 0.7, как в игре
  const arts = new Map(), waiting = new Set();
  function art(id, onLoad) {
    let a = arts.get(id);
    if (!a) {
      const h = HEROES.get(id); if (!h) return null;
      const wide = CDN + 'dota_react/heroes/' + h.s + '.png';
      const im = new Image();
      a = { im, cv: null }; arts.set(id, a);
      im.onload = () => {
        const W = im.naturalWidth, H = im.naturalHeight, k = IMG_W / IMG_H;
        const sw = W / H > k ? H * k : W, sh = W / H > k ? H : W / k;
        const cv = document.createElement('canvas'); cv.width = Math.round(sw); cv.height = Math.round(sh);
        const x = cv.getContext('2d'); x.filter = `saturate(${SAT})`;
        x.drawImage(im, (W - sw) / 2, (H - sh) / 2, sw, sh, 0, 0, cv.width, cv.height);
        a.cv = cv;
        for (const f of waiting) f(); waiting.clear();
      };
      im.onerror = () => { if (im.src !== wide) im.src = wide; };
      im.src = h.v ? CDN + 'heroes/' + h.s + '_vert.jpg' : wide;
    }
    if (!a.cv && onLoad) waiting.add(onLoad);
    return a.cv;
  }

  function layout(n, w, h) {
    let best = { s: 0, c: 1 };
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const s = Math.min(w / (CARD_W * cols + PAD), h / (CARD_H * rows + PAD));
      if (s > best.s) best = { s, c: cols };
    }
    return best;
  }

  // подложки превью: «как в Доте» — тёмная бирюза нынешнего экрана «Герои» (светлее к центру, синее книзу, темнее по краям),
  // «классика» — коричневый фон старого клиента, тёмная и градиент «Огня»
  const BGS = {
    dota: c => {
      c.fillStyle = '#0f1819'; c.fillRect(0, 0, GRID.w, GRID.h);
      const glow = c.createRadialGradient(GRID.w * .58, GRID.h * .42, 0, GRID.w * .58, GRID.h * .42, GRID.w * .62);
      glow.addColorStop(0, 'rgba(34,52,54,.75)'); glow.addColorStop(.55, 'rgba(26,40,42,.35)'); glow.addColorStop(1, 'rgba(26,40,42,0)');
      c.fillStyle = glow; c.fillRect(0, 0, GRID.w, GRID.h);
      const low = c.createLinearGradient(0, GRID.h * .6, 0, GRID.h);
      low.addColorStop(0, 'rgba(10,11,22,0)'); low.addColorStop(1, 'rgba(10,11,22,.55)');
      c.fillStyle = low; c.fillRect(0, 0, GRID.w, GRID.h);
      const edge = c.createRadialGradient(GRID.w / 2, GRID.h / 2, GRID.h * .45, GRID.w / 2, GRID.h / 2, GRID.w * .72);
      edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(0,0,0,.45)');
      c.fillStyle = edge; c.fillRect(0, 0, GRID.w, GRID.h);
    },
    classic: c => {
      c.fillStyle = BG; c.fillRect(0, 0, GRID.w, GRID.h);
      const g = c.createRadialGradient(GRID.w / 2, -60, 0, GRID.w / 2, -60, GRID.w * .95);
      g.addColorStop(0, 'rgba(64,46,28,.32)'); g.addColorStop(1, 'rgba(64,46,28,0)');
      c.fillStyle = g; c.fillRect(0, 0, GRID.w, GRID.h);
    },
    dark: c => {
      c.fillStyle = '#0c0b0b'; c.fillRect(0, 0, GRID.w, GRID.h);
      const g = c.createRadialGradient(GRID.w / 2, GRID.h / 2, GRID.h * .3, GRID.w / 2, GRID.h / 2, GRID.w * .7);
      g.addColorStop(0, 'rgba(40,38,36,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, GRID.w, GRID.h);
    },
    grad: c => {
      const g = c.createLinearGradient(0, 0, GRID.w, GRID.h);
      g.addColorStop(0, '#3a1010'); g.addColorStop(.5, '#2a1309'); g.addColorStop(1, '#2b2109');
      c.fillStyle = g; c.fillRect(0, 0, GRID.w, GRID.h);
      const v = c.createRadialGradient(GRID.w / 2, GRID.h / 2, GRID.h * .2, GRID.w / 2, GRID.h / 2, GRID.w * .75);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)');
      c.fillStyle = v; c.fillRect(0, 0, GRID.w, GRID.h);
    },
  };

  // Рисует сетку в координатах игры (0…1204 × 0…612). Трансформацию ставит вызывающий.
  // label — цвет подписей; по умолчанию игровой серо-голубой.
  function draw(c, cats, { portraits = false, onLoad, font = FONT, bg = 'dota', label = LABEL } = {}) {
    c.save();
    c.beginPath(); c.rect(0, 0, GRID.w, GRID.h); c.clip();
    (BGS[bg] || BGS.dota)(c);
    c.imageSmoothingQuality = 'high';
    for (const cat of cats) {
      const ids = Array.isArray(cat.hero_ids) ? cat.hero_ids : [], w = +cat.width || 0, h = +cat.height || 0;
      if (!ids.length || w <= 0 || h <= 0) continue;
      const L = layout(ids.length, w, h), s = L.s, x0 = +cat.x_position || 0, y0 = (+cat.y_position || 0) + HEAD;
      ids.forEach((id, k) => {
        const hero = HEROES.get(id); if (!hero) return;
        const x = x0 + (PAD / 2 + (k % L.c) * CARD_W + INSET) * s, y = y0 + (PAD / 2 + Math.floor(k / L.c) * CARD_H + INSET) * s;
        const cv = portraits && art(id, onLoad);
        if (cv) c.drawImage(cv, x, y, IMG_W * s, IMG_H * s);
        else { c.fillStyle = muted(hero.c); c.fillRect(x, y, IMG_W * s, IMG_H * s); }
      });
    }
    c.font = `600 ${LBL.size}px ${font}`; c.textBaseline = 'top'; c.fillStyle = label;
    if (HAS_LS) c.letterSpacing = LBL.ls + 'px';
    for (const cat of cats) {
      const t = String(cat.category_name ?? '').toUpperCase();
      if (!t.trim()) continue;
      let x = (+cat.x_position || 0) + LBL.dx; const y = (+cat.y_position || 0) + LBL.dy;
      if (HAS_LS || t.length < 2) c.fillText(t, x, y);
      else for (const ch of t) { c.fillText(ch, x, y); x += c.measureText(ch).width + LBL.ls; }
    }
    if (HAS_LS) c.letterSpacing = '0px';
    c.restore();
  }

  // Картинка для карточки каталога (без портретов — их нельзя сохранить из-за CORS).
  function thumb(cats, { width = 800, font, type = 'image/webp', quality = 0.84 } = {}) {
    const k = width / GRID.w, cv = document.createElement('canvas');
    cv.width = width; cv.height = Math.round(GRID.h * k);
    const c = cv.getContext('2d'); c.scale(k, k);
    draw(c, cats, { font });
    let url = cv.toDataURL(type, quality);
    if (!url.startsWith('data:' + type)) url = cv.toDataURL('image/jpeg', quality); // Safari не умеет webp
    return url;
  }

  // Живой холст: размер по ширине элемента × плотность экрана, настоящие портреты, перерисовка, когда они догрузились
  // или холст поменял размер. Возвращает { set(opts) } — например, сменить подложку без пересоздания.
  function mount(cv, cats, opts = {}) {
    const ctx = cv.getContext('2d');
    let queued = false, o = { ...opts };
    const paint = () => {
      queued = false;
      if (!cv.isConnected) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth || 400, k = w * dpr / GRID.w;
      const W = Math.round(w * dpr), H = Math.round(GRID.h * k);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      ctx.setTransform(k, 0, 0, k, 0, 0);
      draw(ctx, cats, { portraits: true, onLoad: later, ...o });
    };
    const redraw = () => { if (!queued) { queued = true; requestAnimationFrame(paint); } };
    // портреты приходят пачкой — перерисовываемся раз в ~120 мс, а не на каждый
    let lt = 0;
    const later = () => { clearTimeout(lt); lt = setTimeout(redraw, 120); };
    paint();
    document.fonts?.ready.then(redraw);
    let lastW = cv.clientWidth;
    new ResizeObserver(() => { if (cv.clientWidth !== lastW) { lastW = cv.clientWidth; redraw(); } }).observe(cv);
    return { set(next) { o = { ...o, ...next }; redraw(); }, redraw };
  }

  // Что за сетка: ASCII/текст, мозаика из героев или вперемешку
  function stats(cats) {
    let hero = 0, label = 0, ids = 0;
    for (const c of cats) {
      const n = Array.isArray(c.hero_ids) ? c.hero_ids.length : 0;
      if (n || ((+c.width || 0) > 1 && (+c.height || 0) > 1)) { hero++; ids += n; } else label++;
    }
    const kind = hero && label ? (hero > 3 && label > 3 ? 'mixed' : hero > label ? 'mosaic' : 'ascii') : hero ? 'mosaic' : 'ascii';
    return { cats: cats.length, hero, label, ids, kind };
  }

  return { draw, mount, thumb, stats, GRID, BGS: Object.keys(BGS) };
})();
