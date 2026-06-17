-- Mi Álbum de Figuritas — funciones de ciclo de vida del álbum
--
-- Convenciones:
--   - Todas SECURITY DEFINER con search_path explícito; el caller es auth.uid().
--   - Errores: RAISE EXCEPTION con mensaje legible. Códigos cortos en USING ERRCODE
--     usando el rango P0001-P0099 reservado para errores de negocio de esta app.
--   - Mutaciones del CONTENIDO del álbum (name, covers, total_stickers, stickers)
--     SOLO se permiten en status='draft'. La economía (pack_config, trade_config,
--     qr_secret) acepta también 'published'. Nada se toca en 'read_only'/'archived'.

-- ============================================================================
-- UTILITIES
-- ============================================================================

create or replace function fn_is_pro(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from subscriptions
    where user_id = p_user
      and status in ('active', 'in_grace')
      and expires_at > now()
  );
$$;

-- Char set sin caracteres ambiguos (0/O, 1/I/L). 32^6 ≈ 1B combinaciones.
create or replace function fn_gen_share_code() returns text
language plpgsql as $$
declare
  v_chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_attempt int := 0;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, (floor(random() * length(v_chars)) + 1)::int, 1);
    end loop;
    if not exists (select 1 from albums where share_code = v_code) then
      return v_code;
    end if;
    v_attempt := v_attempt + 1;
    if v_attempt > 10 then
      raise exception 'could not generate unique share_code' using errcode = 'P0001';
    end if;
  end loop;
end;
$$;

create or replace function fn_assert_owner(p_album_id uuid) returns albums
language plpgsql stable security definer set search_path = public as $$
declare
  v_album albums;
begin
  select * into v_album from albums where id = p_album_id;
  if not found then
    raise exception 'album_not_found' using errcode = 'P0002';
  end if;
  if v_album.owner_id <> auth.uid() then
    raise exception 'not_album_owner' using errcode = 'P0003';
  end if;
  return v_album;
end;
$$;

-- Cuenta álbumes "activos" del owner (cuentan hacia el límite free de 1).
-- Drafts + published + read_only cuentan; archived no.
create or replace function fn_count_active_albums(p_owner uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from albums
  where owner_id = p_owner and status <> 'archived';
$$;

-- ============================================================================
-- CREATE / UPDATE ALBUM
-- ============================================================================

create or replace function fn_create_album(
  p_name text,
  p_total_stickers int,
  p_cover_thumb_url text default null,
  p_cover_large_url text default null,
  p_pack_thumb_url text default null,
  p_pack_large_url text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_is_pro boolean;
  v_album_id uuid;
  v_max_stickers int;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name_required' using errcode = 'P0011';
  end if;

  v_is_pro := fn_is_pro(v_uid);
  v_max_stickers := case when v_is_pro then 1000 else 75 end;

  if p_total_stickers < 1 or p_total_stickers > v_max_stickers then
    raise exception 'total_stickers_out_of_range_%', v_max_stickers
      using errcode = 'P0012';
  end if;

  -- Gate de free: máximo 1 álbum activo.
  if not v_is_pro and fn_count_active_albums(v_uid) >= 1 then
    raise exception 'pro_required' using errcode = 'P0020';
  end if;

  insert into albums (
    owner_id, name, total_stickers, share_code,
    cover_thumb_url, cover_large_url, pack_thumb_url, pack_large_url
  ) values (
    v_uid, trim(p_name), p_total_stickers, fn_gen_share_code(),
    p_cover_thumb_url, p_cover_large_url, p_pack_thumb_url, p_pack_large_url
  ) returning id into v_album_id;

  return v_album_id;
end;
$$;

create or replace function fn_update_album_content(
  p_album_id uuid,
  p_name text default null,
  p_total_stickers int default null,
  p_cover_thumb_url text default null,
  p_cover_large_url text default null,
  p_pack_thumb_url text default null,
  p_pack_large_url text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_album albums := fn_assert_owner(p_album_id);
  v_is_pro boolean;
  v_max_stickers int;
  v_new_total int;
begin
  if v_album.status <> 'draft' then
    raise exception 'album_not_draft' using errcode = 'P0030';
  end if;

  if p_total_stickers is not null then
    v_is_pro := fn_is_pro(auth.uid());
    v_max_stickers := case when v_is_pro then 1000 else 75 end;
    if p_total_stickers < 1 or p_total_stickers > v_max_stickers then
      raise exception 'total_stickers_out_of_range_%', v_max_stickers
        using errcode = 'P0012';
    end if;
    v_new_total := p_total_stickers;
    -- No permitir bajar el total por debajo del max(number) ya cargado.
    if exists (select 1 from stickers where album_id = v_album.id and number > v_new_total) then
      raise exception 'total_below_existing_sticker_numbers' using errcode = 'P0031';
    end if;
  end if;

  update albums set
    name              = coalesce(nullif(trim(p_name), ''), name),
    total_stickers    = coalesce(p_total_stickers, total_stickers),
    cover_thumb_url   = coalesce(p_cover_thumb_url, cover_thumb_url),
    cover_large_url   = coalesce(p_cover_large_url, cover_large_url),
    pack_thumb_url    = coalesce(p_pack_thumb_url, pack_thumb_url),
    pack_large_url    = coalesce(p_pack_large_url, pack_large_url)
  where id = v_album.id;
end;
$$;

-- Acepta pack_config y/o trade_config completos (null = no cambia).
-- Si pack_config activa qr por primera vez, valida pro y genera qr_secret.
create or replace function fn_update_album_economy(
  p_album_id uuid,
  p_pack_config jsonb default null,
  p_trade_config jsonb default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_album albums := fn_assert_owner(p_album_id);
  v_qr_enabled_now boolean;
  v_qr_enabled_new boolean;
  v_new_secret text := v_album.qr_secret;
begin
  if v_album.status not in ('draft', 'published') then
    raise exception 'album_economy_locked' using errcode = 'P0040';
  end if;

  if p_pack_config is not null then
    v_qr_enabled_now := coalesce((v_album.pack_config #>> '{qr,enabled}')::boolean, false);
    v_qr_enabled_new := coalesce((p_pack_config #>> '{qr,enabled}')::boolean, false);

    if v_qr_enabled_new and not v_qr_enabled_now then
      if not fn_is_pro(auth.uid()) then
        raise exception 'pro_required' using errcode = 'P0020';
      end if;
      if v_new_secret is null then
        v_new_secret := encode(gen_random_bytes(32), 'hex');
      end if;
    end if;

    -- Sanity check liviano de cooldowns para que el cliente no rompa la economía.
    if coalesce((p_pack_config #>> '{daily,cooldown_hours}')::int, 24) < 1 then
      raise exception 'cooldown_too_low' using errcode = 'P0041';
    end if;
    if coalesce((p_pack_config #>> '{qr,cooldown_hours}')::int, 24) < 1 then
      raise exception 'cooldown_too_low' using errcode = 'P0041';
    end if;
  end if;

  update albums set
    pack_config  = coalesce(p_pack_config, pack_config),
    trade_config = coalesce(p_trade_config, trade_config),
    qr_secret    = v_new_secret
  where id = v_album.id;
end;
$$;

create or replace function fn_rotate_qr_secret(p_album_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_album albums := fn_assert_owner(p_album_id);
begin
  if v_album.status not in ('draft', 'published') then
    raise exception 'album_economy_locked' using errcode = 'P0040';
  end if;
  if not fn_is_pro(auth.uid()) then
    raise exception 'pro_required' using errcode = 'P0020';
  end if;
  if not coalesce((v_album.pack_config #>> '{qr,enabled}')::boolean, false) then
    raise exception 'qr_not_enabled' using errcode = 'P0042';
  end if;

  update albums
    set qr_secret = encode(gen_random_bytes(32), 'hex')
    where id = v_album.id;
end;
$$;

-- ============================================================================
-- STICKERS (solo en draft)
-- ============================================================================

create or replace function fn_add_sticker(
  p_album_id uuid,
  p_number int,
  p_name text,
  p_rarity sticker_rarity,
  p_thumb_url text,
  p_large_url text,
  p_traits jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_album albums := fn_assert_owner(p_album_id);
  v_id uuid;
begin
  if v_album.status <> 'draft' then
    raise exception 'album_not_draft' using errcode = 'P0030';
  end if;
  if p_number < 1 or p_number > v_album.total_stickers then
    raise exception 'sticker_number_out_of_range' using errcode = 'P0050';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name_required' using errcode = 'P0011';
  end if;
  if p_thumb_url is null or p_large_url is null then
    raise exception 'images_required' using errcode = 'P0051';
  end if;

  insert into stickers (album_id, number, name, rarity, thumb_url, large_url, traits)
  values (v_album.id, p_number, trim(p_name), p_rarity, p_thumb_url, p_large_url, p_traits)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function fn_update_sticker(
  p_sticker_id uuid,
  p_name text default null,
  p_rarity sticker_rarity default null,
  p_thumb_url text default null,
  p_large_url text default null,
  p_traits jsonb default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_sticker stickers;
  v_album albums;
begin
  select * into v_sticker from stickers where id = p_sticker_id;
  if not found then
    raise exception 'sticker_not_found' using errcode = 'P0052';
  end if;
  v_album := fn_assert_owner(v_sticker.album_id);
  if v_album.status <> 'draft' then
    raise exception 'album_not_draft' using errcode = 'P0030';
  end if;

  update stickers set
    name      = coalesce(nullif(trim(p_name), ''), name),
    rarity    = coalesce(p_rarity, rarity),
    thumb_url = coalesce(p_thumb_url, thumb_url),
    large_url = coalesce(p_large_url, large_url),
    traits    = coalesce(p_traits, traits)
  where id = p_sticker_id;
end;
$$;

create or replace function fn_delete_sticker(p_sticker_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_sticker stickers;
  v_album albums;
begin
  select * into v_sticker from stickers where id = p_sticker_id;
  if not found then
    raise exception 'sticker_not_found' using errcode = 'P0052';
  end if;
  v_album := fn_assert_owner(v_sticker.album_id);
  if v_album.status <> 'draft' then
    raise exception 'album_not_draft' using errcode = 'P0030';
  end if;

  delete from stickers where id = p_sticker_id;
end;
$$;

-- ============================================================================
-- TRANSICIONES DE STATUS
-- ============================================================================

-- One-way: draft → published. Valida que todos los números 1..total_stickers estén cargados.
create or replace function fn_publish_album(p_album_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_album albums := fn_assert_owner(p_album_id);
  v_loaded int;
  v_missing int;
begin
  if v_album.status <> 'draft' then
    raise exception 'album_not_draft' using errcode = 'P0030';
  end if;
  if v_album.cover_thumb_url is null or v_album.cover_large_url is null then
    raise exception 'album_cover_required' using errcode = 'P0060';
  end if;
  if v_album.pack_thumb_url is null or v_album.pack_large_url is null then
    raise exception 'album_pack_image_required' using errcode = 'P0061';
  end if;

  select count(*) into v_loaded from stickers where album_id = v_album.id;
  if v_loaded <> v_album.total_stickers then
    raise exception 'stickers_count_mismatch_%_of_%', v_loaded, v_album.total_stickers
      using errcode = 'P0062';
  end if;

  -- Cubre la integridad: no hay huecos en la numeración.
  select min(g.n) into v_missing
  from generate_series(1, v_album.total_stickers) g(n)
  where not exists (select 1 from stickers s where s.album_id = v_album.id and s.number = g.n);
  if v_missing is not null then
    raise exception 'sticker_number_missing_%', v_missing using errcode = 'P0063';
  end if;

  update albums
    set status = 'published', published_at = now()
    where id = v_album.id;
end;
$$;

create or replace function fn_archive_album(p_album_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_album albums := fn_assert_owner(p_album_id);
begin
  if v_album.status = 'archived' then
    return; -- idempotente
  end if;
  update albums set status = 'archived' where id = v_album.id;
end;
$$;

-- ============================================================================
-- ADMIN
-- ============================================================================

create or replace function fn_set_album_public(p_album_id uuid, p_is_public boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_is_admin boolean;
  v_status album_status;
begin
  select is_admin into v_is_admin from profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'admin_required' using errcode = 'P0070';
  end if;
  select status into v_status from albums where id = p_album_id;
  if not found then
    raise exception 'album_not_found' using errcode = 'P0002';
  end if;
  if v_status <> 'published' then
    raise exception 'album_not_published' using errcode = 'P0071';
  end if;

  update albums set is_public = p_is_public where id = p_album_id;
end;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

grant execute on function fn_is_pro(uuid) to authenticated;
grant execute on function fn_create_album(text, int, text, text, text, text) to authenticated;
grant execute on function fn_update_album_content(uuid, text, int, text, text, text, text) to authenticated;
grant execute on function fn_update_album_economy(uuid, jsonb, jsonb) to authenticated;
grant execute on function fn_rotate_qr_secret(uuid) to authenticated;
grant execute on function fn_add_sticker(uuid, int, text, sticker_rarity, text, text, jsonb) to authenticated;
grant execute on function fn_update_sticker(uuid, text, sticker_rarity, text, text, jsonb) to authenticated;
grant execute on function fn_delete_sticker(uuid) to authenticated;
grant execute on function fn_publish_album(uuid) to authenticated;
grant execute on function fn_archive_album(uuid) to authenticated;
grant execute on function fn_set_album_public(uuid, boolean) to authenticated;

-- Las utilities internas no se exponen al rol authenticated.
revoke execute on function fn_gen_share_code() from public;
revoke execute on function fn_assert_owner(uuid) from public;
revoke execute on function fn_count_active_albums(uuid) from public;
