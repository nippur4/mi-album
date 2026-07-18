// Rewarded ads — implementación Android (AdMob via react-native-google-mobile-ads).
//
// Módulo NATIVO: requiere rebuild del dev build de EAS (como expo-camera/audio).
// El ad unit es el de TEST de Google mientras no haya cuenta AdMob real; con
// __DEV__ además fuerza test ads. Al tener la cuenta: reemplazar REAL_AD_UNIT
// y el android_app_id en app.json (raíz, fuera de "expo").
//
// showRewardedAd() resuelve true SOLO si el user completó el ad (EARNED_REWARD).
// El sobre igual lo otorga el server (fn_claim_ad_pack, tope 2/día) — esto es
// solo la parte visual/reward del cliente.

import mobileAds, {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

export const ADS_SUPPORTED = true;

// TODO(admob): reemplazar por el ad unit real cuando exista la cuenta.
const REAL_AD_UNIT: string | null = null;
const AD_UNIT_ID = __DEV__ || !REAL_AD_UNIT ? TestIds.REWARDED : REAL_AD_UNIT;

let sdkReady: Promise<unknown> | null = null;

export async function showRewardedAd(): Promise<boolean> {
  try {
    // Init lazy del SDK (una sola vez), recién cuando alguien pide un ad.
    sdkReady ??= mobileAds().initialize();
    await sdkReady;
  } catch {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    const ad = RewardedAd.createForAdRequest(AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });
    let earned = false;
    let settled = false;

    function settle(value: boolean) {
      if (settled) return;
      settled = true;
      unsubLoaded();
      unsubEarned();
      unsubClosed();
      unsubError();
      clearTimeout(loadTimeout);
      resolve(value);
    }

    const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      clearTimeout(loadTimeout);
      ad.show().catch(() => settle(false));
    });
    const unsubEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      earned = true;
    });
    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => settle(earned));
    const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => settle(false));

    // Sin inventario / sin red: no dejar el botón colgado esperando la carga.
    const loadTimeout = setTimeout(() => settle(false), 12_000);

    ad.load();
  });
}
