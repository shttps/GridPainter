'use strict';
/* «Взлом замка» — мини-игра Сларка из ивента «Тёмный карнавал» (Dota 2, 2026).
   Отмычка бежит по кругу замка. ЛКМ — взлом: попал в жёлтое деление — +1000 очков, в синее — +1,5 секунды.
   После каждого попадания отмычка меняет направление; деления со временем сужаются и пропадают.
   Промах ненадолго отключает отмычку и замедляет её. ПКМ (удерживать) — ускорение. F9 — пауза.
   Награды как в игре: 6 000, 12 000, 18 000, 24 000. Сцена (камера, свечи, замок) нарисована на canvas
   с процедурными текстурами (камень, мох, металл, ржавчина, дерево); Сларк за решёткой — портрет с CDN Valve.
   Статичное (стена, обод, середина замка) рисуется один раз в отдельные слои, в кадре — только то, что движется. */
(() => {
  const W = 600, H = 800;                 // логический размер сцены
  const CX = 300, CY = 566;               // центр замка
  const R_RIM = 178, R_FACE = 150, R_IN = 92, R_OUT = 144, R_HUB = 80;
  const START_TIME = 30, BLUE_BONUS = 1.5, GOLD_POINTS = 1000, MISS_LOCK = .8, UNLOCK_AT = 6000;
  const IMG = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/heroes/slark_vert.jpg';
  const FONT = '"Philosopher", "Onest", sans-serif';
  const FX = window.ArcadeFX;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rad = d => d * Math.PI / 180;
  const angDiff = (a, b) => ((a - b + 540) % 360) - 180;   // знаковая разница углов в [-180, 180)
  const fmtTime = t => Math.max(0, t).toFixed(1);
  const fmtNum = n => n.toLocaleString('ru-RU');
  const easeBack = t => { t = Math.min(1, Math.max(0, t)); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

  let slark = null;   // портрет грузим один раз на страницу
  function slarkImg() {
    if (!slark) { slark = new Image(); slark.decoding = 'async'; slark.src = IMG; }
    return slark;
  }

  // ---------- статичная сцена: стена, окно с решёткой, подсвечники, ведро, пол ----------
  function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
  // кладка: у каждого камня свой оттенок, фактура из шума, сколы по углам, трещины; у пола — мох и сырость
  function drawWall(g, w, floorY, seed = 7) {
    const r = seeded(seed);
    g.fillStyle = '#0d0c10'; g.fillRect(0, 0, w, floorY + 10);
    for (let y = -10, row = 0; y < floorY; y += 48, row++) {
      for (let x = (row % 2 ? -50 : -5); x < w;) {
        const bw = 84 + r() * 34, l = 22 + r() * 13, hue = 245 + r() * 25;
        const gr = g.createLinearGradient(0, y + 3, 0, y + 45);
        gr.addColorStop(0, `hsl(${hue} 9% ${l * .66}%)`); gr.addColorStop(1, `hsl(${hue} 10% ${l * .4}%)`);
        g.save();
        roundRect(g, x + 3, y + 3, bw - 6, 42, 6); g.fillStyle = gr; g.fill(); g.clip();
        FX.texture(g, x, y, bw, 48, { seed: 3 + (row % 5), k: .5, mode: 'overlay' });
        FX.texture(g, x, y, bw, 48, { seed: 40 + (row % 3), size: 64, k: .18, mode: 'multiply' });
        // верхняя грань ловит свет, нижняя уходит в тень
        g.fillStyle = 'rgba(255,240,220,.06)'; g.fillRect(x + 3, y + 3, bw - 6, 7);
        g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x + 3, y + 37, bw - 6, 8);
        // сколы
        for (let k = 0; k < 2; k++) if (r() < .45) {
          const cx = x + 3 + (r() < .5 ? 0 : bw - 6), cy = y + 3 + (r() < .5 ? 0 : 42), s = 5 + r() * 7;
          g.fillStyle = '#0d0c10'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + (cx > x + bw / 2 ? -s : s), cy); g.lineTo(cx, cy + (cy > y + 24 ? -s * .8 : s * .8)); g.fill();
        }
        // трещина
        if (r() < .2) {
          let px = x + 10 + r() * (bw - 20), py = y + 4;
          g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(px, py);
          for (let k = 0; k < 5; k++) { px += (r() - .5) * 12; py += 4 + r() * 6; g.lineTo(px, py); }
          g.stroke(); g.strokeStyle = 'rgba(255,255,255,.06)'; g.translate(1, 0); g.stroke();
        }
        // мох и сырость у пола
        if (y > floorY - 170 && r() < .5) {
          const mx = x + r() * bw, my = y + 30 + r() * 14;
          const mg = g.createRadialGradient(mx, my, 1, mx, my, 26 + r() * 22);
          mg.addColorStop(0, 'rgba(70,96,50,.55)'); mg.addColorStop(1, 'rgba(70,96,50,0)');
          g.fillStyle = mg; g.fillRect(mx - 50, my - 50, 100, 100);
        }
        g.restore();
        x += bw;
      }
    }
    // сырые потёки
    for (let k = 0; k < 7; k++) {
      const sx = r() * w, sy = r() * floorY * .6, len = 60 + r() * 140;
      const st = g.createLinearGradient(0, sy, 0, sy + len);
      st.addColorStop(0, 'rgba(0,0,0,0)'); st.addColorStop(.3, 'rgba(10,14,12,.28)'); st.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = st; g.fillRect(sx, sy, 5 + r() * 9, len);
    }
  }
  // пол из плит: три ряда в лёгкой перспективе
  function drawFloor(g, w, h, floorY, seed = 9) {
    const r = seeded(seed);
    g.fillStyle = '#0b0a0d'; g.fillRect(0, floorY, w, h - floorY);
    let y = floorY + 2;
    for (let row = 0; y < h; row++) {
      const rh = 22 + row * 14;
      for (let x = -r() * 60; x < w;) {
        const sw = 90 + r() * 70 + row * 20, l = 12 + r() * 6;
        g.save(); roundRect(g, x + 2, y + 2, sw - 4, rh - 4, 4);
        const fg = g.createLinearGradient(0, y, 0, y + rh); fg.addColorStop(0, `hsl(250 7% ${l + 4}%)`); fg.addColorStop(1, `hsl(250 8% ${l}%)`);
        g.fillStyle = fg; g.fill(); g.clip();
        FX.texture(g, x, y, sw, rh, { seed: 21 + row, k: .45, mode: 'overlay' });
        g.fillStyle = 'rgba(255,230,200,.04)'; g.fillRect(x, y + 2, sw, 3);
        g.restore();
        x += sw;
      }
      y += rh;
    }
    // тень от стены на пол
    const sh = g.createLinearGradient(0, floorY, 0, floorY + 40); sh.addColorStop(0, 'rgba(0,0,0,.6)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh; g.fillRect(0, floorY, w, 40);
  }
  function drawScene(g) {
    const r = seeded(17);
    drawWall(g, W, 690);
    drawFloor(g, W, H, 690);

    // окно камеры: тёмная ниша (Сларк и решётка — в каждом кадре), каменная арка, подоконник
    const ax = 300, ay = 236, ar = 122, bottom = 372;
    g.save();
    for (let k = 0; k <= 12; k++) {
      const a0 = Math.PI + k * Math.PI / 13, a1 = a0 + Math.PI / 13 - .025;
      g.beginPath(); g.arc(ax, ay, ar + 30, a0, a1); g.arc(ax, ay, ar, a1, a0, true); g.closePath();
      const sg = g.createRadialGradient(ax, ay, ar, ax, ay, ar + 30);
      const l = 24 + r() * 8; sg.addColorStop(0, `hsl(250 6% ${l * .7}%)`); sg.addColorStop(1, `hsl(250 6% ${l}%)`);
      g.fillStyle = sg; g.fill();
      g.save(); g.clip(); FX.texture(g, ax - ar - 40, ay - ar - 40, ar * 2 + 80, ar + 50, { seed: 5, k: .45 }); g.restore();
      g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 2; g.stroke();
    }
    for (const sx of [ax - ar - 30, ax + ar]) for (let y = ay; y < bottom; y += 34) {
      g.save(); g.fillStyle = `hsl(250 6% ${23 + r() * 8}%)`; roundRect(g, sx, y + 2, 30, 31, 4); g.fill(); g.clip();
      FX.texture(g, sx, y, 30, 34, { seed: 6, k: .45 }); g.restore();
    }
    // ключевой камень с выбитым черепом-меткой карнавала
    g.save(); g.translate(ax, ay - ar - 16);
    g.fillStyle = '#3c3944'; g.beginPath(); g.moveTo(-17, -16); g.lineTo(17, -16); g.lineTo(12, 18); g.lineTo(-12, 18); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2; g.stroke();
    g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(-4.5, 0, 3, 0, 7); g.arc(4.5, 0, 3, 0, 7); g.fill(); g.fillRect(-4, 6, 8, 3);
    g.restore();
    g.restore();
    // подоконник
    g.save(); g.fillStyle = '#3a3742'; roundRect(g, ax - ar - 44, bottom - 4, ar * 2 + 88, 26, 5); g.fill(); g.clip();
    FX.texture(g, ax - ar - 44, bottom - 4, ar * 2 + 88, 26, { seed: 8, k: .5 }); g.restore();
    g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(ax - ar - 40, bottom - 2, ar * 2 + 80, 4);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(ax - ar - 44, bottom + 20, ar * 2 + 88, 8);

    // подсвечники (сами огоньки — в каждом кадре)
    sconce(g, 96, 236, 62); sconce(g, 506, 176, 70);
    // ведро слева внизу: справа — подсказки управления
    bucket(g, 92, 636);
    // цепь у таблички
    for (const x of [212, 388]) for (let y = 0; y < 52; y += 13) {
      g.strokeStyle = '#141318'; g.lineWidth = 6; g.beginPath(); g.ellipse(x, y + 6, 4, 7, 0, 0, 7); g.stroke();
      g.strokeStyle = y / 13 % 2 ? '#56525e' : '#6b6672'; g.lineWidth = 3.5; g.stroke();
    }
    // виньетка
    const v = g.createRadialGradient(W / 2, H * .55, H * .3, W / 2, H * .55, H * .78);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.62)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
  }
  function bar(g, x1, y1, x2, y2, w) {
    g.strokeStyle = '#0e0d12'; g.lineWidth = w + 3; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    const vert = x1 === x2, gr = vert ? g.createLinearGradient(x1 - w / 2, 0, x1 + w / 2, 0) : g.createLinearGradient(0, y1 - w / 2, 0, y1 + w / 2);
    gr.addColorStop(0, '#2b2830'); gr.addColorStop(.35, '#5d5964'); gr.addColorStop(1, '#25222a');
    g.strokeStyle = gr; g.lineWidth = w; g.stroke();
    // ржавые пятна на прутьях
    g.strokeStyle = 'rgba(120,62,30,.35)'; g.lineWidth = w * .7;
    for (let k = 1; k < 4; k++) { const t = ((x1 * 7 + k * 31) % 97) / 97; g.beginPath(); const px = x1 + (x2 - x1) * t, py = y1 + (y2 - y1) * t; g.moveTo(px, py); g.lineTo(px + (vert ? 0 : 6), py + (vert ? 6 : 0)); g.stroke(); }
  }
  function sconce(g, x, top, hgt) {
    // кронштейн из кованого железа
    const ir = g.createLinearGradient(x - 12, 0, x + 12, 0); ir.addColorStop(0, '#1d1b21'); ir.addColorStop(.5, '#3d3944'); ir.addColorStop(1, '#1a181e');
    g.fillStyle = ir; roundRect(g, x - 10, top + hgt + 6, 20, 120, 5); g.fill();
    g.fillStyle = '#3a3640'; roundRect(g, x - 26, top + hgt, 52, 14, 6); g.fill();
    g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(x - 22, top + hgt + 2, 44, 2);
    g.strokeStyle = '#2d2a33'; g.lineWidth = 6; g.beginPath(); g.arc(x, top + hgt + 70, 18, Math.PI * .6, Math.PI * 1.4); g.stroke();
    // свеча с подтёками воска
    const c = g.createLinearGradient(x - 18, 0, x + 18, 0);
    c.addColorStop(0, '#a07a3c'); c.addColorStop(.45, '#f3dc9c'); c.addColorStop(1, '#93692f');
    g.save(); g.fillStyle = c; roundRect(g, x - 17, top, 34, hgt + 4, 6); g.fill(); g.clip();
    FX.texture(g, x - 17, top, 34, hgt + 4, { seed: 12, size: 64, k: .25 }); g.restore();
    g.fillStyle = '#f7e6b0';
    for (const [dx, len] of [[-12, 22], [-2, 12], [9, 30]]) { roundRect(g, x + dx, top + 2, 6, len, 3); g.fill(); g.beginPath(); g.arc(x + dx + 3, top + 2 + len, 3.4, 0, 7); g.fill(); }
    g.strokeStyle = '#2b1d10'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, top); g.lineTo(x, top - 8); g.stroke();
  }
  function bucket(g, x, y) {
    const w = 84, h = 78;
    g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(x, y + h + 2, w * .62, 10, 0, 0, 7); g.fill();
    const wood = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    wood.addColorStop(0, '#2f1c10'); wood.addColorStop(.5, '#6e4a2b'); wood.addColorStop(1, '#2f1c10');
    g.save(); g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x + w / 2, y); g.lineTo(x + w / 2 - 8, y + h); g.lineTo(x - w / 2 + 8, y + h); g.closePath();
    g.fillStyle = wood; g.fill(); g.clip();
    // волокна дерева
    g.strokeStyle = 'rgba(20,10,4,.35)'; g.lineWidth = 1;
    for (let k = 0; k < 18; k++) { const gx = x - w / 2 + k * w / 18; g.beginPath(); g.moveTo(gx, y); g.bezierCurveTo(gx + 3, y + h * .3, gx - 3, y + h * .6, gx + 1, y + h); g.stroke(); }
    FX.texture(g, x - w / 2, y, w, h, { seed: 14, k: .3 });
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2;
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(x + i * 17, y); g.lineTo(x + i * 15, y + h); g.stroke(); }
    g.restore();
    for (const yy of [y + 11, y + h - 17]) {
      const band = g.createLinearGradient(0, yy, 0, yy + 8); band.addColorStop(0, '#5a6576'); band.addColorStop(1, '#2c3440');
      g.fillStyle = band; roundRect(g, x - w / 2 - 2, yy, w + 4, 8, 3); g.fill();
      g.fillStyle = 'rgba(120,60,25,.4)'; g.fillRect(x - 20, yy + 2, 9, 4); g.fillRect(x + 14, yy + 3, 6, 3);
    }
    g.fillStyle = '#140d08'; g.beginPath(); g.ellipse(x, y, w / 2, 9, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(60,90,110,.35)'; g.beginPath(); g.ellipse(x, y + 2, w / 2 - 6, 5, 0, 0, 7); g.fill();
    g.strokeStyle = '#5a3a20'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + 26, y - 4); g.lineTo(x + 6, y - 46); g.stroke();
  }
  function flame(g, x, y, t, seed, power = 1) {
    const f = Math.sin(t * 9 + seed) * .12 + Math.sin(t * 23 + seed * 2) * .06 + Math.sin(t * 3.1 + seed) * .05;
    const glow = g.createRadialGradient(x, y - 10, 2, x, y - 10, 150 * power);
    glow.addColorStop(0, `rgba(255,170,70,${.42 + f * .5})`); glow.addColorStop(.35, `rgba(255,120,40,${.13 + f * .2})`); glow.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = glow; g.fillRect(x - 150 * power, y - 160 * power, 300 * power, 300 * power);
    g.save(); g.translate(x, y); g.rotate(Math.sin(t * 2.3 + seed) * .06); g.scale(1 + f * .5, 1 + f);
    const fl = g.createRadialGradient(0, -6, 1, 0, -10, 22);
    fl.addColorStop(0, '#fffbe0'); fl.addColorStop(.4, '#ffd36a'); fl.addColorStop(1, 'rgba(255,110,30,0)');
    g.fillStyle = fl; g.beginPath(); g.moveTo(0, -34); g.quadraticCurveTo(11, -12, 7, -2); g.quadraticCurveTo(0, 6, -7, -2); g.quadraticCurveTo(-11, -12, 0, -34); g.fill();
    g.fillStyle = 'rgba(80,140,255,.55)'; g.beginPath(); g.ellipse(0, -1, 3.2, 4, 0, 0, 7); g.fill();
    g.restore();
  }

  function drawPrisoner(g, img, t, jolt, cheer) {
    g.save(); g.beginPath(); g.moveTo(178, 372); g.lineTo(178, 236);
    g.arc(300, 236, 122, Math.PI, 0); g.lineTo(422, 372); g.closePath(); g.clip();
    const inside = g.createRadialGradient(300, 250, 20, 300, 260, 200);
    inside.addColorStop(0, '#2c2530'); inside.addColorStop(1, '#09080c');
    g.fillStyle = inside; g.fillRect(178, 114, 244, 258);
    if (img?.naturalWidth) {
      const bob = FX.reduced() ? 0 : Math.sin(t * Math.PI / 2);
      g.save(); g.translate(300, 260 + bob * 1.5 - cheer * 14);
      g.rotate((bob + Math.sin(jolt * 45) * jolt * 14) * Math.PI / 180);
      g.globalAlpha = .95; g.drawImage(img, -118, -110, 236, 236 * img.naturalHeight / img.naturalWidth); g.restore();
    }
    const shade = g.createLinearGradient(0, 130, 0, 372);
    shade.addColorStop(0, 'rgba(10,8,14,.55)'); shade.addColorStop(.45, 'rgba(10,8,14,0)'); shade.addColorStop(1, 'rgba(10,8,14,.5)');
    g.fillStyle = shade; g.fillRect(178, 114, 244, 258);
    g.lineCap = 'round'; for (let x = 200; x <= 400; x += 40) bar(g, x, 100, x, 372, 9);
    bar(g, 178, 196, 422, 196, 8); g.restore();
  }

  // ---------- замок ----------
  // дужка: jolt — дрожь при промахе, open — насколько она выскочила (0…1) в конце, если замок вскрыт
  function drawShackle(g, jolt = 0, open = 0) {
    g.save();
    g.translate(CX, 424); g.rotate(Math.sin(jolt * 35) * jolt * .14 - open * .16); g.translate(-CX, -424 - Math.sin(jolt * 25) * jolt * 10 - open * 46);
    g.lineCap = 'butt';
    const path = () => { g.beginPath(); g.arc(CX, 424, 86, Math.PI, 0); g.lineTo(CX + 86, 470 + open * 30); g.moveTo(CX - 86, 470); g.lineTo(CX - 86, 424); };
    const sh = g.createLinearGradient(CX - 100, 0, CX + 100, 0);
    sh.addColorStop(0, '#3b3a40'); sh.addColorStop(.3, '#8d8a92'); sh.addColorStop(.5, '#5d5b63'); sh.addColorStop(1, '#2c2b31');
    g.strokeStyle = '#141317'; g.lineWidth = 36; path(); g.stroke();
    g.strokeStyle = sh; g.lineWidth = 28; path(); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 3; g.beginPath(); g.arc(CX, 424, 92, Math.PI * 1.15, Math.PI * 1.55); g.stroke();
    g.strokeStyle = 'rgba(120,62,30,.35)'; g.lineWidth = 10; g.beginPath(); g.arc(CX, 424, 86, Math.PI * 1.7, Math.PI * 1.78); g.stroke();
    // крепления дужки
    for (const sx of [-1, 1]) {
      const bx = CX + sx * 86;
      const bg = g.createLinearGradient(bx - 26, 0, bx + 26, 0); bg.addColorStop(0, '#4a4650'); bg.addColorStop(.5, '#7a7680'); bg.addColorStop(1, '#3a3640');
      g.fillStyle = '#121115'; roundRect(g, bx - 30, 392, 60, 46, 6); g.fill();
      g.fillStyle = bg; roundRect(g, bx - 27, 395, 54, 40, 5); g.fill();
      g.fillStyle = '#25232a'; g.beginPath(); g.arc(bx - 15, 405, 4, 0, 7); g.arc(bx + 15, 405, 4, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(bx - 16, 404, 1.4, 0, 7); g.arc(bx + 14, 404, 1.4, 0, 7); g.fill();
    }
    g.restore();
  }
  // обод и циферблат: шлифованный металл, заклёпки, ржавчина, царапины — рисуется один раз в слой
  function drawRim(g) {
    g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.arc(CX, CY + 10, R_RIM + 8, 0, 7); g.fill();
    const rim = g.createLinearGradient(CX - R_RIM, CY - R_RIM, CX + R_RIM, CY + R_RIM);
    rim.addColorStop(0, '#8c8892'); rim.addColorStop(.35, '#55525b'); rim.addColorStop(.7, '#3a3840'); rim.addColorStop(1, '#6a6670');
    g.save();
    g.beginPath(); g.arc(CX, CY, R_RIM, 0, 7); g.arc(CX, CY, R_FACE, 0, 7, true); g.fillStyle = rim; g.fill(); g.clip();
    FX.texture(g, CX - R_RIM, CY - R_RIM, R_RIM * 2, R_RIM * 2, { seed: 31, k: .45 });
    // шлифовка: тонкие концентрические штрихи
    const r = seeded(3);
    for (let i = 0; i < 70; i++) {
      const a = r() * 7, rr = R_FACE + 2 + r() * 26;
      g.strokeStyle = `rgba(${r() < .5 ? '255,255,255' : '0,0,0'},${.04 + r() * .07})`; g.lineWidth = .8 + r();
      g.beginPath(); g.arc(CX, CY, rr, a, a + .2 + r() * .9); g.stroke();
    }
    // ржавчина
    for (let i = 0; i < 9; i++) {
      const a = r() * 7, rr = R_FACE + 6 + r() * 20, px = CX + Math.cos(a) * rr, py = CY + Math.sin(a) * rr;
      const rg = g.createRadialGradient(px, py, 1, px, py, 8 + r() * 14);
      rg.addColorStop(0, 'rgba(130,64,28,.55)'); rg.addColorStop(1, 'rgba(130,64,28,0)');
      g.fillStyle = rg; g.fillRect(px - 30, py - 30, 60, 60);
    }
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 2; g.beginPath(); g.arc(CX, CY, R_RIM - 2, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(CX, CY, R_RIM - 1, Math.PI * .1, Math.PI * .7); g.stroke();
    // заклёпки
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8 + Math.PI / 16, px = CX + Math.cos(a) * (R_FACE + 14), py = CY + Math.sin(a) * (R_FACE + 14);
      g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.arc(px + 1, py + 1.5, 5, 0, 7); g.fill();
      const rv = g.createRadialGradient(px - 1.5, py - 1.5, .5, px, py, 5); rv.addColorStop(0, '#c9c4cf'); rv.addColorStop(.5, '#6f6b76'); rv.addColorStop(1, '#2d2b31');
      g.fillStyle = rv; g.beginPath(); g.arc(px, py, 4.5, 0, 7); g.fill();
    }
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 4; g.beginPath(); g.arc(CX, CY, R_FACE + 3, 0, 7); g.stroke();
    // циферблат
    const face = g.createRadialGradient(CX, CY, R_IN - 20, CX, CY, R_FACE);
    face.addColorStop(0, '#1d1b1f'); face.addColorStop(1, '#121013');
    g.save(); g.fillStyle = face; g.beginPath(); g.arc(CX, CY, R_FACE, 0, 7); g.fill(); g.clip();
    FX.texture(g, CX - R_FACE, CY - R_FACE, R_FACE * 2, R_FACE * 2, { seed: 33, k: .3 });
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,.045)'; g.lineWidth = 1.2;
    for (let a = 0; a < 360; a += 30) { g.beginPath(); g.moveTo(CX + Math.cos(rad(a)) * R_IN, CY + Math.sin(rad(a)) * R_IN); g.lineTo(CX + Math.cos(rad(a)) * R_OUT, CY + Math.sin(rad(a)) * R_OUT); g.stroke(); }
    for (let a = 0; a < 360; a += 6) { const big = a % 30 === 0; g.strokeStyle = `rgba(255,255,255,${big ? .14 : .06})`; g.lineWidth = big ? 2 : 1; g.beginPath(); g.moveTo(CX + Math.cos(rad(a)) * (R_OUT + 1), CY + Math.sin(rad(a)) * (R_OUT + 1)); g.lineTo(CX + Math.cos(rad(a)) * (R_OUT + (big ? 6 : 3)), CY + Math.sin(rad(a)) * (R_OUT + (big ? 6 : 3))); g.stroke(); }
  }
  // середина замка: кованая шайба с вмятинами
  function drawHubBase(g) {
    g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.arc(CX, CY + 4, R_HUB + 6, 0, 7); g.fill();
    const hub = g.createRadialGradient(CX - 20, CY - 30, 10, CX, CY, R_HUB);
    hub.addColorStop(0, '#4a464e'); hub.addColorStop(1, '#262329');
    g.save(); g.fillStyle = hub; g.beginPath(); g.arc(CX, CY, R_HUB, 0, 7); g.fill(); g.clip();
    FX.texture(g, CX - R_HUB, CY - R_HUB, R_HUB * 2, R_HUB * 2, { seed: 37, k: .35 });
    const r = seeded(5);
    for (let i = 0; i < 26; i++) {
      const a = r() * 7, d = r() * (R_HUB - 8), px = CX + Math.cos(a) * d, py = CY + Math.sin(a) * d, s = 3 + r() * 5;
      const dg = g.createRadialGradient(px - s * .3, py - s * .3, .5, px, py, s);
      dg.addColorStop(0, 'rgba(0,0,0,.18)'); dg.addColorStop(.7, 'rgba(0,0,0,.05)'); dg.addColorStop(1, 'rgba(255,255,255,.05)');
      g.fillStyle = dg; g.beginPath(); g.arc(px, py, s, 0, 7); g.fill();
    }
    const vg = g.createRadialGradient(CX, CY, R_HUB * .4, CX, CY, R_HUB); vg.addColorStop(0, 'rgba(0,0,0,.35)'); vg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = vg; g.fillRect(CX - R_HUB, CY - R_HUB, R_HUB * 2, R_HUB * 2);
    g.restore();
    g.strokeStyle = '#5a5660'; g.lineWidth = 2; g.beginPath(); g.arc(CX, CY, R_HUB, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1.5; g.beginPath(); g.arc(CX, CY, R_HUB - 3, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
  }
  function drawHubText(g, time, score, ready, scorePop, timePop) {
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    if (ready > 0) {
      g.fillStyle = '#d9cdb4'; g.font = `700 22px ${FONT}`; g.fillText('Готовься…', CX, CY + 8);
      return;
    }
    g.fillStyle = '#b9ad98'; g.font = `700 10.5px ${FONT}`; g.fillText('ОСТАЛОСЬ ВРЕМЕНИ', CX, CY - 34);
    const ts = 1 + timePop * .5;
    g.save(); g.translate(CX, CY + 6); g.scale(ts, ts);
    g.fillStyle = timePop > 0 ? '#c8ecff' : time < 5 ? '#ff8a6a' : '#efe6d4'; g.font = `700 40px ${FONT}`; g.fillText(fmtTime(time), 0, 0); g.restore();
    g.fillStyle = '#b9ad98'; g.font = `700 10.5px ${FONT}`; g.fillText('ОЧКИ', CX, CY + 28);
    const ss = 1 + scorePop;
    g.save(); g.translate(CX, CY + 49); g.scale(ss, ss);
    g.fillStyle = scorePop > 0 ? '#ffe9a0' : '#efe6d4'; g.font = `700 19px ${FONT}`; g.fillText(fmtNum(score), 0, 0); g.restore();
  }
  // деление: appear — как давно появилось (растёт с отскоком), fading — мигает перед исчезновением
  function drawZone(g, z, w, flash, t = 0) {
    const appear = z.age != null ? easeBack(z.age / .28) : 1;
    w *= Math.max(0, appear);
    if (w <= .2) return;
    const a0 = rad(z.c - w / 2), a1 = rad(z.c + w / 2);
    const gold = z.kind === 'gold';
    const grad = g.createRadialGradient(CX, CY, R_IN, CX, CY, R_OUT);
    if (gold) { grad.addColorStop(0, '#9c7a14'); grad.addColorStop(.5, '#e2bc35'); grad.addColorStop(1, '#f4d660'); }
    else { grad.addColorStop(0, '#3d7fb8'); grad.addColorStop(.55, '#86c6f0'); grad.addColorStop(1, '#bfe6ff'); }
    const shape = () => { g.beginPath(); g.arc(CX, CY, R_OUT, a0, a1); g.arc(CX, CY, R_IN, a1, a0, true); g.closePath(); };
    g.save();
    g.shadowColor = gold ? 'rgba(255,200,60,.6)' : 'rgba(120,200,255,.65)'; g.shadowBlur = 14 + flash * 20;
    g.fillStyle = grad; shape(); g.fill();
    g.restore();
    // фактура: светлые прожилки, как на краске, и бегущий по делению блик
    g.save(); shape(); g.clip();
    g.strokeStyle = gold ? 'rgba(255,240,170,.35)' : 'rgba(235,250,255,.4)'; g.lineWidth = 1.5;
    for (let k = 1; k < 4; k++) { const rr = R_IN + (R_OUT - R_IN) * k / 4 + Math.sin(z.seed + k) * 4; g.beginPath(); g.arc(CX, CY, rr, a0, a1); g.stroke(); }
    if (!FX.reduced()) {
      const sweep = rad(z.c - w / 2 + ((t * 70 + z.seed * 40) % (w + 30)) - 15);
      g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 5; g.globalCompositeOperation = 'lighter';
      g.beginPath(); g.moveTo(CX + Math.cos(sweep) * R_IN, CY + Math.sin(sweep) * R_IN); g.lineTo(CX + Math.cos(sweep) * R_OUT, CY + Math.sin(sweep) * R_OUT); g.stroke();
      g.globalCompositeOperation = 'source-over';
    }
    // шов посередине у синего — как на скриншоте
    if (!gold) { g.strokeStyle = 'rgba(30,60,90,.45)'; g.lineWidth = 2; const am = rad(z.c); g.beginPath(); g.moveTo(CX + Math.cos(am) * R_IN, CY + Math.sin(am) * R_IN); g.lineTo(CX + Math.cos(am) * R_OUT, CY + Math.sin(am) * R_OUT); g.stroke(); }
    // только что появилось — белая вспышка
    if (z.age != null && z.age < .2) { g.fillStyle = `rgba(255,255,255,${.6 * (1 - z.age / .2)})`; g.fillRect(CX - R_OUT, CY - R_OUT, R_OUT * 2, R_OUT * 2); }
    g.restore();
  }
  function drawPick(g, angle, state, boost = 0) {
    const a = rad(angle), c = Math.cos(a), s = Math.sin(a);
    const col = state === 'off' ? '255,90,70' : boost ? '200,235,255' : '170,215,255';
    g.save(); g.lineCap = 'round';
    g.strokeStyle = `rgba(${col},.25)`; g.lineWidth = 12 + boost * 6; g.beginPath(); g.moveTo(CX + c * (R_IN + 4), CY + s * (R_IN + 4)); g.lineTo(CX + c * (R_OUT - 2), CY + s * (R_OUT - 2)); g.stroke();
    g.strokeStyle = `rgba(${col},.55)`; g.lineWidth = 6; g.stroke();
    g.strokeStyle = state === 'off' ? '#ffd0c4' : '#ffffff'; g.lineWidth = 2.5; g.stroke();
    g.restore();
  }

  // ---------- игра ----------
  function mount(shell, api) {
    shell.innerHTML = `<div class="lp-frame" id="lpFrame">
      <canvas class="lp-cv" id="lpCv" aria-label="Замок: нажимай, когда отмычка в делении"></canvas>
      <div class="lp-plate"><span>Взлом замка</span></div>
      <div class="lp-legend">
        <div><span>Взлом</span>${Arcade.MOUSE('l', 'Левая кнопка мыши')}</div>
        <div><span>Ускорение (удерж.)</span>${Arcade.MOUSE('r', 'Правая кнопка мыши')}</div>
        <div><span>Пауза</span>${Arcade.KEY('F9')}</div>
      </div>
      <button class="lp-boost" id="lpBoost" type="button" aria-label="Ускорение (удерживать)">»</button>
      <div class="ar-pause" id="lpPause" hidden><b>Пауза</b><small>F9 или Esc — продолжить</small><button class="ar-btn" data-resume>Продолжить</button></div>
    </div>`;
    const frame = shell.querySelector('#lpFrame'), cv = shell.querySelector('#lpCv'), g = cv.getContext('2d');
    const plate = frame.querySelector('.lp-plate');
    // слои: сцена (стена, пол, окно), обод замка, середина замка — рисуются при изменении размера
    const layer = () => { const c = document.createElement('canvas'); return [c, c.getContext('2d')]; };
    const [scene, sg] = layer(), [rimL, rg] = layer(), [hubL, hg] = layer();
    let scale = 1, dpr = 1;
    function resize() {
      const w = cv.clientWidth || 600;
      dpr = Math.min(2, devicePixelRatio || 1); scale = w * dpr / W;
      cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
      for (const [c, x, draw] of [[scene, sg, drawScene], [rimL, rg, drawRim], [hubL, hg, drawHubBase]]) {
        c.width = cv.width; c.height = cv.height; x.setTransform(scale, 0, 0, scale, 0, 0); draw(x);
      }
    }
    const ro = new ResizeObserver(resize); ro.observe(cv);
    slarkImg();

    // состояние
    const S = { time: START_TIME, score: 0, hits: 0, combo: 0, dir: 1, angle: -90, off: 0, boost: false, zones: [], blueIn: rnd(2, 4), ready: 1.1, paused: false, over: false, fx: [], shake: 0, t: 0, action: 0, endIn: null, scorePop: 0, timePop: 0, flash: 0, flashColor: '255,230,150', open: 0, unlocked: false, cheer: 0, comboPop: 0 };
    const particles = new FX.Particles(), trail = [];
    let dead = false, raf = 0, last = 0, crackleIn = .5, dripIn = rnd(3, 7), wasBoost = false;
    const diff = () => Math.min(1, S.hits / 40);
    function spawn(kind) {
      const d = diff();
      const w0 = kind === 'gold' ? 30 - 18 * d : 26 - 12 * d;
      const life = kind === 'gold' ? 4.4 - 1.9 * d : 3.3 - 1.1 * d;
      let c = 0;
      for (let k = 0; k < 40; k++) {
        c = rnd(0, 360);
        const okPick = Math.abs(angDiff(c, S.angle)) > w0 / 2 + 10;
        const okOther = S.zones.every(z => Math.abs(angDiff(c, z.c)) > (w0 + z.w0) / 2 + 12);
        if (okPick && okOther) break;
      }
      S.zones.push({ kind, c, w0, life, age: 0, seed: Math.random() * 10 });
      api.amb?.('spawn', { pan: Math.cos(rad(c)) * .5 });
    }
    const width = z => z.w0 * Math.max(0, 1 - Math.pow(z.age / z.life, 1.7));
    spawn('gold');

    function pick() {
      if (S.over || S.paused || S.ready > 0 || S.off > 0) return;
      S.action = .15;
      const z = S.zones.find(z => Math.abs(angDiff(S.angle, z.c)) <= width(z) / 2 + 1.2);
      if (z) {
        S.zones.splice(S.zones.indexOf(z), 1);
        S.dir *= -1; S.hits++; S.combo++;
        const a = rad(z.c), x = CX + Math.cos(a) * (R_OUT + 26), y = CY + Math.sin(a) * (R_OUT + 26), pan = Math.cos(a) * .45;
        const gold = z.kind === 'gold', col = gold ? '#ffe477' : '#a8e5ff';
        S.fx.push({ kind: 'burst', z: { ...z, age: null }, w: width(z), t: 0 });
        S.fx.push({ kind: 'ring', color: gold ? '255,220,110' : '150,220,255', t: 0 });
        particles.emit({ x: CX + Math.cos(a) * 118, y: CY + Math.sin(a) * 118, color: col, count: 34, speed: 165, gravity: 130 });
        particles.emit({ x: CX + Math.cos(a) * 118, y: CY + Math.sin(a) * 118, color: [col, '#ffffff'], count: 8, speed: 60, gravity: -10, shape: 'glint', size: 1.6, life: 1.4 });
        S.flash = .14; S.flashColor = gold ? '255,226,140' : '170,225,255';
        if (gold) { S.score += GOLD_POINTS; S.scorePop = .3; S.fx.push({ kind: 'text', x, y, text: '+' + fmtNum(GOLD_POINTS), color: '#ffd760', t: 0, dur: .9 }); api.sfx('hit', { pan }); spawn('gold'); }
        else { S.time += BLUE_BONUS; S.timePop = .5; S.fx.push({ kind: 'text', x: CX, y: CY - 30, text: '+1,5 с', color: '#a8dcff', t: 0, dur: .6 }); api.sfx('blue', { pan }); S.blueIn = rnd(2.5, 5); }
        if (S.combo >= 3) { S.comboPop = .35; api.amb?.('combo', { pitch: 1 + Math.min(S.combo - 3, 12) * .06, pan }); }
        S.cheer = .5;
      } else {
        S.off = MISS_LOCK; S.shake = .25; api.sfx('miss');
        if (S.combo >= 5) S.fx.push({ kind: 'text', x: CX, y: CY + R_RIM + 36, text: 'Серия прервана', color: '#ff9c86', t: 0, dur: .9, small: true });
        S.combo = 0;
        const a = rad(S.angle);
        particles.emit({ x: CX + Math.cos(a) * 130, y: CY + Math.sin(a) * 130, color: '#ff784a', count: 18, speed: 95, gravity: 200 });
        particles.emit({ x: CX + Math.cos(a) * 120, y: CY + Math.sin(a) * 120, color: '#2a2630', count: 5, speed: 18, gravity: -30, shape: 'smoke', size: 2.2, life: 1 });
        S.flash = .1; S.flashColor = '255,80,60';
      }
    }
    function setPause(on) {
      if (S.over || S.paused === on) return;
      S.paused = on; S.boost = false;
      frame.classList.toggle('paused', on); api.pauseAudio?.(on);
      frame.querySelector('#lpPause').hidden = !on;
      if (!on) last = performance.now();
    }

    // ввод: ЛКМ — взлом, ПКМ (держать) — ускорение; на телефоне — тап и кнопка «»»
    const onDown = e => {
      if (e.target.closest('.ar-pause, .lp-boost')) return;
      if (e.button === 2 && !S.paused && !S.over) { S.boost = true; return; }
      if (e.button === 0) { e.preventDefault(); pick(); }
    };
    const onUp = e => { if (e.button === 2) S.boost = false; };
    const onKey = e => {
      if (e.target.closest?.('button, input, textarea, select') && (e.code === 'Space' || e.key === 'Enter')) return;
      if (e.repeat && ['F9', 'Escape', 'p', 'з'].includes(e.key)) return;
      if (e.key === 'F9' || e.key === 'Escape' || e.key === 'p' || e.key === 'з') { e.preventDefault(); setPause(!S.paused); return; }
      if ((e.code === 'Space' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); pick(); }
      if (e.key === 'Shift' && !S.paused && !S.over) S.boost = true;
    };
    const onKeyUp = e => { if (e.key === 'Shift') S.boost = false; };
    const onBlur = () => { S.boost = false; setPause(true); };
    const onVis = () => { if (document.hidden) onBlur(); };
    frame.addEventListener('pointerdown', onDown);
    addEventListener('pointerup', onUp);
    const onCancel = () => { S.boost = false; };
    addEventListener('pointercancel', onCancel);
    frame.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('keydown', onKey); addEventListener('keyup', onKeyUp);
    addEventListener('blur', onBlur); document.addEventListener('visibilitychange', onVis);
    const boostBtn = frame.querySelector('#lpBoost');
    boostBtn.addEventListener('pointerdown', e => { e.preventDefault(); if (S.over || S.paused) return; S.boost = true; boostBtn.setPointerCapture(e.pointerId); });
    boostBtn.addEventListener('pointerup', () => { S.boost = false; });
    boostBtn.addEventListener('pointercancel', () => { S.boost = false; });
    frame.querySelector('[data-resume]').onclick = () => setPause(false);

    function step(dt) {
      if (dead || S.paused) return;
      S.t += dt;
      particles.step(dt);
      for (const f of S.fx) f.t += dt;
      S.fx = S.fx.filter(f => f.t < (f.dur || .9));
      for (const p of trail) p.age += dt;
      while (trail.length && trail[0].age > .14) trail.shift();
      S.flash = Math.max(0, S.flash - dt); S.cheer = Math.max(0, S.cheer - dt); S.comboPop = Math.max(0, S.comboPop - dt);
      // фон: треск свечей и капли — тихо, своим каналом
      if ((crackleIn -= dt) <= 0) { api.amb?.('crackle', { pan: Math.random() < .5 ? -.65 : .65, volume: .7 }); crackleIn = rnd(.35, 1.4); }
      if ((dripIn -= dt) <= 0) { api.amb?.('drip', { pan: .7, volume: .8 }); dripIn = rnd(4, 9); }
      if (S.unlocked) S.open = Math.min(1, S.open + dt / .4);
      if (S.endIn !== null) { S.endIn -= dt; if (S.endIn <= 0) { S.endIn = null; api.end(S.score, S.unlocked ? 'Замок вскрыт!' : 'Время вышло'); } }
      if (S.over) { S.shake = Math.max(0, S.shake - dt); return; }
      if (S.ready > 0) {
        const remaining = Math.max(0, dt - S.ready); S.ready = Math.max(0, S.ready - dt);
        if (S.ready === 0) { api.amb?.('go'); S.fx.push({ kind: 'text', x: CX, y: CY - R_RIM - 40, text: 'Вперёд!', color: '#ffe9b8', t: 0, dur: .8, big: true }); }
        if (!remaining) return; dt = remaining;
      }
      const before = Math.ceil(S.time);
      S.time -= dt;
      if (S.time > 0 && S.time <= 5 && Math.ceil(S.time) !== before) { api.sfx('tick'); api.amb?.('heart'); }
      if (S.off > 0) S.off -= dt;
      S.shake = Math.max(0, S.shake - dt);
      S.action = Math.max(0, S.action - dt); S.scorePop = Math.max(0, S.scorePop - dt); S.timePop = Math.max(0, S.timePop - dt);
      if (S.boost && !wasBoost) api.amb?.('whoosh');
      wasBoost = S.boost;
      const speed = (190 + 120 * diff()) * (S.boost ? 2.1 : 1) * (S.off > 0 ? .3 : 1);
      const prev = S.angle;
      S.angle = (S.angle + S.dir * speed * dt + 360) % 360;
      // щелчок механизма на каждой засечке циферблата
      if (Math.floor((prev + 360) / 30) !== Math.floor((S.angle + 360) / 30)) api.amb?.('rattle', { pan: Math.cos(rad(S.angle)) * .4, volume: S.boost ? .9 : .5 });
      trail.push({ angle: S.angle, age: 0 });
      if (trail.length > 32) trail.shift();
      if (S.boost && Math.random() < .35) { const a = rad(S.angle); particles.emit({ x: CX + Math.cos(a) * R_OUT, y: CY + Math.sin(a) * R_OUT, color: '#bfe9ff', count: 1, speed: 70, gravity: 160, shape: 'ember', size: 1.2, life: .8 }); }
      for (const z of S.zones) {
        z.age += dt;
        // у золотого — редкие искорки
        if (z.kind === 'gold' && Math.random() < dt * 4) { const a = rad(z.c + (Math.random() - .5) * width(z)), rr = R_IN + Math.random() * (R_OUT - R_IN); particles.emit({ x: CX + Math.cos(a) * rr, y: CY + Math.sin(a) * rr, color: '#fff2b0', count: 1, speed: 6, gravity: -8, shape: 'glint', size: 1, life: 1.6 }); }
      }
      for (const z of S.zones.filter(z => z.age >= z.life)) {
        S.zones.splice(S.zones.indexOf(z), 1);
        api.amb?.('fade', { pan: Math.cos(rad(z.c)) * .5 });
        if (z.kind === 'gold') spawn('gold'); else S.blueIn = rnd(2.5, 5);
      }
      if (!S.zones.some(z => z.kind === 'blue')) { S.blueIn -= dt; if (S.blueIn <= 0) spawn('blue'); }
      if (S.time <= 0) {
        S.time = 0; S.over = true; S.boost = false; S.endIn = 1.5;
        // набрал на первую награду — дужка выскакивает, нет — механизм заедает
        S.unlocked = S.score >= UNLOCK_AT;
        if (S.unlocked) {
          api.sfx('unlock'); S.cheer = 1.2; S.flash = .3; S.flashColor = '255,226,140';
          particles.emit({ x: CX, y: 430, color: ['#ffe477', '#fff6c8'], count: 50, speed: 220, gravity: 220 });
          particles.emit({ x: CX, y: 430, color: '#fff2b0', count: 16, speed: 80, gravity: -20, shape: 'glint', size: 2, life: 1.8 });
          S.fx.push({ kind: 'text', x: CX, y: CY - R_RIM - 40, text: 'Замок вскрыт!', color: '#ffe08a', t: 0, dur: 1.6, big: true });
        } else {
          api.sfx('jam'); S.shake = .45;
          particles.emit({ x: CX, y: CY, color: '#2a2630', count: 8, speed: 30, gravity: -40, shape: 'smoke', size: 3, life: 1.4 });
        }
      }
    }
    function render() {
      const calm = FX.reduced();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(scene, 0, 0);
      g.setTransform(scale, 0, 0, scale, 0, 0);
      drawPrisoner(g, slark, S.t, calm ? 0 : S.shake, calm ? 0 : Math.sin(Math.min(1, S.cheer / .5) * Math.PI) * (S.unlocked ? 1 : .35));
      flame(g, 96, 228, S.t, 1); flame(g, 506, 168, S.t, 4);
      // Ambient candle motes use game time, so pausing freezes the entire scene.
      if (!calm) for (const [x, y] of [[96, 218], [506, 158]]) for (let k = 0; k < 6; k++) {
        const age = (S.t * .24 + k / 6) % 1;
        g.globalAlpha = Math.sin(age * Math.PI) * .38; g.fillStyle = '#ffca76';
        g.beginPath(); g.arc(x + Math.sin(age * 7 + k) * 12, y - age * 90, 1.2, 0, 7); g.fill();
      }
      g.globalAlpha = 1;
      const motion = calm ? 0 : Math.sin(S.t * Math.PI / 2) * .32;
      const jolt = calm ? 0 : S.shake;
      plate.style.transform = `translateX(-50%) translateY(${Math.sin(jolt * 40) * jolt * -50}px) rotate(${motion + Math.sin(jolt * 60) * jolt * 7}deg)`;
      g.save();
      if (jolt > 0) g.translate(Math.sin(S.t * 90) * jolt * 25, 0);
      else if (!calm && S.action > 0) g.translate(Math.sin(S.action * 80) * 2, Math.sin(S.action * 40) * 2);
      drawShackle(g, jolt, easeBack(S.open));
      g.drawImage(rimL, 0, 0, W, H);
      for (const z of S.zones) {
        let alpha = z.kind === 'blue' ? .925 + .075 * Math.cos(S.t * Math.PI / .3) : 1;
        if (z.life - z.age < .7 && !calm) alpha *= .55 + .45 * (Math.sin(S.t * 38) > 0 ? 1 : 0);   // вот-вот пропадёт
        g.globalAlpha = alpha;
        drawZone(g, z, width(z), 0, S.t);
      }
      g.globalAlpha = 1;
      for (const f of S.fx) if (f.kind === 'burst') { g.globalAlpha = Math.max(0, 1 - f.t / .45); drawZone(g, f.z, f.w * (1 + f.t * 1.6), 1); g.globalAlpha = 1; }
      if (!calm) for (const p of trail) {
        const a = rad(p.angle);
        g.globalAlpha = Math.max(0, 1 - p.age / .14) * (S.boost ? .32 : .12);
        g.strokeStyle = S.off > 0 ? '#ff6342' : '#c8efff'; g.lineWidth = S.boost ? 4 : 3;
        g.beginPath(); g.moveTo(CX + Math.cos(a) * R_IN, CY + Math.sin(a) * R_IN); g.lineTo(CX + Math.cos(a) * R_OUT, CY + Math.sin(a) * R_OUT); g.stroke();
      }
      g.globalAlpha = 1;
      drawPick(g, S.angle, S.off > 0 ? 'off' : 'on', S.boost ? 1 : 0);
      g.drawImage(hubL, 0, 0, W, H);
      drawHubText(g, S.time, S.score, S.ready, S.scorePop, S.timePop);
      const pulse = S.off > 0 ? Math.min(1, S.off / MISS_LOCK) : Math.max(S.scorePop / .3, S.timePop / .5);
      if (pulse > 0) {
        g.strokeStyle = S.off > 0 ? '#ff5844' : S.timePop > 0 ? '#a8e5ff' : '#ffe477';
        g.globalAlpha = pulse * .7; g.lineWidth = 3; g.shadowColor = g.strokeStyle; g.shadowBlur = 16;
        g.beginPath(); g.arc(CX, CY, R_HUB + 2, 0, 7); g.stroke(); g.shadowBlur = 0; g.globalAlpha = 1;
      }
      // ударная волна от попадания
      for (const f of S.fx) if (f.kind === 'ring' && f.t < .5) {
        const k = f.t / .5;
        g.strokeStyle = `rgba(${f.color},${(1 - k) * .55})`; g.lineWidth = 6 * (1 - k) + 1;
        g.beginPath(); g.arc(CX, CY, R_HUB + (R_RIM + 50 - R_HUB) * (1 - Math.pow(1 - k, 3)), 0, 7); g.stroke();
      }
      particles.draw(g);
      g.restore();
      // серия попаданий — под замком
      if (S.combo >= 3 && !S.over) {
        const s = 1 + S.comboPop * .8;
        g.save(); g.translate(CX, CY + R_RIM + 34); g.scale(s, s);
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 20px ${FONT}`;
        g.shadowColor = 'rgba(255,200,80,.8)'; g.shadowBlur = 12 * (S.comboPop / .35);
        g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(`СЕРИЯ ×${S.combo}`, 0, 0);
        g.fillStyle = S.combo >= 10 ? '#ffd760' : '#efe2c4'; g.fillText(`СЕРИЯ ×${S.combo}`, 0, 0);
        g.restore();
      }
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      for (const f of S.fx) if (f.kind === 'text') {
        const k = f.t / f.dur, pop = f.t < .14 ? 1 + (1 - f.t / .14) * .5 : 1;
        g.save(); g.translate(f.x, f.y - f.t * (f.big ? 12 : 40)); g.scale(pop, pop);
        g.globalAlpha = Math.max(0, Math.min(1, (1 - k) * 2.2)); g.fillStyle = f.color; g.font = `700 ${f.big ? 40 : f.small ? 18 : 24}px ${FONT}`;
        g.strokeStyle = 'rgba(0,0,0,.75)'; g.lineWidth = f.big ? 6 : 4; g.strokeText(f.text, 0, 0); g.fillText(f.text, 0, 0);
        g.restore();
      }
      // мало времени — края темнеют красным в такт секундам
      if (!S.over && S.ready <= 0 && S.time <= 5 && S.time > 0) {
        const beat = Math.pow(S.time % 1, 3) * (calm ? .5 : 1);
        const v = g.createRadialGradient(W / 2, H / 2, H * .32, W / 2, H / 2, H * .75);
        v.addColorStop(0, 'rgba(160,20,10,0)'); v.addColorStop(1, `rgba(160,20,10,${.18 + beat * .32})`);
        g.fillStyle = v; g.fillRect(0, 0, W, H);
      }
      if (S.flash > 0 && !calm) { g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(${S.flashColor},${S.flash * .9})`; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
    }
    function loop(now) {
      if (dead) return;
      let dt = Math.max(0, (now - (last || now)) / 1000); last = now;
      if (dt > 1) { setPause(true); dt = 0; }
      while (dt > 0) { const slice = Math.min(dt, 1 / 120); step(slice); dt -= slice; }
      render();
      raf = requestAnimationFrame(loop);
    }
    resize(); render();
    document.fonts?.load(`700 20px "Philosopher"`).then(() => !dead && render());
    raf = requestAnimationFrame(loop);

    return {
      destroy() {
        dead = true; cancelAnimationFrame(raf); ro.disconnect();
        particles.clear(); removeEventListener('pointercancel', onCancel);
        removeEventListener('pointerup', onUp); removeEventListener('keydown', onKey); removeEventListener('keyup', onKeyUp);
        removeEventListener('blur', onBlur); document.removeEventListener('visibilitychange', onVis);
      },
      _state: S, _step: step, _pick: pick, _draw: render,   // для проверок из консоли
    };
  }

  // ---------- живое превью для карточки на витрине: замок крутится сам, отмычка ловит деления ----------
  function preview(cv) {
    const PW = 960, PH = 540, K = .95, LX = 480, LY = 306;
    const g = cv.getContext('2d'), parts = new FX.Particles(160);
    const bg = document.createElement('canvas'), bgg = bg.getContext('2d');
    const rimL = document.createElement('canvas'), hubL = document.createElement('canvas');
    let sc = 1, t = 0, angle = -90, dir = 1, score = 0, time = 30, raf = 0, last = 0, ring = 0, ringColor = '', flash = 0;
    let zones = [];
    const toLock = x => { x.translate(LX, LY); x.scale(K, K); x.translate(-CX, -CY); };
    function size() {
      const w = cv.clientWidth || 480, d = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(w * d); cv.height = Math.round(w * d * PH / PW); sc = cv.width / PW;
      for (const c of [bg, rimL, hubL]) { c.width = cv.width; c.height = cv.height; }
      bgg.setTransform(sc, 0, 0, sc, 0, 0);
      drawWall(bgg, PW, 470, 11); drawFloor(bgg, PW, PH, 470, 13);
      sconce(bgg, 140, 196, 66); sconce(bgg, 820, 170, 72);
      const v = bgg.createRadialGradient(PW / 2, PH / 2, PH * .3, PW / 2, PH / 2, PW * .62);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.7)'); bgg.fillStyle = v; bgg.fillRect(0, 0, PW, PH);
      for (const [c, draw] of [[rimL, drawRim], [hubL, drawHubBase]]) { const x = c.getContext('2d'); x.setTransform(sc, 0, 0, sc, 0, 0); toLock(x); draw(x); }
    }
    const add = kind => { let c = 0; for (let k = 0; k < 30; k++) { c = rnd(0, 360); if (Math.abs(angDiff(c, angle)) > 50 && zones.every(z => Math.abs(angDiff(c, z.c)) > 40)) break; } zones.push({ kind, c, w0: kind === 'gold' ? 26 : 22, age: 0, life: 99, seed: Math.random() * 9 }); };
    const reset = () => { zones = []; add('gold'); add('blue'); score = 0; time = 30; };
    reset();
    function step(dt) {
      t += dt; time -= dt; flash = Math.max(0, flash - dt); ring = Math.max(0, ring - dt);
      if (time <= 0) reset();
      angle = (angle + dir * 200 * dt + 360) % 360;
      for (const z of zones) z.age += dt;
      // отмычка «ловит» деление, когда доходит до его середины
      const z = zones.find(z => z.age > .5 && Math.abs(angDiff(angle, z.c)) < 2);
      if (z) {
        zones.splice(zones.indexOf(z), 1); dir *= -1; add(z.kind);
        if (z.kind === 'gold') score += 1000; else time += 1.5;
        const a = rad(z.c);
        parts.emit({ x: CX + Math.cos(a) * 118, y: CY + Math.sin(a) * 118, color: z.kind === 'gold' ? '#ffe477' : '#a8e5ff', count: 26, speed: 150, gravity: 120 });
        ring = .5; ringColor = z.kind === 'gold' ? '255,220,110' : '150,220,255'; flash = .1;
      }
      parts.step(dt);
    }
    function draw() {
      g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(bg, 0, 0);
      g.setTransform(sc, 0, 0, sc, 0, 0);
      flame(g, 140, 188, t, 1, .9); flame(g, 820, 162, t, 4, .9);
      g.save(); toLock(g);
      drawShackle(g); g.drawImage(rimL, 0, 0, cv.width, cv.height, CX - LX / K, CY - LY / K, PW / K, PH / K);
      for (const z of zones) drawZone(g, z, z.w0, 0, t);
      drawPick(g, angle, 'on');
      g.drawImage(hubL, 0, 0, cv.width, cv.height, CX - LX / K, CY - LY / K, PW / K, PH / K);
      drawHubText(g, time, score, 0, 0, 0);
      if (ring > 0) { const k = 1 - ring / .5; g.strokeStyle = `rgba(${ringColor},${(1 - k) * .55})`; g.lineWidth = 6 * (1 - k) + 1; g.beginPath(); g.arc(CX, CY, R_HUB + (R_RIM + 50 - R_HUB) * (1 - Math.pow(1 - k, 3)), 0, 7); g.stroke(); }
      parts.draw(g);
      g.restore();
      if (flash > 0) { g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,226,140,${flash})`; g.fillRect(0, 0, PW, PH); g.globalCompositeOperation = 'source-over'; }
    }
    function loop(now) {
      const dt = Math.min(.05, last ? (now - last) / 1000 : 0); last = now;
      step(dt); draw(); raf = requestAnimationFrame(loop);
    }
    size(); step(0); draw();
    document.fonts?.load(`700 20px "Philosopher"`).then(() => raf || draw());
    return {
      play() { if (!raf && !FX.reduced()) { last = 0; raf = requestAnimationFrame(loop); } },
      stop() { cancelAnimationFrame(raf); raf = 0; },
      resize() { size(); draw(); },
    };
  }

  const ticket = n => `<span class="ar-tickets">${'<i>?</i>'.repeat(n)}</span>`;
  Arcade.register({
    id: 'lockpick', theme: 'carnival', title: 'Взлом замка',
    subtitle: 'Помогите Сларку выбраться из камеры!',
    how: `<p class="ar-lead">Взломайте замок, как можно больше раз попав в отмеченные области за отведённое время.</p>
      <div class="ar-step">${Arcade.MOUSE('l', 'ЛКМ')}<div><b>Взлом</b><p>Нажмите кнопку взлома, когда деление достигнет выделенной области.</p><p>Промах ненадолго отключит взлом.</p><p>Синие области дают дополнительное время.</p></div></div>
      <div class="ar-step">${Arcade.MOUSE('r', 'ПКМ')}<div><b>Ускорение</b><p>Удерживайте эту кнопку для ускорения.</p></div></div>
      <div class="ar-step">${Arcade.KEY('F9')}<div><b>Пауза</b><p>Остановить игру. На телефоне: тап — взлом, кнопка «»» — ускорение.</p></div></div>`,
    scoring: [['Каждое попадание', '1 000'], ['Синяя область', '+1,5 секунды']],
    rewards: [
      { at: 6000, pic: '<span class="ar-token lp"></span>', label: 'Билет дальше' },
      { at: 12000, pic: ticket(3), label: '3 случайных билета' },
      { at: 18000, pic: ticket(5), label: '5 случайных билетов' },
      { at: 24000, pic: '<span class="ar-emo" style="--img:url(https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/slark.png)"></span>', label: 'Смайлик Сларка' },
    ],
    mount, preview,
  });
})();
