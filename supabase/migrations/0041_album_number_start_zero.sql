-- Mi Álbum de Figuritas — álbum especial con numeración desde 0
--
-- El álbum ecbf4497-e5d7-4732-88a2-75f7b39a2749 tiene 1001 figuritas
-- numeradas 0..1000 (las imágenes ya generadas usan esos números). Es LA
-- única excepción a la numeración 1..N.
--
-- Modelado genérico para no hardcodear el id en cada función:
--   albums.number_start (0 o 1, default 1). Números válidos de un álbum:
--   number_start .. number_start + total_stickers - 1.
--
-- Solo esta migración setea number_start=0 (no hay UI para cambiarlo — la
-- excepción se administra por SQL a propósito).

-- ============================================================================
-- 1. Constraints
-- ============================================================================

-- stickers.number ahora puede ser 0 (el rango real lo validan las RPCs
-- por álbum via number_start).
alter table stickers drop constraint stickers_number_check;
alter table stickers add constraint stickers_number_check check (number >= 0);

-- El tope absoluto de la tabla sube a 1001 (el especial: 0..1000).
alter table albums drop constraint albums_total_stickers_check;
alter table albums add constraint albums_total_stickers_check
  check (total_stickers between 1 and 1001);

alter table albums
  add column if not exists number_start integer not null default 1
  check (number_start in (0, 1));

-- ============================================================================
-- 2. Data: el álbum especial
-- ============================================================================

update albums
   set number_start = 0,
       total_stickers = 1001
 where id = 'ecbf4497-e5d7-4732-88a2-75f7b39a2749';

-- ============================================================================
-- 3. fn_add_sticker: rango según number_start
-- ============================================================================

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
  if p_number < v_album.number_start
     or p_number > v_album.number_start + v_album.total_stickers - 1 then
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

grant execute on function fn_add_sticker(uuid, int, text, sticker_rarity, text, text, jsonb) to authenticated;

-- ============================================================================
-- 4. fn_update_album_content: cap y mínimo según number_start
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
      v_max_stickers := case when v_is_pro then 1000 else 75 end;
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

-- ============================================================================
-- 5. fn_swap_sticker_positions: rango según number_start
-- ============================================================================

create or replace function fn_swap_sticker_positions(
  p_album_id uuid,
  p_number_a int,
  p_number_b int
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_album albums;
  v_a stickers;
  v_b stickers;
  v_temp int;
begin
  v_album := fn_assert_owner(p_album_id);
  if v_album.status <> 'draft' then
    raise exception 'album_not_draft' using errcode = 'P0030';
  end if;

  if p_number_a = p_number_b then
    raise exception 'same_position' using errcode = 'P0170';
  end if;
  if p_number_a < v_album.number_start
     or p_number_a > v_album.number_start + v_album.total_stickers - 1
     or p_number_b < v_album.number_start
     or p_number_b > v_album.number_start + v_album.total_stickers - 1 then
    raise exception 'number_out_of_range' using errcode = 'P0171';
  end if;

  select * into v_a from stickers
    where album_id = p_album_id and number = p_number_a;
  select * into v_b from stickers
    where album_id = p_album_id and number = p_number_b;

  if v_a.id is null and v_b.id is null then
    raise exception 'sticker_not_found' using errcode = 'P0052';
  end if;

  if v_a.id is not null and v_b.id is not null then
    select coalesce(max(number), 0) + 1 into v_temp
      from stickers where album_id = p_album_id;
    update stickers set number = v_temp      where id = v_a.id;
    update stickers set number = p_number_a  where id = v_b.id;
    update stickers set number = p_number_b  where id = v_a.id;
  elsif v_a.id is not null then
    update stickers set number = p_number_b where id = v_a.id;
  else
    update stickers set number = p_number_a where id = v_b.id;
  end if;
end;
$$;

grant execute on function fn_swap_sticker_positions(uuid, int, int) to authenticated;
