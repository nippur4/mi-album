-- Mi Álbum de Figuritas — fn_home_bundle devuelve solo las columnas que usa el Home
--
-- row_to_json(albums) mandaba la fila COMPLETA (pack_config, trade_config,
-- page_overrides, share_code, qr_cooldown, ...) por cada álbum de owned +
-- joined + 20 públicos, en el endpoint más golpeado de la app. Las cards del
-- Home usan 5 campos; el resto era egress puro (el detalle se baja aparte al
-- navegar). Shape por álbum:
--   { id, name, total_stickers, cover_thumb_key, cover_large_key }
--   (+ __hidden en joined, flag de la membership)
--
-- Recreada desde la definición VIVA (0050: públicos ordenados por
-- public_rank desc, published_at desc) — solo cambia la proyección.

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
        order by public_rank desc, published_at desc nulls last
        limit 20
      ) a
    )
  );
end;
$$;

grant execute on function fn_home_bundle() to authenticated;
