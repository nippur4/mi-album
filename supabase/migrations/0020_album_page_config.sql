-- Mi Álbum de Figuritas — color de hoja por álbum + overrides por página
--
-- Hasta acá las hojas eran todas 3×4 con fondo paper cream. Ahora el owner
-- puede:
--   1) elegir un color de fondo de hoja por defecto (paleta predefinida en cliente)
--   2) overridear color y/o layout por página individual
--
-- page_bg_color: key del paleta del cliente (string corto, ej: 'paper', 'mint').
-- page_overrides: array de { page: int (0-indexed), color?: string, layout?: string }.
-- El cliente valida los enums; el backend solo valida formato general.

alter table albums
  add column page_bg_color text not null default 'paper',
  add column page_overrides jsonb not null default '[]'::jsonb;

create or replace function fn_update_album_pages(
  p_album_id uuid,
  p_bg_color text,
  p_overrides jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_album albums := fn_assert_owner(p_album_id);
begin
  -- Editable tanto en draft como published (no afecta la lógica del juego,
  -- solo la presentación).
  if v_album.status not in ('draft', 'published') then
    raise exception 'album_economy_locked' using errcode = 'P0040';
  end if;

  if p_bg_color is null or char_length(p_bg_color) > 30 then
    raise exception 'invalid_color' using errcode = 'P0160';
  end if;

  if jsonb_typeof(p_overrides) <> 'array' then
    raise exception 'invalid_overrides' using errcode = 'P0161';
  end if;

  update albums
    set page_bg_color = p_bg_color,
        page_overrides = p_overrides
    where id = v_album.id;
end;
$$;

grant execute on function fn_update_album_pages(uuid, text, jsonb) to authenticated;
