// Mi Álbum de Figuritas — Edge Function: borrar la cuenta del caller.
//
// Cumple el requisito de Google Play / GDPR de que el usuario pueda eliminar su
// cuenta y sus datos personales desde la app.
//
// Flujo:
//   1. Autenticamos al caller con su JWT → callerId.
//   2. Llamamos fn_delete_account CON el JWT del caller (userClient) para que
//      auth.uid() resuelva: retira los álbumes propios que juegan otros (sus
//      colecciones sobreviven) y borra el resto. Ver migración 0070.
//   3. Con service role borramos el row de auth.users (auth.admin.deleteUser).
//      El cascade limpia profiles → membership/collection/packs/trades/
//      subscriptions/push_token del caller, y deja en NULL el owner_id de los
//      álbumes retirados que sobreviven.
//
// Contrato:
//   POST  (sin body)
//   200   { ok: true }
//   4xx   { error: string }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { adminClient, CORS, getCallerId, jsonError, jsonOk, userClient } from '../_shared/http.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return jsonError('method_not_allowed', 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError('auth_required', 401);

  const callerId = await getCallerId(userClient(authHeader));
  if (!callerId) return jsonError('auth_required', 401);

  // 1) Limpieza server-side (retira álbumes con jugadores, borra el resto).
  //    Va con el JWT del caller para que auth.uid() funcione dentro de la RPC.
  const { error: rpcErr } = await userClient(authHeader).rpc('fn_delete_account');
  if (rpcErr) return jsonError(rpcErr.message, 500);

  // 2) Borrado del usuario de auth (cascade al resto de sus datos).
  const { error: delErr } = await adminClient().auth.admin.deleteUser(callerId);
  if (delErr) return jsonError(delErr.message, 500);

  return jsonOk({ ok: true });
});
