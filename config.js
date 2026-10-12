// Подключение каталога сеток к Supabase (как настроить — README, раздел «Каталог»).
// publishable (anon) key публичный по задумке Supabase: права режутся политиками и функциями из supabase/schema.sql.
// Если поля пустые, каталог работает в демо-режиме: сетки хранятся только в этом браузере.
window.GRID_CATALOG = {
  url: 'https://trhyeldibroskzupzhjm.supabase.co',
  key: 'sb_publishable_FYYG4_07-LRg7UqpQeSg_A_TLsx1t25',   // Project Settings → API Keys → publishable (НЕ secret!)
  // Аккаунты («Войти», «Мои работы», публикация от своего имени). Включай после настройки
  // Supabase по README, раздел «Аккаунты»: SQL из supabase/schema.sql и адреса сайта в Auth → URL Configuration.
  accounts: true,
  // Вход через Discord / GitHub — только если провайдер включён в Supabase → Authentication → Providers.
  // Вход по ссылке на почту работает всегда.
  providers: { discord: false, github: false },
};

// Сайт: версия, автор и ссылки внизу главной. Пустая ссылка — пункт не показывается.
window.SITE = {
  version: '2.9.0',
  author: { nick: 'ahttps', discord: 'ahttps', github: 'shttps', avatar: 'https://avatars.githubusercontent.com/u/184304697?v=4&s=96' },
  repo: 'https://github.com/shttps/GridPainter',
  // Конкурс недели в «Угадайке»: приз победителю. Пусто — в таблице написано «приз скоро объявим».
  contest: { prize: '' },
  telegram: 'https://t.me/gridstudio_example',   // ПРИМЕР — замени на свой канал/чат: чат и новости
  support: '',    // поддержать разработку рублями: Boosty, DonationAlerts и т. п.
  // Криптовалюта в окне «Поддержать разработку». Пустой addr — монета не показывается; пока адресов нет, там написано «скоро».
  // Вставь СВОИ адреса и проверь каждый (лучше тестовым переводом): отправленное на неверный адрес не вернуть.
  // network — сеть, которую увидит донатер; memo — тег/комментарий, если сеть его требует (TON, XRP…).
  crypto: [
    { id: 'btc',  ticker: 'BTC',  name: 'Bitcoin',  network: 'Bitcoin',           color: '#f7931a', addr: '' },
    { id: 'eth',  ticker: 'ETH',  name: 'Ethereum', network: 'Ethereum (ERC-20)', color: '#8c9eff', addr: '' },
    { id: 'usdt', ticker: 'USDT', name: 'Tether',   network: 'TRON (TRC-20)',     color: '#26a17b', addr: '' },
    { id: 'ton',  ticker: 'TON',  name: 'Toncoin',  network: 'TON',               color: '#2aa3f0', addr: '', memo: '' },
    { id: 'sol',  ticker: 'SOL',  name: 'Solana',   network: 'Solana',            color: '#a96bff', addr: '' },
  ],
  ads: '',        // реклама: ссылка для связи; пусто — показываем контакты автора
};
