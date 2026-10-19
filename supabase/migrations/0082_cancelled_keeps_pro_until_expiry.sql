-- Mi Álbum de Figuritas — cancelar la suscripción ya no saca el Pro al instante
--
-- BUG: `fn_is_pro` (0002) exigía `status in ('active','in_grace')`, dejando
-- afuera a 'cancelled'. Pero el webhook mapea el `CANCELLATION` de Google a ese
-- status, y en Google Play **CANCELLATION significa "apagó la renovación
-- automática", NO "perdió el acceso"**: el usuario conserva el servicio hasta
-- el final del período que ya pagó.
--
-- Resultado: en el instante en que alguien tocaba "cancelar suscripción" en
-- Play, perdía el Pro — y además `fn_subscription_upsert` corría los gates de
-- baja, así que se le pausaban los álbumes y se le cancelaban las ofertas
-- pending. Todo eso con período pago por delante (hasta un mes en producción).
--
-- MEDIDO EN LA PRUEBA E2E (2026-10-19):
--   21:48:39  llega el CANCELLATION → status='cancelled', expires_at=21:49:29
--             (o sea: 50 segundos de período pago TODAVÍA por delante)
--   mismo instante → "Prueba 2" ya figuraba en read_only
--
-- FIX, en dos partes:
--
-- (1) `fn_is_pro` acepta 'cancelled'. El modelo pasa a ser: el **status**
--     describe el estado de la suscripción y **expires_at** describe hasta
--     cuándo hay acceso. Una cancelada con expires_at futuro es Pro; cuando la
--     fecha pasa, deja de serlo por la condición de fecha. Se descartó la
--     alternativa de mapear CANCELLATION → 'active' en el webhook: era más
--     barata pero guardaba una mentira en la base, dejaba muerto el valor
--     'cancelled' del enum y perdía el dato para un futuro "tu suscripción
--     vence el X y no se renueva".
--
-- (2) `fn_enforce_expired_subscriptions` suma 'cancelled' al barrido. Es
--     IMPRESCINDIBLE para que (1) quede completo: al no aplicarse los gates en
--     el momento de cancelar —que es lo que queremos—, si después se perdiera
--     el EXPIRATION nadie degradaría nunca los álbumes de ese owner. El cron es
--     la red de seguridad y antes no miraba las canceladas. Mantiene el margen
--     de gracia de 6h de la 0081: para una cancelada no hay renovación tardía
--     que esperar, pero se deja uniforme por simplicidad y el costo son 6h.
--
-- ESPEJO EN EL CLIENTE: `useIsPro` (client/src/lib/queries/subscriptions.ts)
-- duplica esta condición para no pedir la RPC. Se actualiza en el mismo commit.
-- Si algún día se vuelve a tocar la lista de estados, son DOS lugares.
--
-- NO se toca el índice parcial `idx_subs_active` (0001), cuyo predicado queda
-- desalineado con esta consulta: es redundante, porque `user_id` es la PK de
-- `subscriptions` y el lookup de fn_is_pro va por el índice de la PK.

create or replace function fn_is_pro(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from subscriptions
    where user_id = p_user
      and status in ('active', 'in_grace', 'cancelled')
      and expires_at > now()
  );
$$;

grant execute on function fn_is_pro(uuid) to authenticated;

create or replace function fn_enforce_expired_subscriptions() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_count int := 0;
begin
  for v_user in
    select user_id from subscriptions
    where status in ('active', 'in_grace', 'cancelled')
      and expires_at < now() - interval '6 hours'
  loop
    update subscriptions
      set status = 'expired', updated_at = now()
      where user_id = v_user;
    perform fn_enforce_subscription_gates(v_user);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function fn_enforce_expired_subscriptions() from public;
