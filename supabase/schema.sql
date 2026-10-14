-- Каталог сеток Dota 2 Grid Studio.
-- Выполни целиком в Supabase → SQL Editor → New query → Run. Повторный запуск безопасен.
--
-- Модель доступа:
--   * читать опубликованные сетки может кто угодно (anon, только select по RLS);
--   * писать напрямую в таблицы нельзя — только через функции ниже (security definer),
--     которые проверяют данные, режут частоту публикаций и чистят JSON сетки;
--   * у каждого браузера свой случайный ключ (p_key): он подписывает лайки/жалобы
--     и позволяет удалить свою сетку. Ключи лежат в закрытых таблицах.
--   * 5 жалоб от разных браузеров прячут сетку (hidden = true). Вернуть — руками в Table Editor.

create extension if not exists pgcrypto;

create table if not exists public.grids (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  title       text not null,
  author      text not null default 'Аноним',
  description text not null default '',
  kind        text not null default 'ascii',        -- ascii | mosaic | mixed
  cats        int  not null default 0,               -- категорий в сетке
  heroes      int  not null default 0,               -- портретов героев
  config      jsonb not null,                        -- { config_name, categories: [...] }
  thumb       text not null,                         -- data:image/webp;base64,… (без портретов)
  likes       int  not null default 0,
  downloads   int  not null default 0,
  reports     int  not null default 0,
  hidden      boolean not null default false
);
create index if not exists grids_new_idx  on public.grids (created_at desc) where not hidden;
create index if not exists grids_top_idx  on public.grids (likes desc, created_at desc) where not hidden;
create index if not exists grids_dl_idx   on public.grids (downloads desc, created_at desc) where not hidden;
-- аккаунт автора (если выкладывал, войдя в профиль); у старых и анонимных сеток — null
alter table public.grids add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists grids_user_idx on public.grids (user_id, created_at desc) where user_id is not null;
-- Мастерская: теги (из списка ниже, до 5) и пометка 18+ — такие сетки показываются размытыми, пока не откроешь
alter table public.grids add column if not exists tags text[] not null default '{}';
alter table public.grids add column if not exists nsfw boolean not null default false;
create index if not exists grids_tags_idx on public.grids using gin (tags);

create table if not exists public.grid_owners (
  grid_id    uuid primary key references public.grids(id) on delete cascade,
  key        uuid not null,
  ip         text,
  created_at timestamptz not null default now()
);
create index if not exists grid_owners_ip_idx on public.grid_owners (ip, created_at desc);

create table if not exists public.grid_likes (
  grid_id uuid references public.grids(id) on delete cascade,
  key     uuid not null,
  primary key (grid_id, key)
);

create table if not exists public.grid_reports (
  grid_id uuid references public.grids(id) on delete cascade,
  key     uuid not null,
  primary key (grid_id, key)
);

-- ---------- доступ ----------
alter table public.grids        enable row level security;
alter table public.grid_owners  enable row level security;
alter table public.grid_likes   enable row level security;
alter table public.grid_reports enable row level security;

drop policy if exists "grids are public" on public.grids;
create policy "grids are public" on public.grids for select to anon, authenticated using (not hidden);

grant select on public.grids to anon, authenticated;
revoke insert, update, delete on public.grids from anon, authenticated;
revoke all on public.grid_owners, public.grid_likes, public.grid_reports from anon, authenticated;

-- IP клиента из заголовков PostgREST (для ограничения частоты публикаций)
create or replace function public._client_ip() returns text
language sql stable as $$
  select nullif(split_part(coalesce(
    (current_setting('request.headers', true)::json ->> 'cf-connecting-ip'),
    (current_setting('request.headers', true)::json ->> 'x-forwarded-for'), ''), ',', 1), '')
$$;

-- теги: только из разрешённого списка, без повторов, не больше 5
create or replace function public._clean_tags(p_tags text[], p_allowed text[]) returns text[]
language sql immutable as $$
  select coalesce(array_agg(t), '{}') from (
    select distinct t from unnest(coalesce(p_tags, '{}')) t where t = any(p_allowed) limit 5) x
$$;

-- ---------- публикация ----------
-- старая версия без тегов (до 2.2) — убираем, чтобы PostgREST не путал две функции с одним именем
drop function if exists public.publish_grid(text, text, text, jsonb, text, uuid);
create or replace function public.publish_grid(
  p_title text, p_author text, p_description text, p_config jsonb, p_thumb text, p_key uuid,
  p_tags text[] default '{}', p_nsfw boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_title  text := btrim(coalesce(p_title, ''));
  v_author text := btrim(coalesce(p_author, ''));
  v_desc   text := btrim(coalesce(p_description, ''));
  v_ip     text := public._client_ip();
  v_cats   jsonb;
  v_n      int;
  v_hero   int;
  v_label  int;
  v_ids    int;
  v_kind   text;
  v_id     uuid;
begin
  if p_key is null then raise exception 'bad_key'; end if;
  if char_length(v_title) not between 1 and 60 then raise exception 'bad_title'; end if;
  if char_length(v_author) > 32 then raise exception 'bad_author'; end if;
  if v_author = '' then v_author := 'Аноним'; end if;
  if char_length(v_desc) > 500 then raise exception 'bad_description'; end if;
  if p_thumb is null or p_thumb !~ '^data:image/(webp|jpeg|png);base64,' or octet_length(p_thumb) > 600000 then raise exception 'bad_thumb'; end if;
  if p_config is null or jsonb_typeof(p_config -> 'categories') <> 'array' then raise exception 'bad_config'; end if;
  if octet_length(p_config::text) > 3000000 then raise exception 'too_big'; end if;
  v_n := jsonb_array_length(p_config -> 'categories');
  if v_n < 1 then raise exception 'bad_config'; end if;
  if v_n > 12000 then raise exception 'too_big'; end if;

  -- не больше 5 публикаций за 10 минут с одного IP и 20 за сутки с одного браузера
  if v_ip is not null and (select count(*) from grid_owners where ip = v_ip and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'rate_limit';
  end if;
  if (select count(*) from grid_owners where key = p_key and created_at > now() - interval '1 day') >= 20 then
    raise exception 'rate_limit';
  end if;

  -- оставляем в категориях только поля, которые понимает Дота
  begin
    select jsonb_agg(jsonb_build_object(
             'category_name', left(coalesce(c ->> 'category_name', ''), 200),
             'x_position',    coalesce((c ->> 'x_position')::float8, 0),
             'y_position',    coalesce((c ->> 'y_position')::float8, 0),
             'width',         coalesce((c ->> 'width')::float8, 0),
             'height',        coalesce((c ->> 'height')::float8, 0),
             'hero_ids',      coalesce((select jsonb_agg((h)::int)
                                        from jsonb_array_elements_text(case when jsonb_typeof(c -> 'hero_ids') = 'array' then c -> 'hero_ids' else '[]'::jsonb end) h), '[]'::jsonb)
           ) order by ord)
      into v_cats
      from jsonb_array_elements(p_config -> 'categories') with ordinality as t(c, ord);
  exception when others then
    raise exception 'bad_config';
  end;

  select count(*) filter (where jsonb_array_length(c -> 'hero_ids') > 0 or ((c ->> 'width')::float8 > 1 and (c ->> 'height')::float8 > 1)),
         coalesce(sum(jsonb_array_length(c -> 'hero_ids')), 0)
    into v_hero, v_ids
    from jsonb_array_elements(v_cats) c;
  v_label := v_n - v_hero;
  v_kind := case
    when v_hero > 0 and v_label > 0 then case when v_hero > 3 and v_label > 3 then 'mixed' when v_hero > v_label then 'mosaic' else 'ascii' end
    when v_hero > 0 then 'mosaic' else 'ascii' end;

  insert into grids (title, author, description, kind, cats, heroes, config, thumb, user_id, tags, nsfw)
  values (v_title, v_author, v_desc, v_kind, v_n, v_ids, jsonb_build_object('config_name', v_title, 'categories', v_cats), p_thumb, auth.uid(),
          public._clean_tags(p_tags, array['Аниме', 'Милота', 'Рамки', 'С упором на героя', 'Мемы', 'Dead inside', 'Надписи', 'Игры']),
          coalesce(p_nsfw, false))
  returning id into v_id;
  insert into grid_owners (grid_id, key, ip) values (v_id, p_key, v_ip);
  return v_id;
end $$;

-- ---------- лайк (повторный вызов снимает) ----------
create or replace function public.grid_like(p_id uuid, p_key uuid) returns json
language plpgsql security definer set search_path = public as $$
declare v_liked boolean; v_likes int;
begin
  if p_key is null or not exists (select 1 from grids where id = p_id and not hidden) then raise exception 'not_found'; end if;
  delete from grid_likes where grid_id = p_id and key = p_key;
  if found then v_liked := false;
  else insert into grid_likes (grid_id, key) values (p_id, p_key); v_liked := true;
  end if;
  update grids set likes = (select count(*) from grid_likes where grid_id = p_id) where id = p_id returning likes into v_likes;
  return json_build_object('likes', v_likes, 'liked', v_liked);
end $$;

-- ---------- скачивание / открытие в редакторе ----------
create or replace function public.grid_hit(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update grids set downloads = downloads + 1 where id = p_id and not hidden;
$$;

-- ---------- жалоба: 5 разных браузеров — сетка скрыта ----------
create or replace function public.grid_report(p_id uuid, p_key uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_key is null then return; end if;
  insert into grid_reports (grid_id, key) values (p_id, p_key) on conflict do nothing;
  if found then
    update grids set reports = reports + 1, hidden = hidden or reports + 1 >= 5 where id = p_id;
  end if;
end $$;

-- ---------- удаление своей сетки (админ — любой, см. раздел «Админы» в конце) ----------
create or replace function public.grid_delete(p_id uuid, p_key uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from grids g where g.id = p_id and (
    (auth.uid() is not null and g.user_id = auth.uid())
    or exists (select 1 from grid_owners o where o.grid_id = g.id and o.key = p_key)
    or public.is_admin());
  return found;
end $$;

revoke all on function public.publish_grid(text, text, text, jsonb, text, uuid, text[], boolean), public.grid_like(uuid, uuid),
  public.grid_hit(uuid), public.grid_report(uuid, uuid), public.grid_delete(uuid, uuid), public._client_ip() from public;
grant execute on function public.publish_grid(text, text, text, jsonb, text, uuid, text[], boolean), public.grid_like(uuid, uuid),
  public.grid_hit(uuid), public.grid_report(uuid, uuid), public.grid_delete(uuid, uuid) to anon, authenticated;

-- =====================================================================
-- Аккаунты: профили и «Мои работы».
-- Вход — Supabase Auth (ссылка на почту, по желанию Discord/GitHub). Профиль создаётся сам
-- при регистрации. Работы приватные: видит и меняет их только владелец (RLS).
-- =====================================================================

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nick       text not null default '',
  avatar     text not null default '',
  created_at timestamptz not null default now(),
  constraint profiles_nick   check (char_length(nick) <= 32),
  constraint profiles_avatar check (char_length(avatar) <= 500 and (avatar = '' or avatar ~ '^https://'))
);

create table if not exists public.projects (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title      text not null default 'Моя сетка',
  data       jsonb not null,                       -- холст редактора: { v, settings, els }
  thumb      text not null default '',             -- превью как в каталоге
  cats       int  not null default 0,
  grid_id    uuid references public.grids(id) on delete set null,   -- опубликованная копия
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_title check (char_length(title) between 1 and 60),
  constraint projects_thumb check (octet_length(thumb) <= 600000),
  constraint projects_size  check (octet_length(data::text) <= 5000000)
);
create index if not exists projects_owner_idx on public.projects (owner, updated_at desc);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;

-- профиль: «о себе», ссылка на Steam; аватар — ссылка (Discord/GitHub/портрет героя) или своя картинка data:image до ~90 КБ
alter table public.profiles add column if not exists bio   text not null default '';
alter table public.profiles add column if not exists steam text not null default '';
alter table public.profiles drop constraint if exists profiles_avatar;
alter table public.profiles add constraint profiles_avatar check (avatar = ''
  or (avatar ~ '^https://' and char_length(avatar) <= 500)
  or (avatar ~ '^data:image/(webp|jpeg|png);base64,' and octet_length(avatar) <= 90000));
alter table public.profiles drop constraint if exists profiles_bio;
alter table public.profiles add constraint profiles_bio check (char_length(bio) <= 200);
alter table public.profiles drop constraint if exists profiles_steam;
alter table public.profiles add constraint profiles_steam check (steam = '' or (steam ~ '^https://(steamcommunity\.com|s\.team)/' and char_length(steam) <= 200));

drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles for select to anon, authenticated using (true);
drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
grant select on public.profiles to anon, authenticated;
grant insert on public.profiles to authenticated;
grant update (nick, avatar, bio, steam) on public.profiles to authenticated;

drop policy if exists "own projects" on public.projects;
create policy "own projects" on public.projects for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
revoke all on public.projects from anon;
grant select, insert, update, delete on public.projects to authenticated;

-- время изменения ставит база; не больше 200 работ на аккаунт
create or replace function public._projects_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and (select count(*) from projects where owner = new.owner) >= 200 then
    raise exception 'too_many_projects';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before insert or update on public.projects for each row execute function public._projects_touch();

-- профиль при регистрации: ник и аватар из Discord/GitHub, иначе «Игрок XXXX» (почту не светим)
create or replace function public._new_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, nick, avatar) values (
    new.id,
    left(coalesce(nullif(m -> 'custom_claims' ->> 'global_name', ''), nullif(m ->> 'full_name', ''), nullif(m ->> 'user_name', ''),
                  nullif(m ->> 'name', ''), 'Игрок ' || upper(substr(replace(new.id::text, '-', ''), 1, 4))), 32),
    case when coalesce(m ->> 'avatar_url', '') ~ '^https://' then left(m ->> 'avatar_url', 500) else '' end)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public._new_profile();
revoke all on function public._new_profile(), public._projects_touch() from public, anon, authenticated;

-- =====================================================================
-- Мастерская: фоны главного меню Dota 2.
-- Файлы лежат в Supabase Storage, в публичном бакете backgrounds: каждый пишет только в свою папку <id аккаунта>/.
-- Публикация (publish_background) проверяет, что файл действительно загружен в эту папку,
-- и берёт его тип и размер из Storage, а не со слов браузера: картинка/GIF до 5 МБ, видео (MP4/WebM) до 15 МБ.
-- Лайки, скачивания и жалобы — как у сеток, по ключу браузера.
-- =====================================================================

-- бакет: публичное чтение, лимит размера и типы файлов проверяет сам Storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('backgrounds', 'backgrounds', true, 15728640,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "backgrounds: upload to own folder" on storage.objects;
create policy "backgrounds: upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "backgrounds: see own files" on storage.objects;
create policy "backgrounds: see own files" on storage.objects for select to authenticated
  using (bucket_id = 'backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "backgrounds: delete own files" on storage.objects;
create policy "backgrounds: delete own files" on storage.objects for delete to authenticated
  using (bucket_id = 'backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);

create table if not exists public.backgrounds (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  author     text not null default '',
  tags       text[] not null default '{}',
  nsfw       boolean not null default false,
  kind       text not null default 'image',     -- image | video
  aspect     text not null default '16:9',      -- 16:9 | 16:10 | 21:9 | 4:3 | other
  width      int  not null default 0,
  height     int  not null default 0,
  duration   real not null default 0,           -- секунды, у картинок 0
  size       int  not null default 0,           -- байты файла
  file       text not null,                     -- путь в бакете: <id аккаунта>/<uuid>.<ext>
  poster     text not null,                     -- <id аккаунта>/<uuid>.poster.webp
  likes      int  not null default 0,
  downloads  int  not null default 0,
  reports    int  not null default 0,
  hidden     boolean not null default false
);
create index if not exists backgrounds_new_idx  on public.backgrounds (created_at desc) where not hidden;
create index if not exists backgrounds_top_idx  on public.backgrounds (likes desc, created_at desc) where not hidden;
create index if not exists backgrounds_user_idx on public.backgrounds (user_id, created_at desc);
create index if not exists backgrounds_tags_idx on public.backgrounds using gin (tags);

create table if not exists public.background_likes (
  bg_id uuid references public.backgrounds(id) on delete cascade,
  key   uuid not null,
  primary key (bg_id, key)
);
create table if not exists public.background_reports (
  bg_id uuid references public.backgrounds(id) on delete cascade,
  key   uuid not null,
  primary key (bg_id, key)
);

alter table public.backgrounds        enable row level security;
alter table public.background_likes   enable row level security;
alter table public.background_reports enable row level security;
drop policy if exists "backgrounds are public" on public.backgrounds;
create policy "backgrounds are public" on public.backgrounds for select to anon, authenticated using (not hidden);
grant select on public.backgrounds to anon, authenticated;
revoke insert, update, delete on public.backgrounds from anon, authenticated;
revoke all on public.background_likes, public.background_reports from anon, authenticated;

-- первые версии этих функций (под воркер Cloudflare) больше не нужны
drop function if exists public.publish_background(uuid, text, text[], boolean, text, text, int, int, real, int, text, text);
drop function if exists public.delete_background(uuid, uuid);

-- публикация: файл и постер уже загружены в свою папку бакета
create or replace function public.publish_background(
  p_title text, p_tags text[], p_nsfw boolean, p_aspect text,
  p_width int, p_height int, p_duration real, p_file text, p_poster text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_dir   text;
  v_mime  text;
  v_size  bigint;
  v_kind  text;
  v_max   bigint;
  v_nick  text;
  v_id    uuid;
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;
  v_dir := v_uid::text || '/';
  if char_length(v_title) not between 1 and 60 then raise exception 'bad_title'; end if;
  if left(coalesce(p_file, ''), char_length(v_dir)) <> v_dir or left(coalesce(p_poster, ''), char_length(v_dir)) <> v_dir then raise exception 'bad_file'; end if;
  select o.metadata ->> 'mimetype', (o.metadata ->> 'size')::bigint into v_mime, v_size
    from storage.objects o where o.bucket_id = 'backgrounds' and o.name = p_file;
  if v_mime is null then raise exception 'bad_file'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'backgrounds' and o.name = p_poster and o.metadata ->> 'mimetype' in ('image/webp', 'image/jpeg')) then
    raise exception 'bad_file';
  end if;
  -- лимит считаем заранее: CASE прямо внутри IF сбивает разбор PL/pgSQL
  v_kind := case when v_mime like 'video/%' then 'video' else 'image' end;
  v_max := case when v_kind = 'video' then 15728640 else 5242880 end;
  if v_size > v_max then raise exception 'too_big'; end if;
  if p_aspect not in ('16:9', '16:10', '21:9', '4:3', 'other') then p_aspect := 'other'; end if;
  -- не больше 10 фонов за сутки с одного аккаунта
  if (select count(*) from backgrounds where user_id = v_uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'rate_limit';
  end if;
  select nullif(nick, '') into v_nick from profiles where id = v_uid;
  insert into backgrounds (user_id, title, author, tags, nsfw, kind, aspect, width, height, duration, size, file, poster)
  values (v_uid, v_title, coalesce(v_nick, 'Игрок'),
          public._clean_tags(p_tags, array['Аниме', 'Dota 2', 'Игры', 'Милота', 'Мемы', 'Dead inside', 'Природа', 'Космос', 'Абстракция']),
          coalesce(p_nsfw, false), v_kind, p_aspect, greatest(coalesce(p_width, 0), 0), greatest(coalesce(p_height, 0), 0),
          greatest(coalesce(p_duration, 0), 0), v_size, p_file, p_poster)
  returning id into v_id;
  return v_id;
end $$;

-- удаление своего фона (админ — любого): запись уходит сразу, файлы браузер стирает из бакета по возвращённым путям
create or replace function public.delete_background(p_id uuid) returns json
language plpgsql security definer set search_path = public as $$
declare v_file text; v_poster text;
begin
  delete from backgrounds where id = p_id and (user_id = auth.uid() or public.is_admin()) returning file, poster into v_file, v_poster;
  if not found then return null; end if;
  return json_build_object('file', v_file, 'poster', v_poster);
end $$;

create or replace function public.bg_like(p_id uuid, p_key uuid) returns json
language plpgsql security definer set search_path = public as $$
declare v_liked boolean; v_likes int;
begin
  if p_key is null or not exists (select 1 from backgrounds where id = p_id and not hidden) then raise exception 'not_found'; end if;
  delete from background_likes where bg_id = p_id and key = p_key;
  if found then v_liked := false;
  else insert into background_likes (bg_id, key) values (p_id, p_key); v_liked := true;
  end if;
  update backgrounds set likes = (select count(*) from background_likes where bg_id = p_id) where id = p_id returning likes into v_likes;
  return json_build_object('likes', v_likes, 'liked', v_liked);
end $$;

create or replace function public.bg_hit(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update backgrounds set downloads = downloads + 1 where id = p_id and not hidden;
$$;

create or replace function public.bg_report(p_id uuid, p_key uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_key is null then return; end if;
  insert into background_reports (bg_id, key) values (p_id, p_key) on conflict do nothing;
  if found then
    update backgrounds set reports = reports + 1, hidden = hidden or reports + 1 >= 5 where id = p_id;
  end if;
end $$;

revoke all on function public.publish_background(text, text[], boolean, text, int, int, real, text, text),
  public.delete_background(uuid), public.bg_like(uuid, uuid), public.bg_hit(uuid), public.bg_report(uuid, uuid),
  public._clean_tags(text[], text[]) from public, anon, authenticated;
grant execute on function public.publish_background(text, text[], boolean, text, int, int, real, text, text),
  public.delete_background(uuid) to authenticated;
grant execute on function public.bg_like(uuid, uuid), public.bg_hit(uuid), public.bg_report(uuid, uuid) to anon, authenticated;

-- =====================================================================
-- Админы: видят скрытое жалобами, возвращают и прячут сетки и фоны, удаляют чужие.
-- С сайта стать админом нельзя — список правится только здесь, в SQL Editor:
--   insert into public.admins (user_id) select id from auth.users where email = 'почта@пример.ru' on conflict do nothing;
-- Аккаунт с этой почтой должен хоть раз войти на сайт, иначе его ещё нет в auth.users.
-- Снять админа: delete from public.admins where user_id = (select id from auth.users where email = 'почта@пример.ru');
-- =====================================================================

create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- кто админ — видно всем (значок в профиле), менять нельзя никому, кроме SQL Editor
drop policy if exists "admins are public" on public.admins;
create policy "admins are public" on public.admins for select to anon, authenticated using (true);
grant select on public.admins to anon, authenticated;
revoke insert, update, delete on public.admins from anon, authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- админ видит и скрытое (обычные списки на сайте сами просят hidden = false);
-- (select …) — чтобы проверка шла один раз на запрос, а не на каждую строку
drop policy if exists "admins see hidden grids" on public.grids;
create policy "admins see hidden grids" on public.grids for select to authenticated using ((select public.is_admin()));
drop policy if exists "admins see hidden backgrounds" on public.backgrounds;
create policy "admins see hidden backgrounds" on public.backgrounds for select to authenticated using ((select public.is_admin()));

-- файлы чужих фонов: админ стирает их после delete_background
drop policy if exists "backgrounds: admins see all files" on storage.objects;
create policy "backgrounds: admins see all files" on storage.objects for select to authenticated
  using (bucket_id = 'backgrounds' and (select public.is_admin()));
drop policy if exists "backgrounds: admins delete any file" on storage.objects;
create policy "backgrounds: admins delete any file" on storage.objects for delete to authenticated
  using (bucket_id = 'backgrounds' and (select public.is_admin()));

-- скрыть или вернуть: p_kind — 'grid' | 'bg'; возврат обнуляет счётчик жалоб
-- (кто уже жаловался, второй раз не сможет — новые жалобы считаются с нуля)
create or replace function public.admin_moderate(p_kind text, p_id uuid, p_hidden boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_kind = 'grid' then
    update grids set hidden = p_hidden, reports = case when p_hidden then reports else 0 end where id = p_id;
  elsif p_kind = 'bg' then
    update backgrounds set hidden = p_hidden, reports = case when p_hidden then reports else 0 end where id = p_id;
  else
    raise exception 'bad_kind';
  end if;
  return found;
end $$;
revoke all on function public.admin_moderate(text, uuid, boolean) from public, anon;
grant execute on function public.admin_moderate(text, uuid, boolean) to authenticated;

-- =====================================================================
-- Профили: баннер и GIF-аватарки.
-- Файлы лежат в публичном бакете profiles: у каждого своя папка <id аккаунта>/ и не больше 6 файлов в ней
-- (старые сайт стирает сам после каждой смены). Обычные картинки сайт сам кадрирует и пережимает в WebP,
-- GIF кладёт как есть: аватар — до 2 МБ (проверяет сайт), баннер — до 5 МБ (лимит бакета).
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profiles', 'profiles', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- сколько файлов уже в папке аккаунта (security definer — считаем мимо RLS самого storage.objects)
create or replace function public._profile_files(p_uid uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from storage.objects where bucket_id = 'profiles' and name like p_uid::text || '/%'
$$;
revoke all on function public._profile_files(uuid) from public, anon;
grant execute on function public._profile_files(uuid) to authenticated;

drop policy if exists "profiles: upload to own folder" on storage.objects;
create policy "profiles: upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'profiles' and (storage.foldername(name))[1] = auth.uid()::text and public._profile_files(auth.uid()) < 6);
drop policy if exists "profiles: see own files" on storage.objects;
create policy "profiles: see own files" on storage.objects for select to authenticated
  using (bucket_id = 'profiles' and ((storage.foldername(name))[1] = auth.uid()::text or (select public.is_admin())));
drop policy if exists "profiles: delete own files" on storage.objects;
create policy "profiles: delete own files" on storage.objects for delete to authenticated
  using (bucket_id = 'profiles' and ((storage.foldername(name))[1] = auth.uid()::text or (select public.is_admin())));

-- баннер — только файл из этого бакета
alter table public.profiles add column if not exists banner text not null default '';
alter table public.profiles drop constraint if exists profiles_banner;
alter table public.profiles add constraint profiles_banner check (banner = ''
  or (banner ~ '^https://[^/]+/storage/v1/object/public/profiles/' and char_length(banner) <= 500));
grant update (nick, avatar, bio, steam, banner) on public.profiles to authenticated;

-- админ убирает чужой аватар или баннер; возвращает старую ссылку, чтобы сайт стёр файл из бакета
create or replace function public.admin_clear_media(p_user uuid, p_what text) returns text
language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_what = 'avatar' then
    select avatar into v_old from profiles where id = p_user;
    update profiles set avatar = '' where id = p_user;
  elsif p_what = 'banner' then
    select banner into v_old from profiles where id = p_user;
    update profiles set banner = '' where id = p_user;
  else
    raise exception 'bad_kind';
  end if;
  return coalesce(v_old, '');
end $$;
revoke all on function public.admin_clear_media(uuid, text) from public, anon;
grant execute on function public.admin_clear_media(uuid, text) to authenticated;

-- =====================================================================
-- Профили: Telegram (2.5). Храним только ник без @ — ссылку https://t.me/<ник> собирает сайт.
-- =====================================================================
alter table public.profiles add column if not exists tg text not null default '';
alter table public.profiles drop constraint if exists profiles_tg;
alter table public.profiles add constraint profiles_tg check (tg = '' or tg ~ '^[A-Za-z][A-Za-z0-9_]{3,31}$');
grant update (nick, avatar, bio, steam, banner, tg) on public.profiles to authenticated;

-- =====================================================================
-- Фоны на главной (2.6): админ отмечает фон «На главную», и он идёт фоном первого экрана сайта.
-- Сайт берёт случайный из отмеченных; 18+ и скрытые на главную не попадают.
-- =====================================================================
alter table public.backgrounds add column if not exists featured boolean not null default false;
create index if not exists backgrounds_featured_idx on public.backgrounds (created_at desc) where featured and not hidden;

create or replace function public.admin_feature(p_id uuid, p_on boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update backgrounds set featured = coalesce(p_on, false) where id = p_id;
  return found;
end $$;
revoke all on function public.admin_feature(uuid, boolean) from public, anon;
grant execute on function public.admin_feature(uuid, boolean) to authenticated;


-- ---------- Угадайка: результаты «Героя дня» и конкурс недели ----------
-- Один результат на игрока в день (первый засчитывается). Очки: угадал с 1-й попытки — 6, со 2-й — 5 … с 6-й — 1, не угадал — 0.
-- Неделя — с понедельника по воскресенье (UTC). Победитель — больше очков, потом больше побед, потом тот, кто набрал их раньше.
-- Номер дня считается от 2026-10-09 (как GAME_START в site.js). Ответ «героя дня» знает только клиент, поэтому приз стоит выдавать, глядя на таблицу глазами.
create table if not exists public.game_results (
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        int  not null,
  tries      int  not null,
  won        boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day),
  constraint game_results_tries check (tries between 1 and 6)
);
alter table public.game_results enable row level security;
revoke all on public.game_results from anon, authenticated;

create or replace function public.game_submit(p_day int, p_tries int, p_won boolean) returns json
language plpgsql security definer set search_path = public as $$
declare v_today int := ((now() at time zone 'utc')::date - date '2026-10-09') + 1;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_day is null or p_day not between v_today - 1 and v_today + 1 then raise exception 'game_day'; end if;
  if p_tries is null or p_tries not between 1 and 6 then raise exception 'game_tries'; end if;
  insert into game_results (user_id, day, tries, won) values (auth.uid(), p_day, p_tries, coalesce(p_won, false))
    on conflict (user_id, day) do nothing;
  return json_build_object('saved', found);
end $$;
revoke all on function public.game_submit(int, int, boolean) from public, anon;
grant execute on function public.game_submit(int, int, boolean) to authenticated;

-- таблица недели: p_back = 0 — текущая, 1 — прошлая и т. д.
create or replace function public.game_board(p_back int default 0) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  v_from date := date_trunc('week', (now() at time zone 'utc')::date)::date - 7 * greatest(0, least(coalesce(p_back, 0), 52));
  v_d0 int := (v_from - date '2026-10-09') + 1;
begin
  return json_build_object('from', v_from, 'to', v_from + 6, 'rows', coalesce((
    select json_agg(t order by t.place) from (
      select row_number() over (order by sum(case when g.won then 7 - g.tries else 0 end) desc, count(*) filter (where g.won) desc, max(g.created_at)) as place,
             g.user_id as id, p.nick, p.avatar,
             sum(case when g.won then 7 - g.tries else 0 end)::int as points,
             (count(*) filter (where g.won))::int as wins, count(*)::int as played
        from game_results g join profiles p on p.id = g.user_id
       where g.day between v_d0 and v_d0 + 6
       group by g.user_id, p.nick, p.avatar
       order by 1 limit 50) t), '[]'::json));
end $$;
grant execute on function public.game_board(int) to anon, authenticated;


-- ---------- Мини-игры: лучший результат каждого игрока («Взлом замка», «Сапёр Сплин») ----------
-- Хранится только рекорд: новый результат записывается, если он больше прежнего.
-- Игры идут в браузере, поэтому потолок очков отсекает только явную подделку; призы по этой таблице не выдаём.
create table if not exists public.arcade_scores (
  user_id    uuid not null references auth.users(id) on delete cascade,
  game       text not null,
  score      int  not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, game),
  constraint arcade_scores_game check (game in ('lockpick', 'sweeper')),
  constraint arcade_scores_score check (score between 0 and 1000000)
);
alter table public.arcade_scores enable row level security;
revoke all on public.arcade_scores from anon, authenticated;

create or replace function public.arcade_submit(p_game text, p_score int) returns json
language plpgsql security definer set search_path = public as $$
declare v_cap int := case p_game when 'lockpick' then 400000 when 'sweeper' then 60000 end;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if v_cap is null then raise exception 'arcade_game'; end if;
  if p_score is null or p_score < 0 or p_score > v_cap then raise exception 'arcade_score'; end if;
  insert into arcade_scores (user_id, game, score) values (auth.uid(), p_game, p_score)
    on conflict (user_id, game) do update set score = excluded.score, updated_at = now()
    where arcade_scores.score < excluded.score;
  return json_build_object('saved', found);
end $$;
revoke all on function public.arcade_submit(text, int) from public, anon;
grant execute on function public.arcade_submit(text, int) to authenticated;

-- таблица рекордов игры: топ-50, при равенстве выше тот, кто набрал раньше
create or replace function public.arcade_board(p_game text) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(t order by t.place), '[]'::json) from (
    select row_number() over (order by a.score desc, a.updated_at) as place,
           a.user_id as id, p.nick, p.avatar, a.score
      from arcade_scores a join profiles p on p.id = a.user_id
     where a.game = p_game and a.score > 0
     order by a.score desc, a.updated_at limit 50) t;
$$;
grant execute on function public.arcade_board(text) to anon, authenticated;


-- ---------- Огонёк: сколько дней подряд игрок заходит на сайт ----------
-- День — по часам игрока (сайт присылает свою дату; разница с UTC больше суток — берём UTC).
-- Зашёл на следующий день — серия +1, пропустил день — серия заново с 1. best — рекорд, days — всего дней с заходами.
create table if not exists public.visit_streaks (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  last_day date not null,
  streak   int  not null default 1,
  best     int  not null default 1,
  days     int  not null default 1
);
alter table public.visit_streaks enable row level security;
revoke all on public.visit_streaks from anon, authenticated;

create or replace function public.visit_ping(p_day date) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_utc date := (now() at time zone 'utc')::date;
  v_day date := case when p_day between v_utc - 1 and v_utc + 1 then p_day else v_utc end;
  r visit_streaks;
  v_prev int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into r from visit_streaks where user_id = auth.uid() for update;
  if not found then
    insert into visit_streaks (user_id, last_day) values (auth.uid(), v_day) returning * into r;
    return json_build_object('streak', 1, 'best', 1, 'days', 1, 'prev', 0);
  end if;
  v_prev := r.streak;
  if v_day > r.last_day then
    update visit_streaks set
      streak = case when v_day = r.last_day + 1 then r.streak + 1 else 1 end,
      best = greatest(best, case when v_day = r.last_day + 1 then r.streak + 1 else 1 end),
      days = days + 1, last_day = v_day
      where user_id = auth.uid() returning * into r;
  end if;
  return json_build_object('streak', r.streak, 'best', r.best, 'days', r.days, 'prev', v_prev);
end $$;
revoke all on function public.visit_ping(date) from public, anon;
grant execute on function public.visit_ping(date) to authenticated;

-- ---------- Достижения: игровые цифры профиля и рекорд огонька ----------
-- Остальные достижения сайт считает сам по публичным данным (работы, лайки, скачивания, профиль).
-- Здесь — только то, что спрятано в закрытых таблицах игр; рекорды и так видны в таблицах, поэтому функция открыта всем.
create or replace function public.profile_feats(p_uid uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'played', (select count(*) from game_results where user_id = p_uid),
    'wins',   (select count(*) from game_results where user_id = p_uid and won),
    'aces',   (select count(*) from game_results where user_id = p_uid and won and tries = 1),
    'lockpick', coalesce((select score from arcade_scores where user_id = p_uid and game = 'lockpick'), 0),
    'sweeper',  coalesce((select score from arcade_scores where user_id = p_uid and game = 'sweeper'), 0),
    'streak',   coalesce((select best from visit_streaks where user_id = p_uid), 0));
$$;
grant execute on function public.profile_feats(uuid) to anon, authenticated;

-- ---------- Буст огонька: сетки игрока с серией от 3 дней выше в «Популярных» ----------
-- Лайки остаются настоящими; в сортировке к выбранным сеткам добавляются «виртуальные»: 3–6 дней подряд +3, 7–29 дней +8, 30+ дней +20.
-- Буст живёт, пока огонёк горит (заходил сегодня или вчера); пропустил день — сетки возвращаются на своё место.
-- Колонку score читает только сортировка в Мастерской (catalog-api.js); скрытое жалобами клиент отсеивает сам (hidden = false).
create or replace function public.streak_boost(p_streak int, p_last date) returns int
language sql stable as $$
  select case when p_last < (now() at time zone 'utc')::date - 1 then 0
              when p_streak >= 30 then 20 when p_streak >= 7 then 8 when p_streak >= 3 then 3 else 0 end
$$;

-- Буст получают не все сетки игрока, а только выбранные им (boosted_at): с 3 дней подряд — 2 сетки, с 7 дней — 3.
-- Серия упала и мест стало меньше — бустятся те, что выбраны раньше; остальные ждут, пока места снова появятся.
alter table public.grids add column if not exists boosted_at timestamptz;
create or replace function public.boost_slots(p_streak int, p_last date) returns int
language sql stable as $$
  select case when p_last < (now() at time zone 'utc')::date - 1 then 0
              when p_streak >= 7 then 3 when p_streak >= 3 then 2 else 0 end
$$;

create or replace view public.grids_ranked as
  with picked as (
    select id, row_number() over (partition by user_id order by boosted_at) as n
      from public.grids where boosted_at is not null and user_id is not null and not hidden)
  select g.id, g.title, g.author, g.description, g.kind, g.cats, g.heroes, g.likes, g.downloads, g.created_at,
         g.user_id, g.tags, g.nsfw, g.hidden,
         g.likes + case when p.n <= public.boost_slots(v.streak, v.last_day)
                        then coalesce(public.streak_boost(v.streak, v.last_day), 0) else 0 end as score
    from public.grids g
    left join public.visit_streaks v on v.user_id = g.user_id
    left join picked p on p.id = g.id;
grant select on public.grids_ranked to anon, authenticated;

-- выбрать (p_on) или снять сетку с буста; только свою и только пока есть свободное место
create or replace function public.set_boost(p_id uuid, p_on boolean) returns int
language plpgsql security definer set search_path = public as $$
declare v_slots int; v_used int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from grids where id = p_id and user_id = auth.uid()) then raise exception 'not_your_grid'; end if;
  if not p_on then
    update grids set boosted_at = null where id = p_id;
  else
    select coalesce((select boost_slots(streak, last_day) from visit_streaks where user_id = auth.uid()), 0) into v_slots;
    if v_slots = 0 then raise exception 'no_streak'; end if;
    select count(*) into v_used from grids where user_id = auth.uid() and boosted_at is not null and not hidden and id <> p_id;
    if v_used >= v_slots then raise exception 'boost_full'; end if;
    update grids set boosted_at = coalesce(boosted_at, now()) where id = p_id;
  end if;
  return v_slots;
end $$;
revoke all on function public.set_boost(uuid, boolean) from public, anon;
grant execute on function public.set_boost(uuid, boolean) to authenticated;

-- сколько буста у игрока сейчас — для окна огонька
create or replace function public.my_boost() returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select public.streak_boost(streak, last_day) from visit_streaks where user_id = auth.uid()), 0)
$$;
revoke all on function public.my_boost() from public, anon;
grant execute on function public.my_boost() to authenticated;
