-- Mi Álbum de Figuritas — asignar un avatar por defecto a los usuarios nuevos
--
-- Antes fn_handle_new_user creaba el perfil solo con display_name (avatar null →
-- fallback a iniciales+color). Ahora, si hay presets de avatar libres cargados,
-- le asigna uno AL AZAR de los libres iniciales ({1,4,20,22} por sort_order),
-- para que arranque con una imagen en vez de iniciales.
--
-- Best-effort: si no hay presets libres activos (setup admin incompleto), queda
-- null y sigue el fallback. NUNCA debe romper el signup.

create or replace function fn_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_avatar_key text;
begin
  -- Un avatar libre al azar (mismo set que fn_update_avatar: 1,4,20,22).
  select thumb_key into v_avatar_key
  from preset_images
  where kind = 'avatar' and active = true and sort_order in (1, 4, 20, 22)
  order by random()
  limit 1;

  insert into profiles (id, display_name, avatar_thumb_key)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    v_avatar_key
  );
  return new;
end;
$$;
