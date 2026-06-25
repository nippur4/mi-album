-- Mi Álbum de Figuritas — avatares de perfil desde plantillas admin
--
-- Decisión clave: los usuarios NO suben imágenes propias (riesgo de contenido
-- inadecuado). El admin gestiona una galería de avatares en preset_images con
-- kind='avatar' (1:1) y el user elige una. El default es el avatar derivado
-- de iniciales+color (queda con avatar_thumb_key=null).

-- 1) Sumar 'avatar' al CHECK de kind de preset_images
alter table preset_images drop constraint preset_images_kind_check;
alter table preset_images
  add constraint preset_images_kind_check check (kind in ('cover','pack','avatar'));

-- 1b) Replicar en el check duplicado de fn_admin_create_preset (la tabla ya
--     valida, pero la RPC tenía su propio in-list que rechazaba 'avatar').
create or replace function fn_admin_create_preset(
  p_id uuid,
  p_kind text,
  p_name text,
  p_thumb_key text,
  p_large_key text,
  p_sort_order int default 0
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
  if p_kind not in ('cover','pack','avatar') then
    raise exception 'invalid_kind' using errcode = 'P0150';
  end if;

  insert into preset_images (id, kind, name, thumb_key, large_key, sort_order, created_by)
  values (p_id, p_kind, p_name, p_thumb_key, p_large_key, coalesce(p_sort_order, 0), auth.uid())
  returning * into v_row;
  return v_row;
end;
$$;

grant execute on function fn_admin_create_preset(uuid, text, text, text, text, int) to authenticated;

-- 2) Columna en profiles. Null = avatar default (iniciales+hash).
alter table profiles add column avatar_thumb_key text;

-- 3) RPC para que el user setee/limpie su avatar. Valida que la key pertenezca
--    a un preset admin activo de kind 'avatar' (evita inyectar keys arbitrarias
--    apuntando a imágenes ajenas o no aprobadas).
create or replace function fn_update_avatar(p_thumb_key text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;

  if p_thumb_key is not null and not exists (
    select 1 from preset_images
    where thumb_key = p_thumb_key and kind = 'avatar' and active = true
  ) then
    raise exception 'invalid_avatar' using errcode = 'P0152';
  end if;

  update profiles set avatar_thumb_key = p_thumb_key where id = auth.uid();
end;
$$;

grant execute on function fn_update_avatar(text) to authenticated;
