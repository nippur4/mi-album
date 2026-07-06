-- Mi Álbum de Figuritas — avatares desbloqueables via álbum de avatares
--
-- Gimmick: existe un álbum público ("álbum de avatares") cuyas figuritas
-- 1..30 espejan los 30 presets de avatar. Pegaste la figurita N → se te
-- desbloquea el avatar N para el perfil.
--
-- Convención de mapeo: preset_images.sort_order (kind='avatar') ES el número
-- de avatar/figurita. Ya es editable desde el panel admin y además ordena el
-- picker 1→30 naturalmente.
--   - sort_order >= 1 y no está en los libres → gated por figurita pegada.
--   - sort_order en {1, 4, 22}                → libre (los default de todo user).
--   - sort_order <= 0                          → libre (presets legacy sin número).
--
-- Config hardcodeada acá (álbum + libres). Si cambia, nueva migración.
--
-- Errores nuevos:
--   P0180 avatar_locked_<n>

-- ============================================================================
-- 1. fn_update_avatar con gate de desbloqueo (defensa server-side)
-- ============================================================================

create or replace function fn_update_avatar(p_thumb_key text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_preset preset_images;
  c_avatar_album constant uuid := '29a1fa90-85b3-48fc-b452-2b7f64bd327b';
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;

  -- null = volver al avatar default (iniciales+color) — siempre permitido.
  if p_thumb_key is not null then
    select * into v_preset from preset_images
      where thumb_key = p_thumb_key and kind = 'avatar' and active = true;
    if not found then
      raise exception 'invalid_avatar' using errcode = 'P0152';
    end if;

    if v_preset.sort_order >= 1 and v_preset.sort_order not in (1, 4, 22) then
      if not exists (
        select 1
        from user_collection uc
        join stickers s on s.id = uc.sticker_id
        where uc.user_id = v_uid
          and uc.pasted = true
          and s.album_id = c_avatar_album
          and s.number = v_preset.sort_order
      ) then
        raise exception 'avatar_locked_%', v_preset.sort_order using errcode = 'P0180';
      end if;
    end if;
  end if;

  update profiles set avatar_thumb_key = p_thumb_key where id = v_uid;
end;
$$;

grant execute on function fn_update_avatar(text) to authenticated;

-- ============================================================================
-- 2. fn_my_avatar_unlocks — estado de desbloqueo para el picker
-- ============================================================================

-- Devuelve jsonb:
--   {
--     album_id:   uuid del álbum de avatares,
--     album_name: para el copy del picker ("Conseguilo en <name>"),
--     free:       [1,4,22] — números libres para todos,
--     unlocked:   [n, ...] — figuritas del álbum que el caller ya pegó
--   }
create or replace function fn_my_avatar_unlocks()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  c_avatar_album constant uuid := '29a1fa90-85b3-48fc-b452-2b7f64bd327b';
  v_album_name text;
  v_unlocked jsonb;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;

  select name into v_album_name from albums where id = c_avatar_album;

  select coalesce(jsonb_agg(s.number order by s.number), '[]'::jsonb)
    into v_unlocked
  from user_collection uc
  join stickers s on s.id = uc.sticker_id
  where uc.user_id = v_uid
    and uc.pasted = true
    and s.album_id = c_avatar_album;

  return jsonb_build_object(
    'album_id', c_avatar_album,
    'album_name', coalesce(v_album_name, ''),
    'free', jsonb_build_array(1, 4, 22),
    'unlocked', v_unlocked
  );
end;
$$;

grant execute on function fn_my_avatar_unlocks() to authenticated;
