-- Mi Álbum de Figuritas — formatear el timestamp del cooldown del QR como ISO
--
-- Antes: raise exception 'qr_on_cooldown_until_%', v_next_available
-- emitía algo como "qr_on_cooldown_until_2026-06-26 14:30:00.123+00" (formato
-- default de timestamptz en Postgres). El cliente Hermes no garantiza
-- parsear ese formato, así que el mensaje al user caía al fallback genérico.
--
-- Ahora formateamos como "2026-06-26T14:30:00Z" para que new Date(...) lo
-- parsee sin ambigüedad. El resto del cuerpo es idéntico al original (0005).

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
  if v_album.owner_id = v_uid then
    raise exception 'owner_cannot_redeem_own_qr' using errcode = 'P0095';
  end if;

  v_qr_enabled := coalesce((v_album.pack_config #>> '{qr,enabled}')::boolean, false);
  if not v_qr_enabled then
    raise exception 'qr_not_enabled' using errcode = 'P0096';
  end if;

  v_count          := coalesce((v_album.pack_config #>> '{qr,count}')::int, 3);
  v_cooldown_hours := coalesce((v_album.pack_config #>> '{qr,cooldown_hours}')::int, 24);

  -- Si no era miembro, lo unimos antes (el QR también funciona como join).
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

  -- Rate limit del QR. Formateamos el ts como ISO UTC para que el cliente
  -- (Hermes) lo parsee sin ambigüedad.
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
