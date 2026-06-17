-- Mi Álbum de Figuritas — membership y otorgamiento de sobres
--
-- Cubre:
--   - Unirse a un álbum por share_code (idempotente, otorga welcome pack)
--   - Reclamar el sobre diario (cooldown del pack_config.daily)
--
-- No cubre (van en otras migraciones):
--   - open_pack (Edge Function, lleva aleatoriedad ponderada)
--   - redeem_qr (Edge Function, lleva HMAC)
--   - trades (migración 0004)

-- ============================================================================
-- HELPER INTERNO
-- ============================================================================

-- Crea N packs para (user, album). Devuelve el array de ids.
-- No chequea status del álbum; eso lo hace el caller con el contexto correcto.
create or replace function fn_grant_packs(
  p_user uuid,
  p_album uuid,
  p_source pack_source,
  p_count int
) returns uuid[]
language plpgsql security definer set search_path = public as $$
declare
  v_ids uuid[] := array[]::uuid[];
  v_id uuid;
begin
  if p_count < 1 then
    return v_ids;
  end if;
  for i in 1..p_count loop
    insert into packs (user_id, album_id, source)
    values (p_user, p_album, p_source)
    returning id into v_id;
    v_ids := array_append(v_ids, v_id);
  end loop;
  return v_ids;
end;
$$;

revoke execute on function fn_grant_packs(uuid, uuid, pack_source, int) from public;

-- ============================================================================
-- JOIN ALBUM
-- ============================================================================

-- Idempotente. Devuelve { album_id, joined, welcome_packs }.
--   - joined=true si la membership se acaba de crear; false si ya existía.
--   - welcome_packs = cantidad de sobres welcome otorgados en esta llamada (0 si ya
--     se habían otorgado antes, o si pack_config.welcome.enabled = false).
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

  if v_album.owner_id = v_uid then
    raise exception 'owner_cannot_join_own_album' using errcode = 'P0081';
  end if;

  -- Solo se puede entrar a álbumes publicados. Draft/read_only/archived bloquean.
  if v_album.status <> 'published' then
    raise exception 'album_not_joinable_%', v_album.status using errcode = 'P0082';
  end if;

  select * into v_existing from user_album_membership
    where user_id = v_uid and album_id = v_album.id;

  if found then
    -- Ya era miembro: idempotente, no se vuelve a otorgar welcome.
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

-- ============================================================================
-- DAILY PACK
-- ============================================================================

-- Reclama el sobre diario configurado por el owner. Devuelve:
--   { packs: int, next_available_at: timestamptz }
-- Errores:
--   P0090 daily_not_enabled    — owner tiene la fuente apagada
--   P0091 daily_on_cooldown    — todavía no pasó el cooldown (mensaje incluye fecha)
--   P0092 not_member           — el user no se unió al álbum
--   P0082 album_not_available_ — status != 'published' (read_only, draft, archived)
create or replace function fn_claim_daily_pack(p_album_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_album albums;
  v_member user_album_membership;
  v_daily_enabled boolean;
  v_count int;
  v_cooldown_hours int;
  v_next_available timestamptz;
  v_pack_ids uuid[];
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

  select * into v_member from user_album_membership
    where user_id = v_uid and album_id = p_album_id;
  if not found then
    raise exception 'not_member' using errcode = 'P0092';
  end if;

  v_daily_enabled  := coalesce((v_album.pack_config #>> '{daily,enabled}')::boolean, false);
  v_count          := coalesce((v_album.pack_config #>> '{daily,count}')::int, 1);
  v_cooldown_hours := coalesce((v_album.pack_config #>> '{daily,cooldown_hours}')::int, 24);

  if not v_daily_enabled then
    raise exception 'daily_not_enabled' using errcode = 'P0090';
  end if;

  if v_member.last_daily_claim_at is not null then
    v_next_available := v_member.last_daily_claim_at + make_interval(hours => v_cooldown_hours);
    if v_next_available > now() then
      raise exception 'daily_on_cooldown_until_%', v_next_available using errcode = 'P0091';
    end if;
  end if;

  v_pack_ids := fn_grant_packs(v_uid, p_album_id, 'daily', v_count);

  update user_album_membership
    set last_daily_claim_at = now()
    where user_id = v_uid and album_id = p_album_id;

  return jsonb_build_object(
    'packs', v_count,
    'next_available_at', now() + make_interval(hours => v_cooldown_hours)
  );
end;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

grant execute on function fn_join_album(text) to authenticated;
grant execute on function fn_claim_daily_pack(uuid) to authenticated;
