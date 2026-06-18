// Wrapper sobre la Edge Function upload_image.
//
// Manda multipart/form-data: archivo + album_id + kind. La Edge Function genera
// 2 tamaños WebP y los sube a R2; devuelve las object keys (no URLs completas).
//
// El path completo lo arma el cliente con r2Url(key) cuando renderiza.

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export type ImageKind = 'cover' | 'pack' | 'sticker';

export interface UploadedKeys {
  thumb_key: string;
  large_key: string;
}

export interface UploadAsset {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

export async function uploadImage(
  albumId: string,
  kind: ImageKind,
  asset: UploadAsset,
): Promise<UploadedKeys> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw { error: 'auth_required' };

  const form = new FormData();
  form.append('album_id', albumId);
  form.append('kind', kind);
  // RN/Expo necesita este shape para mandar archivos vía multipart.
  // El "as any" es por la firma de FormData del DOM, no del nativo de RN.
  form.append('file', {
    uri: asset.uri,
    name: asset.fileName ?? `upload.${guessExt(asset.mimeType)}`,
    type: asset.mimeType ?? 'image/jpeg',
  } as any);

  const res = await fetch(`${env.supabaseUrl}/functions/v1/upload_image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw { error: body.error ?? `upload_failed_${res.status}` };
  }
  return body as UploadedKeys;
}

function guessExt(mime?: string | null): string {
  if (!mime) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('heic')) return 'heic';
  return 'jpg';
}
