-- Mi Álbum de Figuritas — FIX REAL de column-level security
--
-- Las migraciones 0009 (albums.qr_secret) y 0064 (profiles.push_token) fueron
-- INEFECTIVAS. Verificado en remoto con has_column_privilege → seguían en TRUE.
--
-- Causa: `revoke select (columna)` NO pisa el grant de SELECT a nivel TABLA que
-- Supabase le da por default a anon/authenticated sobre las tablas de public.
-- El grant de tabla cubre todas las columnas; revocar una suelta no lo resta.
-- Resultado: qr_secret (clave HMAC de los QR de sobres) y push_token viajaban
-- al cliente en cada `select('*')` y eran legibles con la anon key pública.
--
-- Patrón correcto: REVOCAR el SELECT de tabla y volver a GRANTEAR todas las
-- columnas MENOS la sensible. PostgREST respeta los privilegios de columna:
-- `select=*` devuelve solo las columnas permitidas, así que el cliente sigue
-- usando `.select('*')` sin cambios. Las Edge Functions leen qr_secret con
-- service_role (bypasea estos grants) y las RPCs SECURITY DEFINER corren como
-- owner → ninguna vía legítima se rompe.
--
-- ⚠️ CONVENCIÓN NUEVA: profiles y albums YA NO tienen grant de SELECT a nivel
-- tabla para anon/authenticated. Toda columna que se agregue a estas tablas en
-- el futuro necesita, en la MISMA migración:
--     grant select (nueva_col) on <tabla> to anon, authenticated;
-- o quedará invisible para el cliente (select=* la omite silenciosamente).

do $$
declare
  col text;
begin
  -- profiles: exponer todo MENOS push_token
  execute 'revoke select on profiles from anon, authenticated';
  for col in
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name <> 'push_token'
  loop
    execute format('grant select (%I) on profiles to anon, authenticated', col);
  end loop;

  -- albums: exponer todo MENOS qr_secret
  execute 'revoke select on albums from anon, authenticated';
  for col in
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'albums'
      and column_name <> 'qr_secret'
  loop
    execute format('grant select (%I) on albums to anon, authenticated', col);
  end loop;
end $$;

notify pgrst, 'reload config';
