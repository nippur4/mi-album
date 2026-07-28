-- Mi Álbum de Figuritas — el tope de figuritas del plan free baja a 30
--
-- Antes el free permitía hasta 75 y Pro hasta 1000. Ahora free = 30, Pro = 1000
-- (sin cambios). El álbum especial (number_start=0) sigue con su tope propio
-- de 1001, independiente del tier.
--
-- Recreamos las DOS funciones que validan el tope por tier desde su definición
-- VIVA para no pisar fixes previos:
--   - fn_create_album   → definición viva en 0010 (keys-not-urls).
--   - fn_update_album_content → definición viva en 0041 (rango por number_start).
-- El único cambio en cada una es el literal 75 → 30.
--
-- Nota: los álbumes free existentes con más de 30 figuritas quedan como están
-- (el chequeo solo corre al CREAR o al setear un total nuevo, y editar el total
-- es draft-only). No se achica nada retroactivamente.

-- ============================================================================
-- 1. fn_create_album: tope free 75 → 30
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
  v_max_stickers := case when v_is_pro then 1000 else 30 end;

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

grant execute on function fn_create_album(text, int, text, text, text, text) to authenticated;

-- ============================================================================
-- 2. fn_update_album_content: tope free 75 → 30 (mantiene branch del especial)
-- ============================================================================

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
    -- El álbum especial (numeración 0..1000) admite 1001 sin depender del
    -- tier. Los demás mantienen el cap por tier.
    if v_album.number_start = 0 then
      v_max_stickers := 1001;
    else
      v_is_pro := fn_is_pro(auth.uid());
      v_max_stickers := case when v_is_pro then 1000 else 30 end;
    end if;
    if p_total_stickers < 1 or p_total_stickers > v_max_stickers then
      raise exception 'total_stickers_out_of_range_%', v_max_stickers
        using errcode = 'P0012';
    end if;
    v_new_total := p_total_stickers;
    if exists (
      select 1 from stickers
       where album_id = v_album.id
         and number > v_album.number_start + v_new_total - 1
    ) then
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

grant execute on function fn_update_album_content(uuid, text, int, text, text, text, text) to authenticated;
