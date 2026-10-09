'use strict';
/* Редактор, дополнения к app.js: первое знакомство (окно приветствия, тур по интерфейсу, подсказки к месту)
   и профиль («Мои работы» в облаке, автосохранение, публикация от своего имени).
   Пользуется функциями и состоянием app.js — подключается после него. */
(() => {
  const ACC = window.Accounts;
  const hintsSeen = new Set(load('gp2.hints', []));
  const seen = id => hintsSeen.has(id);
  const markSeen = id => { hintsSeen.add(id); store('gp2.hints', [...hintsSeen]); };
  const modalOpen = () => $('#modalRoot').children.length > 0;
  // выполнить, когда закроются все окна (например, тур — после окна импорта)
  function whenIdle(fn) {
    if (!modalOpen()) { setTimeout(fn, 250); return; }
    const mo = new MutationObserver(() => { if (!modalOpen()) { mo.disconnect(); setTimeout(fn, 300); } });
    mo.observe($('#modalRoot'), { childList: true });
  }

  // ======================= тур по интерфейсу =======================
  const TOUR = [
    ['#rail', 'Инструменты', 'Карандаш, линии и фигуры ставят символы по сетке плотности. Клавиши подписаны в углу кнопок: <kbd>B</kbd> — карандаш, <kbd>L</kbd> — линия, <kbd>R</kbd> — прямоугольник.'],
    ['#layers', 'Категории', 'Каждый рисунок, текст и блок героев — строка здесь, клик выделяет объект на холсте. <b>+</b> — добавить картинку, ASCII, текст или героев.'],
    ['#inspector', 'Свойства', 'Настройки выделенного, инструмента и холста: перо, плотность, фон-картинка для обводки.'],
    ['#viewSwitch', 'Как в игре', '<kbd>Tab</kbd> — экран «Герои» Доты по её настоящим стилям. Так сетка будет выглядеть в игре.'],
    ['#btnExport', 'Экспорт', 'Готовый <b>hero_grid_config.json</b>. Сначала открой свой файл (меню у названия → «Открыть JSON…»), чтобы не потерять старые сетки.'],
    ['#brandPill', 'Название и меню', 'Название сетки в Доте. В меню — открыть JSON, «Мои работы», тема и эти подсказки.'],
    ['#btnCmd', 'Все команды', '<kbd>Ctrl</kbd> + <kbd>K</kbd> — поиск по всем действиям редактора. Удачи!'],
  ];
  let tourEl = null;
  function startTour() {
    closeMenus();
    if (st.preview) setPreview(false);
    const steps = TOUR.filter(([sel]) => { const el = $(sel); return el && el.offsetParent !== null && el.getBoundingClientRect().width > 0; });
    if (!steps.length) return;
    endTour();
    tourEl = document.createElement('div');
    tourEl.className = 'tour';
    tourEl.innerHTML = '<div class="tour-spot"></div><div class="tour-pop" role="dialog" aria-live="polite"></div>';
    document.body.appendChild(tourEl);
    let k = 0;
    const show = () => {
      const [sel, title, text] = steps[k], r = $(sel).getBoundingClientRect(), pad = 6;
      Object.assign($('.tour-spot', tourEl).style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
      const pop = $('.tour-pop', tourEl);
      pop.innerHTML = `<div class="tp-step">${k + 1} / ${steps.length}</div><b>${title}</b><p>${text}</p>
        <div class="tp-actions"><button class="link" data-t="skip">Пропустить</button>${k ? '<button class="btn sm" data-t="back">Назад</button>' : ''}<button class="btn primary sm" data-t="next">${k === steps.length - 1 ? 'Готово' : 'Дальше'}</button></div>`;
      // попап — под элементом, над ним или сбоку, смотря где больше места
      const W = innerWidth, H = innerHeight, pw = Math.min(320, W - 24);
      pop.style.width = pw + 'px';
      const ph = pop.offsetHeight;
      let x = clamp(r.left + r.width / 2 - pw / 2, 12, W - pw - 12), y;
      if (r.bottom + 14 + ph < H) y = r.bottom + 14;
      else if (r.top - 14 - ph > 0) y = r.top - 14 - ph;
      else { y = clamp(r.top, 12, H - ph - 12); x = r.left > W / 2 ? r.left - pw - 16 : r.right + 16; }
      Object.assign(pop.style, { left: x + 'px', top: y + 'px' });
      pop.classList.remove('in'); void pop.offsetWidth; pop.classList.add('in');
      $('[data-t="next"]', pop).focus({ preventScroll: true });
    };
    tourEl.onclick = e => {
      const t = e.target.closest('[data-t]')?.dataset.t;
      if (t === 'next') { if (++k >= steps.length) endTour(); else show(); }
      else if (t === 'back') { k = Math.max(0, k - 1); show(); }
      else if (t === 'skip') endTour();
    };
    tourEl.onkeydown = e => { if (e.key === 'Escape') endTour(); };
    tourEl._resize = () => show();
    addEventListener('resize', tourEl._resize);
    show();
    markSeen('tour');
  }
  function endTour() {
    if (!tourEl) return;
    removeEventListener('resize', tourEl._resize);
    tourEl.remove(); tourEl = null;
  }
  document.addEventListener('keydown', e => { if (tourEl && e.key === 'Escape') { e.stopPropagation(); endTour(); } }, true);
  CMD.tour = startTour;

  // ======================= подсказки к месту =======================
  // Небольшой пузырь у элемента: показывается один раз, закрывается сам или по «Понятно».
  let bubble = null;
  function hint(id, sel, html, { force = false, action } = {}) {
    if ((!force && seen(id)) || tourEl || modalOpen()) return false;
    const el = $(sel); if (!el || !el.offsetParent) return false;
    markSeen(id);
    bubble?.remove();
    const b = bubble = document.createElement('div');
    b.className = 'hint-pop';
    b.innerHTML = `<p>${html}</p><div class="hp-actions">${action ? `<button class="btn primary sm" data-h="act">${action[0]}</button>` : ''}<button class="btn sm" data-h="ok">Понятно</button></div>`;
    document.body.appendChild(b);
    const r = el.getBoundingClientRect(), w = Math.min(300, innerWidth - 24);
    b.style.width = w + 'px';
    const below = r.bottom + 12 + b.offsetHeight < innerHeight;
    Object.assign(b.style, { left: clamp(r.left + r.width / 2 - w / 2, 12, innerWidth - w - 12) + 'px', top: (below ? r.bottom + 12 : r.top - 12 - b.offsetHeight) + 'px' });
    b.classList.add(below ? 'below' : 'above');
    b.style.setProperty('--ax', clamp(r.left + r.width / 2 - parseFloat(b.style.left), 18, w - 18) + 'px');
    const close = () => { b.classList.add('out'); setTimeout(() => b.remove(), 200); if (bubble === b) bubble = null; };
    b.onclick = e => { const h = e.target.closest('[data-h]')?.dataset.h; if (h === 'act') { action[1](); close(); } else if (h === 'ok') close(); };
    setTimeout(close, 14000);
    return true;
  }

  // следим за изменениями холста и режимом «В игре» — по ним показываем подсказки
  let lastCount = st.els.length;
  const prevChanged = changed;
  changed = function (rebuild) {
    prevChanged(rebuild);
    const n = st.els.length, grew = n - lastCount;
    lastCount = n;
    cloudDirty();
    if (grew >= 50) setTimeout(() => {
      hint('ingame', '#viewSwitch', 'Готово! Нажми <b>«В игре»</b> (<kbd>Tab</kbd>) — так сетка будет выглядеть в Доте.')
        || (ACC?.enabled && ACC.signedIn() && !proj() && hint('cloud', '#brandPill', 'Сохрани работу в профиль, чтобы вернуться к ней с любого устройства.', { action: ['Сохранить', () => cloudSave()] }))
        || (ACC?.enabled && !ACC.signedIn() && hint('login', '#brandPill', 'Войди в профиль — работы будут храниться в «Мои работы» и открываться с любого устройства.', { action: ['Войти', () => { location.href = 'profile.html?next=editor.html'; }] }));
    }, 500);
    if (n > 6000) setTimeout(() => hint('many', '#catCount', 'Много категорий: экран героев в игре будет открываться дольше. <a href="guides.html#limits" target="_blank">Как сэкономить</a>'), 600);
  };
  const prevPreview = setPreview;
  setPreview = function (on) {
    prevPreview(on);
    if (!on && st.els.length) setTimeout(() => hint('export', '#btnExport', 'Нравится? <b>Экспорт</b> — и положи файл в папку Доты. <a href="guides.html#start" target="_blank">Куда класть файл</a>'), 450);
  };

  // ======================= окно приветствия =======================
  function openWelcome() {
    const m = openModal(`${modalHead('Добро пожаловать в редактор')}
      <div class="modal-body welcome">
        <p class="wl-lead">Здесь рисуют сетки героев Dota&nbsp;2: каждый символ на холсте станет категорией в игре. С чего начнём?</p>
        <div class="wl-grid">
          <button class="wl-card hot" data-w="image"><span class="wl-ico" data-icon="image"></span><b>Картинка → арт</b><span>Line-art, ASCII или мозаика из героев. Самый быстрый путь.</span></button>
          <button class="wl-card" data-w="draw"><span class="wl-ico" data-icon="pencil"></span><b>Нарисовать самому</b><span>Карандаш, линии, фигуры и текст — покажем, где что.</span></button>
          <button class="wl-card" data-w="json"><span class="wl-ico" data-icon="folder"></span><b>Открыть свой JSON</b><span>hero_grid_config.json из папки Доты — чтобы не потерять старые сетки.</span></button>
          <a class="wl-card" href="catalog.html" data-w="catalog"><span class="wl-ico" data-icon="grid"></span><b>Взять готовую</b><span>Сетки игроков из каталога — открой любую и доработай.</span></a>
        </div>
        ${sw('wlTour', 'Показать подсказки по интерфейсу', true)}
      </div>
      <div class="modal-foot"><span class="info">Тур можно повторить: меню у названия → «Подсказки»</span><button class="btn" data-w="skip">Пропустить</button></div>`, { cls: 'welcome-modal' });
    applyIcons(m.root);
    m.root.querySelector('.modal').addEventListener('click', e => {
      const w = e.target.closest('[data-w]')?.dataset.w; if (!w) return;
      store('gp2.welcome', 1);
      const tour = $('#wlTour')?.checked && w !== 'skip';
      if (w === 'catalog') return; // ссылка уходит сама
      m.close();
      setTimeout(() => {
        if (w === 'image') openImageModal();
        else if (w === 'json') openJson();
        else if (w === 'draw') setTool('pencil');
        if (tour) whenIdle(startTour);
      }, 180);
    });
  }

  // ======================= профиль: «Мои работы» =======================
  const enabled = !!ACC?.enabled;
  // текущий холст привязан к работе в профиле этого пользователя: { id, user }
  const proj = () => { const p = load('gp2.project', null); return p && ACC?.user() && p.user === ACC.user().id ? p : null; };
  const setProj = p => { store('gp2.project', p); renderAccountMenu(); setCloud(p ? 'в профиле' : ''); };
  let cloudTimer = 0, saving = false, dirtyAgain = false;
  function setCloud(text, cls = '') {
    const el = $('#cloudState'); if (!el) return;
    el.textContent = text ? ' · ' + text : ''; el.className = cls;
  }
  const r2 = v => Math.round(v * 100) / 100;
  function snapshotData() {
    return {
      v: 1,
      settings: { configName: S.configName, areaW: S.areaW, areaH: S.areaH, cellW: S.cellW, cellH: S.cellH },
      els: st.els.map(e => e.t === 'hero' ? { ...e, x: r2(e.x), y: r2(e.y), w: r2(e.w), h: r2(e.h) } : { ...e, x: r2(e.x), y: r2(e.y) }),
    };
  }
  async function cloudSave({ asNew = false, quiet = false } = {}) {
    if (!enabled) return;
    if (!ACC.signedIn()) { toast('Войди в профиль, чтобы сохранять работы', 'err'); location.href = 'profile.html?next=editor.html'; return; }
    if (!st.els.length) { if (!quiet) toast('Холст пустой — сохранять нечего', 'err'); return; }
    if (saving) { dirtyAgain = true; return; }
    saving = true; clearTimeout(cloudTimer); cloudTimer = 0;
    setCloud('сохраняю в профиль…', 'saving');
    try {
      const cats = st.els.map(elToCategory);
      let thumb = '';
      try { thumb = GridRender.thumb(cats, { font: fontFamily(), width: 480 }); } catch {}
      const cur = asNew ? null : proj();
      const r = await ACC.projects.save({ id: cur?.id, title: (S.configName || 'Моя сетка').trim().slice(0, 60) || 'Моя сетка', data: snapshotData(), thumb, cats: cats.length });
      setProj({ id: r.id, user: ACC.user().id });
      setCloud('в профиле · сохранено');
      if (!quiet) toast(cur ? 'Сохранено в «Мои работы»' : 'Работа сохранена в профиль — дальше она будет сохраняться сама', 'ok');
    } catch (e) {
      setCloud('не сохранено в профиль', 'err');
      // работу удалили из профиля — следующее сохранение создаст новую
      if (/не найдена/.test(e.message)) store('gp2.project', null);
      if (!quiet) toast(e.message, 'err');
    } finally {
      saving = false;
      if (dirtyAgain) { dirtyAgain = false; cloudDirty(); }
    }
  }
  // автосохранение: через 5 секунд после последней правки, если холст привязан к работе
  function cloudDirty() {
    if (!enabled || !proj() || !ACC.signedIn()) return;
    clearTimeout(cloudTimer);
    setCloud('в профиле · изменено');
    cloudTimer = setTimeout(() => { cloudTimer = 0; cloudSave({ quiet: true }); }, 5000);
  }
  // уходят со страницы, не дождавшись автосохранения, — пробуем успеть (копия холста всё равно есть в браузере)
  addEventListener('pagehide', () => { if (cloudTimer && proj()) cloudSave({ quiet: true }); });

  async function openProject(id) {
    if (!enabled) return;
    await ACC.ready();
    if (!ACC.signedIn()) { toast('Войди в профиль, чтобы открыть свою работу', 'err'); location.href = 'profile.html?next=' + encodeURIComponent('editor.html?project=' + id); return; }
    try {
      setCloud('открываю работу…', 'saving');
      const p = await ACC.projects.get(id), d = p.data || {};
      if (st.els.length) snapshot(); // прежний холст — по Ctrl+Z
      st.els = Array.isArray(d.els) ? d.els : []; st.sel.clear();
      Object.assign(S, d.settings || {}, { configName: d.settings?.configName || p.title });
      $('#configName').value = S.configName;
      reindex(); lastCount = st.els.length;
      setProj({ id: p.id, user: ACC.user().id });
      prevChanged(true); fitView();
      setCloud('в профиле · сохранено');
      toast(`Открыта «${p.title}» из твоих работ`, 'ok');
    } catch (e) { setCloud(''); toast(e.message, 'err'); }
  }

  // пункт «Профиль» в меню у названия
  function renderAccountMenu() {
    const box = $('#menuAccount'); if (!box) return;
    if (!enabled) { box.innerHTML = ''; return; }
    const p = ACC.profile(), u = ACC.user(), linked = proj();
    box.innerHTML = u
      ? `<div class="menu-sec">Профиль · ${esc(p?.nick || u.email || '')}</div>
        <button data-acc="save" data-icon="cloud"><span>${linked ? 'Сохранить сейчас' : 'Сохранить в мои работы'}<small>${linked ? 'работа сохраняется сама после правок' : 'приватно, видишь только ты'}</small></span><kbd>Ctrl ⇧ S</kbd></button>
        ${linked ? '<button data-acc="copy" data-icon="dup"><span>Сохранить как новую<small>отдельная работа в профиле</small></span></button>' : ''}
        <a href="profile.html" data-icon="user"><span>Мои работы<small>все сохранённые и опубликованные</small></span></a>`
      : `<div class="menu-sec">Профиль</div>
        <a href="profile.html?next=editor.html" data-icon="user"><span>Войти<small>хранить работы в профиле, с любого устройства</small></span></a>`;
    applyIcons(box);
  }
  $('#menuAccount')?.addEventListener('click', e => {
    const a = e.target.closest('[data-acc]')?.dataset.acc; if (!a) return;
    closeMenus();
    cloudSave({ asNew: a === 'copy' });
  });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyS' && enabled) { e.preventDefault(); e.stopPropagation(); cloudSave(); }
  }, true);

  // публикация: ник из профиля, а опубликованная сетка помечается у работы
  if (enabled) {
    const origAuthor = CatalogAPI.author, origPublish = CatalogAPI.publish;
    CatalogAPI.author = () => (ACC.signedIn() && ACC.profile()?.nick) || origAuthor();
    CatalogAPI.publish = async (...args) => {
      const id = await origPublish(...args);
      const p = proj();
      if (p) ACC.projects.save({ id: p.id, grid_id: id }).catch(() => {});
      return id;
    };
    ACC.onChange(renderAccountMenu);
  }

  // палитра команд (Ctrl K): подсказки, гайды, профиль
  const prevCommands = commandList;
  commandList = function () {
    const extra = [
      { g: 'Прочее', icon: 'spark', label: 'Подсказки: тур по редактору', words: 'помощь обучение тур', run: startTour },
      { g: 'Прочее', icon: 'image', label: 'Окно приветствия', words: 'начало старт', run: openWelcome },
      { g: 'Прочее', icon: 'book', label: 'Гайды', words: 'помощь как', run: () => { location.href = 'guides.html'; } },
    ];
    if (enabled) extra.unshift(ACC.signedIn()
      ? { g: 'Файл', icon: 'cloud', label: 'Сохранить в мои работы', key: 'Ctrl Shift S', words: 'профиль облако', run: () => cloudSave() }
      : { g: 'Файл', icon: 'user', label: 'Войти в профиль', words: 'аккаунт логин', run: () => { location.href = 'profile.html?next=editor.html'; } });
    return [...prevCommands(), ...extra];
  };

  // ======================= запуск =======================
  // ?import / ?steam — сразу окно импорта; ?new — чистый холст; ?project=<id> — работа из профиля
  const qs = new URLSearchParams(location.search);
  const has = k => qs.has(k);
  if (has('import') || has('steam') || has('new') || has('project')) history.replaceState(null, '', location.pathname);
  renderAccountMenu();
  if (enabled) ACC.ready().then(() => { renderAccountMenu(); if (proj()) setCloud('в профиле'); });
  if (has('project')) openProject(qs.get('project'));
  else if (has('new')) {
    if (st.els.length) { snapshot(); st.els = []; st.sel.clear(); prevChanged(true); toast('Новая сетка. Ctrl+Z — вернуть прежний холст'); }
    S.configName = 'Моя сетка'; $('#configName').value = S.configName; persist();
    store('gp2.project', null); setCloud('');
  } else if (has('import')) setTimeout(() => openImageModal(), 200);
  else if (has('steam')) setTimeout(() => openSteamModal(), 200);
  // первый визит: приветствие (если холст пустой и пришли не по ссылке на действие)
  const fromLink = has('grid') || has('publish') || has('import') || has('steam') || has('project');
  if (!load('gp2.welcome', 0) && !st.els.length && !fromLink) setTimeout(() => { if (!modalOpen()) openWelcome(); }, 500);
  else if (!seen('tour') && !fromLink) setTimeout(() => { if (!modalOpen() && !st.els.length) hint('tourOffer', '#brandPill', 'Впервые здесь? Покажем, где что, за полминуты.', { action: ['Показать', startTour] }); }, 900);
})();
