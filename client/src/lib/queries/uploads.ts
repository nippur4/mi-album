// Wrapper sobre la Edge Function upload_image.
//
// El cliente hace TODO el procesamiento de imagen (resize + JPEG + compress)
// con expo-image-manipulator y envía los dos tamaños ya listos como base64.
// La Edge Function pasa a ser un proxy R2 trivial (sin sharp/imagescript/wasm).
//
// Esto evita libs nativas en el runtime de Edge Functions, que era frágil.

import * as ImageManipulator from 'expo-image-manipulator';

import { callEdgeFunction } from '@/lib/edge';

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

// Tamaños target por tipo de imagen. El cliente resizea + comprime.
// El "thumb" es lo que se renderiza en la mayoría de los lugares (avatares
// chicos, pickers, listas). Regla aprendida (avatares 160→512, stickers
// 300→512): en retina 2x/3x y en las celdas grandes del pager desktop, un
// thumb chico se estira y pixela. 512 cubre celdas de hasta ~250dp @2x.
// El large de sticker subió 1000→1600 para las figuritas tipo ficha (mucho
// texto chico): StickerCell lo usa cuando la celda renderiza grande.
// Las imágenes ya subidas mantienen su tamaño viejo hasta re-subirse.
const SIZES: Record<ImageKind | 'avatar', { thumb: number; large: number }> = {
  cover:   { thumb: 512, large: 1200 },
  pack:    { thumb: 512, large: 1200 },
  sticker: { thumb: 512, large: 1600 },
  avatar:  { thumb: 512, large: 1024 },
};
const JPEG_QUALITY = 0.85;

async function resizeToBase64(uri: string, width: number): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width } }],
    {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );
  if (!result.base64) throw { error: 'manipulator_no_base64' };
  return result.base64;
}

export async function uploadImage(
  albumId: string,
  kind: ImageKind,
  asset: UploadAsset,
): Promise<UploadedKeys> {
  // Resize + comprimir a JPEG en cliente, para 2 tamaños en paralelo.
  const sizes = SIZES[kind];
  let thumb_base64: string;
  let large_base64: string;
  try {
    [thumb_base64, large_base64] = await Promise.all([
      resizeToBase64(asset.uri, sizes.thumb),
      resizeToBase64(asset.uri, sizes.large),
    ]);
  } catch (err: any) {
    throw { error: `image_resize_failed: ${err?.message ?? String(err)}` };
  }

  return callEdgeFunction<UploadedKeys>(
    'upload_image',
    { album_id: albumId, kind, thumb_base64, large_base64 },
    { timeoutMs: 60_000 },
  );
}

export interface UploadedPreset {
  preset_id: string;
  thumb_key: string;
  large_key: string;
}

export async function uploadPresetImage(
  kind: 'cover' | 'pack' | 'avatar',
  asset: UploadAsset,
): Promise<UploadedPreset> {
  const sizes = SIZES[kind];
  const [thumb_base64, large_base64] = await Promise.all([
    resizeToBase64(asset.uri, sizes.thumb),
    resizeToBase64(asset.uri, sizes.large),
  ]);

  return callEdgeFunction<UploadedPreset>(
    'upload_preset_image',
    { kind, thumb_base64, large_base64 },
    { timeoutMs: 60_000 },
  );
}
