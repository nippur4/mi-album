-- Mi Álbum de Figuritas — moderación de contenido (bloqueo + reporte)
--
-- Requisito de Google Play para apps con contenido generado por usuarios:
-- el usuario debe poder REPORTAR contenido objetable y BLOQUEAR a otros usuarios
-- para dejar de verlos.
--
--   - user_blocks: el caller (blocker) no quiere ver contenido de blocked. El
--     bloqueo es one-directional (yo dejo de verlo a él). Efectos: sus álbumes
--     públicos se excluyen del Home (server-side, acá) y sus ofertas/matches de
--     intercambio se filtran en el cliente.
--   - album_reports: reportes de álbumes (un reporte por usuario por álbum). El
--     admin los revisa (por ahora vía dashboard; UI de admin queda para después).
--
-- Acceso SOLO por RPCs SECURITY DEFINER (las tablas quedan con RLS on / sin
-- policies → PostgREST no las toca directo; las funciones definer bypasean RLS).

-- ============================================================================
-- Tablas
-- ============================================================================

create table user_blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index idx_user_blocks_blocker on user_blocks(blocker_id);
alter table user_blocks enable row level security;

create table album_reports (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references albums(id) on delete cascade,
  reporter_id uuid not null references profiles(id) on delete cascade,
  reason text not null,
  details text,
  created_at timestamptz not null default now(),
  unique (album_id, reporter_id)
);
create index idx_album_reports_album on album_reports(album_id);
alter table album_reports enable row level security;

-- ============================================================================
-- RPCs de bloqueo
-- ============================================================================

create or replace function fn_block_user(p_blocked uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'auth_required' using errcode = 'P0010'; end if;
  if p_blocked is null or p_blocked = v_uid then
    raise exception 'cannot_block_self' using errcode = 'P0302';
  end if;
  insert into user_blocks (blocker_id, blocked_id)
  values (v_uid, p_blocked)
  on conflict do nothing;
end $$;
grant execute on function fn_block_user(uuid) to authenticated;

create or replace function fn_unblock_user(p_blocked uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'auth_required' using errcode = 'P0010'; end if;
  delete from user_blocks where blocker_id = v_uid and blocked_id = p_blocked;
end $$;
grant execute on function fn_unblock_user(uuid) to authenticated;

-- Lista de bloqueados del caller (con nombre + avatar) para la pantalla de gestión.
create or replace function fn_my_blocks()
returns table (blocked_id uuid, display_name text, avatar_thumb_key text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'auth_required' using errcode = 'P0010'; end if;
  return query
    select b.blocked_id, p.display_name, p.avatar_thumb_key, b.created_at
      from user_blocks b
      join profiles p on p.id = b.blocked_id
     where b.blocker_id = v_uid
     order by b.created_at desc;
end $$;
grant execute on function fn_my_blocks() to authenticated;

-- ============================================================================
-- RPC de reporte
-- ============================================================================

create or replace function fn_report_album(
  p_album uuid, p_reason text, p_details text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'auth_required' using errcode = 'P0010'; end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'reason_required' using errcode = 'P0301';
  end if;
  if not exists (select 1 from albums where id = p_album) then
    raise exception 'album_not_found' using errcode = 'P0303';
  end if;
  insert into album_reports (album_id, reporter_id, reason, details)
  values (p_album, v_uid, p_reason, nullif(trim(p_details), ''))
  on conflict (album_id, reporter_id) do update
    set reason = excluded.reason, details = excluded.details, created_at = now();
end $$;
grant execute on function fn_report_album(uuid, text, text) to authenticated;

-- ============================================================================
-- fn_home_bundle: excluir del carrusel público los álbumes de usuarios bloqueados
-- (recreada desde 0053, único cambio: NOT EXISTS sobre user_blocks en 'public').
-- ============================================================================

create or replace function fn_home_bundle()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;

  return jsonb_build_object(
    'owned', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id,
        'name', a.name,
        'total_stickers', a.total_stickers,
        'cover_thumb_key', a.cover_thumb_key,
        'cover_large_key', a.cover_large_key
      ) order by a.created_at desc), '[]'::jsonb)
      from albums a
      where a.owner_id = v_uid
        and a.status <> 'archived'
        and a.owner_hidden = false
    ),
    'joined', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id,
        'name', a.name,
        'total_stickers', a.total_stickers,
        'cover_thumb_key', a.cover_thumb_key,
        'cover_large_key', a.cover_large_key,
        '__hidden', m.hidden
      ) order by a.created_at desc), '[]'::jsonb)
      from user_album_membership m
      join albums a on a.id = m.album_id
      where m.user_id = v_uid
        and a.status <> 'archived'
    ),
    'public', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id,
        'name', a.name,
        'total_stickers', a.total_stickers,
        'cover_thumb_key', a.cover_thumb_key,
        'cover_large_key', a.cover_large_key
      ) order by a.public_rank desc, a.published_at desc nulls last), '[]'::jsonb)
      from (
        select * from albums
        where is_public = true and status = 'published'
          and not exists (
            select 1 from user_blocks ub
             where ub.blocker_id = v_uid and ub.blocked_id = albums.owner_id
          )
        order by public_rank desc, published_at desc nulls last
        limit 20
      ) a
    )
  );
end;
$$;

grant execute on function fn_home_bundle() to authenticated;
