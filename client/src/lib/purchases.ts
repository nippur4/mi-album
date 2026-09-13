// Compras / suscripción Pro — stub para web e iOS.
//
// La implementación real vive en purchases.android.ts (Metro la elige por
// extensión de plataforma). Las compras solo son viables en Android: el canal
// definido es Google Play Billing vía RevenueCat (ver spec del proyecto). En
// web no hay pagos y iOS está descartado.
//
// Mantener las DOS firmas idénticas: tsc tipa contra este archivo.

// true solo en la app Android (con la key de RC configurada). El paywall usa
// este flag para decidir si muestra el botón de compra o el fallback
// "Disponible en la app Android".
export const PURCHASES_SUPPORTED = false;

export interface ProOffering {
  /** Precio ya formateado con moneda local, ej "$3.000,00" o "US$2.99". */
  priceString: string;
}

/** Resultado de intentar comprar. `cancelled` distingue el cierre voluntario
 *  del paywall (silencioso) de un error real (que sí se muestra). */
export type BuyResult =
  | { ok: true }
  | { ok: false; cancelled: boolean; message?: string };

// Init idempotente del SDK. No-op en web/iOS.
export async function initPurchases(): Promise<void> {}

// Asocia las compras al usuario logueado (app_user_id = auth.users.id). No-op.
export async function identifyPurchaser(_userId: string): Promise<void> {}

// Desasocia al cerrar sesión. No-op.
export async function logOutPurchaser(): Promise<void> {}

// Devuelve el offering Pro para mostrar el precio en el paywall. null en web/iOS.
export async function getProOffering(): Promise<ProOffering | null> {
  return null;
}

// Lanza el flujo de compra. En web/iOS nunca se llama (el botón no aparece).
export async function buyPro(): Promise<BuyResult> {
  return { ok: false, cancelled: true };
}

// Restaura compras previas. Devuelve true si el usuario quedó Pro activo.
export async function restorePro(): Promise<boolean> {
  return false;
}
