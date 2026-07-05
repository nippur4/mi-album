-- Mi Álbum de Figuritas — intercambiar posición de dos figuritas (owner, draft)
--
-- El owner puede tocar "Reordenar" en la grilla y elegir dos casilleros:
--   - ambos ocupados  → swap de números
--   - destino vacío   → move (la figurita cambia de número)
--
-- Mismas reglas que el resto de la edición de contenido: solo el owner y solo
-- en draft (publicado = inmutable). Atómico: la unique (album_id, number)
-- obliga a pasar por un número temporal libre dentro de la transacción.
--
-- Errores:
--   P0010 auth_required (via fn_assert_owner)
--   P0030 album_not_draft
--   P0170 same_position
--   P0171 number_out_of_range
--   P0052 sticker_not_found (ninguna de las dos posiciones tiene figurita)

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
  if p_number_a < 1 or p_number_a > v_album.total_stickers
     or p_number_b < 1 or p_number_b > v_album.total_stickers then
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
    -- Swap: A pasa por un número temporal libre para no chocar con la unique.
    select coalesce(max(number), 0) + 1 into v_temp
      from stickers where album_id = p_album_id;
    update stickers set number = v_temp      where id = v_a.id;
    update stickers set number = p_number_a  where id = v_b.id;
    update stickers set number = p_number_b  where id = v_a.id;
  elsif v_a.id is not null then
    -- Move: destino vacío.
    update stickers set number = p_number_b where id = v_a.id;
  else
    update stickers set number = p_number_a where id = v_b.id;
  end if;
end;
$$;

grant execute on function fn_swap_sticker_positions(uuid, int, int) to authenticated;
