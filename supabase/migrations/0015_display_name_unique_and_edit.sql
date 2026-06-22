-- display_name único (case-insensitive) + RPC para editarlo + trigger de signup
-- robusto a colisiones.

-- 1. Índice único case-insensitive sobre display_name.
--    Si ya hay duplicados, esto falla. Como recién arrancamos no debería haber.
create unique index if not exists profiles_display_name_lower_idx
  on profiles (lower(display_name));

-- 2. Trigger de signup: si el display_name del meta colisiona, le agregamos
--    sufijo numérico (luego random) hasta encontrar uno libre.
create or replace function fn_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_base text;
  v_candidate text;
  v_attempt int := 0;
begin
  v_base := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    split_part(new.email, '@', 1)
  );
  v_candidate := v_base;
  while exists (select 1 from profiles where lower(display_name) = lower(v_candidate)) loop
    v_attempt := v_attempt + 1;
    if v_attempt > 10 then
      -- fallback con sufijo random para no quedarse colgado
      v_candidate := v_base || '-' || substr(md5(random()::text), 1, 6);
      exit;
    end if;
    v_candidate := v_base || v_attempt::text;
  end loop;
  insert into profiles (id, display_name) values (new.id, v_candidate);
  return new;
end;
$$;

-- 3. RPC para que el user edite su propio display_name con validaciones.
create or replace function fn_update_display_name(p_new_name text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_trimmed text;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;
  v_trimmed := trim(p_new_name);
  if length(v_trimmed) < 2 then
    raise exception 'display_name_too_short' using errcode = 'P0140';
  end if;
  if length(v_trimmed) > 40 then
    raise exception 'display_name_too_long' using errcode = 'P0141';
  end if;
  -- letras, números, espacios y un par de chars amistosos
  if v_trimmed !~ '^[A-Za-z0-9 _.\-]+$' then
    raise exception 'display_name_invalid_chars' using errcode = 'P0142';
  end if;
  -- Si es el mismo (case-insensitive), no-op
  if exists (
    select 1 from profiles
    where profiles.id = v_uid and lower(profiles.display_name) = lower(v_trimmed)
  ) then
    return;
  end if;
  -- Validar que no esté tomado por otro
  if exists (
    select 1 from profiles
    where profiles.id <> v_uid and lower(profiles.display_name) = lower(v_trimmed)
  ) then
    raise exception 'display_name_taken' using errcode = 'P0143';
  end if;
  update profiles set display_name = v_trimmed where profiles.id = v_uid;
end;
$$;

grant execute on function fn_update_display_name(text) to authenticated;
