-- Mi Álbum de Figuritas — column-level security para albums.qr_secret
--
-- RLS es row-level: un miembro del álbum podría hacer `select qr_secret from
-- albums where id = ...` y leerlo. qr_secret es la clave HMAC del QR de sobres,
-- así que el cliente NUNCA debe verlo. Las únicas vías legítimas son:
--   - generate_qr (futura Edge Function del owner): usa service_role.
--   - redeem_qr Edge Function: usa service_role.
--
-- Por eso revocamos SELECT del column específicamente para los roles que el
-- cliente usa (anon y authenticated). Las RPCs SECURITY DEFINER siguen
-- pudiendo leerlo porque corren como postgres.

revoke select (qr_secret) on albums from anon;
revoke select (qr_secret) on albums from authenticated;
