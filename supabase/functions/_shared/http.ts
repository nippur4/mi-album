// Mi Álbum de Figuritas — helpers HTTP compartidos por las Edge Functions.
//
// Centraliza el boilerplate que estaba copiado en cada function: headers CORS,
// respuestas JSON y la creación de clientes Supabase (user con JWT del caller
// para que auth.uid() funcione en RPCs/RLS, y admin service-role para lecturas
// restringidas como qr_secret).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export function jsonError(code: string, status: number) {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// Cliente con el JWT del caller: RLS aplica y auth.uid() funciona en RPCs.
export function userClient(authHeader: string) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
}

// Cliente service-role: bypasea RLS (ej. leer qr_secret con column revoke).
export function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

// Resuelve el user id del JWT del caller, o null si el token no es válido.
export async function getCallerId(
  client: ReturnType<typeof createClient>,
): Promise<string | null> {
  const { data } = await client.auth.getUser();
  return data?.user?.id ?? null;
}
