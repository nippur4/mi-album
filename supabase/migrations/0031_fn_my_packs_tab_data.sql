-- Mi Álbum de Figuritas — RPC bundle para el tab Sobres.
--
-- Reemplaza 4 llamadas separadas del cliente:
--   1) fn_my_pending_packs — sobres sin abrir por álbum
--   2) useMyMemberAlbums    — álbumes jugables
--   3) useMyOwnedAlbums     — solo para filtrar `!owned.includes(a.id)` en JS
--   4) useMyDailyStatusBatch — status del daily por álbum
--
-- La 3ra se hace server-side (`a.owner_id <> v_uid`) — el cliente ya no
-- necesita traer los owned solo para hacer un filtrado. La 4ta se computa
-- inline con el mismo join.
--
-- Output JSONB con 2 arrays:
--   pending_packs:   [ { album_id, album_name, cover_thumb_key, pack_thumb_key, pending_count } ]
--   playable_albums: [ { album_id, album_name, cover_thumb_key, pack_thumb_key,
--                        daily: { enabled, count, cooldown_hours, next_available_at } } ]

create or replace function fn_my_packs_tab_data()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_pending jsonb;
  v_playable jsonb;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;

  -- Sobres pendientes por álbum (group by en Postgres, no en JS).
  with counts as (
    select album_id, count(*)::int as c
      from packs
     where user_id = v_uid and opened_at is null
     group by album_id
  )
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'album_id', a.id,
      'album_name', a.name,
      'cover_thumb_key', a.cover_thumb_key,
      'pack_thumb_key', a.pack_thumb_key,
      'pending_count', counts.c
    ) order by counts.c desc, a.name asc),
    '[]'::jsonb
  ) into v_pending
  from counts
  join albums a on a.id = counts.album_id;

  -- Álbumes jugables con status del daily.
  --
  -- Criterios:
  --   - El caller tiene membership.
  --   - NO ocultó el álbum.
  --   - NO es owner (el owner juega vía `?as=player`, no aparece acá).
  --   - Álbum published.
  with playable as (
    select a.*, m.last_daily_claim_at
      from user_album_membership m
      join albums a on a.id = m.album_id
     where m.user_id = v_uid
       and m.hidden = false
       and a.owner_id <> v_uid
       and a.status = 'published'
  )
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'album_id', p.id,
      'album_name', p.name,
      'cover_thumb_key', p.cover_thumb_key,
      'pack_thumb_key', p.pack_thumb_key,
      'daily', jsonb_build_object(
        'enabled', coalesce((p.pack_config #>> '{daily,enabled}')::boolean, false),
        'count', coalesce((p.pack_config #>> '{daily,count}')::int, 1),
        'cooldown_hours', coalesce((p.pack_config #>> '{daily,cooldown_hours}')::int, 24),
        'next_available_at', case
          when p.last_daily_claim_at is null then null
          else p.last_daily_claim_at
                 + make_interval(hours => coalesce((p.pack_config #>> '{daily,cooldown_hours}')::int, 24))
        end
      )
    ) order by p.name asc),
    '[]'::jsonb
  ) into v_playable
  from playable p;

  return jsonb_build_object(
    'pending_packs', v_pending,
    'playable_albums', v_playable
  );
end;
$$;

grant execute on function fn_my_packs_tab_data() to authenticated;
