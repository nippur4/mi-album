-- Mi Álbum de Figuritas — sistema de intercambio (trades)
--
-- Cubre:
--   - fn_create_trade_offer: crear una oferta 1-a-1
--   - fn_resolve_trade_offer: aceptar / rechazar / cancelar (accept es atómico)
--   - fn_paste_sticker: marcar una figurita como pegada (ritual del user)
--   - fn_album_matches: lista de coincidencias para la pantalla 07
--
-- Reglas duras del trade:
--   - Solo álbumes status='published' (read_only bloquea).
--   - Solo si trade_config.enabled = true.
--   - Stock intercambiable = quantity - (pasted ? 1 : 0). La pegada NUNCA se mueve.
--   - Rate limit (trade_config.limit) se chequea AL ACEPTAR para ambos lados.
--   - Lo que se transfiere entra en el receptor con pasted=false siempre. Si ya
--     tenía la fila, el flag pasted preexistente se respeta (lo nuevo es repe).

-- ============================================================================
-- HELPER INTERNO — rate limit del trade_config
-- ============================================================================

-- Devuelve true si el user superó el cap de trades aceptados en la ventana
-- definida por trade_config.limit. Si el limit es null (sin tope), devuelve false.
create or replace function fn_trade_limit_reached(
  p_album_id uuid,
  p_user uuid,
  p_trade_config jsonb
) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_limit jsonb := p_trade_config -> 'limit';
  v_count int;
  v_period text;
  v_interval interval;
  v_done int;
begin
  if v_limit is null or v_limit = 'null'::jsonb then
    return false;
  end if;
  v_count := (v_limit ->> 'count')::int;
  v_period := v_limit ->> 'period';
  v_interval := case v_period
    when 'day'   then interval '1 day'
    when 'week'  then interval '7 days'
    when 'month' then interval '30 days'
    else interval '1 day'
  end;

  select count(*) into v_done
  from trade_offers
  where album_id = p_album_id
    and (from_user = p_user or to_user = p_user)
    and status = 'accepted'
    and resolved_at > now() - v_interval;

  return v_done >= v_count;
end;
$$;

revoke execute on function fn_trade_limit_reached(uuid, uuid, jsonb) from public;

-- ============================================================================
-- CREATE OFFER
-- ============================================================================

-- Devuelve { offer_id }.
-- Errores:
--   P0010 auth_required
--   P0002 album_not_found
--   P0082 album_not_available_<status>
--   P0115 trades_disabled
--   P0116 self_trade_not_allowed
--   P0117 to_user_not_member
--   P0118 sticker_not_in_album
--   P0119 same_sticker_offered_and_requested
--   P0114 stock_unavailable
--   P0120 duplicate_pending_offer
create or replace function fn_create_trade_offer(
  p_album_id uuid,
  p_to_user uuid,
  p_offered_sticker_id uuid,
  p_requested_sticker_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_album albums;
  v_offered stickers;
  v_requested stickers;
  v_my_qty int;
  v_my_pasted boolean;
  v_offer_id uuid;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;
  if v_uid = p_to_user then
    raise exception 'self_trade_not_allowed' using errcode = 'P0116';
  end if;
  if p_offered_sticker_id = p_requested_sticker_id then
    raise exception 'same_sticker_offered_and_requested' using errcode = 'P0119';
  end if;

  select * into v_album from albums where id = p_album_id;
  if not found then
    raise exception 'album_not_found' using errcode = 'P0002';
  end if;
  if v_album.status <> 'published' then
    raise exception 'album_not_available_%', v_album.status using errcode = 'P0082';
  end if;
  if not coalesce((v_album.trade_config ->> 'enabled')::boolean, true) then
    raise exception 'trades_disabled' using errcode = 'P0115';
  end if;

  -- Caller y receptor deben ser miembros (no el owner del álbum).
  if not exists (
    select 1 from user_album_membership
    where user_id = v_uid and album_id = p_album_id
  ) then
    raise exception 'not_member' using errcode = 'P0092';
  end if;
  if not exists (
    select 1 from user_album_membership
    where user_id = p_to_user and album_id = p_album_id
  ) then
    raise exception 'to_user_not_member' using errcode = 'P0117';
  end if;

  -- Las dos figuritas deben pertenecer al álbum.
  select * into v_offered from stickers
    where id = p_offered_sticker_id and album_id = p_album_id;
  if not found then
    raise exception 'sticker_not_in_album' using errcode = 'P0118';
  end if;
  select * into v_requested from stickers
    where id = p_requested_sticker_id and album_id = p_album_id;
  if not found then
    raise exception 'sticker_not_in_album' using errcode = 'P0118';
  end if;

  -- Stock intercambiable del caller para la offered.
  select quantity, pasted into v_my_qty, v_my_pasted
    from user_collection
    where user_id = v_uid and sticker_id = p_offered_sticker_id;
  if not found or (v_my_qty - case when v_my_pasted then 1 else 0 end) < 1 then
    raise exception 'stock_unavailable' using errcode = 'P0114';
  end if;

  -- Evitar duplicar la misma oferta pending exacta.
  if exists (
    select 1 from trade_offers
    where album_id = p_album_id
      and from_user = v_uid
      and to_user = p_to_user
      and offered_sticker_id = p_offered_sticker_id
      and requested_sticker_id = p_requested_sticker_id
      and status = 'pending'
  ) then
    raise exception 'duplicate_pending_offer' using errcode = 'P0120';
  end if;

  insert into trade_offers (
    album_id, from_user, to_user, offered_sticker_id, requested_sticker_id
  ) values (
    p_album_id, v_uid, p_to_user, p_offered_sticker_id, p_requested_sticker_id
  ) returning id into v_offer_id;

  return jsonb_build_object('offer_id', v_offer_id);
end;
$$;

-- ============================================================================
-- RESOLVE OFFER (accept / reject / cancel)
-- ============================================================================

-- Acciones:
--   'accept' → solo to_user; revalida stock de ambos, chequea rate limit,
--              transfiere atómicamente, marca accepted.
--   'reject' → solo to_user; marca rejected.
--   'cancel' → solo from_user; marca cancelled.
--
-- Errores adicionales (sobre los de create):
--   P0110 offer_not_found
--   P0111 offer_not_pending
--   P0112 not_offer_party
--   P0113 trade_limit_exceeded
--   P0121 invalid_action
create or replace function fn_resolve_trade_offer(
  p_offer_id uuid,
  p_action text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_offer trade_offers;
  v_album albums;
  v_from_qty int;
  v_from_pasted boolean;
  v_to_qty int;
  v_to_pasted boolean;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;
  if p_action not in ('accept', 'reject', 'cancel') then
    raise exception 'invalid_action' using errcode = 'P0121';
  end if;

  select * into v_offer from trade_offers where id = p_offer_id for update;
  if not found then
    raise exception 'offer_not_found' using errcode = 'P0110';
  end if;
  if v_offer.status <> 'pending' then
    raise exception 'offer_not_pending' using errcode = 'P0111';
  end if;

  -- Autoría por acción
  if p_action in ('accept', 'reject') and v_offer.to_user <> v_uid then
    raise exception 'not_offer_party' using errcode = 'P0112';
  end if;
  if p_action = 'cancel' and v_offer.from_user <> v_uid then
    raise exception 'not_offer_party' using errcode = 'P0112';
  end if;

  if p_action = 'reject' then
    update trade_offers set status = 'rejected', resolved_at = now()
      where id = p_offer_id;
    return jsonb_build_object('status', 'rejected', 'transferred', false);
  end if;
  if p_action = 'cancel' then
    update trade_offers set status = 'cancelled', resolved_at = now()
      where id = p_offer_id;
    return jsonb_build_object('status', 'cancelled', 'transferred', false);
  end if;

  -- accept: revalidar contexto, stock, rate limit, transferir.
  select * into v_album from albums where id = v_offer.album_id;
  if v_album.status <> 'published' then
    raise exception 'album_not_available_%', v_album.status using errcode = 'P0082';
  end if;
  if not coalesce((v_album.trade_config ->> 'enabled')::boolean, true) then
    raise exception 'trades_disabled' using errcode = 'P0115';
  end if;

  -- Lock + revalidar stock del from_user (lo que ofreció).
  select quantity, pasted into v_from_qty, v_from_pasted
    from user_collection
    where user_id = v_offer.from_user and sticker_id = v_offer.offered_sticker_id
    for update;
  if not found or (v_from_qty - case when v_from_pasted then 1 else 0 end) < 1 then
    raise exception 'stock_unavailable' using errcode = 'P0114';
  end if;

  -- Lock + revalidar stock del to_user (lo que el caller daría a cambio).
  select quantity, pasted into v_to_qty, v_to_pasted
    from user_collection
    where user_id = v_offer.to_user and sticker_id = v_offer.requested_sticker_id
    for update;
  if not found or (v_to_qty - case when v_to_pasted then 1 else 0 end) < 1 then
    raise exception 'stock_unavailable' using errcode = 'P0114';
  end if;

  -- Rate limit en ambos lados.
  if fn_trade_limit_reached(v_offer.album_id, v_offer.from_user, v_album.trade_config) then
    raise exception 'trade_limit_exceeded' using errcode = 'P0113';
  end if;
  if fn_trade_limit_reached(v_offer.album_id, v_offer.to_user, v_album.trade_config) then
    raise exception 'trade_limit_exceeded' using errcode = 'P0113';
  end if;

  -- Transferencia atómica.
  -- from_user pierde 1 de offered.
  if v_from_qty = 1 then
    delete from user_collection
      where user_id = v_offer.from_user and sticker_id = v_offer.offered_sticker_id;
  else
    update user_collection set quantity = quantity - 1
      where user_id = v_offer.from_user and sticker_id = v_offer.offered_sticker_id;
  end if;

  -- to_user gana 1 de offered. Si era nueva, entra con pasted=false (ritual).
  insert into user_collection (user_id, sticker_id, quantity, pasted)
    values (v_offer.to_user, v_offer.offered_sticker_id, 1, false)
    on conflict (user_id, sticker_id) do update
      set quantity = user_collection.quantity + 1,
          last_obtained_at = now();

  -- to_user pierde 1 de requested.
  if v_to_qty = 1 then
    delete from user_collection
      where user_id = v_offer.to_user and sticker_id = v_offer.requested_sticker_id;
  else
    update user_collection set quantity = quantity - 1
      where user_id = v_offer.to_user and sticker_id = v_offer.requested_sticker_id;
  end if;

  -- from_user gana 1 de requested.
  insert into user_collection (user_id, sticker_id, quantity, pasted)
    values (v_offer.from_user, v_offer.requested_sticker_id, 1, false)
    on conflict (user_id, sticker_id) do update
      set quantity = user_collection.quantity + 1,
          last_obtained_at = now();

  update trade_offers
    set status = 'accepted', resolved_at = now()
    where id = p_offer_id;

  return jsonb_build_object('status', 'accepted', 'transferred', true);
end;
$$;

-- ============================================================================
-- PASTE STICKER
-- ============================================================================

-- Idempotente: si ya estaba pegada, no falla.
-- Errores:
--   P0010 auth_required
--   P0130 sticker_not_owned
create or replace function fn_paste_sticker(p_sticker_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_pasted boolean;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;

  select pasted into v_pasted from user_collection
    where user_id = v_uid and sticker_id = p_sticker_id;
  if not found then
    raise exception 'sticker_not_owned' using errcode = 'P0130';
  end if;
  if v_pasted then
    return; -- idempotente
  end if;

  update user_collection set pasted = true
    where user_id = v_uid and sticker_id = p_sticker_id;
end;
$$;

-- ============================================================================
-- ALBUM MATCHES
-- ============================================================================

-- Devuelve pares (le das X, te da Y) con otros miembros del álbum.
-- Solo entre el caller y otros members (no incluye al owner del álbum como par).
-- Ordenado por rareza desc del sticker que recibís (legendarias primero).
create or replace function fn_album_matches(
  p_album_id uuid,
  p_limit int default 50
) returns table (
  other_user_id uuid,
  other_user_name text,
  other_user_avatar_url text,
  they_give_sticker_id uuid,
  they_give_sticker_number int,
  they_give_sticker_name text,
  they_give_sticker_rarity sticker_rarity,
  they_give_sticker_thumb_url text,
  i_give_sticker_id uuid,
  i_give_sticker_number int,
  i_give_sticker_name text,
  i_give_sticker_rarity sticker_rarity,
  i_give_sticker_thumb_url text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;
  -- El caller debe ser miembro del álbum para ver matches.
  if not exists (
    select 1 from user_album_membership
    where user_id = v_uid and album_id = p_album_id
  ) then
    raise exception 'not_member' using errcode = 'P0092';
  end if;

  return query
  with my_inv as (
    select i.* from v_user_album_inventory i
    where i.user_id = v_uid and i.album_id = p_album_id
  ),
  their_inv as (
    select i.* from v_user_album_inventory i
    where i.album_id = p_album_id and i.user_id <> v_uid
  ),
  they_give as (
    -- ellos pueden darme: yo missing, ellos tradable
    select ti.user_id as other_uid, ti.sticker_id, ti.sticker_number, ti.rarity
    from my_inv mi
    join their_inv ti on ti.sticker_id = mi.sticker_id
    where mi.missing = true and ti.tradable_stock > 0
  ),
  i_give as (
    -- yo puedo darles: ellos missing, yo tradable
    select ti.user_id as other_uid, ti.sticker_id, ti.sticker_number, ti.rarity
    from my_inv mi
    join their_inv ti on ti.sticker_id = mi.sticker_id
    where mi.tradable_stock > 0 and ti.missing = true
  )
  select
    tg.other_uid,
    p.display_name,
    p.avatar_url,
    tg.sticker_id, tg.sticker_number, s_tg.name, tg.rarity, s_tg.thumb_url,
    ig.sticker_id, ig.sticker_number, s_ig.name, ig.rarity, s_ig.thumb_url
  from they_give tg
  join i_give ig on ig.other_uid = tg.other_uid
  join profiles p on p.id = tg.other_uid
  join stickers s_tg on s_tg.id = tg.sticker_id
  join stickers s_ig on s_ig.id = ig.sticker_id
  order by
    case tg.rarity
      when 'legendary' then 1 when 'epic' then 2 when 'rare' then 3 else 4
    end,
    tg.sticker_number
  limit p_limit;
end;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

grant execute on function fn_create_trade_offer(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function fn_resolve_trade_offer(uuid, text) to authenticated;
grant execute on function fn_paste_sticker(uuid) to authenticated;
grant execute on function fn_album_matches(uuid, int) to authenticated;
