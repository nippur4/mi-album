-- Mi Álbum de Figuritas — admin custom presets para carátula y sobre
--
-- Los gradientes hardcoded (lib/presets.ts) siguen disponibles. Esto suma
-- imágenes subidas por admin como opciones adicionales en el picker, por
-- kind ('cover' 4:5, 'pack' 3:4). Cuando el owner elige uno, las keys reales
-- de R2 se copian al álbum (no se referencia el preset por id), así si admin
-- desactiva un preset los álbumes que lo usaron siguen renderizando.

create table preset_images (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('cover','pack')),
  name text not null check (char_length(name) between 1 and 60),
  thumb_key text not null,
  large_key text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index preset_images_kind_active_idx
  on preset_images (kind, active, sort_order);

alter table preset_images enable row level security;

-- Cualquier authenticated puede leer las activas (lo usa el preset picker).
create policy preset_images_select_active
  on preset_images for select
  to authenticated
  using (active = true);

-- Insert/update/delete solo via RPCs SECURITY DEFINER (sin policies = bloqueado).

-- =========================================================================
-- RPCs admin
-- =========================================================================

create or replace function fn_admin_list_presets()
returns setof preset_images
language plpgsql stable security definer set search_path = public as $$
declare
  v_is_admin boolean;
begin
  select p.is_admin into v_is_admin from profiles p where p.id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'admin_required' using errcode = 'P0070';
  end if;
  return query
    select * from preset_images
    order by kind, sort_order, created_at desc;
end;
$$;

grant execute on function fn_admin_list_presets() to authenticated;

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
  if p_kind not in ('cover','pack') then
    raise exception 'invalid_kind' using errcode = 'P0150';
  end if;

  insert into preset_images (id, kind, name, thumb_key, large_key, sort_order, created_by)
  values (p_id, p_kind, p_name, p_thumb_key, p_large_key, coalesce(p_sort_order, 0), auth.uid())
  returning * into v_row;
  return v_row;
end;
$$;

grant execute on function fn_admin_create_preset(uuid, text, text, text, text, int) to authenticated;

create or replace function fn_admin_update_preset(
  p_id uuid,
  p_name text,
  p_sort_order int,
  p_active boolean
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

create or replace function fn_admin_delete_preset(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_is_admin boolean;
begin
  select p.is_admin into v_is_admin from profiles p where p.id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'admin_required' using errcode = 'P0070';
  end if;

  delete from preset_images where id = p_id;
end;
$$;

grant execute on function fn_admin_delete_preset(uuid) to authenticated;
