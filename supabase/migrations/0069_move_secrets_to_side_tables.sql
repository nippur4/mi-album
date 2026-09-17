-- Mi Álbum de Figuritas — mover qr_secret y push_token a tablas aparte
--
-- CONTEXTO: la column-level security de la 0066 (revocar SELECT de la columna
-- sensible y re-grantear el resto) ES INCOMPATIBLE con `.select('*')` en ESTE
-- proyecto: PostgREST expande `*` a TODAS las columnas y ejecuta la query como
-- anon/authenticated, que no pueden leer qr_secret/push_token → `42501
-- permission denied for table albums/profiles`. Recargar el schema cache (0067,
-- 0068) NO lo arregla: PostgREST no excluye columnas del `*` por rol acá.
-- Verificado con la API real: `select=*` deniega, `select=col,col` funciona.
-- Rompía TODA pantalla que lee la fila con `select('*')` (detalle de álbum,
-- sobre sin nombre/imagen, "Gestionar", perfil).
--
-- SOLUCIÓN (elegida por el owner): sacar los secretos de las tablas expuestas.
-- qr_secret → private-ish `album_qr_secrets`; push_token → `profile_push_tokens`.
-- Ambas SIN acceso para anon/authenticated (revoke all + RLS sin policies), solo
-- las leen/escriben las Edge Functions (service_role, bypassa RLS) y las RPCs
-- SECURITY DEFINER (corren como owner). Con los secretos fuera, `albums` y
-- `profiles` recuperan el GRANT SELECT de tabla → `select('*')` vuelve a andar
-- sin exponer nada. Esto reemplaza el enfoque de las 0009/0064/0066/0067/0068.
--
-- IMPORTANTE: después de esta migración hay que redeployar las Edge Functions
-- generate_qr y redeem_qr (ahora leen qr_secret de album_qr_secrets, no de
-- albums). Ver supabase/functions/{generate_qr,redeem_qr}/index.ts.

-- ============================================================================
-- 1. Tablas de secretos (sin acceso público)
-- ============================================================================

create table if not exists public.album_qr_secrets (
  album_id  uuid primary key references public.albums(id) on delete cascade,
  qr_secret text not null
);

create table if not exists public.profile_push_tokens (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  push_token text not null
);

-- Cerrar a cal y canto: nadie con anon/authenticated puede tocarlas. RLS activa
-- sin policies = deny-all para esos roles aunque tuvieran grant. El revoke saca
-- el grant por default de Supabase a tablas nuevas de public. service_role
-- (Edge Functions) bypassa RLS y tiene sus grants por default; se los re-afirmo
-- explícito por las dudas. Las RPCs SECURITY DEFINER corren como owner.
alter table public.album_qr_secrets   enable row level security;
alter table public.profile_push_tokens enable row level security;

revoke all on public.album_qr_secrets   from anon, authenticated, public;
revoke all on public.profile_push_tokens from anon, authenticated, public;

grant select, insert, update, delete on public.album_qr_secrets   to service_role;
grant select, insert, update, delete on public.profile_push_tokens to service_role;

-- ============================================================================
-- 2. Migrar los datos existentes
-- ============================================================================

insert into public.album_qr_secrets (album_id, qr_secret)
  select id, qr_secret from public.albums
  where qr_secret is not null and qr_secret <> ''
  on conflict (album_id) do nothing;

insert into public.profile_push_tokens (user_id, push_token)
  select id, push_token from public.profiles
  where push_token is not null and push_token <> ''
  on conflict (user_id) do nothing;

-- ============================================================================
-- 3. Recrear las funciones que leían/escribían las columnas (ANTES del drop)
-- ============================================================================

-- fn_update_album_economy: al habilitar QR por primera vez, asegura que exista
-- el secreto en album_qr_secrets (antes lo generaba en albums.qr_secret).
create or replace function fn_update_album_economy(
  p_album_id uuid,
  p_pack_config jsonb default null,
  p_trade_config jsonb default null
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_album albums := fn_assert_owner(p_album_id);
  v_qr_enabled_now boolean;
  v_qr_enabled_new boolean;
begin
  if v_album.status not in ('draft', 'published') then
    raise exception 'album_economy_locked' using errcode = 'P0040';
  end if;

  if p_pack_config is not null then
    v_qr_enabled_now := coalesce((v_album.pack_config #>> '{qr,enabled}')::boolean, false);
    v_qr_enabled_new := coalesce((p_pack_config #>> '{qr,enabled}')::boolean, false);

    if v_qr_enabled_new and not v_qr_enabled_now then
      if not fn_is_pro(auth.uid()) then
        raise exception 'pro_required' using errcode = 'P0020';
      end if;
      -- Genera el secreto si el álbum aún no tiene (idempotente).
      insert into album_qr_secrets (album_id, qr_secret)
        values (v_album.id, encode(gen_random_bytes(32), 'hex'))
        on conflict (album_id) do nothing;
    end if;

    if coalesce((p_pack_config #>> '{daily,cooldown_hours}')::int, 24) < 1 then
      raise exception 'cooldown_too_low' using errcode = 'P0041';
    end if;
    if coalesce((p_pack_config #>> '{qr,cooldown_hours}')::int, 24) < 1 then
      raise exception 'cooldown_too_low' using errcode = 'P0041';
    end if;
  end if;

  update albums set
    pack_config  = coalesce(p_pack_config, pack_config),
    trade_config = coalesce(p_trade_config, trade_config)
  where id = v_album.id;
end;
$$;

-- fn_rotate_qr_secret: rota el secreto en album_qr_secrets (upsert por si no
-- existiera la fila todavía).
create or replace function fn_rotate_qr_secret(p_album_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_album albums := fn_assert_owner(p_album_id);
begin
  if v_album.status not in ('draft', 'published') then
    raise exception 'album_economy_locked' using errcode = 'P0040';
  end if;
  if not fn_is_pro(auth.uid()) then
    raise exception 'pro_required' using errcode = 'P0020';
  end if;
  if not coalesce((v_album.pack_config #>> '{qr,enabled}')::boolean, false) then
    raise exception 'qr_not_enabled' using errcode = 'P0042';
  end if;

  insert into album_qr_secrets (album_id, qr_secret)
    values (v_album.id, encode(gen_random_bytes(32), 'hex'))
    on conflict (album_id) do update set qr_secret = excluded.qr_secret;
end;
$$;

-- fn_register_push_token: guarda el token en profile_push_tokens (upsert).
create or replace function fn_register_push_token(p_token text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;

  insert into profile_push_tokens (user_id, push_token)
    values (v_uid, p_token)
    on conflict (user_id) do update set push_token = excluded.push_token;
end;
$$;

-- _send_push: lee el token de profile_push_tokens.
create or replace function _send_push(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_token text;
begin
  select push_token into v_token from profile_push_tokens where user_id = p_user_id;
  if v_token is null or v_token = '' then
    return;
  end if;

  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := jsonb_build_object(
      'to', v_token,
      'title', p_title,
      'body', p_body,
      'sound', 'default',
      'data', coalesce(p_data, '{}'::jsonb)
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Accept', 'application/json'
    )
  );
exception when others then
  null;
end;
$$;

-- ============================================================================
-- 4. Dropear las columnas viejas (los datos ya se copiaron)
-- ============================================================================

alter table public.albums   drop column if exists qr_secret;
alter table public.profiles drop column if exists push_token;

-- ============================================================================
-- 5. Restaurar el GRANT SELECT de tabla (ya no hay columnas sensibles)
-- ============================================================================
--
-- Deshace el revoke de las 0066/0067/0068: como qr_secret/push_token ya no son
-- columnas de estas tablas, `select('*')` es seguro. Los grants por columna que
-- dejaron esas migraciones desaparecieron junto con las columnas dropeadas.

grant select on public.albums   to anon, authenticated;
grant select on public.profiles to anon, authenticated;

-- ============================================================================
-- 6. Recargar el schema cache de PostgREST (COMMENT dispara el auto-reload)
-- ============================================================================

comment on table public.albums   is 'Álbumes de figuritas.';
comment on table public.profiles is 'Perfiles de usuario.';
notify pgrst, 'reload schema';
