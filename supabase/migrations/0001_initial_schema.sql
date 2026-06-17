-- Mi Álbum de Figuritas — schema inicial
--
-- Reglas que ordenan este schema:
--   1. Toda mutación crítica pasa por RPC SECURITY DEFINER o Edge Function.
--      El cliente solo lee; no hay policies de INSERT/UPDATE/DELETE.
--   2. Álbum 'published' es inmutable en su contenido (name, covers, total_stickers,
--      stickers). Solo la economía (pack_config, trade_config, qr_secret) y el flag
--      is_public siguen siendo mutables. Validado en cada Edge Function.
--   3. user_collection nunca guarda quantity=0; ausencia de fila = no tengo.

create extension if not exists pgcrypto;

-- ============================================================================
-- ENUMS
-- ============================================================================

create type album_status as enum ('draft', 'published', 'read_only', 'archived');
create type sticker_rarity as enum ('common', 'rare', 'epic', 'legendary');
create type pack_source as enum ('welcome', 'daily', 'qr', 'admin');
create type trade_status as enum ('pending', 'accepted', 'rejected', 'cancelled', 'expired');
create type subscription_status as enum ('active', 'in_grace', 'expired', 'cancelled');
create type subscription_plan as enum ('monthly', 'annual');
create type subscription_store as enum ('app_store', 'play_store');

-- ============================================================================
-- TABLAS
-- ============================================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  is_admin boolean not null default false,
  push_token text,
  created_at timestamptz not null default now()
);

create table albums (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete restrict,
  name text not null,
  cover_thumb_url text,
  cover_large_url text,
  pack_thumb_url text,
  pack_large_url text,
  total_stickers integer not null check (total_stickers between 1 and 1000),
  status album_status not null default 'draft',
  is_public boolean not null default false,
  share_code text not null unique,
  pack_config jsonb not null default jsonb_build_object(
    'daily',   jsonb_build_object('enabled', true,  'count', 1, 'cooldown_hours', 24),
    'qr',      jsonb_build_object('enabled', false, 'count', 3, 'cooldown_hours', 24),
    'welcome', jsonb_build_object('enabled', true,  'count', 1)
  ),
  -- trade_config.limit: null = sin tope, o { count: int, period: 'day'|'week'|'month' }
  trade_config jsonb not null default jsonb_build_object(
    'enabled', true,
    'limit', null
  ),
  qr_secret text,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table stickers (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references albums(id) on delete cascade,
  number integer not null check (number > 0),
  name text not null,
  rarity sticker_rarity not null default 'common',
  thumb_url text not null,
  large_url text not null,
  -- traits libre: section, hábitat, clase, copy del detalle, etc.
  traits jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (album_id, number)
);

create table user_album_membership (
  user_id uuid not null references profiles(id) on delete cascade,
  album_id uuid not null references albums(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_daily_claim_at timestamptz,
  last_qr_redeem_at timestamptz,
  welcome_granted boolean not null default false,
  primary key (user_id, album_id)
);

create table user_collection (
  user_id uuid not null references profiles(id) on delete cascade,
  sticker_id uuid not null references stickers(id) on delete cascade,
  pasted boolean not null default false,
  quantity integer not null check (quantity > 0),
  first_obtained_at timestamptz not null default now(),
  last_obtained_at timestamptz not null default now(),
  primary key (user_id, sticker_id)
);

create table packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  album_id uuid not null references albums(id) on delete cascade,
  source pack_source not null,
  granted_at timestamptz not null default now(),
  opened_at timestamptz,
  -- snapshot del contenido (array de sticker_ids) al abrir; auditoría + permite revisitar
  contents jsonb
);

create table trade_offers (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references albums(id) on delete cascade,
  from_user uuid not null references profiles(id) on delete cascade,
  to_user uuid not null references profiles(id) on delete cascade,
  offered_sticker_id uuid not null references stickers(id) on delete cascade,
  requested_sticker_id uuid not null references stickers(id) on delete cascade,
  status trade_status not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  resolved_at timestamptz,
  check (from_user <> to_user),
  check (offered_sticker_id <> requested_sticker_id)
);

create table subscriptions (
  user_id uuid primary key references profiles(id) on delete cascade,
  plan subscription_plan not null,
  status subscription_status not null,
  provider text not null default 'revenuecat',
  entitlement_id text not null,
  store subscription_store not null,
  original_transaction_id text not null unique,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- ÍNDICES
-- ============================================================================

create index idx_albums_owner on albums(owner_id);
create index idx_albums_public on albums(is_public, status)
  where is_public = true and status = 'published';

create index idx_stickers_album on stickers(album_id);

create index idx_collection_user on user_collection(user_id);
create index idx_collection_sticker on user_collection(sticker_id);

-- contar sobres sin abrir es la query más caliente de la app
create index idx_packs_unopened on packs(user_id, album_id) where opened_at is null;

create index idx_offers_to_pending on trade_offers(to_user, created_at desc)
  where status = 'pending';
create index idx_offers_from on trade_offers(from_user, created_at desc);
-- usado por el chequeo de rate limit de trades aceptados
create index idx_offers_accepted_window on trade_offers(album_id, from_user, to_user, resolved_at)
  where status = 'accepted';

create index idx_subs_active on subscriptions(user_id)
  where status in ('active', 'in_grace');

-- ============================================================================
-- VIEW DE INVENTARIO (base del matchmaking)
-- ============================================================================

-- security_invoker = true → respeta la RLS de las tablas subyacentes; cada user
-- solo ve su propio inventario al consultar directo. El matchmaking entre users
-- pasa por fn_album_matches (migración 0002) con un cross-join controlado.
create view v_user_album_inventory with (security_invoker = true) as
select
  uam.user_id,
  uam.album_id,
  s.id as sticker_id,
  s.number as sticker_number,
  s.rarity,
  coalesce(uc.quantity, 0) as quantity,
  coalesce(uc.pasted, false) as pasted,
  greatest(
    coalesce(uc.quantity, 0) - case when coalesce(uc.pasted, false) then 1 else 0 end,
    0
  ) as tradable_stock,
  (uc.user_id is null) as missing
from user_album_membership uam
join stickers s on s.album_id = uam.album_id
left join user_collection uc
  on uc.user_id = uam.user_id and uc.sticker_id = s.id;

-- ============================================================================
-- RLS
-- ============================================================================

alter table profiles enable row level security;
alter table albums enable row level security;
alter table stickers enable row level security;
alter table user_album_membership enable row level security;
alter table user_collection enable row level security;
alter table packs enable row level security;
alter table trade_offers enable row level security;
alter table subscriptions enable row level security;

-- profiles: display_name y avatar son públicos (los usan trade_offers, owner del álbum, etc.)
create policy profiles_select on profiles for select using (true);
create policy profiles_update_own on profiles for update using (id = auth.uid());

-- albums: visible si público publicado, owner, o miembro
create policy albums_select on albums for select using (
  (is_public = true and status = 'published')
  or owner_id = auth.uid()
  or exists (
    select 1 from user_album_membership uam
    where uam.album_id = albums.id and uam.user_id = auth.uid()
  )
);

-- stickers: visible si tenés acceso al álbum
create policy stickers_select on stickers for select using (
  exists (
    select 1 from albums a where a.id = stickers.album_id and (
      (a.is_public = true and a.status = 'published')
      or a.owner_id = auth.uid()
      or exists (
        select 1 from user_album_membership uam
        where uam.album_id = a.id and uam.user_id = auth.uid()
      )
    )
  )
);

create policy membership_select_own on user_album_membership for select
  using (user_id = auth.uid());
create policy collection_select_own on user_collection for select
  using (user_id = auth.uid());
create policy packs_select_own on packs for select
  using (user_id = auth.uid());
create policy offers_select_own on trade_offers for select
  using (from_user = auth.uid() or to_user = auth.uid());
create policy subs_select_own on subscriptions for select
  using (user_id = auth.uid());

-- NOTA: a propósito no hay policies de INSERT/UPDATE/DELETE en ninguna tabla.
-- Toda mutación pasa por RPC SECURITY DEFINER o Edge Function con service_role.

-- ============================================================================
-- TRIGGER DE SIGNUP
-- ============================================================================

create or replace function fn_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function fn_handle_new_user();
