-- Mi Álbum de Figuritas — cron jobs (pg_cron)
--
-- REQUISITO: la extensión pg_cron debe estar habilitada en el proyecto Supabase.
-- En Supabase Cloud: Dashboard → Database → Extensions → habilitar "pg_cron".
-- Esta migración asume que ya está habilitada (no se puede instalar como user normal).
--
-- Los jobs corren en el role postgres con search_path = public.

-- ============================================================================
-- EXPIRE PENDING OFFERS
-- ============================================================================
-- Las ofertas pending superan su expires_at (default 7 días) → status='expired'.
-- Corre cada hora a los minutos :00.

select cron.schedule(
  'expire-pending-offers',
  '0 * * * *',
  $$
    update public.trade_offers
      set status = 'expired', resolved_at = now()
      where status = 'pending' and expires_at < now();
  $$
);

-- ============================================================================
-- ENFORCE EXPIRED SUBSCRIPTIONS
-- ============================================================================
-- RevenueCat normalmente notifica vía webhook, pero si el webhook falla o se
-- atrasa, este job barre suscripciones con expires_at vencido y aplica gates.
-- Corre cada hora a los :15 (offset del job anterior).

select cron.schedule(
  'enforce-expired-subs',
  '15 * * * *',
  $$ select public.fn_enforce_expired_subscriptions(); $$
);
