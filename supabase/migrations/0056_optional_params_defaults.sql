-- Mi Álbum de Figuritas — default null en params opcionales de 2 RPCs
--
-- fn_admin_update_preset y fn_update_avatar ya trataban NULL como "no tocar"
-- / "volver al default" en el body, pero la firma no declaraba default → el
-- typegen de Supabase los marcaba como requeridos no-nulos y el cliente
-- necesitaba pasar null peleándose con los tipos (parte del baseline de 22
-- errores de typecheck). Con `default null` el typegen los emite opcionales
-- y el cliente puede omitirlos (`?? undefined`) con el mismo resultado.
--
-- Cero cambio de comportamiento: solo defaults. Bodies copiados de las
-- definiciones VIVAS (fn_admin_update_preset: 0017; fn_update_avatar: 0036,
-- la del gate de avatares desbloqueables).

create or replace function fn_admin_update_preset(
  p_id uuid,
  p_name text default null,
  p_sort_order int default null,
  p_active boolean default null
) returns preset_images
language plpgsql security definer set search_path = public as $$
declare
  v_is_admin boolean;
  v_row preset_images;
begin
  select p.is_admin into v_is_admin from profiles p where p.id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'admin_required' using errcode = 'P0070';
  end if;

  update preset_images
  set name = coalesce(p_name, name),
      sort_order = coalesce(p_sort_order, sort_order),
      active = coalesce(p_active, active),
      updated_at = now()
  where id = p_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'preset_not_found' using errcode = 'P0151';
  end if;
  return v_row;
end;
$$;

grant execute on function fn_admin_update_preset(uuid, text, int, boolean) to authenticated;

create or replace function fn_update_avatar(p_thumb_key text default null)
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

    if v_preset.sort_order >= 1 and v_preset.sort_order not in (1, 4, 20, 22) then
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
