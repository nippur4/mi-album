// En web con viewport ancho pasamos a un layout tipo desktop:
// header horizontal arriba, contenido capeado por pantalla.
// El threshold 768 = tablet portrait, el corte típico entre "usalo como mobile"
// y "usalo como desktop".
//
// En mobile nativo siempre devuelve false, aunque el tablet en horizontal
// tenga width > 768: el layout mobile con tab bar abajo es lo esperado ahí.

import { Platform, useWindowDimensions, type ViewStyle } from 'react-native';

const DESKTOP_THRESHOLD = 768;

export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web') return false;
  return width >= DESKTOP_THRESHOLD;
}

// Estilo para capear CONTENIDO en desktop dejando el scroll full-bleed.
// Se aplica al contentContainerStyle del ScrollView (y a los bloques fijos
// fuera del scroll, como ScreenHeader) — así la barra de scroll queda en el
// borde de la ventana y no flotando en el borde del cap.
// En mobile devuelve undefined: cero impacto.
export function useDesktopCap(maxWidth: number): ViewStyle | undefined {
  const isDesktop = useIsDesktop();
  if (!isDesktop) return undefined;
  return { maxWidth, width: '100%', alignSelf: 'center' };
}
