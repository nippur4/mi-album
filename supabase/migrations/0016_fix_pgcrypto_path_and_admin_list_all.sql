-- Mi Álbum de Figuritas — fixes y panel admin "ver todo"
--
-- 1) Fix bug "function gen_random_bytes does not exist": en Supabase pgcrypto
--    vive en el schema `extensions`. Las funciones que usan gen_random_bytes
--    tenían search_path solo en `public`, no la encontraban. Sumamos
--    `extensions` al search_path de esas funciones.
--
-- 2) Panel admin ve TODOS los álbumes (no solo publicados). Renombramos la
--    RPC y el cliente la llama con el nuevo nombre. Sumamos status + created_at
--    al return para que la UI muestre estado y permita togglear público
--    solo cuando corresponde.

-- =========================================================================
-- 1. Fix search_path para funciones que usan gen_random_bytes
-- =========================================================================

alter function fn_update_album_economy(uuid, jsonb, jsonb)
  set search_path = public, extensions;

alter function fn_rotate_qr_secret(uuid)
  set search_path = public, extensions;

-- =========================================================================
-- 2. fn_admin_list_albums (reemplaza fn_admin_list_published_albums)
-- =========================================================================

drop function if exists fn_admin_list_published_albums();

create or replace function fn_admin_list_albums()
returns table (
  id uuid,
  name text,
  owner_id uuid,
  owner_name text,
  status album_status,
  is_public boolean,
  total_stickers int,
  published_at timestamptz,
  created_at timestamptz,
  member_count int
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
    a.id,
    a.name,
    a.owner_id,
    p.display_name as owner_name,
    a.status,
    a.is_public,
    a.total_stickers,
    a.published_at,
    a.created_at,
    (select count(*)::int from user_album_membership where album_id = a.id) as member_count
  from albums a
  join profiles p on p.id = a.owner_id
  where a.status <> 'archived'
  order by
    case a.status
      when 'published' then 1
      when 'read_only' then 2
      when 'draft' then 3
      else 4
    end,
    a.created_at desc;
end;
$$;

grant execute on function fn_admin_list_albums() to authenticated;
