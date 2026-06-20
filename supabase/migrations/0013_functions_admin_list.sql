-- fn_admin_list_published_albums: listado para el panel admin.
--
-- Bypassa RLS (SECURITY DEFINER) para que el admin pueda ver TODOS los álbumes
-- publicados (públicos y privados), no solo los visibles vía RLS normal.
-- La función chequea is_admin explícitamente.

create or replace function fn_admin_list_published_albums()
returns table (
  id uuid,
  name text,
  owner_id uuid,
  owner_name text,
  is_public boolean,
  total_stickers int,
  published_at timestamptz,
  member_count int
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'admin_required' using errcode = 'P0070';
  end if;
  return query
  select
    a.id,
    a.name,
    a.owner_id,
    p.display_name as owner_name,
    a.is_public,
    a.total_stickers,
    a.published_at,
    (select count(*)::int from user_album_membership where album_id = a.id) as member_count
  from albums a
  join profiles p on p.id = a.owner_id
  where a.status = 'published'
  order by a.published_at desc nulls last;
end;
$$;

grant execute on function fn_admin_list_published_albums() to authenticated;
