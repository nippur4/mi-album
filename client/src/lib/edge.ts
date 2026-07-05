// Helper único para llamar Edge Functions de Supabase.
//
// Centraliza el patrón que estaba copiado en packs.ts, qr.ts y uploads.ts:
// token de sesión + headers + parseo tolerante del body + armado del error.
// Todos los errores salen con shape { error: string } — errors.ts ya sabe
// mapear 'auth_required' y los códigos que emiten las propias functions.

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export async function callEdgeFunction<T>(
  name: string,
  body: unknown,
  opts?: { timeoutMs?: number },
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw { error: 'auth_required' };

  // Timeout opcional para no quedar esperando infinito si la function se cuelga.
  const controller = opts?.timeoutMs ? new AbortController() : null;
  const timeout = controller
    ? setTimeout(() => controller.abort(), opts!.timeoutMs)
    : null;

  let res: Response;
  try {
    res = await fetch(`${env.supabaseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller?.signal,
    });
  } catch (err: any) {
    if (timeout) clearTimeout(timeout);
    if (err?.name === 'AbortError') {
      throw { error: `${name}_timeout_${opts!.timeoutMs}ms (server never responded)` };
    }
    throw { error: `fetch_failed: ${err?.message ?? String(err)}` };
  }
  if (timeout) clearTimeout(timeout);

  const text = await res.text();
  let payload: any = {};
  try { payload = JSON.parse(text); } catch {}

  if (!res.ok) {
    throw { error: payload.error ?? `${name}_failed_${res.status}: ${text.slice(0, 200)}` };
  }
  return payload as T;
}
