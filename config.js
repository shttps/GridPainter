// Подключение каталога сеток к Supabase (как настроить — README, раздел «Каталог»).
// publishable (anon) key публичный по задумке Supabase: права режутся политиками и функциями из supabase/schema.sql.
// Если поля пустые, каталог работает в демо-режиме: сетки хранятся только в этом браузере.
window.GRID_CATALOG = {
  url: 'https://trhyeldibroskzupzhjm.supabase.co',
  key: 'sb_publishable_FYYG4_07-LRg7UqpQeSg_A_TLsx1t25',   // Project Settings → API Keys → publishable (НЕ secret!)
};
