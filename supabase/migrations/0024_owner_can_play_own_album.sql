-- Mi Álbum de Figuritas — el owner puede jugar su propio álbum
--
-- Motivación: hasta acá el owner solo administraba su álbum. Ahora también
-- puede unirse como jugador, abrir sobres, pegar, reclamar el diario y
-- escanear su propio QR. Esto le permite completar el álbum y probar la
-- experiencia end-to-end.
--
-- El intercambio consigo mismo se mantiene bloqueado (P0116 self_trade_not_allowed)
-- porque no tiene sentido — sigue vigente vía el check de `to_user <> v_uid`
-- en fn_create_trade_offer.
--
-- Cambios:
--   1) fn_join_album: quitar check P0081 owner_cannot_join_own_album
--   2) fn_apply_qr_redeem: quitar check P0095 owner_cannot_redeem_own_qr

-- =========================================================================
-- 1) fn_join_album — sin el bloqueo al owner
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

  -- NOTA: el owner ahora puede joinear su propio álbum (Fase 10 del web plan).
  -- Antes rechazaba con P0081; el check quedó eliminado deliberadamente.

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

  return jsonb_build_object(
    'album_id', v_album.id,
    'joined', true,
    'welcome_packs', v_granted
  );
end;
$$;

grant execute on function fn_join_album(text) to authenticated;

-- =========================================================================
-- 2) fn_apply_qr_redeem — sin el bloqueo al owner de escanear su propio QR
-- =========================================================================

create or replace function fn_apply_qr_redeem(
  p_album_id uuid,
  p_nonce text,
  p_issued_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_album albums;
  v_member user_album_membership;
  v_qr_enabled boolean;
  v_count int;
  v_cooldown_hours int;
  v_next_available timestamptz;
  v_joined boolean := false;
  v_welcome_enabled boolean;
  v_welcome_count int;
  v_welcome_granted_now int := 0;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;

  select * into v_album from albums where id = p_album_id;
  if not found then
    raise exception 'album_not_found' using errcode = 'P0002';
  end if;
  if v_album.status <> 'published' then
    raise exception 'album_not_available_%', v_album.status using errcode = 'P0082';
  end if;

  -- NOTA: el owner ahora puede escanear su propio QR (Fase 10 del web plan).
  -- Antes rechazaba con P0095; el check quedó eliminado deliberadamente.

  v_qr_enabled := coalesce((v_album.pack_config #>> '{qr,enabled}')::boolean, false);
  if not v_qr_enabled then
    raise exception 'qr_not_enabled' using errcode = 'P0096';
  end if;

  v_count          := coalesce((v_album.pack_config #>> '{qr,count}')::int, 3);
  v_cooldown_hours := coalesce((v_album.pack_config #>> '{qr,cooldown_hours}')::int, 24);

  select * into v_member from user_album_membership
    where user_id = v_uid and album_id = p_album_id;

  if not found then
    insert into user_album_membership (user_id, album_id)
    values (v_uid, p_album_id)
    returning * into v_member;
    v_joined := true;

    v_welcome_enabled := coalesce((v_album.pack_config #>> '{welcome,enabled}')::boolean, false);
    v_welcome_count   := coalesce((v_album.pack_config #>> '{welcome,count}')::int, 0);
    if v_welcome_enabled and v_welcome_count > 0 then
      perform fn_grant_packs(v_uid, p_album_id, 'welcome', v_welcome_count);
      v_welcome_granted_now := v_welcome_count;
      update user_album_membership
        set welcome_granted = true
        where user_id = v_uid and album_id = p_album_id;
    end if;
  end if;

  if v_member.last_qr_redeem_at is not null then
    v_next_available := v_member.last_qr_redeem_at + make_interval(hours => v_cooldown_hours);
    if v_next_available > now() then
      raise exception 'qr_on_cooldown_until_%',
        to_char(v_next_available at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
        using errcode = 'P0097';
    end if;
  end if;

  perform fn_grant_packs(v_uid, p_album_id, 'qr', v_count);

  update user_album_membership
    set last_qr_redeem_at = now()
    where user_id = v_uid and album_id = p_album_id;

  return jsonb_build_object(
    'packs', v_count,
    'next_available_at', now() + make_interval(hours => v_cooldown_hours),
    'joined', v_joined,
    'welcome_packs', v_welcome_granted_now
  );
end;
$$;

grant execute on function fn_apply_qr_redeem(uuid, text, timestamptz) to authenticated;
