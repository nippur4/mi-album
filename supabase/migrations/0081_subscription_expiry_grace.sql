-- Mi Álbum de Figuritas — margen de gracia antes de dar por vencida una suscripción
--
-- `fn_enforce_expired_subscriptions` (cron horario, :15) es la red de seguridad
-- para cuando RevenueCat no notifica un vencimiento. Barría TODA fila con
-- `expires_at < now()` y status activo, sin ningún margen. El problema es que no
-- distingue "se dio de baja" de "la renovación todavía no llegó".
--
-- OBSERVADO EN LA PRUEBA E2E (2026-10-19), con RTDN de Google sin configurar:
--
--   19:01:06  vence el período pago
--   19:01→19:12  el usuario ya no es Pro para fn_is_pro, aunque Google ya cobró
--   19:12:12  recién ahí RevenueCat se pone al día y manda la renovación
--             (llegó de golpe con 3 ciclos juntos: expires_at saltó +15 min)
--   19:15:00  corre el cron
--
-- O sea: la renovación le ganó al cron por 2m48s. Si hubiera tardado tres
-- minutos más, a un suscriptor al día se le habrían aplicado los gates de baja.
--
-- Y esos gates no son todos reversibles. Los álbumes vuelven solos a published
-- cuando el Pro se restablece (`fn_enforce_subscription_gates`), pero las
-- ofertas pending que se cancelan en el camino NO se recuperan nunca. Una
-- demora de notificación le borraría intercambios en curso a alguien que pagó.
--
-- FIX: exigir que el vencimiento tenga al menos 6 horas de antigüedad. Cubre de
-- sobra cualquier demora razonable de RevenueCat (incluso sin RTDN, donde la
-- sincronización depende de polling o de que el usuario abra la app) y sigue
-- cortando a quien realmente se dio de baja: el atraso máximo pasa a ser de 6h
-- más la hora del cron.
--
-- Aplica igual a 'active' y a 'in_grace'. El segundo es BILLING_ISSUE —
-- Google reintentando el cobro—, que con más razón no conviene matar temprano.
--
-- OJO, lo que esto NO arregla: `fn_is_pro` sigue pidiendo `expires_at > now()`,
-- así que durante la demora el usuario igual pierde los beneficios Pro en la
-- app (en el caso de arriba, 11 minutos). Eso es una decisión de producto
-- aparte — darle gracia a fn_is_pro significa regalarle Pro unas horas a quien
-- sí se dio de baja, y además habría que espejar el cambio en `useIsPro`
-- (client/src/lib/queries/subscriptions.ts), que duplica la condición.
-- El arreglo de fondo para la demora es configurar las RTDN de Google.
--
-- Margen en un solo lugar: un único caller, así que va inline. Si algún día hay
-- más de uno, extraer un helper como `_fn_daily_interval` (0040/0077/0078).

create or replace function fn_enforce_expired_subscriptions() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_count int := 0;
begin
  for v_user in
    select user_id from subscriptions
    where status in ('active', 'in_grace')
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

-- `create or replace` conserva los privilegios, así que el revoke de 0007 sigue
-- en pie; lo repetimos igual para que la intención quede explícita.
revoke execute on function fn_enforce_expired_subscriptions() from public;
