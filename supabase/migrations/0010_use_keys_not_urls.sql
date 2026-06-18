-- Mi Álbum de Figuritas — guardar object keys en vez de URLs completas
--
-- Motivación: si en el futuro cambiamos R2_PUBLIC_BASE_URL (ej. de r2.dev a un
-- dominio custom como cdn.tuapp.com), no hay que hacer UPDATE masivo de strings
-- en la DB. La URL completa se construye en el cliente concatenando el base URL
-- (env var) con la key guardada.
--
-- Renombra columnas y reescribe las funciones que las referencian.
-- Las views/policies no usaban estos campos, no requieren cambios.

-- ============================================================================
-- 1. RENAME COLUMNS
-- ============================================================================

alter table albums rename column cover_thumb_url to cover_thumb_key;
alter table albums rename column cover_large_url to cover_large_key;
alter table albums rename column pack_thumb_url  to pack_thumb_key;
alter table albums rename column pack_large_url  to pack_large_key;

alter table stickers rename column thumb_url to thumb_key;
alter table stickers rename column large_url to large_key;

-- ============================================================================
-- 2. DROP funciones con signatures que cambian nombre de parámetros
-- ============================================================================

drop function if exists fn_create_album(text, int, text, text, text, text);
drop function if exists fn_update_album_content(uuid, text, int, text, text, text, text);
drop function if exists fn_add_sticker(uuid, int, text, sticker_rarity, text, text, jsonb);
drop function if exists fn_update_sticker(uuid, text, sticker_rarity, text, text, jsonb);
drop function if exists fn_album_matches(uuid, int);

-- ============================================================================
-- 3. RECREATE funciones con nombres de parámetros actualizados
-- ============================================================================

create or replace function fn_create_album(
  p_name text,
  p_total_stickers int,
  p_cover_thumb_key text default null,
  p_cover_large_key text default null,
  p_pack_thumb_key text default null,
  p_pack_large_key text default null
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

  if not v_is_pro and fn_count_active_albums(v_uid) >= 1 then
    raise exception 'pro_required' using errcode = 'P0020';
  end if;

  insert into albums (
    owner_id, name, total_stickers, share_code,
    cover_thumb_key, cover_large_key, pack_thumb_key, pack_large_key
  ) values (
    v_uid, trim(p_name), p_total_stickers, fn_gen_share_code(),
    p_cover_thumb_key, p_cover_large_key, p_pack_thumb_key, p_pack_large_key
  ) returning id into v_album_id;

  return v_album_id;
end;
$$;

create or replace function fn_update_album_content(
  p_album_id uuid,
  p_name text default null,
  p_total_stickers int default null,
  p_cover_thumb_key text default null,
  p_cover_large_key text default null,
  p_pack_thumb_key text default null,
  p_pack_large_key text default null
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
    if exists (select 1 from stickers where album_id = v_album.id and number > v_new_total) then
      raise exception 'total_below_existing_sticker_numbers' using errcode = 'P0031';
    end if;
  end if;

  update albums set
    name              = coalesce(nullif(trim(p_name), ''), name),
    total_stickers    = coalesce(p_total_stickers, total_stickers),
    cover_thumb_key   = coalesce(p_cover_thumb_key, cover_thumb_key),
    cover_large_key   = coalesce(p_cover_large_key, cover_large_key),
    pack_thumb_key    = coalesce(p_pack_thumb_key, pack_thumb_key),
    pack_large_key    = coalesce(p_pack_large_key, pack_large_key)
  where id = v_album.id;
end;
$$;

create or replace function fn_add_sticker(
  p_album_id uuid,
  p_number int,
  p_name text,
  p_rarity sticker_rarity,
  p_thumb_key text,
  p_large_key text,
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
  if p_thumb_key is null or p_large_key is null then
    raise exception 'images_required' using errcode = 'P0051';
  end if;

  insert into stickers (album_id, number, name, rarity, thumb_key, large_key, traits)
  values (v_album.id, p_number, trim(p_name), p_rarity, p_thumb_key, p_large_key, p_traits)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function fn_update_sticker(
  p_sticker_id uuid,
  p_name text default null,
  p_rarity sticker_rarity default null,
  p_thumb_key text default null,
  p_large_key text default null,
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
    thumb_key = coalesce(p_thumb_key, thumb_key),
    large_key = coalesce(p_large_key, large_key),
    traits    = coalesce(p_traits, traits)
  where id = p_sticker_id;
end;
$$;

-- ============================================================================
-- 4. fn_publish_album: cuerpo actualizado (signature no cambia)
-- ============================================================================

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
  if v_album.cover_thumb_key is null or v_album.cover_large_key is null then
    raise exception 'album_cover_required' using errcode = 'P0060';
  end if;
  if v_album.pack_thumb_key is null or v_album.pack_large_key is null then
    raise exception 'album_pack_image_required' using errcode = 'P0061';
  end if;

  select count(*) into v_loaded from stickers where album_id = v_album.id;
  if v_loaded <> v_album.total_stickers then
    raise exception 'stickers_count_mismatch_%_of_%', v_loaded, v_album.total_stickers
      using errcode = 'P0062';
  end if;

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

-- ============================================================================
-- 5. fn_album_matches: return type cambia (columnas thumb_url → thumb_key)
-- ============================================================================

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
  they_give_sticker_thumb_key text,
  i_give_sticker_id uuid,
  i_give_sticker_number int,
  i_give_sticker_name text,
  i_give_sticker_rarity sticker_rarity,
  i_give_sticker_thumb_key text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;
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
    select ti.user_id as other_uid, ti.sticker_id, ti.sticker_number, ti.rarity
    from my_inv mi
    join their_inv ti on ti.sticker_id = mi.sticker_id
    where mi.missing = true and ti.tradable_stock > 0
  ),
  i_give as (
    select ti.user_id as other_uid, ti.sticker_id, ti.sticker_number, ti.rarity
    from my_inv mi
    join their_inv ti on ti.sticker_id = mi.sticker_id
    where mi.tradable_stock > 0 and ti.missing = true
  )
  select
    tg.other_uid,
    p.display_name,
    p.avatar_url,
    tg.sticker_id, tg.sticker_number, s_tg.name, tg.rarity, s_tg.thumb_key,
    ig.sticker_id, ig.sticker_number, s_ig.name, ig.rarity, s_ig.thumb_key
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
-- GRANTS (re-aplicar para las que fueron drop+create)
-- ============================================================================

grant execute on function fn_create_album(text, int, text, text, text, text) to authenticated;
grant execute on function fn_update_album_content(uuid, text, int, text, text, text, text) to authenticated;
grant execute on function fn_add_sticker(uuid, int, text, sticker_rarity, text, text, jsonb) to authenticated;
grant execute on function fn_update_sticker(uuid, text, sticker_rarity, text, text, jsonb) to authenticated;
grant execute on function fn_album_matches(uuid, int) to authenticated;
