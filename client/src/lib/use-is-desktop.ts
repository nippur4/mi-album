// En web con viewport ancho pasamos a un layout tipo desktop:
// header horizontal arriba, contenido capeado a 480 centrado.
// El threshold 768 = tablet portrait, el corte típico entre "usalo como mobile"
// y "usalo como desktop".
//
// En mobile nativo siempre devuelve false, aunque el tablet en horizontal
// tenga width > 768: el layout mobile con tab bar abajo es lo esperado ahí.

import { Platform, useWindowDimensions } from 'react-native';

const DESKTOP_THRESHOLD = 768;

export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web') return false;
  return width >= DESKTOP_THRESHOLD;
}
