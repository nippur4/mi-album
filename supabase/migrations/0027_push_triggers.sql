-- Mi Álbum de Figuritas — disparadores de push
--
-- Recrea 3 RPCs sumando llamadas a _send_push:
--   fn_create_trade_offer   → push al receptor "Te propusieron un cambio"
--   fn_resolve_trade_offer  → push al proposer en accept/reject
--   fn_join_album           → push al owner "Alguien se unió"
--
-- Y crea un cron cada 15 min que notifica sobres diarios listos.

-- =========================================================================
-- 1) fn_create_trade_offer + push al receptor
-- =========================================================================

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

  select quantity, pasted into v_my_qty, v_my_pasted
    from user_collection
    where user_id = v_uid and sticker_id = p_offered_sticker_id;
  if not found or (v_my_qty - case when v_my_pasted then 1 else 0 end) < 1 then
    raise exception 'stock_unavailable' using errcode = 'P0114';
  end if;

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

  -- Push al receptor. Fire-and-forget: no bloquea la transacción.
  perform _send_push(
    p_to_user,
    'Te propusieron un cambio',
    format('En "%s" alguien quiere intercambiarte una figurita.', v_album.name),
    jsonb_build_object(
      'kind', 'trade_received',
      'album_id', p_album_id,
      'offer_id', v_offer_id
    )
  );

  return jsonb_build_object('offer_id', v_offer_id);
end;
$$;

grant execute on function fn_create_trade_offer(uuid, uuid, uuid, uuid) to authenticated;

-- =========================================================================
-- 2) fn_resolve_trade_offer + push al proposer en accept/reject
-- =========================================================================

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

  if p_action in ('accept', 'reject') and v_offer.to_user <> v_uid then
    raise exception 'not_offer_party' using errcode = 'P0112';
  end if;
  if p_action = 'cancel' and v_offer.from_user <> v_uid then
    raise exception 'not_offer_party' using errcode = 'P0112';
  end if;

  select * into v_album from albums where id = v_offer.album_id;

  if p_action = 'reject' then
    update trade_offers set status = 'rejected', resolved_at = now()
      where id = p_offer_id;
    -- Push al proposer: le rechazaron.
    perform _send_push(
      v_offer.from_user,
      'Rechazaron tu propuesta',
      format('En "%s" no aceptaron tu propuesta de cambio.', v_album.name),
      jsonb_build_object(
        'kind', 'trade_rejected',
        'album_id', v_offer.album_id,
        'offer_id', v_offer.id
      )
    );
    return jsonb_build_object('status', 'rejected', 'transferred', false);
  end if;
  if p_action = 'cancel' then
    -- No push: quien cancela es el mismo que propuso.
    update trade_offers set status = 'cancelled', resolved_at = now()
      where id = p_offer_id;
    return jsonb_build_object('status', 'cancelled', 'transferred', false);
  end if;

  -- accept: revalidar contexto, stock, rate limit, transferir.
  if v_album.status <> 'published' then
    raise exception 'album_not_available_%', v_album.status using errcode = 'P0082';
  end if;
  if not coalesce((v_album.trade_config ->> 'enabled')::boolean, true) then
    raise exception 'trades_disabled' using errcode = 'P0115';
  end if;

  select quantity, pasted into v_from_qty, v_from_pasted
    from user_collection
    where user_id = v_offer.from_user and sticker_id = v_offer.offered_sticker_id
    for update;
  if not found or (v_from_qty - case when v_from_pasted then 1 else 0 end) < 1 then
    raise exception 'stock_unavailable' using errcode = 'P0114';
  end if;

  select quantity, pasted into v_to_qty, v_to_pasted
    from user_collection
    where user_id = v_offer.to_user and sticker_id = v_offer.requested_sticker_id
    for update;
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
      set quantity = user_collection.quantity + 1,
          last_obtained_at = now();

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
      set quantity = user_collection.quantity + 1,
          last_obtained_at = now();

  update trade_offers
    set status = 'accepted', resolved_at = now()
    where id = p_offer_id;

  -- Push al proposer: aceptaron.
  perform _send_push(
    v_offer.from_user,
    '¡Aceptaron tu propuesta!',
    format('En "%s" recibiste la figurita que pediste.', v_album.name),
    jsonb_build_object(
      'kind', 'trade_accepted',
      'album_id', v_offer.album_id,
      'offer_id', v_offer.id
    )
  );

  return jsonb_build_object('status', 'accepted', 'transferred', true);
end;
$$;

grant execute on function fn_resolve_trade_offer(uuid, text) to authenticated;

-- =========================================================================
-- 3) fn_join_album + push al owner
-- =========================================================================

create or replace function fn_join_album(p_share_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_album albums;
  v_existing user_album_membership;
  v_welcome_enabled boolean;
  v_welcome_count int;
  v_granted int := 0;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;
  if p_share_code is null or length(trim(p_share_code)) = 0 then
    raise exception 'share_code_required' using errcode = 'P0080';
  end if;

  v_code := upper(trim(p_share_code));

  select * into v_album from albums where share_code = v_code;
  if not found then
    raise exception 'album_not_found' using errcode = 'P0002';
  end if;

  if v_album.status <> 'published' then
    raise exception 'album_not_joinable_%', v_album.status using errcode = 'P0082';
  end if;

  select * into v_existing from user_album_membership
    where user_id = v_uid and album_id = v_album.id;

  if found then
    return jsonb_build_object(
      'album_id', v_album.id,
      'joined', false,
      'welcome_packs', 0
    );
  end if;

  insert into user_album_membership (user_id, album_id)
  values (v_uid, v_album.id);

  v_welcome_enabled := coalesce((v_album.pack_config #>> '{welcome,enabled}')::boolean, false);
  v_welcome_count   := coalesce((v_album.pack_config #>> '{welcome,count}')::int, 0);

  if v_welcome_enabled and v_welcome_count > 0 then
    perform fn_grant_packs(v_uid, v_album.id, 'welcome', v_welcome_count);
    v_granted := v_welcome_count;
    update user_album_membership
      set welcome_granted = true
      where user_id = v_uid and album_id = v_album.id;
  end if;

  -- Push al owner (excepto si el owner se joineó a su propio álbum, Fase 10).
  if v_uid <> v_album.owner_id then
    perform _send_push(
      v_album.owner_id,
      'Alguien se unió a tu álbum',
      format('Ya tenés un jugador más en "%s".', v_album.name),
      jsonb_build_object(
        'kind', 'album_joined',
        'album_id', v_album.id
      )
    );
  end if;

  return jsonb_build_object(
    'album_id', v_album.id,
    'joined', true,
    'welcome_packs', v_granted
  );
end;
$$;

grant execute on function fn_join_album(text) to authenticated;

-- =========================================================================
-- 4) Cron: notificar sobres diarios disponibles
-- =========================================================================

-- Selecciona memberships donde:
--   - El player NO ocultó el álbum (hidden = false)
--   - El álbum está published
--   - pack_config.daily.enabled = true
--   - Nunca reclamó (last_daily_claim_at IS NULL) O el cooldown ya pasó
--   - No fue notificado todavía (daily_notified_at IS NULL — el trigger de
--     0026 resetea este campo cuando el user reclama, así que en la próxima
--     ventana vuelve a estar en NULL).
--
-- Para cada match: send_push + set daily_notified_at = now().
create or replace function _cron_notify_daily_available()
returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  for r in
    select m.user_id, m.album_id, a.name as album_name
      from user_album_membership m
      join albums a on a.id = m.album_id
     where m.hidden = false
       and m.daily_notified_at is null
       and a.status = 'published'
       and coalesce((a.pack_config #>> '{daily,enabled}')::boolean, false) = true
       and (
         m.last_daily_claim_at is null
         or m.last_daily_claim_at
              + make_interval(hours => coalesce((a.pack_config #>> '{daily,cooldown_hours}')::int, 24))
              <= now()
       )
  loop
    perform _send_push(
      r.user_id,
      'Sobre diario disponible',
      format('Tenés un sobre listo en "%s".', r.album_name),
      jsonb_build_object('kind', 'daily_ready', 'album_id', r.album_id)
    );
    update user_album_membership
       set daily_notified_at = now()
     where user_id = r.user_id and album_id = r.album_id;
  end loop;
end;
$$;

-- cron.schedule con el mismo `name` sobrescribe si ya existe.
select cron.schedule(
  'notify-daily-available',
  '*/15 * * * *',
  $$select _cron_notify_daily_available()$$
);
