// Wrapper para capear el ancho de un grupo de rutas en desktop web.
//
// En mobile (nativo o web angosto) devuelve children tal cual — cero cambios.
// En desktop (web ≥ 768) centra el contenido a maxWidth, con un fondo
// full-bleed opcional (ej. el grupo pack/ usa fondo ink oscuro y no queremos
// que asomen los costados cream del root).
//
// Uso típico en el _layout de un grupo:
//   <DesktopCapped maxWidth={760}><Stack ... /></DesktopCapped>

import { type ReactNode } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';

import { useIsDesktop } from '@/lib/use-is-desktop';

interface Props {
  maxWidth: number;
  backgroundColor?: ColorValue;
  children: ReactNode;
}

export function DesktopCapped({ maxWidth, backgroundColor, children }: Props) {
  const isDesktop = useIsDesktop();
  if (!isDesktop) return <>{children}</>;
  return (
    <View style={[styles.bleed, backgroundColor != null && { backgroundColor }]}>
      <View style={[styles.inner, { maxWidth }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bleed: { flex: 1, width: '100%' },
  inner: { flex: 1, width: '100%', alignSelf: 'center' },
});
