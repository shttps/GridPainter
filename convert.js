'use strict';
// Преобразование картинок в элементы сетки: мозаика из героев, ASCII, line-art (Canny).
// Все функции возвращают элементы в координатах холста сетки.
window.Convert = (() => {
  // Карточка героя: 51×83 + 8 отступа (panorama/styles/hero_grid_new.css).
  // Дота масштабирует карточки, чтобы все герои влезли в категорию, поэтому
  // категория (51·c+8)·s × (83·r+8)·s даёт ровно c×r карточек размера 51s×83s.
  const CARD_W = 51, CARD_H = 83, PAD = 8;
  const SLACK = 1.002; // запас от округления; лишнюю колонку он не добавит

  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

  function srgbToLinear(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
  function rgbToLab(r, g, b) {
    const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
    const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
    const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
    const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }

  function fitRect(iw, ih, W, H) {
    const s = Math.min(W / iw, H / ih), w = iw * s, h = ih * s;
    return { x: (W - w) / 2, y: (H - h) / 2, w, h };
  }

  // Уменьшение в несколько шагов — чище, чем за один drawImage.
  function sample(img, w, h) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    let src = img, sw = img.naturalWidth || img.width, sh = img.naturalHeight || img.height;
    while (sw / 2 > w * 2 && sh / 2 > h * 2) {
      const c = document.createElement('canvas');
      c.width = sw = Math.round(sw / 2); c.height = sh = Math.round(sh / 2);
      const cx = c.getContext('2d'); cx.imageSmoothingQuality = 'high';
      cx.drawImage(src, 0, 0, sw, sh); src = c;
    }
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(src, 0, 0, w, h);
    return { data: cx.getImageData(0, 0, w, h).data, w, h };
  }

  // Яркость/контраст/насыщенность + удаление фона заливкой от краёв.
  // Возвращает массив: null (пусто) или { lab, lum }.
  function preprocess({ data, w, h }, p) {
    const br = (p.brightness || 0) * 1.28;
    const c = (p.contrast || 0) * 2.55, cf = (259 * (c + 255)) / (255 * (259 - c));
    const sat = 1 + (p.saturation || 0) / 100;
    const px = new Array(w * h);
    const raw = new Array(w * h);
    for (let i = 0; i < w * h; i++) {
      if (data[i * 4 + 3] < 128) { px[i] = null; continue; }
      let r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      raw[i] = [r, g, b];
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      r = y + (r - y) * sat; g = y + (g - y) * sat; b = y + (b - y) * sat;
      r = clamp(cf * (r - 128) + 128 + br, 0, 255);
      g = clamp(cf * (g - 128) + 128 + br, 0, 255);
      b = clamp(cf * (b - 128) + 128 + br, 0, 255);
      px[i] = { lab: rgbToLab(r, g, b), lum: 0.299 * r + 0.587 * g + 0.114 * b };
    }
    if (p.bgRemove) {
      const corner = raw[0] || raw[w - 1] || raw[(h - 1) * w] || raw[h * w - 1];
      if (corner) {
        const bg = rgbToLab(...corner), tol2 = (p.tolerance || 18) ** 2;
        const seen = new Uint8Array(w * h), stack = [];
        for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
        for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
        while (stack.length) {
          const i = stack.pop();
          if (seen[i]) continue; seen[i] = 1;
          if (raw[i] && dist2(rgbToLab(...raw[i]), bg) > tol2) continue;
          px[i] = null;
          const x = i % w, y = (i / w) | 0;
          if (x > 0) stack.push(i - 1); if (x < w - 1) stack.push(i + 1);
          if (y > 0) stack.push(i - w); if (y < h - 1) stack.push(i + w);
        }
      }
    }
    return px;
  }

  // ---------- мозаика из героев ----------
  function mosaic(img, p, area, heroes, pool) {
    const cols = p.cols;
    const rows = Math.max(1, Math.round(cols * img.naturalHeight / img.naturalWidth * CARD_W / CARD_H));
    const px = preprocess(sample(img, cols, rows), p);
    const cells = new Int16Array(cols * rows).fill(-1);
    if (pool.length) {
      const labs = px.map(q => q && q.lab.slice());
      if (p.fit) {
        // растягиваем L картинки (2–98 перцентиль) в диапазон L палитры героев
        const Ls = labs.filter(Boolean).map(l => l[0]).sort((a, b) => a - b);
        if (Ls.length > 1) {
          const lo = Ls[Math.floor(Ls.length * 0.02)], hi = Ls[Math.ceil(Ls.length * 0.98) - 1];
          const pl = pool.map(i => heroes[i].lab[0]);
          const pLo = Math.min(...pl), pHi = Math.max(...pl);
          for (const l of labs) if (l) {
            if (hi - lo > 1) l[0] = pLo + (clamp(l[0], lo, hi) - lo) / (hi - lo) * (pHi - pLo);
            // палитра героев малонасыщенная — приглушаем цвет, чтобы подбор шёл по форме
            l[1] *= 0.8; l[2] *= 0.8;
          }
        }
      }
      const nearest = lab => {
        let best = pool[0], bd = Infinity;
        for (const i of pool) { const d = dist2(lab, heroes[i].lab); if (d < bd) { bd = d; best = i; } }
        return best;
      };
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const i = y * cols + x, l = labs[i];
        if (!l) continue;
        const hi = nearest(l);
        cells[i] = hi;
        if (p.dither) {
          const e = [0, 1, 2].map(k => l[k] - heroes[hi].lab[k]);
          const spread = (dx, dy, f) => {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || xx >= cols || yy >= rows) return;
            const t = labs[yy * cols + xx];
            if (t) for (let k = 0; k < 3; k++) t[k] += e[k] * f;
          };
          spread(1, 0, 7 / 16); spread(-1, 1, 3 / 16); spread(0, 1, 5 / 16); spread(1, 1, 1 / 16);
        }
      }
    }
    return { els: mosaicCategories(cells, cols, rows, area, heroes), cols, rows, uniq: new Set(cells.filter(v => v >= 0)).size };
  }

  // Клетки → категории: полосы подряд идущих героев, склеенные по вертикали при одинаковых границах.
  function mosaicCategories(cells, cols, rows, area, heroes) {
    const s = Math.min(area.w / (CARD_W * cols + PAD), area.h / (CARD_H * rows + PAD));
    const offX = (area.w - (CARD_W * cols + PAD) * s) / 2;
    const offY = (area.h - (CARD_H * rows + PAD) * s) / 2;
    const merged = [], open = new Map();
    for (let y = 0; y < rows; y++) {
      let x = 0;
      while (x < cols) {
        if (cells[y * cols + x] < 0) { x++; continue; }
        const x0 = x; while (x < cols && cells[y * cols + x] >= 0) x++;
        const key = x0 + ':' + x, prev = open.get(key);
        if (prev && prev.y1 === y) prev.y1 = y + 1;
        else { const r = { x0, x1: x, y0: y, y1: y + 1 }; open.set(key, r); merged.push(r); }
      }
    }
    return merged.map(r => {
      const ids = [];
      for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) ids.push(heroes[cells[y * cols + x]].id);
      return {
        t: 'hero', name: '',
        x: offX + r.x0 * CARD_W * s, y: offY + r.y0 * CARD_H * s,
        w: (CARD_W * (r.x1 - r.x0) + PAD) * s * SLACK, h: (CARD_H * (r.y1 - r.y0) + PAD) * s * SLACK,
        heroes: ids,
      };
    });
  }

  // ---------- ASCII по яркости ----------
  function ascii(img, p, area, measure, fontSize) {
    const fit = fitRect(img.naturalWidth, img.naturalHeight, area.w, area.h);
    const els = [];
    if (p.mode === 'braille') {
      const cols = p.cols, w = cols * 2;
      const h = Math.max(4, Math.round(w * fit.h / fit.w / 4) * 4);
      const px = preprocess(sample(img, w, h), p);
      const lum = px.map(q => q ? (p.invert ? 255 - q.lum : q.lum) : -1);
      const vals = lum.filter(v => v >= 0);
      const th = p.autoThreshold && vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : p.threshold;
      const on = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x, v = lum[i];
        if (v < 0) continue;
        const bit = v >= th ? 1 : 0;
        on[i] = bit;
        if (p.dither) {
          const e = v - (bit ? 255 : 0);
          const sp = (dx, dy, f) => { const xx = x + dx, yy = y + dy; if (xx >= 0 && xx < w && yy < h && lum[yy * w + xx] >= 0) lum[yy * w + xx] += e * f; };
          sp(1, 0, 7 / 16); sp(-1, 1, 3 / 16); sp(0, 1, 5 / 16); sp(1, 1, 1 / 16);
        }
      }
      const DOTS = [[0x01, 0x08], [0x02, 0x10], [0x04, 0x20], [0x40, 0x80]];
      const lines = [];
      for (let cy = 0; cy < h / 4; cy++) {
        let line = '';
        for (let cx = 0; cx < cols; cx++) {
          let bits = 0;
          for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 2; dx++) if (on[(cy * 4 + dy) * w + cx * 2 + dx]) bits |= DOTS[dy][dx];
          line += String.fromCharCode(0x2800 + bits);
        }
        lines.push(line);
      }
      const lw = measure('⣿') * cols, totalH = lines.length * p.lineH;
      const x0 = (area.w - lw) / 2, y0 = Math.max(0, (area.h - totalH) / 2);
      lines.forEach((line, i) => { if (/[^⠀]/.test(line)) els.push({ t: 'text', name: line, x: x0, y: y0 + i * p.lineH }); });
      return { els, th: Math.round(th) };
    }
    const step = p.step;
    const cols = Math.max(1, Math.floor(fit.w / step)), rows = Math.max(1, Math.floor(fit.h / step));
    const px = preprocess(sample(img, cols, rows), p);
    const ramp = [...(p.ramp || ' .:-=+*#%@')];
    const lum = px.map(q => q ? (p.invert ? 255 - q.lum : q.lum) : -1);
    const ox = fit.x + (fit.w - cols * step) / 2, oy = fit.y + (fit.h - rows * step) / 2;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x, v = lum[i];
      if (v < 0) continue;
      const k = clamp(Math.round(v / 255 * (ramp.length - 1)), 0, ramp.length - 1);
      if (p.dither) {
        const e = v - k / (ramp.length - 1) * 255;
        const sp = (dx, dy, f) => { const xx = x + dx, yy = y + dy; if (xx >= 0 && xx < cols && yy < rows && lum[yy * cols + xx] >= 0) lum[yy * cols + xx] += e * f; };
        sp(1, 0, 7 / 16); sp(-1, 1, 3 / 16); sp(0, 1, 5 / 16); sp(1, 1, 1 / 16);
      }
      const ch = ramp[k];
      if (!ch || ch === ' ') continue;
      els.push({ t: 'glyph', name: ch, x: ox + x * step + (step - measure(ch)) / 2, y: oy + y * step + (step - fontSize) / 2 });
    }
    return { els };
  }

  // ---------- line-art: Canny ----------
  function gaussian(src, w, h, sigma) {
    if (sigma < 0.3) return src;
    const r = Math.ceil(sigma * 3), k = [];
    let sum = 0;
    for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * sigma * sigma)); k.push(v); sum += v; }
    for (let i = 0; i < k.length; i++) k[i] /= sum;
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let a = 0;
      for (let i = -r; i <= r; i++) a += src[y * w + clamp(x + i, 0, w - 1)] * k[i + r];
      tmp[y * w + x] = a;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let a = 0;
      for (let i = -r; i <= r; i++) a += tmp[clamp(y + i, 0, h - 1) * w + x] * k[i + r];
      out[y * w + x] = a;
    }
    return out;
  }

  function canny(gray, w, h, sigma, lowPct, highPct) {
    const g = gaussian(gray, w, h, sigma);
    const mag = new Float32Array(w * h), gx = new Float32Array(w * h), gy = new Float32Array(w * h);
    let max = 0;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const a = g[i - w - 1], b = g[i - w], c = g[i - w + 1], d = g[i - 1], f = g[i + 1], G = g[i + w - 1], H = g[i + w], I = g[i + w + 1];
      const sx = (c + 2 * f + I) - (a + 2 * d + G);
      const sy = (G + 2 * H + I) - (a + 2 * b + c);
      gx[i] = sx; gy[i] = sy;
      const m = Math.hypot(sx, sy);
      mag[i] = m; if (m > max) max = m;
    }
    // подавление немаксимумов
    const nms = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, m = mag[i];
      if (!m) continue;
      let ang = Math.atan2(gy[i], gx[i]) * 180 / Math.PI; if (ang < 0) ang += 180;
      let n1, n2;
      if (ang < 22.5 || ang >= 157.5) { n1 = mag[i - 1]; n2 = mag[i + 1]; }
      else if (ang < 67.5) { n1 = mag[i - w - 1]; n2 = mag[i + w + 1]; }
      else if (ang < 112.5) { n1 = mag[i - w]; n2 = mag[i + w]; }
      else { n1 = mag[i - w + 1]; n2 = mag[i + w - 1]; }
      if (m >= n1 && m >= n2) nms[i] = m;
    }
    // двойной порог + гистерезис
    const hi = max * highPct / 100, lo = max * Math.min(lowPct, highPct) / 100;
    const edge = new Uint8Array(w * h), stack = [];
    for (let i = 0; i < w * h; i++) if (nms[i] >= hi) { edge[i] = 1; stack.push(i); }
    while (stack.length) {
      const i = stack.pop(), x = i % w, y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (!edge[j] && nms[j] >= lo) { edge[j] = 1; stack.push(j); }
      }
    }
    return { edge, mag, gx, gy };
  }

  // Порядок символов в наборе: горизонталь, диагональ «\», вертикаль, диагональ «/».
  const CHARSETS = { lines: '-\\|/', dots: '.', mid: '·', mixed: '-\\|/' };

  function lineart(img, p, area, measure, fontSize) {
    const fit = fitRect(img.naturalWidth, img.naturalHeight, area.w, area.h);
    const K = 3; // пикселей обработки на шаг плотности
    const workW = Math.round(clamp(fit.w / p.step * K, 60, 1400));
    const workH = Math.max(20, Math.round(workW * fit.h / fit.w));
    const px = preprocess(sample(img, workW, workH), p);
    const gray = new Float32Array(workW * workH);
    for (let i = 0; i < gray.length; i++) gray[i] = px[i] ? px[i].lum : 0;
    const { edge, mag, gx, gy } = canny(gray, workW, workH, p.blur, p.low, p.high);
    const pts = [];
    for (let i = 0; i < edge.length; i++) if (edge[i]) pts.push(i);

    const set = p.charset === 'custom' ? [...(p.custom || '.')] : [...CHARSETS[p.charset] || '.'];
    const binCells = c => {
      const m = new Map();
      for (const i of pts) {
        const x = i % workW, y = (i / workW) | 0;
        const key = ((y / c) | 0) * 100000 + ((x / c) | 0);
        let e = m.get(key);
        if (!e) m.set(key, e = { best: i, bm: -1, C: 0, S: 0 });
        const mg = mag[i];
        if (mg > e.bm) { e.bm = mg; e.best = i; }
        // усреднение ориентации удвоенным углом (0° и 180° — одно направление)
        const a = Math.atan2(gy[i], gx[i]) * 2;
        e.C += Math.cos(a) * mg; e.S += Math.sin(a) * mg;
      }
      return m;
    };
    let c = K, cells = binCells(c);
    if (p.limit > 0) while (cells.size > p.limit && c < 200) cells = binCells(++c);

    const ws = fit.w / workW, els = [];
    for (const e of cells.values()) {
      const bx = e.best % workW, by = (e.best / workW) | 0;
      let ch = set[0];
      if (p.orient && set.length >= 4) {
        // направление линии = градиент + 90°, в экранных координатах (y вниз)
        let dir = (Math.atan2(e.S, e.C) / 2) * 180 / Math.PI + 90;
        dir = ((dir % 180) + 180) % 180;
        ch = set[Math.round(dir / 45) % 4];
      } else if (set.length > 1 && !p.orient) ch = set[(bx + by) % set.length];
      const wx = fit.x + (bx + 0.5) * ws, wy = fit.y + (by + 0.5) * ws;
      els.push({ t: 'glyph', name: ch, x: wx - measure(ch) / 2, y: wy - fontSize * 0.55 });
    }
    return { els, step: c * ws, edges: pts.length };
  }

  return { CARD_W, CARD_H, PAD, rgbToLab, fitRect, mosaic, ascii, lineart };
})();
