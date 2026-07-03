-- Mi Álbum de Figuritas — RPC batch para el data del jugador en un álbum
--
-- Reemplaza 3 hooks del cliente que hacían round trips separados al abrir
-- un álbum como player:
--   1) useUserCollection      → user_collection JOIN stickers
--   2) useAvailablePacksCount → count(*) de packs no abiertos
--   3) useDailyPackStatus     → albums.pack_config + membership.last_daily_claim_at
--
-- Con esta RPC el player-view hace 1 sola llamada en vez de 3. El álbum y
-- los stickers los sigue trayendo `useAlbumDetail` porque el thin router
-- los necesita para bifurcar owner vs player antes de saber cuál data pedir.
--
-- Output JSONB para mantener types flexibles:
-- {
--   "collection": [ { "sticker_id": uuid, "pasted": bool, "quantity": int }, ... ],
--   "packs_available": int,
--   "daily": {
--     "enabled": bool,
--     "cooldown_hours": int,
--     "count": int,
--     "next_available_at": timestamptz | null
--   }
-- }
--
-- Silenciosamente devuelve el bundle "vacío" si el user no es miembro del
-- álbum, así el caller no tiene que manejar 3 casos distintos.

create or replace function fn_player_album_sidedata(p_album_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_album albums;
  v_member user_album_membership;
  v_collection jsonb;
  v_packs_available int;
  v_daily_enabled boolean;
  v_daily_count int;
  v_daily_cooldown int;
  v_next timestamptz;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;

  select * into v_album from albums where id = p_album_id;
  if not found then
    raise exception 'album_not_found' using errcode = 'P0002';
  end if;

  select * into v_member from user_album_membership
    where user_id = v_uid and album_id = p_album_id;

  -- Colección del user en este álbum (solo entries de stickers del álbum).
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'sticker_id', uc.sticker_id,
      'pasted',     uc.pasted,
      'quantity',   uc.quantity
    )),
    '[]'::jsonb
  )
  into v_collection
  from user_collection uc
  join stickers s on s.id = uc.sticker_id
  where uc.user_id = v_uid
    and s.album_id = p_album_id;

  -- Sobres sin abrir del user en este álbum.
  select count(*) into v_packs_available
    from packs
   where user_id = v_uid
     and album_id = p_album_id
     and opened_at is null;

  -- Estado del daily: leemos config del álbum + last_claim de la membership.
  v_daily_enabled  := coalesce((v_album.pack_config #>> '{daily,enabled}')::boolean, false);
  v_daily_count    := coalesce((v_album.pack_config #>> '{daily,count}')::int, 1);
  v_daily_cooldown := coalesce((v_album.pack_config #>> '{daily,cooldown_hours}')::int, 24);
  v_next := case
    when v_member.last_daily_claim_at is null then null
    else v_member.last_daily_claim_at + make_interval(hours => v_daily_cooldown)
  end;

  return jsonb_build_object(
    'collection', v_collection,
    'packs_available', v_packs_available,
    'daily', jsonb_build_object(
      'enabled', v_daily_enabled,
      'count', v_daily_count,
      'cooldown_hours', v_daily_cooldown,
      'next_available_at', v_next
    )
  );
end;
$$;

grant execute on function fn_player_album_sidedata(uuid) to authenticated;
