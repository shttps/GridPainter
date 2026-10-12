/* Run with Playwright on NODE_PATH, or installed locally. No production service writes. */
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const name = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!name.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(name, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(name)] || 'application/octet-stream' }).end(data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.ARCADE_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    // Leaderboards/auth are out of scope; keep this test completely offline.
    await context.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:') ? route.continue() : route.abort());
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      // Deterministic animation clock: each test explicitly advances simulation time.
      window.requestAnimationFrame = () => 1;
      window.cancelAnimationFrame = () => {};
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/arcade.html`);
    await page.evaluate(() => {
      window.soundEvents = [];
      const sound = ArcadeAudio.sound;
      ArcadeAudio.sound = (name, options) => { soundEvents.push(name); sound(name, options); };
    });
    const start = async id => { await page.evaluate(id => Arcade.open(id), id); await page.locator('#arPlay').click(); };
    const advance = async seconds => page.evaluate(seconds => {
      const game = Arcade.current;
      for (let t = 0; t < seconds - 1e-8; t += 1 / 120) game._step(Math.min(1 / 120, seconds - t));
      game._draw?.();
    }, seconds);
    await start('lockpick');
    await advance(1.1);
    assert.equal(await page.evaluate(() => {
      const g = Arcade.current, s = g._state; s.ready = 0; s.angle = s.zones[0].c; g._pick(); return s.score;
    }), 1000);
    await page.evaluate(() => { const g = Arcade.current, s = g._state; s.zones = [{ kind: 'blue', c: 20, w0: 26, life: 4, age: 0 }]; s.angle = 20; const t = s.time; g._pick(); if (Math.abs(s.time - t - 1.5) > 1e-8) throw Error('Blue time bonus'); });
    await page.evaluate(() => { const g = Arcade.current, s = g._state; s.zones = []; g._pick(); if (s.off <= 0) throw Error('Miss cooldown'); });
    await page.keyboard.press('F9');
    const lockPause = await page.evaluate(() => JSON.stringify(Arcade.current._state));
    await advance(2);
    assert.equal(await page.evaluate(() => JSON.stringify(Arcade.current._state)), lockPause);
    await page.keyboard.press('F9');
    await page.evaluate(() => { Arcade.current._state.time = .05; });
    await advance(.1);
    assert.equal(await page.locator('.ar-result').count(), 0);
    await advance(1.5);
    assert.equal(await page.locator('.ar-result').count(), 1);
    await page.locator('#arAgain').click();
    assert.equal(await page.evaluate(() => Arcade.current._state.score), 0);
    await start('sweeper');
    assert.equal(await page.locator('#swPause').isVisible(), false);
    await page.evaluate(() => { Arcade.current._reveal(40); Arcade.current._draw(); });
    assert.ok(await page.evaluate(() => Arcade.current._board().opened > 1));
    await advance(.6);
    // Wrong chord must not consume a move; it should provide feedback.
    assert.ok(await page.evaluate(() => {
      const g = Arcade.current, b = g._board(); const i = b.num.findIndex((n, i) => n > 0 && b.open[i]);
      const opened = b.opened; g._reveal(i); return b.opened === opened && soundEvents.at(-1) === 'invalid';
    }));
    // Real mouse at the last pixel inside the canvas must flag the last cell.
    const corner = await page.locator('#swBoard').evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.right - 6, y: r.bottom - 6 }; });
    await page.evaluate(() => { const b = Arcade.current._board(); b.open[b.n - 1] = 0; b.flag[b.n - 1] = 0; });
    await page.mouse.click(corner.x, corner.y, { button: 'right' });
    assert.equal(await page.evaluate(() => Arcade.current._board().flag.at(-1)), 1);
    await advance(.25);
    await page.mouse.click(corner.x, corner.y, { button: 'right' });
    assert.equal(await page.evaluate(() => soundEvents.at(-1)), 'unflag');
    await page.keyboard.press('F9');
    const paused = await page.evaluate(() => ({ time: Arcade.current._state.time, t: Arcade.current._state.t }));
    await advance(2);
    assert.deepEqual(await page.evaluate(() => ({ time: Arcade.current._state.time, t: Arcade.current._state.t })), paused);
    await page.keyboard.press('F9');
    // Skill must spend exactly 50 mana and safely remove a mine.
    const skillCell = await page.evaluate(() => {
      const b = Arcade.current._board(); return b.mine.findIndex((m, i) => m && !b.flag[i]);
    });
    await page.locator('#swSkill').click();
    const skillPoint = await page.locator('#swBoard').evaluate((el, i) => {
      const r = el.getBoundingClientRect(), b = Arcade.current._board();
      return { x: r.left + el.clientLeft + (i % b.w + .5) * el.clientWidth / b.w, y: r.top + el.clientTop + (Math.floor(i / b.w) + .5) * el.clientHeight / b.h };
    }, skillCell);
    await page.mouse.click(skillPoint.x, skillPoint.y);
    assert.equal(await page.evaluate(() => Arcade.current._state.mana), 50);
    assert.equal(await page.evaluate(i => Arcade.current._board().mine[i], skillCell), 0);
    await advance(.3);
    // Pickup/expiry have distinct events, and item relocation preserves its lifetime.
    await page.evaluate(() => {
      const g = Arcade.current, b = g._board(), i = b.open.findIndex((v, i) => !v && !b.mine[i] && !b.flag[i]);
      b.items.set(i, { type: 'clarity', left: 5, born: g._state.t });
      g._reveal(i);
      if (g._state.mana !== 75 || !soundEvents.includes('clarity')) throw Error('Clarity pickup');
      const j = b.open.findIndex((v, i) => !v && !b.flag[i]);
      b.items.set(j, { type: 'clock', left: 1, born: g._state.t });
      g._flag(j);
      if (b.items.has(j) || ![...b.items.values()].some(it => it.left === 1)) throw Error('Item relocation');
    });
    // Explosion must happen AFTER priming, never in the same frame.
    await page.evaluate(() => { const g = Arcade.current, b = g._board(); const i = b.mine.findIndex((m, i) => m && !b.flag[i]); g._reveal(i); g._draw(); });
    assert.equal(await page.evaluate(() => soundEvents.at(-1)), 'prime');
    await advance(.39);
    assert.equal(await page.evaluate(() => Arcade.current._board().exploded), false);
    await advance(.02);
    assert.equal(await page.evaluate(() => Arcade.current._board().exploded), true);
    assert.equal(await page.evaluate(() => soundEvents.at(-1)), 'boom');
    await advance(1.5);
    assert.equal(await page.locator('.ar-result').count(), 1);
    // Stage transitions must respect pause, and a destroyed game must not finish later.
    await start('sweeper');
    await page.evaluate(() => { const g = Arcade.current; g._reveal(40); const b = g._board(); for (let i = 0; i < b.n; i++) if (!b.mine[i]) g._reveal(i); });
    assert.equal(await page.evaluate(() => Arcade.current._state.busy), true);
    await page.keyboard.press('F9');
    await advance(3);
    assert.equal(await page.evaluate(() => Arcade.current._state.stage), 0);
    await page.keyboard.press('F9');
    await advance(2);
    assert.equal(await page.evaluate(() => Arcade.current._state.stage), 1);
    for (let stage = 1; stage < 5; stage++) {
      await page.evaluate(() => { const g = Arcade.current; g._reveal(0); const b = g._board(); for (let i = 0; i < b.n; i++) if (!b.mine[i]) g._reveal(i); });
      await advance(2);
    }
    assert.equal(await page.locator('.ar-eyebrow').textContent(), 'Победа');
    await start('sweeper');
    await page.evaluate(() => { window.oldGame = Arcade.current; Arcade.close(); oldGame._step(100); });
    assert.equal(await page.locator('.ar-ov').count(), 0);
    // Mute preference survives closing/reopening the overlay.
    await start('lockpick'); await page.locator('#arMute').click();
    assert.equal(await page.locator('#arMute').getAttribute('aria-pressed'), 'true');
    await start('sweeper');
    assert.equal(await page.locator('#arMute').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(errors, []);
    // Render actual frames at desktop and mobile sizes for visual inspection.
    const out = path.join(root, '.tmp', 'arcade-qa'); fs.mkdirSync(out, { recursive: true });
    await page.evaluate(() => { Arcade.current._reveal(40); }); await advance(.7);
    await page.screenshot({ path: path.join(out, 'sweeper-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100); await page.evaluate(() => Arcade.current._draw());
    await page.screenshot({ path: path.join(out, 'sweeper-mobile.png') });
    const board = await page.locator('#swBoard').boundingBox();
    assert.ok(board.x >= 0 && board.x + board.width <= 390);
    await start('lockpick');
    await page.waitForTimeout(100); await page.evaluate(() => Arcade.current._draw());
    await page.screenshot({ path: path.join(out, 'lockpick-mobile.png') });
    // Native touch events: a canceled long press must never plant a later flag.
    await start('sweeper');
    const cdp = await context.newCDPSession(page);
    const touchBoard = await page.locator('#swBoard').boundingBox();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchBoard.x + 20, y: touchBoard.y + 20 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await page.waitForTimeout(420);
    assert.equal(await page.evaluate(() => Arcade.current._board().flag.reduce((a, b) => a + b, 0)), 0);
    assert.equal(await page.evaluate(() => Arcade.current._board().opened), 0);
    await cdp.detach();
    assert.deepEqual(errors, []);
    // Real RAF and Web Audio (the deterministic page above cannot validate these).
    const live = await context.newPage();
    live.on('pageerror', e => errors.push(e.message));
    await live.addInitScript(() => {
      const NativeContext = window.AudioContext;
      window.AudioContext = class extends NativeContext {
        createDynamicsCompressor() {
          const node = super.createDynamicsCompressor();
          window.audioProbe = this.createAnalyser(); node.connect(audioProbe); return node;
        }
      };
    });
    await live.goto(`http://127.0.0.1:${server.address().port}/arcade.html#lockpick`);
    // The previous page saved mute=true; exercise enabling it again.
    await live.locator('#arMute').click(); await live.locator('#arPlay').click();
    await live.waitForTimeout(1750);
    assert.ok(await live.evaluate(() => Arcade.current._state.time < 29.8 && Arcade.current._state.time > 28));
    await live.evaluate(() => { ArcadeAudio.sound('boom'); });
    await live.waitForTimeout(75);
    const peak = await live.evaluate(() => {
      const samples = new Float32Array(audioProbe.fftSize); audioProbe.getFloatTimeDomainData(samples);
      return Math.max(...samples.map(Math.abs));
    });
    assert.ok(peak > .001 && peak < 1, `Audible, unclipped output: ${peak}`);
    await live.evaluate(() => { const g = Arcade.current, s = g._state; s.angle = s.zones[0].c; g._pick(); });
    await live.waitForTimeout(60);
    await live.screenshot({ path: path.join(out, 'lockpick-hit.png') });
    await live.evaluate(() => Arcade.open('sweeper')); await live.locator('#arPlay').click();
    await live.evaluate(() => { Arcade.current._reveal(40); });
    await live.waitForTimeout(600);
    await live.evaluate(() => { const g = Arcade.current, b = g._board(); g._reveal(b.mine.findIndex(m => m)); });
    await live.waitForTimeout(480);
    await live.screenshot({ path: path.join(out, 'sweeper-boom.png') });
    await live.close();
    assert.deepEqual(errors, []);
    console.log('PASS: scoring, blue bonus, cooldown, pause, replay, safe opening, chord, edge hit-testing, flags, delayed explosion, five stages, cleanup, mute, mobile layout.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => server.close());
