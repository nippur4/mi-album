-- Mi Álbum de Figuritas — settings de intercambio por jugador
--
-- Dos flags por-usuario-por-álbum en user_album_membership (default OFF):
--   trade_when_complete: seguir cambiando aunque completes el álbum (ayudar a
--                        un amigo con tus repes). Sin sobres nuevos igual.
--   accept_owned:        aceptar recibir en un cambio una figurita que ya tenés
--                        (una repe). Necesario para el recíproco del completo.
--
-- Reglas (el sistema es 1-a-1 recíproco; un completo no necesita nada, así que
-- recibe una repe a cambio):
--   - Gate completado: una parte con el álbum completo NO participa en cambios
--     salvo que tenga trade_when_complete. (P0183 trade_complete_disabled)
--   - Gate ya-la-tiene: nadie recibe en un cambio una figu que ya tiene salvo
--     que tenga accept_owned. (P0184 already_owned)
--   - En un match NORMAL nunca recibís algo que ya tenés (they_give exige
--     missing), así que los gates NO afectan los cambios normales.
--   - El matcher surфa a los helpers (completo + ambas flags) relajando el lado
--     "missing" del receptor SOLO para helpers, para no ensuciar ni explotar.

-- ============================================================================
-- 1. Columnas
-- ============================================================================

alter table user_album_membership
  add column if not exists trade_when_complete boolean not null default false,
  add column if not exists accept_owned boolean not null default false;

-- ============================================================================
-- 2. Setter (patrón de fn_set_daily_muted)
-- ============================================================================

create or replace function fn_set_trade_prefs(
  p_album_id uuid,
  p_trade_when_complete boolean,
  p_accept_owned boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;

  update user_album_membership
     set trade_when_complete = coalesce(p_trade_when_complete, false),
         accept_owned        = coalesce(p_accept_owned, false)
   where user_id = v_uid and album_id = p_album_id;

  if not found then
    raise exception 'not_member' using errcode = 'P0092';
  end if;
end;
$$;

grant execute on function fn_set_trade_prefs(uuid, boolean, boolean) to authenticated;

-- ============================================================================
-- 3. fn_create_trade_offer — con gates (recrea la def viva con push)
-- ============================================================================

create or replace function fn_create_trade_offer(
  p_album_id uuid, p_to_user uuid, p_offered_sticker_id uuid, p_requested_sticker_id uuid
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
  v_from_twc boolean; v_from_ao boolean;
  v_to_twc boolean;   v_to_ao boolean;
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

  select trade_when_complete, accept_owned into v_from_twc, v_from_ao
    from user_album_membership where user_id = v_uid and album_id = p_album_id;
  if not found then
    raise exception 'not_member' using errcode = 'P0092';
  end if;
  select trade_when_complete, accept_owned into v_to_twc, v_to_ao
    from user_album_membership where user_id = p_to_user and album_id = p_album_id;
  if not found then
    raise exception 'to_user_not_member' using errcode = 'P0117';
  end if;

  -- Gate completado (setting A) para ambas partes.
  if _fn_album_completed(v_uid, p_album_id, v_album.total_stickers) and not coalesce(v_from_twc, false) then
    raise exception 'trade_complete_disabled' using errcode = 'P0183';
  end if;
  if _fn_album_completed(p_to_user, p_album_id, v_album.total_stickers) and not coalesce(v_to_twc, false) then
    raise exception 'trade_complete_disabled' using errcode = 'P0183';
  end if;

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

  -- Gate ya-la-tiene (setting B): cada parte por la figu que RECIBE.
  if not coalesce(v_to_ao, false) and exists (
    select 1 from user_collection where user_id = p_to_user and sticker_id = p_offered_sticker_id
  ) then
    raise exception 'already_owned' using errcode = 'P0184';
  end if;
  if not coalesce(v_from_ao, false) and exists (
    select 1 from user_collection where user_id = v_uid and sticker_id = p_requested_sticker_id
  ) then
    raise exception 'already_owned' using errcode = 'P0184';
  end if;

  select quantity, pasted into v_my_qty, v_my_pasted
    from user_collection
    where user_id = v_uid and sticker_id = p_offered_sticker_id;
  if not found or (v_my_qty - case when v_my_pasted then 1 else 0 end) < 1 then
    raise exception 'stock_unavailable' using errcode = 'P0114';
  end if;

  if exists (
    select 1 from trade_offers
    where album_id = p_album_id and from_user = v_uid and to_user = p_to_user
      and offered_sticker_id = p_offered_sticker_id
      and requested_sticker_id = p_requested_sticker_id
      and status = 'pending'
  ) then
    raise exception 'duplicate_pending_offer' using errcode = 'P0120';
  end if;

  insert into trade_offers (album_id, from_user, to_user, offered_sticker_id, requested_sticker_id)
  values (p_album_id, v_uid, p_to_user, p_offered_sticker_id, p_requested_sticker_id)
  returning id into v_offer_id;

  perform _send_push(
    p_to_user,
    'Te propusieron un cambio',
    format('En "%s" alguien quiere intercambiarte una figurita.', v_album.name),
    jsonb_build_object('kind', 'trade_received', 'album_id', p_album_id, 'offer_id', v_offer_id)
  );

  return jsonb_build_object('offer_id', v_offer_id);
end;
$$;

grant execute on function fn_create_trade_offer(uuid, uuid, uuid, uuid) to authenticated;

-- ============================================================================
-- 4. fn_resolve_trade_offer — con gates en accept (recrea la def viva con push)
-- ============================================================================

create or replace function fn_resolve_trade_offer(p_offer_id uuid, p_action text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_offer trade_offers;
  v_album albums;
  v_from_qty int;   v_from_pasted boolean;
  v_to_qty int;     v_to_pasted boolean;
  v_from_twc boolean; v_from_ao boolean;
  v_to_twc boolean;   v_to_ao boolean;
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

  if p_action in ('accept', 'reject') and v_offer.to_user <> v_uid then
    raise exception 'not_offer_party' using errcode = 'P0112';
  end if;
  if p_action = 'cancel' and v_offer.from_user <> v_uid then
    raise exception 'not_offer_party' using errcode = 'P0112';
  end if;

  select * into v_album from albums where id = v_offer.album_id;

  if p_action = 'reject' then
    update trade_offers set status = 'rejected', resolved_at = now() where id = p_offer_id;
    perform _send_push(
      v_offer.from_user, 'Rechazaron tu propuesta',
      format('En "%s" no aceptaron tu propuesta de cambio.', v_album.name),
      jsonb_build_object('kind', 'trade_rejected', 'album_id', v_offer.album_id, 'offer_id', v_offer.id)
    );
    return jsonb_build_object('status', 'rejected', 'transferred', false);
  end if;
  if p_action = 'cancel' then
    update trade_offers set status = 'cancelled', resolved_at = now() where id = p_offer_id;
    return jsonb_build_object('status', 'cancelled', 'transferred', false);
  end if;

  -- accept
  if v_album.status <> 'published' then
    raise exception 'album_not_available_%', v_album.status using errcode = 'P0082';
  end if;
  if not coalesce((v_album.trade_config ->> 'enabled')::boolean, true) then
    raise exception 'trades_disabled' using errcode = 'P0115';
  end if;

  select trade_when_complete, accept_owned into v_from_twc, v_from_ao
    from user_album_membership where user_id = v_offer.from_user and album_id = v_offer.album_id;
  select trade_when_complete, accept_owned into v_to_twc, v_to_ao
    from user_album_membership where user_id = v_offer.to_user and album_id = v_offer.album_id;

  -- Gate completado (ambas partes).
  if _fn_album_completed(v_offer.from_user, v_offer.album_id, v_album.total_stickers) and not coalesce(v_from_twc, false) then
    raise exception 'trade_complete_disabled' using errcode = 'P0183';
  end if;
  if _fn_album_completed(v_offer.to_user, v_offer.album_id, v_album.total_stickers) and not coalesce(v_to_twc, false) then
    raise exception 'trade_complete_disabled' using errcode = 'P0183';
  end if;

  -- Gate ya-la-tiene: to_user recibe offered; from_user recibe requested.
  if not coalesce(v_to_ao, false) and exists (
    select 1 from user_collection where user_id = v_offer.to_user and sticker_id = v_offer.offered_sticker_id
  ) then
    raise exception 'already_owned' using errcode = 'P0184';
  end if;
  if not coalesce(v_from_ao, false) and exists (
    select 1 from user_collection where user_id = v_offer.from_user and sticker_id = v_offer.requested_sticker_id
  ) then
    raise exception 'already_owned' using errcode = 'P0184';
  end if;

  select quantity, pasted into v_from_qty, v_from_pasted
    from user_collection
    where user_id = v_offer.from_user and sticker_id = v_offer.offered_sticker_id for update;
  if not found or (v_from_qty - case when v_from_pasted then 1 else 0 end) < 1 then
    raise exception 'stock_unavailable' using errcode = 'P0114';
  end if;

  select quantity, pasted into v_to_qty, v_to_pasted
    from user_collection
    where user_id = v_offer.to_user and sticker_id = v_offer.requested_sticker_id for update;
  if not found or (v_to_qty - case when v_to_pasted then 1 else 0 end) < 1 then
    raise exception 'stock_unavailable' using errcode = 'P0114';
  end if;

  if fn_trade_limit_reached(v_offer.album_id, v_offer.from_user, v_album.trade_config) then
    raise exception 'trade_limit_exceeded' using errcode = 'P0113';
  end if;
  if fn_trade_limit_reached(v_offer.album_id, v_offer.to_user, v_album.trade_config) then
    raise exception 'trade_limit_exceeded' using errcode = 'P0113';
  end if;

  if v_from_qty = 1 then
    delete from user_collection
      where user_id = v_offer.from_user and sticker_id = v_offer.offered_sticker_id;
  else
    update user_collection set quantity = quantity - 1
      where user_id = v_offer.from_user and sticker_id = v_offer.offered_sticker_id;
  end if;

  insert into user_collection (user_id, sticker_id, quantity, pasted)
    values (v_offer.to_user, v_offer.offered_sticker_id, 1, false)
    on conflict (user_id, sticker_id) do update
      set quantity = user_collection.quantity + 1, last_obtained_at = now();

  if v_to_qty = 1 then
    delete from user_collection
      where user_id = v_offer.to_user and sticker_id = v_offer.requested_sticker_id;
  else
    update user_collection set quantity = quantity - 1
      where user_id = v_offer.to_user and sticker_id = v_offer.requested_sticker_id;
  end if;

  insert into user_collection (user_id, sticker_id, quantity, pasted)
    values (v_offer.from_user, v_offer.requested_sticker_id, 1, false)
    on conflict (user_id, sticker_id) do update
      set quantity = user_collection.quantity + 1, last_obtained_at = now();

  update trade_offers set status = 'accepted', resolved_at = now() where id = p_offer_id;

  perform _send_push(
    v_offer.from_user, '¡Aceptaron tu propuesta!',
    format('En "%s" recibiste la figurita que pediste.', v_album.name),
    jsonb_build_object('kind', 'trade_accepted', 'album_id', v_offer.album_id, 'offer_id', v_offer.id)
  );

  return jsonb_build_object('status', 'accepted', 'transferred', true);
end;
$$;

grant execute on function fn_resolve_trade_offer(uuid, text) to authenticated;

-- ============================================================================
-- 5. fn_album_matches — surfa helpers relajando el lado "missing" del receptor
-- ============================================================================

create or replace function fn_album_matches(p_album_id uuid, p_limit integer default 50)
returns table(
  other_user_id uuid, other_user_name text, other_user_avatar_url text,
  they_give_sticker_id uuid, they_give_sticker_number integer, they_give_sticker_name text,
  they_give_sticker_rarity sticker_rarity, they_give_sticker_thumb_key text,
  i_give_sticker_id uuid, i_give_sticker_number integer, i_give_sticker_name text,
  i_give_sticker_rarity sticker_rarity, i_give_sticker_thumb_key text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_total int;
  v_my_twc boolean; v_my_ao boolean;
  v_is_helper boolean;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;
  if not exists (
    select 1 from user_album_membership where user_id = v_uid and album_id = p_album_id
  ) then
    raise exception 'not_member' using errcode = 'P0092';
  end if;

  select total_stickers into v_total from albums where id = p_album_id;
  select trade_when_complete, accept_owned into v_my_twc, v_my_ao
    from user_album_membership where user_id = v_uid and album_id = p_album_id;
  -- Soy helper si completé Y activé ambas flags (puedo dar repes y recibir dupes).
  v_is_helper := _fn_album_completed(v_uid, p_album_id, v_total)
                 and coalesce(v_my_twc, false) and coalesce(v_my_ao, false);

  return query
  with my_inv as (
    select i.* from v_user_album_inventory i
    where i.user_id = v_uid and i.album_id = p_album_id
  ),
  their_inv as (
    select i.* from v_user_album_inventory i
    where i.album_id = p_album_id and i.user_id <> v_uid
  ),
  their_meta as (
    select ti.user_id,
           bool_and(ti.pasted) as completed,
           coalesce(m.trade_when_complete, false) as twc,
           coalesce(m.accept_owned, false) as ao
    from their_inv ti
    join user_album_membership m on m.user_id = ti.user_id and m.album_id = p_album_id
    group by ti.user_id, m.trade_when_complete, m.accept_owned
  ),
  they_give as (
    -- O me da: O tradable, y yo la necesito (missing) o soy helper (acepto dupe).
    -- Excluye a los O completos que no optaron por seguir cambiando.
    select ti.user_id as other_uid, ti.sticker_id, ti.sticker_number, ti.rarity
    from my_inv mi
    join their_inv ti on ti.sticker_id = mi.sticker_id
    join their_meta tm on tm.user_id = ti.user_id
    where ti.tradable_stock > 0
      and (mi.missing or v_is_helper)
      and not (tm.completed and not tm.twc)
  ),
  i_give as (
    -- Yo doy a O: yo tradable, y O la necesita (missing) o O es helper (acepta dupe).
    select ti.user_id as other_uid, ti.sticker_id, ti.sticker_number, ti.rarity
    from my_inv mi
    join their_inv ti on ti.sticker_id = mi.sticker_id
    join their_meta tm on tm.user_id = ti.user_id
    where mi.tradable_stock > 0
      and (ti.missing or (tm.completed and tm.twc and tm.ao))
      and not (tm.completed and not tm.twc)
  ),
  pairs as (
    select
      tg.other_uid,
      tg.sticker_id     as tg_sticker_id,
      tg.sticker_number as tg_sticker_number,
      tg.rarity         as tg_rarity,
      ig.sticker_id     as ig_sticker_id,
      ig.sticker_number as ig_sticker_number,
      ig.rarity         as ig_rarity,
      row_number() over (
        partition by tg.other_uid
        order by
          case tg.rarity when 'legendary' then 1 when 'epic' then 2 when 'rare' then 3 else 4 end,
          tg.sticker_number, ig.sticker_number
      ) as rn
    from they_give tg
    join i_give ig on ig.other_uid = tg.other_uid
    where tg.sticker_id <> ig.sticker_id
  )
  select
    pr.other_uid, p.display_name, p.avatar_url,
    pr.tg_sticker_id, pr.tg_sticker_number, s_tg.name, pr.tg_rarity, s_tg.thumb_key,
    pr.ig_sticker_id, pr.ig_sticker_number, s_ig.name, pr.ig_rarity, s_ig.thumb_key
  from pairs pr
  join profiles p on p.id = pr.other_uid
  join stickers s_tg on s_tg.id = pr.tg_sticker_id
  join stickers s_ig on s_ig.id = pr.ig_sticker_id
  where pr.rn <= 5
  order by
    case pr.tg_rarity when 'legendary' then 1 when 'epic' then 2 when 'rare' then 3 else 4 end,
    pr.tg_sticker_number
  limit p_limit;
end;
$$;

grant execute on function fn_album_matches(uuid, int) to authenticated;

-- ============================================================================
-- 6. fn_player_album_sidedata — exponer las flags nuevas (recrea def viva)
-- ============================================================================

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

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'sticker_id', uc.sticker_id, 'pasted', uc.pasted, 'quantity', uc.quantity
    )), '[]'::jsonb
  ) into v_collection
  from user_collection uc
  join stickers s on s.id = uc.sticker_id
  where uc.user_id = v_uid and s.album_id = p_album_id;

  select count(*) into v_packs_available
    from packs where user_id = v_uid and album_id = p_album_id and opened_at is null;

  v_daily_enabled  := coalesce((v_album.pack_config #>> '{daily,enabled}')::boolean, false);
  v_daily_count    := coalesce((v_album.pack_config #>> '{daily,count}')::int, 1);
  v_daily_cooldown := coalesce((v_album.pack_config #>> '{daily,cooldown_hours}')::int, 24);
  v_next := case
    when v_member.last_daily_claim_at is null then null
    else v_member.last_daily_claim_at + _fn_daily_interval(v_daily_cooldown)
  end;

  return jsonb_build_object(
    'collection', v_collection,
    'packs_available', v_packs_available,
    'daily_muted', coalesce(v_member.daily_muted, false),
    'trade_when_complete', coalesce(v_member.trade_when_complete, false),
    'accept_owned', coalesce(v_member.accept_owned, false),
    'daily', jsonb_build_object(
      'enabled', v_daily_enabled, 'count', v_daily_count,
      'cooldown_hours', v_daily_cooldown, 'next_available_at', v_next
    )
  );
end;
$$;

grant execute on function fn_player_album_sidedata(uuid) to authenticated;
