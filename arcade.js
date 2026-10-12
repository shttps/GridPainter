'use strict';
/* «Мини-игры»: витрина и общий каркас для игр из ивентов Dota 2.
   Игра открывается поверх страницы, как в клиенте: экран описания («Как играть», «Рекорды», «Награды», «Играть»),
   затем сама игра и итог. Лучший результат хранится в браузере, а у вошедших — ещё и в общей таблице (Supabase).
   Игры регистрируются через Arcade.register() в своих файлах (lockpick.js, sweeper.js). */
(() => {
  const GAMES = new Map();
  const CFG = window.GRID_CATALOG || {}, ACC = window.Accounts;
  const remote = !!(CFG.url && CFG.key && ACC?.enabled);
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const best = id => load('gs.arcade.best', {})[id] || 0;
  const setBest = (id, v) => { const all = load('gs.arcade.best', {}); all[id] = v; save('gs.arcade.best', all); };
  const fmt = n => (+n || 0).toLocaleString('ru-RU');

  async function rpc(fn, args) {
    const h = { apikey: CFG.key, 'Content-Type': 'application/json' };
    const t = await ACC.token();
    if (t) h.Authorization = 'Bearer ' + t; else if (!CFG.key.startsWith('sb_')) h.Authorization = 'Bearer ' + CFG.key;
    const res = await fetch(CFG.url.replace(/\/+$/, '') + '/rest/v1/rpc/' + fn, { method: 'POST', headers: h, body: JSON.stringify(args) });
    const text = await res.text(), data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(data?.message || res.statusText);
    return data;
  }

  // One shared audio context; sessions stop all pending voices on pause/exit.
  let muted = load('gs.arcade.mute', false);
  const audio = window.ArcadeAudio;
  audio?.mute(muted);
  const sfx = (name, options) => audio?.sound(name, options);

  // ---------- оверлей ----------
  let ov = null, cur = null, inst = null;
  const MOUSE = (btn, label) => `<span class="ar-mouse ${btn}" aria-label="${label}"><i></i></span>`;
  const KEY = k => `<kbd class="ar-key">${k}</kbd>`;

  function open(id) {
    const g = GAMES.get(id); if (!g) return;
    close(true);
    cur = g;
    audio?.unlock();
    ov = document.createElement('div');
    ov.className = `ar-ov theme-${g.theme}`; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', g.title);
    ov.innerHTML = `<div class="ar-backdrop"></div><div class="ar-shell" id="arShell"></div>
      <div class="ar-tools"><button class="ar-tool" id="arMute" title="Звук">${muted ? '🔇' : '🔊'}</button><button class="ar-tool ar-close" id="arClose" title="Закрыть (Esc)" aria-label="Закрыть">✕</button></div>`;
    document.body.appendChild(ov);
    document.documentElement.classList.add('ar-lock');
    ov.querySelector('#arClose').onclick = () => close();
    const muteButton = ov.querySelector('#arMute');
    const muteUI = () => { muteButton.textContent = muted ? '🔇' : '🔊'; muteButton.setAttribute('aria-pressed', String(muted)); muteButton.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук'); };
    muteUI();
    muteButton.onclick = () => { muted = !muted; save('gs.arcade.mute', muted); audio?.unlock(); audio?.mute(muted); muteUI(); };
    ov.querySelector('.ar-backdrop').onclick = () => { if (!inst) close(); };
    if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
    intro();
  }
  function close(silent) {
    inst?.destroy(); inst = null; audio?.stop(); audio?.pause(false);
    ov?.remove(); ov = null; cur = null;
    document.documentElement.classList.remove('ar-lock');
    if (!silent && location.hash) history.replaceState(null, '', location.pathname + location.search);
    renderHub();
  }
  addEventListener('keydown', e => {
    if (!ov || e.key !== 'Escape') return;
    if (inst && !ov.dataset.done) return;   // в игре Esc — пауза (её ловит сама игра)
    close();
  });

  // экран описания: как в клиенте — заголовок, «Как играть» и «Рекорды», очки, награды, «Играть»
  function intro() {
    inst?.destroy(); inst = null; audio?.stop(); audio?.pause(false); delete ov.dataset.done;
    const g = cur, b = best(g.id), sh = ov.querySelector('#arShell');
    sh.className = 'ar-shell intro';
    sh.innerHTML = `<div class="ar-panel">
      <header class="ar-hero">${g.logo || `<h2 class="ar-title">${g.title}</h2>`}<p class="ar-sub">${g.subtitle}</p></header>
      <div class="ar-cols">
        <section class="ar-how"><h3>Как играть</h3>${g.how}
          ${g.scoring ? `<h3>Подсчёт очков</h3><div class="ar-scoring">${g.scoring.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('')}</div>` : ''}
        </section>
        <section class="ar-rec"><h3>Рекорды</h3><div class="ar-board" id="arBoard"></div>
          <div class="ar-mine"><span>Твой рекорд</span><b>${fmt(b)}</b></div></section>
      </div>
      <section class="ar-rewards"><h3>Награды</h3><div class="ar-rw">${g.rewards.map(r => `<div class="ar-rw-i${b >= r.at ? ' got' : ''}"><i class="ar-check">✓</i><b>${fmt(r.at)}</b><div class="ar-rw-pic">${r.pic}</div><small>${r.label}</small></div>`).join('')}</div></section>
      <div class="ar-play"><button class="ar-btn" id="arPlay">Играть</button></div>
    </div>`;
    sh.querySelector('#arPlay').onclick = start;
    sh.querySelector('#arPlay').focus({ preventScroll: true });
    loadBoard(g.id);
  }
  function start() {
    audio?.stop(); audio?.pause(false); audio?.unlock();
    sfx('start');
    const sh = ov.querySelector('#arShell');
    sh.className = 'ar-shell play'; sh.innerHTML = ''; delete ov.dataset.done;
    inst = cur.mount(sh, { sfx, end: finish, best: best(cur.id), muted: () => muted, pauseAudio: on => audio?.pause(on) });
  }
  // итог: очки, рекорд, какие награды взяты; у вошедших результат уходит в общую таблицу
  function finish(score, note = '') {
    if (!cur || !ov || ov.dataset.done) return;
    audio?.pause(false);
    const g = cur, prev = best(g.id), rec = score > prev;
    if (rec) setBest(g.id, score);
    ov.dataset.done = '1';
    const sh = ov.querySelector('#arShell');
    const box = document.createElement('div');
    box.className = 'ar-result';
    box.innerHTML = `<div class="ar-result-card">
      <span class="ar-eyebrow">${note || 'Игра окончена'}</span>
      <b class="ar-score">${fmt(score)}</b>
      <span class="ar-best">${rec ? '<em>Новый рекорд!</em>' : `Рекорд: ${fmt(prev)}`}</span>
      <div class="ar-rw small">${g.rewards.map(r => `<div class="ar-rw-i${Math.max(score, prev) >= r.at ? ' got' : ''}${score >= r.at && prev < r.at ? ' new' : ''}"><i class="ar-check">✓</i><b>${fmt(r.at)}</b></div>`).join('')}</div>
      <p class="ar-sync" id="arSync"></p>
      <div class="ar-result-btns"><button class="ar-btn" id="arAgain">Ещё раз</button><button class="ar-btn ghost" id="arBack">К описанию</button></div>
    </div>`;
    sh.appendChild(box);
    box.querySelector('#arAgain').onclick = () => { inst?.destroy(); start(); };
    box.querySelector('#arBack').onclick = intro;
    box.querySelector('#arAgain').focus({ preventScroll: true });
    sfx(note === 'Победа' ? 'win' : 'end');
    submit(g.id, Math.max(score, prev), box.querySelector('#arSync'));
  }
  async function submit(id, score, el) {
    if (!remote) return;
    if (!ACC.signedIn()) { el.innerHTML = `<a href="profile.html?next=arcade.html">Войди</a>, чтобы попасть в таблицу рекордов.`; return; }
    if (!score) return;
    try { await rpc('arcade_submit', { p_game: id, p_score: score }); el.textContent = 'Результат в таблице рекордов.'; }
    catch (e) { el.textContent = /arcade_submit|function|schema/i.test(e.message) ? 'Таблица рекордов скоро заработает.' : 'Не удалось записать рекорд.'; }
  }
  async function loadBoard(id) {
    const box = ov?.querySelector('#arBoard'); if (!box) return;
    if (!remote) { box.innerHTML = '<p class="ar-note">Таблица заработает, когда сайт подключит базу.</p>'; return; }
    box.innerHTML = '<p class="ar-note">Загружаем…</p>';
    let rows;
    try { rows = await rpc('arcade_board', { p_game: id }); } catch { if (box.isConnected) box.innerHTML = '<p class="ar-note">Таблица рекордов скоро заработает.</p>'; return; }
    if (!box.isConnected) return;
    const me = ACC.user()?.id;
    rows = rows || [];
    box.innerHTML = rows.length ? `<ol>${rows.map(r => `<li class="${r.id === me ? 'me' : ''}"><i>${r.place}</i>${avatarHTML(r.avatar, r.nick, 'ar-ava')}<span>${esc(r.nick)}</span><b>${fmt(r.score)}</b></li>`).join('')}</ol>`
      : '<p class="ar-note">Пока пусто. Сыграй первым!</p>';
  }

  // ---------- витрина ----------
  function renderHub() {
    for (const el of $$('[data-best]')) { const v = best(el.dataset.best); el.textContent = v ? `Рекорд: ${fmt(v)}` : 'Ещё не играл'; }
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-play]'); if (!b) return;
    e.preventDefault(); open(b.dataset.play);
  });
  addEventListener('hashchange', () => { const id = location.hash.slice(1); if (GAMES.has(id) && cur?.id !== id) open(id); });

  window.Arcade = {
    register(g) { GAMES.set(g.id, g); if (location.hash.slice(1) === g.id && !ov) setTimeout(() => !ov && open(g.id)); },
    open, close, sfx, fmt, MOUSE, KEY,
    get current() { return inst; },   // для проверок из консоли
  };
  renderHub();
})();
