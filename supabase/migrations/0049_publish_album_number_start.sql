-- Mi Álbum de Figuritas — fn_publish_album respeta number_start
--
-- La 0041 introdujo albums.number_start (0 para el álbum especial 0..1000) y
-- actualizó fn_add_sticker / fn_update_album_content / fn_swap_sticker_positions,
-- pero SE OLVIDÓ de fn_publish_album: su chequeo de integridad de numeración
-- usaba generate_series(1, total_stickers) = 1..1001 para el especial, así que
-- creía que faltaba el número 1001 (P0063 sticker_number_missing_1001) cuando en
-- realidad los números válidos son 0..1000.
--
-- Fix: el rango de la validación va de number_start a number_start+total-1.
-- El resto de la función queda idéntico (chequeos de cover/pack/count).

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

  -- Rango real de números según number_start (0..total-1 para el especial,
  -- 1..total para el resto).
  select min(g.n) into v_missing
  from generate_series(
    v_album.number_start,
    v_album.number_start + v_album.total_stickers - 1
  ) g(n)
  where not exists (select 1 from stickers s where s.album_id = v_album.id and s.number = g.n);
  if v_missing is not null then
    raise exception 'sticker_number_missing_%', v_missing using errcode = 'P0063';
  end if;

  update albums
    set status = 'published', published_at = now()
    where id = v_album.id;
end;
$$;

grant execute on function fn_publish_album(uuid) to authenticated;
