// Estado vacío de una lista: título + bajada opcional, centrados.
//
// Estaba copiado (View + 2 Text + 3 bloques de estilos) en los dos tabs de
// listas, las tres pantallas de admin, Cambios, Coincidencias, bloqueados y
// los pickers. Las copias ya habían empezado a divergir en el textAlign.

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';

interface Props {
  title: string;
  body?: string;
  // Acciones debajo del texto (ej. el CTA "Crear álbum" del tab Gestionar).
  children?: React.ReactNode;
  // Override del espaciado del contenedor cuando el vacío no va al tope de la
  // pantalla (ej. dentro de un sheet o entre secciones).
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({ title, body, children, style }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.title}>{title}</Text>
      {body != null && <Text style={styles.body}>{body}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
    textAlign: 'center',
  },
  body: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
});
