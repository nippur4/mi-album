-- Mi Álbum de Figuritas — Pro permanente para la cuenta de revisión de Google Play.
--
-- El revisor de Play necesita ver las funciones Pro. Le damos una suscripción
-- "manual" con expires_at lejano. NO viene de RevenueCat: el webhook nunca la
-- toca porque esta cuenta no tiene compras reales. Es Pro, NO admin.
--
-- Idempotente (on conflict do update). Si la cuenta todavía no existe (nunca se
-- logueó), la migración FALLA a propósito para poder re-aplicarla después de
-- crear la cuenta — así no queda registrada a medias.
--
-- Revocar en el futuro:
--   update subscriptions set status='cancelled'
--    where user_id = (select id from auth.users where lower(email)='miapp.beta@yahoo.com');

do $$
declare
  v_uid uuid;
begin
  select id into v_uid
    from auth.users
   where lower(email) = 'miapp.beta@yahoo.com'
   limit 1;

  if v_uid is null then
    raise exception
      'La cuenta miapp.beta@yahoo.com no existe todavía. Logueate una vez con ese mail y volvé a aplicar la migración.';
  end if;

  insert into subscriptions (
    user_id, plan, status, provider, entitlement_id, store,
    original_transaction_id, expires_at, updated_at
  ) values (
    v_uid, 'annual', 'active', 'manual', 'pro', 'play_store',
    'manual-review-' || v_uid::text, '2099-12-31T00:00:00Z'::timestamptz, now()
  )
  on conflict (user_id) do update set
    status      = 'active',
    expires_at  = '2099-12-31T00:00:00Z'::timestamptz,
    provider    = 'manual',
    entitlement_id = 'pro',
    updated_at  = now();
end $$;
