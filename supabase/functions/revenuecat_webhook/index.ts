// Mi Álbum de Figuritas — Edge Function: webhook de RevenueCat
//
// Recibe eventos de RevenueCat, valida la auth, mapea al modelo de subscriptions
// y delega a fn_subscription_upsert (migración 0007), que también dispara
// fn_enforce_subscription_gates (aplica read_only / vuelve a published según pro).
//
// Setup (en RevenueCat dashboard → Integrations → Webhooks):
//   - URL: https://<project>.functions.supabase.co/revenuecat_webhook
//   - Authorization header: Bearer <REVENUECAT_WEBHOOK_SECRET>
//
// Env vars requeridas en Supabase:
//   - REVENUECAT_WEBHOOK_SECRET           (el shared secret del header)
//   - REVENUECAT_PRO_ENTITLEMENT_ID       (default: "pro")
//   - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (inyectadas por Supabase)
//
// Configuración del cliente RC (en la app):
//   - Purchases.logIn(user.id)  ← el app_user_id debe ser el auth.users.id (uuid)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const PRO_ENTITLEMENT = Deno.env.get('REVENUECAT_PRO_ENTITLEMENT_ID') ?? 'pro';

type SubStatus = 'active' | 'in_grace' | 'expired' | 'cancelled';
type SubPlan = 'monthly' | 'annual';
type SubStore = 'app_store' | 'play_store';

// Mapeo de event.type → status de nuestra tabla. Eventos no listados se loggean
// y se devuelven 200 sin tocar la DB (RC reintentaría si no fuera 200).
const EVENT_TO_STATUS: Record<string, SubStatus | null> = {
  INITIAL_PURCHASE: 'active',
  RENEWAL: 'active',
  PRODUCT_CHANGE: 'active',
  UNCANCELLATION: 'active',
  BILLING_ISSUE: 'in_grace',
  CANCELLATION: 'cancelled',
  EXPIRATION: 'expired',
  SUBSCRIPTION_PAUSED: 'in_grace',
  // No-ops (devolver 200 sin upsert):
  SUBSCRIBER_ALIAS: null,
  TRANSFER: null,
  NON_RENEWING_PURCHASE: null,
  REFUND: null,
};

const STORE_MAP: Record<string, SubStore | undefined> = {
  APP_STORE: 'app_store',
  PLAY_STORE: 'play_store',
  MAC_APP_STORE: 'app_store',
};

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method_not_allowed', { status: 405 });
  }

  // Auth: header debe ser exactamente "Bearer <REVENUECAT_WEBHOOK_SECRET>"
  const expected = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!expected) {
    console.error('REVENUECAT_WEBHOOK_SECRET not configured');
    return jsonError('webhook_misconfigured', 500);
  }
  const auth = req.headers.get('Authorization');
  if (auth !== `Bearer ${expected}`) {
    return jsonError('unauthorized', 401);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError('invalid_body', 400);
  }

  const event = body?.event;
  if (!event?.type) {
    return jsonError('missing_event', 400);
  }

  // Eventos que no impactan subscriptions: 200 silencioso.
  if (!(event.type in EVENT_TO_STATUS) || EVENT_TO_STATUS[event.type] === null) {
    console.log('rc_webhook noop', { type: event.type, app_user_id: event.app_user_id });
    return new Response('ok', { status: 200 });
  }

  // Filtrar por entitlement pro. Si el evento es de otro entitlement, ignorar.
  const entitlements: string[] = event.entitlement_ids ?? [];
  if (entitlements.length > 0 && !entitlements.includes(PRO_ENTITLEMENT)) {
    console.log('rc_webhook other_entitlement', { entitlements });
    return new Response('ok', { status: 200 });
  }

  const userId = event.app_user_id;
  if (!isUuid(userId)) {
    console.warn('rc_webhook invalid_user_id', { app_user_id: userId });
    return jsonError('invalid_user_id', 400);
  }

  const status = EVENT_TO_STATUS[event.type]!;
  const plan = inferPlan(event.product_id);
  const store = STORE_MAP[event.store] ?? 'app_store';
  const originalTxn = String(
    event.original_transaction_id ?? event.transaction_id ?? '',
  );
  if (!originalTxn) {
    return jsonError('missing_transaction_id', 400);
  }
  const expiresAtMs: number | undefined =
    event.expiration_at_ms ?? event.expires_date_ms;
  if (!expiresAtMs) {
    return jsonError('missing_expiration', 400);
  }
  const expiresAt = new Date(expiresAtMs).toISOString();

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { error } = await admin.rpc('fn_subscription_upsert', {
    p_user_id: userId,
    p_plan: plan,
    p_status: status,
    p_store: store,
    p_original_transaction_id: originalTxn,
    p_expires_at: expiresAt,
    p_entitlement_id: PRO_ENTITLEMENT,
  });

  if (error) {
    console.error('rc_webhook rpc_error', error);
    return jsonError(error.message, 500);
  }

  return new Response('ok', { status: 200 });
});

// ---------------------------------------------------------------------------

function inferPlan(productId: unknown): SubPlan {
  const s = String(productId ?? '').toLowerCase();
  if (s.includes('annual') || s.includes('year')) return 'annual';
  return 'monthly';
}

function isUuid(s: unknown): s is string {
  return typeof s === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function jsonError(code: string, status: number) {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
