'use strict';
/* Общие эффекты мини-игр: ключевые кадры появления (как в Crownfall), пул частиц разных форм
   и процедурные текстуры (шум), которые игры накладывают на камень, металл, дерево и траву. */
(() => {
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => motionPreference.matches;
  const lerp = (a, b, t) => a + (b - a) * t;
  function keyframe(values, t) {
    const p = Math.max(0, Math.min(.999999, t)) * (values.length - 1), i = Math.floor(p);
    return lerp(values[i], values[i + 1], p - i);
  }
  // The scale/rotation keyframes match Crownfall's BounceIn and DropIn.
  function pop(g, x, y, t, drop = false) {
    if (reduced()) return;
    t = Math.max(0, Math.min(1, t));
    const scale = drop ? (t < .9 ? lerp(1.8, .8, t / .9) : lerp(.8, 1, (t - .9) / .1)) : keyframe([.3, 1.5, .8, 1.1, 1], t);
    g.translate(x, y + (drop ? (t < .9 ? lerp(-60, 2, t / .9) : lerp(2, 0, (t - .9) / .1)) : 0));
    g.rotate(drop ? 0 : keyframe([-10, 2, -2, 1, 0], t) * Math.PI / 180);
    g.scale(scale, scale); g.translate(-x, -y);
    g.globalAlpha *= Math.min(1, t * 5);
  }

  // Частицы: spark — светящийся штрих, chunk — кувыркающийся кусочек (трава, земля), smoke — мягкий клуб дыма,
  // ember — тлеющая точка, glint — четырёхлучевой блик. Координаты — в единицах игры (пиксели сцены или клетки).
  class Particles {
    constructor(max = 420) { this.items = []; this.max = max; }
    emit({ x, y, color, count = 12, speed = 90, gravity = 100, shape = 'spark', size = 1, life = 1, angle = null, spread = Math.PI * 2, drag = 0, up = 0 }) {
      if (reduced()) return;
      for (let i = 0; i < count && this.items.length < this.max; i++) {
        const a = angle == null ? Math.random() * Math.PI * 2 : angle + (Math.random() - .5) * spread, v = speed * (.25 + Math.random());
        this.items.push({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, color: Array.isArray(color) ? color[i % color.length] : color, gravity, drag, shape,
          age: 0, life: life * (.25 + Math.random() * .55) * (shape === 'smoke' ? 2.2 : 1),
          size: size * (.8 + Math.random() * 1.6), rot: Math.random() * 6.3, spin: (Math.random() - .5) * 14,
        });
      }
    }
    // старый вызов: искры
    burst(x, y, color, count = 20, speed = 90, gravity = 100) { this.emit({ x, y, color, count, speed, gravity }); }
    step(dt) {
      for (const p of this.items) {
        p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.gravity * dt; p.rot += p.spin * dt;
        if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      }
      this.items = this.items.filter(p => p.age < p.life);
    }
    draw(g, sizeScale = 1) {
      g.save(); g.lineCap = 'round';
      for (const p of this.items) {
        const k = p.age / p.life;
        if (p.shape === 'smoke') {
          g.globalCompositeOperation = 'source-over';
          g.globalAlpha = Math.sin(Math.min(1, k * 1.4) * Math.PI) * .28;
          g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, p.size * sizeScale * (3 + k * 7), 0, 7); g.fill();
        } else if (p.shape === 'chunk') {
          g.globalCompositeOperation = 'source-over';
          g.globalAlpha = Math.min(1, (1 - k) * 2.5);
          const s = p.size * sizeScale * 1.6;
          g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.color; g.fillRect(-s / 2, -s / 3, s, s * .66); g.restore();
        } else if (p.shape === 'ember') {
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = Math.pow(1 - k, 1.2) * (.6 + .4 * Math.sin(p.age * 30 + p.rot));
          g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, p.size * sizeScale * .9, 0, 7); g.fill();
        } else if (p.shape === 'glint') {
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = Math.sin(k * Math.PI);
          const s = p.size * sizeScale * 3;
          g.strokeStyle = p.color; g.lineWidth = sizeScale * .9;
          g.beginPath(); g.moveTo(p.x - s, p.y); g.lineTo(p.x + s, p.y); g.moveTo(p.x, p.y - s); g.lineTo(p.x, p.y + s); g.stroke();
        } else {
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = Math.pow(1 - k, 1.5); g.strokeStyle = p.color; g.lineWidth = p.size * sizeScale;
          g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * .025, p.y - p.vy * .025); g.stroke();
        }
      }
      g.restore();
    }
    clear() { this.items.length = 0; }
  }

  // Процедурный шум: плитка w×h, которая бесшовно повторяется. Светлые и тёмные пятна разных масштабов —
  // её накладывают поверх заливки (overlay/multiply), и гладкий градиент превращается в камень или металл.
  const noiseCache = new Map();
  function noise(size = 128, seed = 1, octaves = 4) {
    const key = size + ':' + seed + ':' + octaves;
    if (noiseCache.has(key)) return noiseCache.get(key);
    let s = seed >>> 0 || 1;
    const rand = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    const out = new Float32Array(size * size);
    let amp = 1, total = 0;
    for (let o = 0; o < octaves; o++) {
      const cells = 4 << o, grid = new Float32Array(cells * cells);
      for (let i = 0; i < grid.length; i++) grid[i] = rand();
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const fx = x / size * cells, fy = y / size * cells, ix = Math.floor(fx), iy = Math.floor(fy);
        const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const at = (a, b) => grid[(b % cells) * cells + (a % cells)];
        const v = lerp(lerp(at(ix, iy), at(ix + 1, iy), sx), lerp(at(ix, iy + 1), at(ix + 1, iy + 1), sx), sy);
        out[y * size + x] += v * amp;
      }
      total += amp; amp *= .5;
    }
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const g = cv.getContext('2d'), img = g.createImageData(size, size);
    for (let i = 0; i < out.length; i++) {
      const v = out[i] / total, c = Math.max(0, Math.min(255, (v - .5) * 2.4 * 128 + 128));
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = c; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    noiseCache.set(key, cv);
    return cv;
  }
  // наложить шум на уже нарисованное в пределах текущего пути/клипа: k — сила, mode — режим смешивания
  function texture(g, x, y, w, h, { seed = 1, size = 128, k = .25, mode = 'overlay', scale = 1 } = {}) {
    const pat = g.createPattern(noise(size, seed), 'repeat');
    if (scale !== 1 && pat.setTransform) pat.setTransform(new DOMMatrix().scale(scale));
    g.save(); g.globalCompositeOperation = mode; g.globalAlpha = k; g.fillStyle = pat; g.fillRect(x, y, w, h); g.restore();
  }
  window.ArcadeFX = { Particles, pop, keyframe, reduced, noise, texture };
})();
