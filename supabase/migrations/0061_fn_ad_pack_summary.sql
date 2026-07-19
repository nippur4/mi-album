-- Mi Álbum de Figuritas — resumen de sobres-por-ad para el tab Sobres
--
-- El tab lista varios álbumes; consultar fn_ad_pack_status por cada fila
-- sería N+1 (regla del proyecto: RPC batch). Como el tope es GLOBAL por
-- usuario, alcanza con un solo call que devuelva:
--   - album_ids: los álbumes con ads habilitados donde el caller es miembro
--     (publicados)
--   - used / remaining / limit: el cupo global de hoy (hora argentina)

create or replace function fn_ad_pack_summary()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_ids uuid[];
  v_used int;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;

  select coalesce(array_agg(m.album_id), '{}'::uuid[]) into v_ids
    from user_album_membership m
    join albums a on a.id = m.album_id
   where m.user_id = v_uid
     and m.album_id = any (_fn_ad_albums())
     and a.status = 'published';

  v_used := _fn_ad_packs_today(v_uid);

  return jsonb_build_object(
    'album_ids', to_jsonb(v_ids),
    'used', v_used,
    'remaining', greatest(0, 2 - v_used),
    'limit', 2
  );
end;
$$;

grant execute on function fn_ad_pack_summary() to authenticated;
