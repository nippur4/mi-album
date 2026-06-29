-- Mi Álbum de Figuritas — textura por defecto + override por página
--
-- Suma una capa visual encima del color de la hoja pero debajo de las
-- figuritas: puntos / líneas / cuadrícula / etc. Sigue el mismo modelo que
-- el color: una columna para el default + override jsonb por página.
--
-- Las keys de textura se validan en el cliente (PAGE_TEXTURES). Backend
-- solo valida formato general.

alter table albums
  add column page_texture text not null default 'none';

-- Reemplazamos fn_update_album_pages para que acepte texture además de
-- bg_color y overrides. La signature cambia, así que drop + create.
drop function if exists fn_update_album_pages(uuid, text, jsonb);

create or replace function fn_update_album_pages(
  p_album_id uuid,
  p_bg_color text,
  p_texture text,
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

  if jsonb_typeof(p_overrides) <> 'array' then
    raise exception 'invalid_overrides' using errcode = 'P0161';
  end if;

  update albums
    set page_bg_color = p_bg_color,
        page_texture = p_texture,
        page_overrides = p_overrides
    where id = v_album.id;
end;
$$;

grant execute on function fn_update_album_pages(uuid, text, text, jsonb) to authenticated;
