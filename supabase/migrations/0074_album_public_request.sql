-- ============================================================================
-- 0074 — Solicitud de álbum público (owner solicita, admin aprueba)
-- ============================================================================
-- Hasta ahora `is_public` lo marcaba SOLO el admin (fn_set_album_public), sin
-- forma de que el owner lo pidiera desde la app. Este flujo agrega la solicitud:
--   - Owner (álbum publicado, no público) → fn_request_album_public → marca
--     public_requested_at.
--   - Admin ve la solicitud pendiente en fn_admin_list_albums (badge PENDIENTE)
--     y aprueba (fn_set_album_public true → limpia el pedido) o la descarta
--     (fn_reject_album_public_request).
--   - Owner puede retirar su solicitud (fn_cancel_album_public_request).
--
-- GOTCHA column-security (0066/0069): albums NO tiene grant de SELECT a nivel
-- tabla; cada columna nueva necesita su grant explícito o el select('*') del
-- cliente la omite en silencio. Además hay que recargar el schema de PostgREST.

alter table albums add column if not exists public_requested_at timestamptz;

-- Sin esto, la columna es invisible para el owner (PostgREST select=* la omite).
grant select (public_requested_at) on albums to anon, authenticated;

-- ============================================================================
-- fn_request_album_public — el OWNER solicita que su álbum sea público
-- ============================================================================

create or replace function fn_request_album_public(p_album_id uuid) returns void
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

  update albums set public_requested_at = now() where id = p_album_id;
end;
$$;

-- ============================================================================
-- fn_cancel_album_public_request — el OWNER retira su solicitud
-- ============================================================================

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
  update albums set public_requested_at = null where id = p_album_id;
end;
$$;

-- ============================================================================
-- fn_reject_album_public_request — el ADMIN descarta una solicitud pendiente
-- (sin cambiar is_public)
-- ============================================================================

create or replace function fn_reject_album_public_request(p_album_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'admin_required' using errcode = 'P0070';
  end if;
  update albums set public_requested_at = null where id = p_album_id;
end;
$$;

-- ============================================================================
-- fn_set_album_public — al aprobar/cambiar, limpiar la solicitud pendiente
-- (recreamos la 0002 sumando el reset de public_requested_at)
-- ============================================================================

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

  -- Cualquier acción del admin (aprobar o quitar) resuelve la solicitud pendiente.
  update albums
    set is_public = p_is_public,
        public_requested_at = null
    where id = p_album_id;
end;
$$;

-- ============================================================================
-- fn_admin_list_albums — sumar public_requested_at al listado (RETURNS TABLE
-- cambia de firma → DROP antes). Recreamos la 0050 con la columna extra.
-- ============================================================================

drop function if exists fn_admin_list_albums();

create or replace function fn_admin_list_albums()
returns table(
  id uuid, name text, owner_id uuid, owner_name text, status album_status,
  is_public boolean, total_stickers integer, published_at timestamptz,
  created_at timestamptz, member_count integer, public_rank integer,
  public_requested_at timestamptz
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
    a.public_requested_at
  from albums a
  join profiles p on p.id = a.owner_id
  where a.status <> 'archived'
  order by
    -- Pendientes de aprobación primero (para que el admin las vea de una).
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
-- GRANTS + reload schema (para que PostgREST vea la columna nueva y su grant)
-- ============================================================================

grant execute on function fn_request_album_public(uuid) to authenticated;
grant execute on function fn_cancel_album_public_request(uuid) to authenticated;
grant execute on function fn_reject_album_public_request(uuid) to authenticated;
grant execute on function fn_admin_list_albums() to authenticated;
grant execute on function fn_set_album_public(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
