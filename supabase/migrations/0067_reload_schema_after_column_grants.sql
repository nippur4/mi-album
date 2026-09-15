-- Mi Álbum de Figuritas — FIX: recargar el schema cache de PostgREST tras 0066
--
-- SÍNTOMA: crear un álbum funcionaba (fn_create_album es SECURITY DEFINER, el
-- INSERT corre como owner) pero el cliente tiraba "permission denied for table
-- albums" y el owner no veía sus álbumes. La pantalla "Gestionar"
-- (useMyOwnedAlbums) lista con `.from('albums').select('*')` como authenticated.
--
-- CAUSA: la 0066 hizo `revoke select on albums` + re-grant columna por columna
-- (todo menos qr_secret) y cerró con `notify pgrst, 'reload config'`. A nivel
-- DB los grants quedaron CORRECTOS (has_column_privilege lo confirma), PERO
-- `reload config` NO recarga el SCHEMA CACHE de PostgREST. PostgREST expande
-- `select=*` según las columnas que su cache cree accesibles: con el cache viejo
-- (previo al revoke) seguía incluyendo qr_secret en el SELECT → Postgres, al
-- correr como authenticated (que ya no tiene esa columna), devolvía
-- "permission denied for table albums". Y como GRANT/REVOKE no disparan el
-- event trigger `ddl_command_end` que Supabase usa para auto-recargar, el cache
-- quedó tildado indefinidamente.
--
-- FIX: `notify pgrst, 'reload schema'` recarga el cache completo al estado real
-- de los privilegios → `select=*` pasa a excluir qr_secret/push_token solo, sin
-- tocar el cliente. Re-afirmamos los grants de forma idempotente por las dudas
-- de que en el remoto alguno no hubiera quedado (no cuesta nada si ya están).
--
-- LECCIÓN: cualquier migración que cambie GRANT/REVOKE de columnas en tablas
-- expuestas a PostgREST debe terminar con `notify pgrst, 'reload schema'`
-- (NO 'reload config', que solo relee variables de configuración). Verificar el
-- fix con la API real (crear/leer), no solo con has_column_privilege.

do $$
declare
  col text;
begin
  -- profiles: exponer todo MENOS push_token (idempotente)
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

  -- albums: exponer todo MENOS qr_secret (idempotente)
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

-- LA LÍNEA QUE FALTABA EN 0066: recarga el schema cache, no solo la config.
notify pgrst, 'reload schema';
