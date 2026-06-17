// Mapeo de errores del backend (SQLSTATE P00XX) a keys estables del cliente.
//
// El backend lanza errores con códigos en el rango P0001-P0199 (ver migraciones
// 0002–0007). El cliente Supabase los recibe en .code, y el mensaje legible
// viene en .message. Esta tabla normaliza a keys que la UI puede usar para:
//   - mostrar copy localizado
//   - decidir si abrir el paywall (pro_required)
//   - decidir si re-fetchear datos (offer_not_pending, stock_unavailable)

import type { PostgrestError } from '@supabase/supabase-js';

export type AppErrorKey =
  // Genéricos
  | 'auth_required'
  | 'name_required'
  | 'images_required'
  | 'invalid_action'
  // Álbum
  | 'album_not_found'
  | 'not_album_owner'
  | 'album_not_draft'
  | 'album_not_published'
  | 'album_economy_locked'
  | 'album_cover_required'
  | 'album_pack_image_required'
  | 'album_not_available'         // sufijo de status en .message
  | 'stickers_count_mismatch'
  | 'sticker_number_missing'
  | 'sticker_number_out_of_range'
  | 'sticker_not_found'
  | 'sticker_not_in_album'
  | 'sticker_not_owned'
  | 'total_stickers_out_of_range'
  | 'total_below_existing_sticker_numbers'
  | 'cooldown_too_low'
  | 'share_code_required'
  | 'owner_cannot_join_own_album'
  // Pro / suscripción
  | 'pro_required'
  | 'admin_required'
  // Packs
  | 'daily_not_enabled'
  | 'daily_on_cooldown'
  | 'pack_not_found'
  | 'pack_already_opened'
  | 'not_pack_owner'
  | 'no_stickers'
  | 'not_member'
  // QR
  | 'qr_not_enabled'
  | 'qr_on_cooldown'
  | 'owner_cannot_redeem_own_qr'
  // Trades
  | 'offer_not_found'
  | 'offer_not_pending'
  | 'not_offer_party'
  | 'trade_limit_exceeded'
  | 'trades_disabled'
  | 'self_trade_not_allowed'
  | 'to_user_not_member'
  | 'same_sticker_offered_and_requested'
  | 'duplicate_pending_offer'
  | 'stock_unavailable'
  // Catch-all
  | 'unknown';

const SQLSTATE_TO_KEY: Record<string, AppErrorKey> = {
  P0002: 'album_not_found',
  P0003: 'not_album_owner',
  P0010: 'auth_required',
  P0011: 'name_required',
  P0012: 'total_stickers_out_of_range',
  P0020: 'pro_required',
  P0030: 'album_not_draft',
  P0031: 'total_below_existing_sticker_numbers',
  P0040: 'album_economy_locked',
  P0041: 'cooldown_too_low',
  P0042: 'qr_not_enabled',
  P0050: 'sticker_number_out_of_range',
  P0051: 'images_required',
  P0052: 'sticker_not_found',
  P0060: 'album_cover_required',
  P0061: 'album_pack_image_required',
  P0062: 'stickers_count_mismatch',
  P0063: 'sticker_number_missing',
  P0070: 'admin_required',
  P0071: 'album_not_published',
  P0080: 'share_code_required',
  P0081: 'owner_cannot_join_own_album',
  P0082: 'album_not_available',
  P0090: 'daily_not_enabled',
  P0091: 'daily_on_cooldown',
  P0092: 'not_member',
  P0095: 'owner_cannot_redeem_own_qr',
  P0096: 'qr_not_enabled',
  P0097: 'qr_on_cooldown',
  P0100: 'no_stickers',
  P0101: 'pack_not_found',
  P0102: 'not_pack_owner',
  P0103: 'pack_already_opened',
  P0110: 'offer_not_found',
  P0111: 'offer_not_pending',
  P0112: 'not_offer_party',
  P0113: 'trade_limit_exceeded',
  P0114: 'stock_unavailable',
  P0115: 'trades_disabled',
  P0116: 'self_trade_not_allowed',
  P0117: 'to_user_not_member',
  P0118: 'sticker_not_in_album',
  P0119: 'same_sticker_offered_and_requested',
  P0120: 'duplicate_pending_offer',
  P0121: 'invalid_action',
  P0130: 'sticker_not_owned',
};

export interface AppError {
  key: AppErrorKey;
  raw: string;        // mensaje crudo del backend; útil cuando incluye sufijos
                      // (ej. "album_not_available_read_only", "qr_on_cooldown_until_2026...")
}

export function toAppError(err: unknown): AppError {
  if (!err) return { key: 'unknown', raw: '' };

  // Errores de RPC vienen como PostgrestError con .code SQLSTATE
  const pg = err as Partial<PostgrestError>;
  if (typeof pg?.code === 'string' && SQLSTATE_TO_KEY[pg.code]) {
    return { key: SQLSTATE_TO_KEY[pg.code], raw: pg.message ?? '' };
  }

  // Errores de Edge Functions vienen como { error: 'pack_already_opened' } en body
  if (typeof err === 'object' && err !== null && 'error' in err) {
    const code = String((err as { error: unknown }).error);
    // Si el código viene en el body, intentar matchear contra las keys conocidas
    const known = Object.values(SQLSTATE_TO_KEY).find((k) => code.startsWith(k));
    if (known) return { key: known, raw: code };
  }

  return { key: 'unknown', raw: String((err as Error)?.message ?? err) };
}

// Copy en español para mostrar al usuario. La UI puede sobreescribir para
// contextos específicos (ej. en el paywall, "pro_required" no se muestra).
export const ERROR_COPY: Record<AppErrorKey, string> = {
  auth_required: 'Necesitás iniciar sesión.',
  name_required: 'El nombre no puede estar vacío.',
  images_required: 'Falta cargar la imagen.',
  invalid_action: 'Acción inválida.',
  album_not_found: 'No encontramos ese álbum.',
  not_album_owner: 'No sos el dueño de este álbum.',
  album_not_draft: 'El álbum ya fue publicado y no puede editarse.',
  album_not_published: 'El álbum aún no está publicado.',
  album_economy_locked: 'Las opciones del álbum están bloqueadas.',
  album_cover_required: 'Cargá una carátula antes de publicar.',
  album_pack_image_required: 'Cargá una imagen para el sobre antes de publicar.',
  album_not_available: 'Este álbum no está disponible ahora.',
  stickers_count_mismatch: 'Faltan figuritas por cargar.',
  sticker_number_missing: 'Hay números de figurita sin cargar.',
  sticker_number_out_of_range: 'Ese número de figurita no es válido para este álbum.',
  sticker_not_found: 'No encontramos esa figurita.',
  sticker_not_in_album: 'Esa figurita no pertenece a este álbum.',
  sticker_not_owned: 'No tenés esa figurita en tu colección.',
  total_stickers_out_of_range: 'La cantidad de figuritas excede el límite de tu plan.',
  total_below_existing_sticker_numbers: 'No podés bajar la cantidad: ya cargaste figuritas con números más altos.',
  cooldown_too_low: 'El cooldown configurado es demasiado bajo.',
  share_code_required: 'Falta el código del álbum.',
  owner_cannot_join_own_album: 'Es tu propio álbum.',
  pro_required: 'Esta función requiere suscripción Pro.',
  admin_required: 'Solo el admin puede hacer esto.',
  daily_not_enabled: 'El sobre diario no está habilitado para este álbum.',
  daily_on_cooldown: 'Todavía falta para tu próximo sobre diario.',
  pack_not_found: 'No encontramos ese sobre.',
  pack_already_opened: 'Este sobre ya fue abierto.',
  not_pack_owner: 'Ese sobre no es tuyo.',
  no_stickers: 'No hay figuritas para entregar.',
  not_member: 'Primero unite al álbum.',
  qr_not_enabled: 'El QR de sobres no está habilitado.',
  qr_on_cooldown: 'Volvé a escanear más tarde.',
  owner_cannot_redeem_own_qr: 'No podés escanear el QR de tu propio álbum.',
  offer_not_found: 'No encontramos esa oferta.',
  offer_not_pending: 'Esa oferta ya no está pendiente.',
  not_offer_party: 'No participás de esta oferta.',
  trade_limit_exceeded: 'Llegaste al límite de cambios por este período.',
  trades_disabled: 'Los cambios están desactivados en este álbum.',
  self_trade_not_allowed: 'No podés intercambiar con vos mismo.',
  to_user_not_member: 'Esa persona no es miembro del álbum.',
  same_sticker_offered_and_requested: 'No podés pedir la misma figurita que ofrecés.',
  duplicate_pending_offer: 'Ya tenés una oferta igual pendiente.',
  stock_unavailable: 'Una de las figuritas ya no está disponible.',
  unknown: 'Algo salió mal. Probá de nuevo.',
};

export const errorMessage = (err: unknown): string => ERROR_COPY[toAppError(err).key];
