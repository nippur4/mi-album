// Copy centralizado para los CTAs / mensajes relacionados con Pro.
// Cambia según plataforma:
//   - mobile: "Suscribite a Pro" (eventualmente abre paywall via RevenueCat)
//   - web: "Bajate la app Android" (la compra solo está en mobile por ahora;
//     no integramos pagos web — ver WEB_PLAN.md decisiones)

import { Platform } from 'react-native';

const IS_WEB = Platform.OS === 'web';

/** CTA corto, ej para reemplazar "Hacete Pro" en botones. */
export function upsellShort(): string {
  return IS_WEB ? 'Bajate la app' : 'Hacete Pro';
}

/** Descripción de una feature pro-only en contexto. */
export function proFeatureHint(featureDescription: string): string {
  if (IS_WEB) {
    return `${featureDescription} Para usarla, bajate la app Android.`;
  }
  return `${featureDescription} Suscribite a Pro para activarla.`;
}

/** Mensaje cuando el backend rechaza con `pro_required` (P0020). */
export function proRequiredMessage(): string {
  return IS_WEB
    ? 'Esta función requiere la app Android. Bajala para usarla.'
    : 'Esta función requiere suscripción Pro.';
}
