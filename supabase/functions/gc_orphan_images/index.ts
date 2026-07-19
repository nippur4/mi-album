// Mi Álbum de Figuritas — garbage collector de imágenes huérfanas en R2.
//
// La DB guarda solo keys y NUNCA borra de R2, así que quedan huérfanas al:
// eliminar álbum/figurita/preset, o re-subir cualquier imagen (cada upload
// genera uuid nuevo). Esta function lista el bucket completo, junta las keys
// VIVAS de la DB (albums + stickers + presets + avatares) y borra el diff.
//
// Seguridad / robustez:
//   - Solo admin (profiles.is_admin, verificado con service role).
//   - Los objetos subidos en las últimas 24h NO se tocan: el upload ocurre
//     ANTES del insert en DB, un GC en el medio los borraría en vuelo.
//   - dry_run=true (default) solo informa; el borrado real se pide explícito.
//   - max_delete por corrida (default 500) para no chocar el timeout del
//     runtime; si quedan más, se re-invoca.
//
// Request:  { dry_run?: boolean, max_delete?: number }
// Response: { listed, live_keys, orphans, skipped_recent, deleted, failed,
//             remaining, dry_run, sample: string[] }

import { adminClient, CORS, getCallerId, jsonError, jsonOk, userClient } from '../_shared/http.ts';
import { deleteFromR2, listAllR2Objects } from '../_shared/r2.ts';

const RECENT_MS = 24 * 60 * 60 * 1000;
const DELETE_CONCURRENCY = 10;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonError('method_not_allowed', 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError('auth_required', 401);

  const caller = await getCallerId(userClient(authHeader));
  if (!caller) return jsonError('auth_required', 401);

  const admin = adminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', caller)
    .maybeSingle();
  if (!profile?.is_admin) return jsonError('admin_required', 403);

  let body: { dry_run?: boolean; max_delete?: number } = {};
  try {
    body = await req.json();
  } catch {
    // body vacío = defaults
  }
  const dryRun = body.dry_run !== false; // default true: borrar es opt-in
  const maxDelete = Math.max(1, Math.min(2000, body.max_delete ?? 500));

  try {
    // 1. Keys vivas en DB. Paginado con .range(): PostgREST capea los
    //    listados a max_rows (lección de la migración 0045).
    const live = new Set<string>();
    const addKeys = (rows: Record<string, string | null>[], cols: string[]) => {
      for (const row of rows) {
        for (const c of cols) {
          const k = row[c];
          // 'preset:<id>' es un pseudo-key de gradiente local, no vive en R2.
          if (k && !k.startsWith('preset:')) live.add(k);
        }
      }
    };

    async function pagedSelect(table: string, cols: string[]) {
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await admin
          .from(table)
          .select(cols.join(','))
          .range(from, from + PAGE - 1);
        if (error) throw new Error(`db_${table}: ${error.message}`);
        addKeys((data ?? []) as Record<string, string | null>[], cols);
        if (!data || data.length < PAGE) break;
      }
    }

    await pagedSelect('albums', [
      'cover_thumb_key',
      'cover_large_key',
      'pack_thumb_key',
      'pack_large_key',
    ]);
    await pagedSelect('stickers', ['thumb_key', 'large_key']);
    await pagedSelect('preset_images', ['thumb_key', 'large_key']);
    await pagedSelect('profiles', ['avatar_thumb_key']);

    // 2. Listado completo del bucket.
    const objects = await listAllR2Objects();

    // 3. Diff, salteando lo reciente (uploads en vuelo).
    const cutoff = Date.now() - RECENT_MS;
    const orphans: string[] = [];
    let skippedRecent = 0;
    for (const o of objects) {
      if (live.has(o.key)) continue;
      if (new Date(o.lastModified).getTime() > cutoff) {
        skippedRecent++;
        continue;
      }
      orphans.push(o.key);
    }

    // 4. Borrado (si no es dry run), con concurrencia acotada.
    let deleted = 0;
    let failed = 0;
    if (!dryRun) {
      const batch = orphans.slice(0, maxDelete);
      for (let i = 0; i < batch.length; i += DELETE_CONCURRENCY) {
        const chunk = batch.slice(i, i + DELETE_CONCURRENCY);
        const results = await Promise.allSettled(chunk.map((k) => deleteFromR2(k)));
        for (const r of results) r.status === 'fulfilled' ? deleted++ : failed++;
      }
    }

    return jsonOk({
      listed: objects.length,
      live_keys: live.size,
      orphans: orphans.length,
      skipped_recent: skippedRecent,
      deleted,
      failed,
      remaining: dryRun ? orphans.length : Math.max(0, orphans.length - deleted),
      dry_run: dryRun,
      sample: orphans.slice(0, 20),
    });
  } catch (err) {
    console.error('[gc_orphan_images]', err);
    return jsonError('gc_failed', 500);
  }
});
