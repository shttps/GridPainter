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
  // Фоны Мастерской: адрес воркера Cloudflare с хранилищем R2 (README, раздел «Фоны: Cloudflare R2»),
  // например 'https://gridstudio-bg.<аккаунт>.workers.dev'. Пусто — фоны можно смотреть, но не выкладывать.
  backgrounds: '',
};

// Сайт: версия, автор и ссылки внизу главной. Пустая ссылка — пункт не показывается.
window.SITE = {
  version: '2.2.0',
  author: { nick: 'ahttps', discord: 'ahttps', github: 'shttps', avatar: 'https://avatars.githubusercontent.com/u/184304697?v=4&s=96' },
  repo: 'https://github.com/shttps/GridPainter',
  telegram: 'https://t.me/gridstudio_example',   // ПРИМЕР — замени на свой канал/чат: чат и новости
  support: '',    // поддержать разработку: Boosty, DonationAlerts и т. п.
  ads: '',        // реклама: ссылка для связи; пусто — показываем контакты автора
};
