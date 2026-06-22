-- Fix: "column reference 'id' is ambiguous" en fn_admin_list_published_albums.
-- Cuando una función con RETURNS TABLE incluye una columna llamada `id`,
-- toda referencia a `id` no calificada dentro del body es ambigua. El select
-- de is_admin no estaba aliaseando profiles.

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
