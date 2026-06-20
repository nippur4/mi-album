-- fn_album_progress: para una lista de álbumes, devuelve el progreso del caller
-- (owner: cuántas figuritas cargó / member: cuántas pegó). Usado por las
-- cards del Landing para mostrar la barra y el contador X/N.

create or replace function fn_album_progress(p_album_ids uuid[])
returns table (
  album_id uuid,
  total_stickers int,
  stickers_loaded int,
  my_pasted_count int
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;
  return query
  select
    a.id,
    a.total_stickers,
    (select count(*)::int from stickers where album_id = a.id) as stickers_loaded,
    (select count(*)::int
       from user_collection uc
       join stickers s on s.id = uc.sticker_id
       where s.album_id = a.id and uc.user_id = v_uid and uc.pasted = true
    ) as my_pasted_count
  from albums a
  where a.id = any(p_album_ids);
end;
$$;

grant execute on function fn_album_progress(uuid[]) to authenticated;
