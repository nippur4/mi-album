-- ============================================================================
-- 0075 — Moderación de admin + motivo en la solicitud de público
-- ============================================================================
-- Suma:
--   1. Motivo obligatorio en la solicitud de álbum público (public_request_note).
--   2. Bloqueo reversible de álbum por admin (blocked_at): lo saca del carrusel
--      público (is_public=false) y frena nuevos joins. Reversible.
--   3. Borrado de álbum por admin (fn_admin_delete_album, cascade, con protección
--      de los especiales curados).
--   4. Listado de reports para el panel admin + resolución (resolved_at).
--
-- Los reportes ya existían (0072: album_reports con reason + details, fn_report_album).
-- Acá se agrega la cara de admin (ver/moderar) que aquella migración dejó pendiente.
--
-- GOTCHA column-security (0066/0069): albums no tiene grant de SELECT a nivel
-- tabla → cada columna nueva necesita su grant explícito + reload de PostgREST.

alter table albums add column if not exists public_request_note text;
alter table albums add column if not exists blocked_at timestamptz;
grant select (public_request_note) on albums to anon, authenticated;
grant select (blocked_at) on albums to anon, authenticated;

alter table album_reports add column if not exists resolved_at timestamptz;

-- ============================================================================
-- Solicitud de público CON MOTIVO (recrea las 0074 sumando el note)
-- ============================================================================

create or replace function fn_request_album_public(p_album_id uuid, p_note text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_status album_status;
  v_is_public boolean;
begin
  select owner_id, status, is_public
    into v_owner, v_status, v_is_public
    from albums where id = p_album_id;
  if not found then
    raise exception 'album_not_found' using errcode = 'P0002';
  end if;
  if v_owner <> auth.uid() then
    raise exception 'not_album_owner' using errcode = 'P0003';
  end if;
  if v_status <> 'published' then
    raise exception 'album_not_published' using errcode = 'P0071';
  end if;
  if coalesce(v_is_public, false) then
    raise exception 'album_already_public' using errcode = 'P0072';
  end if;
  if coalesce(trim(p_note), '') = '' then
    raise exception 'public_reason_required' using errcode = 'P0074';
  end if;

  update albums
    set public_requested_at = now(),
        public_request_note = trim(p_note)
    where id = p_album_id;
end;
$$;

create or replace function fn_cancel_album_public_request(p_album_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from albums where id = p_album_id;
  if not found then
    raise exception 'album_not_found' using errcode = 'P0002';
  end if;
  if v_owner <> auth.uid() then
    raise exception 'not_album_owner' using errcode = 'P0003';
  end if;
  update albums
    set public_requested_at = null, public_request_note = null
    where id = p_album_id;
end;
$$;

create or replace function fn_reject_album_public_request(p_album_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'admin_required' using errcode = 'P0070';
  end if;
  update albums
    set public_requested_at = null, public_request_note = null
    where id = p_album_id;
end;
$$;

create or replace function fn_set_album_public(p_album_id uuid, p_is_public boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_is_admin boolean;
  v_status album_status;
begin
  select is_admin into v_is_admin from profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'admin_required' using errcode = 'P0070';
  end if;
  select status into v_status from albums where id = p_album_id;
  if not found then
    raise exception 'album_not_found' using errcode = 'P0002';
  end if;
  if v_status <> 'published' then
    raise exception 'album_not_published' using errcode = 'P0071';
  end if;

  -- Cualquier acción del admin resuelve la solicitud pendiente.
  update albums
    set is_public = p_is_public,
        public_requested_at = null,
        public_request_note = null
    where id = p_album_id;
end;
$$;

-- ============================================================================
-- Bloqueo / desbloqueo de álbum por admin (reversible)
-- ============================================================================

create or replace function fn_admin_block_album(p_album_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_is_admin boolean;
begin
  select is_admin into v_is_admin from profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'admin_required' using errcode = 'P0070';
  end if;
  if not exists (select 1 from albums where id = p_album_id) then
    raise exception 'album_not_found' using errcode = 'P0002';
  end if;
  -- Sale del carrusel (is_public=false), muere cualquier solicitud pendiente y
  -- se marca bloqueado (frena nuevos joins vía fn_join_album). Reversible.
  update albums
    set blocked_at = now(),
        is_public = false,
        public_requested_at = null,
        public_request_note = null
    where id = p_album_id;
end;
$$;

create or replace function fn_admin_unblock_album(p_album_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_is_admin boolean;
begin
  select is_admin into v_is_admin from profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'admin_required' using errcode = 'P0070';
  end if;
  update albums set blocked_at = null where id = p_album_id;
end;
$$;

-- ============================================================================
-- Borrado de álbum por admin (cascade). Protege los especiales curados.
-- ============================================================================

create or replace function fn_admin_delete_album(p_album_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_is_admin boolean;
begin
  select is_admin into v_is_admin from profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'admin_required' using errcode = 'P0070';
  end if;
  if p_album_id in (
    '55fce726-d398-491f-9a92-06ee2e6c8d96',
    '29a1fa90-85b3-48fc-b452-2b7f64bd327b',
    'ecbf4497-e5d7-4732-88a2-75f7b39a2749',
    'd1227449-f10c-41e6-8483-5bef42b9fb0a'
  ) then
    raise exception 'album_protected' using errcode = 'P0201';
  end if;
  if not exists (select 1 from albums where id = p_album_id) then
    raise exception 'album_not_found' using errcode = 'P0002';
  end if;
  -- Los FKs cascadean: stickers, colecciones, memberships, packs, ofertas, reports.
  delete from albums where id = p_album_id;
end;
$$;

-- ============================================================================
-- Reports para el panel admin
-- ============================================================================

-- Marca como resueltos todos los reports (no resueltos) de un álbum.
create or replace function fn_admin_resolve_album_reports(p_album_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_is_admin boolean;
begin
  select is_admin into v_is_admin from profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'admin_required' using errcode = 'P0070';
  end if;
  update album_reports set resolved_at = now()
    where album_id = p_album_id and resolved_at is null;
end;
$$;

-- Un row por álbum con reports SIN resolver: conteo + detalle de cada reporte.
create or replace function fn_admin_list_album_reports()
returns table(
  album_id uuid, album_name text, owner_id uuid, owner_name text,
  status album_status, is_public boolean, blocked_at timestamptz,
  report_count integer, last_reported_at timestamptz, reports jsonb
)
language plpgsql stable security definer set search_path = public as $$
declare v_is_admin boolean;
begin
  select is_admin into v_is_admin from profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'admin_required' using errcode = 'P0070';
  end if;
  return query
  select
    a.id, a.name, a.owner_id, po.display_name, a.status, a.is_public, a.blocked_at,
    count(r.id)::int as report_count,
    max(r.created_at) as last_reported_at,
    jsonb_agg(
      jsonb_build_object(
        'reason', r.reason,
        'details', r.details,
        'reporter', pr.display_name,
        'created_at', r.created_at
      ) order by r.created_at desc
    ) as reports
  from album_reports r
  join albums a on a.id = r.album_id
  join profiles po on po.id = a.owner_id
  left join profiles pr on pr.id = r.reporter_id
  where r.resolved_at is null
  group by a.id, a.name, a.owner_id, po.display_name, a.status, a.is_public, a.blocked_at
  order by max(r.created_at) desc;
end;
$$;

-- ============================================================================
-- fn_admin_list_albums — sumar blocked_at, public_request_note y report_count
-- (RETURNS TABLE cambia de firma → DROP antes). Recrea la 0074.
-- ============================================================================

drop function if exists fn_admin_list_albums();

create or replace function fn_admin_list_albums()
returns table(
  id uuid, name text, owner_id uuid, owner_name text, status album_status,
  is_public boolean, total_stickers integer, published_at timestamptz,
  created_at timestamptz, member_count integer, public_rank integer,
  public_requested_at timestamptz, public_request_note text,
  blocked_at timestamptz, report_count integer
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_is_admin boolean;
begin
  select p.is_admin into v_is_admin from profiles p where p.id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'admin_required' using errcode = 'P0070';
  end if;
  return query
  select
    a.id, a.name, a.owner_id, p.display_name as owner_name, a.status,
    a.is_public, a.total_stickers, a.published_at, a.created_at,
    (select count(*)::int from user_album_membership where album_id = a.id) as member_count,
    a.public_rank,
    a.public_requested_at,
    a.public_request_note,
    a.blocked_at,
    (select count(*)::int from album_reports r
       where r.album_id = a.id and r.resolved_at is null) as report_count
  from albums a
  join profiles p on p.id = a.owner_id
  where a.status <> 'archived'
  order by
    case when a.public_requested_at is not null and a.is_public = false then 0 else 1 end,
    case a.status
      when 'published' then 1
      when 'read_only' then 2
      when 'draft' then 3
      else 4
    end,
    a.public_rank desc,
    a.created_at desc;
end;
$$;

-- ============================================================================
-- fn_join_album — frenar joins a álbumes bloqueados (recrea la 0027 + guard)
-- ============================================================================

create or replace function fn_join_album(p_share_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_album albums;
  v_existing user_album_membership;
  v_welcome_enabled boolean;
  v_welcome_count int;
  v_granted int := 0;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;
  if p_share_code is null or length(trim(p_share_code)) = 0 then
    raise exception 'share_code_required' using errcode = 'P0080';
  end if;

  v_code := upper(trim(p_share_code));

  select * into v_album from albums where share_code = v_code;
  if not found then
    raise exception 'album_not_found' using errcode = 'P0002';
  end if;

  if v_album.status <> 'published' then
    raise exception 'album_not_joinable_%', v_album.status using errcode = 'P0082';
  end if;

  -- Bloqueado por moderación: no se puede unir.
  if v_album.blocked_at is not null then
    raise exception 'album_blocked' using errcode = 'P0304';
  end if;

  select * into v_existing from user_album_membership
    where user_id = v_uid and album_id = v_album.id;

  if found then
    return jsonb_build_object(
      'album_id', v_album.id,
      'joined', false,
      'welcome_packs', 0
    );
  end if;

  insert into user_album_membership (user_id, album_id)
  values (v_uid, v_album.id);

  v_welcome_enabled := coalesce((v_album.pack_config #>> '{welcome,enabled}')::boolean, false);
  v_welcome_count   := coalesce((v_album.pack_config #>> '{welcome,count}')::int, 0);

  if v_welcome_enabled and v_welcome_count > 0 then
    perform fn_grant_packs(v_uid, v_album.id, 'welcome', v_welcome_count);
    v_granted := v_welcome_count;
    update user_album_membership
      set welcome_granted = true
      where user_id = v_uid and album_id = v_album.id;
  end if;

  if v_uid <> v_album.owner_id then
    perform _send_push(
      v_album.owner_id,
      'Alguien se unió a tu álbum',
      format('Ya tenés un jugador más en "%s".', v_album.name),
      jsonb_build_object('kind', 'album_joined', 'album_id', v_album.id)
    );
  end if;

  return jsonb_build_object(
    'album_id', v_album.id,
    'joined', true,
    'welcome_packs', v_granted
  );
end;
$$;

-- ============================================================================
-- GRANTS + reload schema
-- ============================================================================

grant execute on function fn_request_album_public(uuid, text) to authenticated;
grant execute on function fn_cancel_album_public_request(uuid) to authenticated;
grant execute on function fn_reject_album_public_request(uuid) to authenticated;
grant execute on function fn_set_album_public(uuid, boolean) to authenticated;
grant execute on function fn_admin_block_album(uuid) to authenticated;
grant execute on function fn_admin_unblock_album(uuid) to authenticated;
grant execute on function fn_admin_delete_album(uuid) to authenticated;
grant execute on function fn_admin_resolve_album_reports(uuid) to authenticated;
grant execute on function fn_admin_list_album_reports() to authenticated;
grant execute on function fn_admin_list_albums() to authenticated;
grant execute on function fn_join_album(text) to authenticated;

-- La firma vieja de fn_request_album_public(uuid) quedó hecha en 0074; la nueva
-- es (uuid, text). Revocamos la vieja para no dejar una firma sin note.
drop function if exists fn_request_album_public(uuid);

notify pgrst, 'reload schema';
