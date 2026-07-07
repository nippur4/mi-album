-- Mi Álbum de Figuritas — composición (grilla) por defecto del álbum
--
-- Hasta ahora el layout default era 3x4 fijo y solo se podía cambiar hoja
-- por hoja. Mismo modelo que color/textura/tamaño: default a nivel álbum
-- + override por hoja. Keys de PAGE_LAYOUTS del cliente ('3x4', '2x3'...).

alter table albums
  add column page_layout text not null default '3x4';

-- La signature cambia otra vez: drop + create (+ re-grant).
drop function if exists fn_update_album_pages(uuid, text, text, text, jsonb);

create or replace function fn_update_album_pages(
  p_album_id uuid,
  p_bg_color text,
  p_texture text,
  p_cell_aspect text,
  p_layout text,
  p_overrides jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_album albums := fn_assert_owner(p_album_id);
begin
  if v_album.status not in ('draft', 'published') then
    raise exception 'album_economy_locked' using errcode = 'P0040';
  end if;

  if p_bg_color is null or char_length(p_bg_color) > 30 then
    raise exception 'invalid_color' using errcode = 'P0160';
  end if;

  if p_texture is null or char_length(p_texture) > 30 then
    raise exception 'invalid_texture' using errcode = 'P0162';
  end if;

  if p_cell_aspect is null or char_length(p_cell_aspect) > 30 then
    raise exception 'invalid_cell_aspect' using errcode = 'P0163';
  end if;

  if p_layout is null or char_length(p_layout) > 30 then
    raise exception 'invalid_layout' using errcode = 'P0164';
  end if;

  if jsonb_typeof(p_overrides) <> 'array' then
    raise exception 'invalid_overrides' using errcode = 'P0161';
  end if;

  update albums
    set page_bg_color = p_bg_color,
        page_texture = p_texture,
        page_cell_aspect = p_cell_aspect,
        page_layout = p_layout,
        page_overrides = p_overrides
    where id = v_album.id;
end;
$$;

grant execute on function fn_update_album_pages(uuid, text, text, text, text, jsonb) to authenticated;
