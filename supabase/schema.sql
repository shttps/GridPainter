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

-- ---------- публикация ----------
create or replace function public.publish_grid(
  p_title text, p_author text, p_description text, p_config jsonb, p_thumb text, p_key uuid
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

  insert into grids (title, author, description, kind, cats, heroes, config, thumb)
  values (v_title, v_author, v_desc, v_kind, v_n, v_ids, jsonb_build_object('config_name', v_title, 'categories', v_cats), p_thumb)
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

-- ---------- удаление своей сетки ----------
create or replace function public.grid_delete(p_id uuid, p_key uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from grids g using grid_owners o where g.id = p_id and o.grid_id = g.id and o.key = p_key;
  return found;
end $$;

revoke all on function public.publish_grid(text, text, text, jsonb, text, uuid), public.grid_like(uuid, uuid),
  public.grid_hit(uuid), public.grid_report(uuid, uuid), public.grid_delete(uuid, uuid), public._client_ip() from public;
grant execute on function public.publish_grid(text, text, text, jsonb, text, uuid), public.grid_like(uuid, uuid),
  public.grid_hit(uuid), public.grid_report(uuid, uuid), public.grid_delete(uuid, uuid) to anon, authenticated;
