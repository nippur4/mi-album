// Compras / suscripción Pro — implementación Android (RevenueCat).
//
// Módulo NATIVO (react-native-purchases): requiere rebuild del dev build de EAS
// (como expo-camera/audio). Canal único = Google Play Billing vía RevenueCat.
//
// Modelo: un solo producto mensual `pro_monthly` bajo el entitlement `pro`.
// El app_user_id de RC = auth.users.id (uuid), así el webhook (fn_subscription_upsert)
// escribe la fila correcta y useIsPro la lee por RLS. La compra refresca useIsPro
// de inmediato con getCustomerInfo() sin esperar el webhook (que es la fuente de
// verdad autoritativa, pero llega segundos después).
//
// Mantener las firmas idénticas al stub (purchases.ts): tsc tipa contra ese.

import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';

import { env } from './env';

const ENTITLEMENT = 'pro';

// Solo soportado si hay key de RC configurada. En dev sin cuenta RC la key está
// vacía → el paywall cae al fallback en vez de romper al configurar el SDK.
export const PURCHASES_SUPPORTED = !!env.revenuecatAndroidKey;

export interface ProOffering {
  priceString: string;
}

export type BuyResult =
  | { ok: true }
  | { ok: false; cancelled: boolean; message?: string };

let configured = false;
// Cacheamos el package del offering actual para no re-consultar entre mostrar el
// precio (getProOffering) y comprar (buyPro).
let cachedPackage: PurchasesPackage | null = null;

export async function initPurchases(): Promise<void> {
  if (configured || !PURCHASES_SUPPORTED) return;
  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: env.revenuecatAndroidKey });
    configured = true;
  } catch {
    // Si configure falla, dejamos configured=false: el paywall mostrará el
    // fallback en vez de un botón que no funciona.
  }
}

export async function identifyPurchaser(userId: string): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logIn(userId);
  } catch {}
}

export async function logOutPurchaser(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch {}
}

export async function getProOffering(): Promise<ProOffering | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    // Preferimos el package mensual explícito; si el offering se armó con un
    // package custom, caemos al primero disponible.
    const pkg = current?.monthly ?? current?.availablePackages?.[0] ?? null;
    cachedPackage = pkg;
    if (!pkg) return null;
    return { priceString: pkg.product.priceString };
  } catch {
    return null;
  }
}

export async function buyPro(): Promise<BuyResult> {
  if (!configured) {
    return { ok: false, cancelled: false, message: 'Las compras no están disponibles.' };
  }
  try {
    let pkg = cachedPackage;
    if (!pkg) {
      await getProOffering();
      pkg = cachedPackage;
    }
    if (!pkg) {
      return { ok: false, cancelled: false, message: 'No se encontró el plan Pro. Probá más tarde.' };
    }
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    if (isProActive(customerInfo)) return { ok: true };
    return {
      ok: false,
      cancelled: false,
      message: 'La compra no se activó. Probá restaurar compras.',
    };
  } catch (e: any) {
    if (e?.userCancelled) return { ok: false, cancelled: true };
    return {
      ok: false,
      cancelled: false,
      message: e?.message ?? 'No se pudo completar la compra.',
    };
  }
}

export async function restorePro(): Promise<boolean> {
  if (!configured) return false;
  try {
    const customerInfo = await Purchases.restorePurchases();
    return isProActive(customerInfo);
  } catch {
    return false;
  }
}

function isProActive(info: CustomerInfo): boolean {
  return info.entitlements.active[ENTITLEMENT] !== undefined;
}
