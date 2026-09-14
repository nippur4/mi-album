-- Mi Álbum de Figuritas — column-level security para profiles.push_token
--
-- La policy `profiles_select using (true)` (0001) hace TODA la tabla profiles
-- legible por cualquiera (display_name y avatar son públicos a propósito: los
-- usan las ofertas de trade, el owner del álbum, etc.). Pero `push_token` es
-- el Expo/FCM push token del usuario — dato personal que NUNCA debe viajar al
-- cliente: cualquier usuario autenticado (o anon con la anon key pública)
-- podía `select push_token from profiles` y cosechar los tokens de todos.
--
-- El token solo se ESCRIBE vía `fn_register_push_token` y solo lo LEE
-- `_send_push` (ambas SECURITY DEFINER, corren como postgres). El cliente nunca
-- lo lee. Mismo patrón que albums.qr_secret (migración 0009).
--
-- Nota: PostgREST expande `select=*` a las columnas que el rol puede ver, así
-- que las lecturas con `.select('*')` siguen funcionando (ya sin push_token).
-- La única lectura explícita de profiles del cliente pide
-- `id, display_name, avatar_url, avatar_thumb_key, is_admin` — no toca esta col.

revoke select (push_token) on profiles from anon;
revoke select (push_token) on profiles from authenticated;
