-- Mi Álbum de Figuritas — FIX: forzar el reload del schema cache de PostgREST
--
-- SÍNTOMA (post-0066/0067): el cliente hace `.select('*')` sobre `albums` y
-- `profiles` y recibe `42501 permission denied for table albums/profiles`.
-- Reproducible con la anon key: `select=*` falla, pero pedir columnas
-- explícitas (`select=id,name,...`) funciona. Las figuritas se ven porque
-- vienen de RPCs/Edge Functions (SECURITY DEFINER / service_role, bypassean
-- grants), pero TODA pantalla que lee la fila del álbum o el perfil con
-- `select('*')` queda rota (detalle de álbum, sobre sin nombre/imagen, etc.).
--
-- CAUSA: PostgREST expande `select=*` a las columnas que su SCHEMA CACHE cree
-- accesibles para el rol. La 0066 revocó el SELECT de tabla y re-granteó todas
-- las columnas MENOS la sensible (qr_secret / push_token); mientras el cache
-- esté tildado, `*` sigue incluyendo la columna revocada → Postgres deniega la
-- query entera. La 0067 intentó arreglarlo con `notify pgrst, 'reload schema'`,
-- pero el NOTIFY NO surtió efecto (la conexión LISTEN de PostgREST puede
-- perderse durante el apply de migraciones, o el notify se pierde). Verificado:
-- 0067 figura aplicada en remoto y aun así `select=*` sigue denegado.
--
-- FIX: recargar el cache por DOS vías redundantes para que esta vez sí tome:
--   1. Re-afirmar los grants por columna (idempotente) por si alguno faltara.
--   2. `COMMENT ON TABLE`: es un DDL REAL que dispara el event trigger
--      `ddl_command_end`; Supabase engancha ahí `pgrst_ddl_watch`, que hace el
--      pg_notify de reload automáticamente. GRANT/REVOKE NO disparan ese
--      trigger (por eso 0066/0067 dependían del notify manual, más frágil).
--   3. `notify pgrst, 'reload schema'` explícito como respaldo.
--
-- LECCIÓN: para invalidar el cache de PostgREST tras cambios de privilegios,
-- no confíes solo en el `notify` manual — sumá un DDL neutro (COMMENT) que
-- dispare el auto-reload de Supabase. Verificá SIEMPRE con la API real
-- (`select=*`), no solo con `has_column_privilege`.

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

-- Disparar el event trigger de auto-reload de PostgREST (COMMENT = DDL real).
comment on table public.albums is 'Álbumes de figuritas (column security: qr_secret oculto a anon/authenticated).';
comment on table public.profiles is 'Perfiles de usuario (column security: push_token oculto a anon/authenticated).';

-- Respaldo explícito por si el event trigger no estuviera activo.
notify pgrst, 'reload schema';
