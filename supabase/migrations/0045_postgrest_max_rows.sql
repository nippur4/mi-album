-- Mi Álbum de Figuritas — subir el tope de filas de PostgREST
--
-- El álbum especial (ecbf4497-e5d7-4732-88a2-75f7b39a2749) tiene 1001
-- figuritas numeradas 0..1000. El default de PostgREST/Supabase es
-- max_rows = 1000: TODA respuesta de listado se corta a 1000 filas.
--
-- Efecto del bug: la query de stickers viene ordenada por número ascendente,
-- así que devolvía 0..999 y descartaba EN SILENCIO la fila número 1000 (la
-- más alta). El cliente veía el slot del 1000 como vacío ("+"), y al intentar
-- cargarlo de nuevo la DB tiraba `23505 duplicate key` porque el 1000 ya
-- existía. Rompía por igual pager/buildPages, matches, apertura de sobres y
-- la colección del jugador para ese álbum.
--
-- Fix sistémico: subir el tope para que quepan las 1001 filas. El cap real de
-- figuritas por álbum sigue siendo 1001 (constraint en 0041), así que 2000 da
-- margen sin exponer payloads grandes.
--
-- Nota: `max_rows` en supabase/config.toml es SOLO para el entorno local; el
-- proyecto hosteado se configura acá, en el GUC del rol authenticator.

alter role authenticator set pgrst.db_max_rows = '2000';

-- Que PostgREST relea su config sin reiniciar.
notify pgrst, 'reload config';
