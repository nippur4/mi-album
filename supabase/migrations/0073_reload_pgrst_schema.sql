-- Mi Álbum de Figuritas — forzar reload del schema cache de PostgREST.
--
-- Las migraciones 0070 y 0072 hicieron DDL (alter table preset_images/albums,
-- create table user_blocks/album_reports, recreate fn_home_bundle) sin un reload
-- explícito. Este proyecto ya tuvo el bug de "permission denied for table X" por
-- cache tildado de PostgREST (ver 0067/0068). Esto lo fuerza a refrescar, por si
-- quedó inconsistente. Es idempotente y no toca datos.
notify pgrst, 'reload schema';
