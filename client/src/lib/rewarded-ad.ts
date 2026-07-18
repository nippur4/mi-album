// Rewarded ads — stub para web/iOS.
//
// La implementación real vive en rewarded-ad.android.ts (Metro la elige por
// extensión de plataforma). Los rewarded ads solo son viables en Android:
// el SDK de AdMob es nativo, el equivalente web de Google está en beta y
// limitado a juegos H5, y iOS está descartado en el plan.
//
// Mantener las DOS firmas idénticas: tsc tipa contra este archivo.

export const ADS_SUPPORTED = false;

// Resuelve true solo si el usuario completó el ad y ganó la recompensa.
export async function showRewardedAd(): Promise<boolean> {
  return false;
}
