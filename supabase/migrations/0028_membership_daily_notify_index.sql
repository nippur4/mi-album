-- Mi Álbum de Figuritas — índice para el cron de sobre diario
--
-- El cron `_cron_notify_daily_available` (migración 0027) corre cada 15 min
-- y hace un scan sobre user_album_membership filtrando por:
--   - daily_notified_at is null
--   - hidden = false
--   - + join con albums donde status='published' y pack_config.daily.enabled=true
--
-- La PK de user_album_membership es (user_id, album_id): sirve para lookups
-- por user pero no para este barrido por album_id (el join con albums lo
-- necesita) filtrado por candidatos a notificar.
--
-- Sin índice, seq scan de la tabla completa cada 15 min. Este índice
-- parcial mantiene indexadas SOLO las filas candidatas — es liviano
-- (muchas memberships van a estar "ya notificadas" o "hidden").

create index if not exists idx_membership_daily_notify_pending
  on user_album_membership(album_id)
  where daily_notified_at is null and hidden = false;
