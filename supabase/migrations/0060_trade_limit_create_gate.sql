-- Mi Álbum de Figuritas — límite de trades también al CREAR ofertas
--
-- Hasta ahora el tope de trade_config.limit se chequeaba solo AL ACEPTAR:
-- un jugador que ya agotó su ventana podía seguir creando ofertas que la
-- contraparte no iba a poder concretar (chocaba con P0113 al aceptar).
--
-- Dos cambios:
--   1. fn_create_trade_offer gatea al creador: si ya alcanzó su tope, P0113
--      (mismo errcode que al aceptar — el cliente ya tiene el copy).
--   2. fn_my_offer_flags(): para las ofertas PENDING donde el caller es
--      parte, devuelve si el EMISOR está bloqueado por su tope. El cliente:
--      - Recibidas: oculta las ofertas cuyo emisor está bloqueado (quedaron
--        pendientes de ANTES de que el emisor agotara su ventana — no tiene
--        sentido mostrarlas si aceptar va a fallar).
--      - Enviadas: muestra la nota "el otro no la ve hasta que puedas
--        cambiar de nuevo" en las propias.
--      Cuando la ventana rueda, el flag vuelve a false y las ofertas
--      reaparecen solas — por eso se OCULTAN y no se cancelan.

-- ============================================================================
-- 1. fn_create_trade_offer — recreada desde la def viva (0052, con prefs y
--    push), agregando SOLO el gate del tope del creador.
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

  -- NUEVO (0060): el creador con la ventana agotada no genera ofertas nuevas.
  if fn_trade_limit_reached(p_album_id, v_uid, v_album.trade_config) then
    raise exception 'trade_limit_exceeded' using errcode = 'P0113';
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
-- 2. fn_my_offer_flags — visibilidad de ofertas pending del caller.
--    security definer: fn_trade_limit_reached está revocada de public y el
--    conteo mira trades del EMISOR (que el caller no puede ver por RLS).
-- ============================================================================

create or replace function fn_my_offer_flags()
returns table (offer_id uuid, sender_blocked boolean)
language sql stable security definer set search_path = public as $$
  select o.id,
         fn_trade_limit_reached(o.album_id, o.from_user, a.trade_config)
    from trade_offers o
    join albums a on a.id = o.album_id
   where o.status = 'pending'
     and (o.from_user = auth.uid() or o.to_user = auth.uid());
$$;

grant execute on function fn_my_offer_flags() to authenticated;
