-- Mi Álbum de Figuritas — gates de suscripción
--
-- Cubre:
--   - fn_enforce_subscription_gates(owner_id): aplica reglas de pro/free a sus álbumes.
--   - fn_subscription_upsert(...): la usa la Edge Function revenuecat_webhook.
--   - fn_enforce_expired_subscriptions(): la corre el cron horario para
--     detectar suscripciones vencidas que RevenueCat no haya notificado todavía.
--
-- Reglas al pasar a free (sub vencida/cancelada):
--   - Conservar el álbum más viejo published. Los demás published → read_only.
--   - Las ofertas pending de los álbumes que entran en read_only → cancelled.
--   - Drafts del owner quedan tal cual.
--   - Los read_only no pierden su pack_config.qr (al volver a pro, vuelven a
--     funcionar; el flag de status='read_only' ya bloqueaba el redeem).
--
-- Reglas al pasar a pro:
--   - Todos los read_only del owner vuelven a published.

-- ============================================================================
-- ENFORCE SUBSCRIPTION GATES
-- ============================================================================

create or replace function fn_enforce_subscription_gates(p_owner_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_is_pro boolean;
  v_first_published uuid;
begin
  v_is_pro := fn_is_pro(p_owner_id);

  if v_is_pro then
    -- Pro restaurado: los read_only del owner vuelven a published.
    update albums
      set status = 'published'
      where owner_id = p_owner_id and status = 'read_only';
    return;
  end if;

  -- Free: conservar el published más viejo.
  select id into v_first_published
    from albums
    where owner_id = p_owner_id and status = 'published'
    order by published_at asc nulls last, created_at asc
    limit 1;

  if v_first_published is null then
    return; -- no hay published, nada que pausar
  end if;

  -- Cancelar trades pending de los álbumes que están por entrar en read_only.
  -- (Importante: este UPDATE corre ANTES del UPDATE de albums; sino el filtro
  -- por status='published' no los encontraría.)
  update trade_offers
    set status = 'cancelled', resolved_at = now()
    where status = 'pending'
      and album_id in (
        select id from albums
        where owner_id = p_owner_id
          and status = 'published'
          and id <> v_first_published
      );

  update albums
    set status = 'read_only'
    where owner_id = p_owner_id
      and status = 'published'
      and id <> v_first_published;
end;
$$;

revoke execute on function fn_enforce_subscription_gates(uuid) from public;

-- ============================================================================
-- SUBSCRIPTION UPSERT (llamada por revenuecat_webhook)
-- ============================================================================

create or replace function fn_subscription_upsert(
  p_user_id uuid,
  p_plan subscription_plan,
  p_status subscription_status,
  p_store subscription_store,
  p_original_transaction_id text,
  p_expires_at timestamptz,
  p_entitlement_id text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into subscriptions (
    user_id, plan, status, store, original_transaction_id, expires_at,
    entitlement_id, updated_at
  ) values (
    p_user_id, p_plan, p_status, p_store, p_original_transaction_id, p_expires_at,
    p_entitlement_id, now()
  )
  on conflict (user_id) do update set
    plan = excluded.plan,
    status = excluded.status,
    store = excluded.store,
    original_transaction_id = excluded.original_transaction_id,
    expires_at = excluded.expires_at,
    entitlement_id = excluded.entitlement_id,
    updated_at = now();

  perform fn_enforce_subscription_gates(p_user_id);
end;
$$;

revoke execute on function fn_subscription_upsert(
  uuid, subscription_plan, subscription_status, subscription_store, text, timestamptz, text
) from public;

-- ============================================================================
-- ENFORCE EXPIRED SUBSCRIPTIONS (cron)
-- ============================================================================

-- Barre suscripciones donde expires_at ya pasó y el status no se actualizó
-- (RevenueCat puede tardar o no notificar). Las marca como expired y reaplica gates.
create or replace function fn_enforce_expired_subscriptions() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_count int := 0;
begin
  for v_user in
    select user_id from subscriptions
    where status in ('active', 'in_grace')
      and expires_at < now()
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
