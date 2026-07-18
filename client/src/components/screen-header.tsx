import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';

import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';

interface Props {
  title: string;
  back?: boolean;
  // Botón de casita → Inicio. Para pantallas fuera del grupo (tabs) donde no
  // hay tab bar y el "volver" puede quedar lejos del Home (ej. dentro de un
  // álbum). navigate('/') colapsa el stack hasta las tabs.
  home?: boolean;
  // Si true, deja partir el título en hasta 2 líneas (estilo handoff con Anton)
  multiline?: boolean;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function ScreenHeader({ title, back, home, multiline, right, style }: Props) {
  const router = useRouter();
  return (
    <View style={[styles.row, multiline && styles.rowMultiline, style]}>
      <View style={styles.side}>
        {back && router.canGoBack() && (
          <Pressable onPress={router.back} hitSlop={12} style={styles.backHit}>
            <Text style={styles.chevron}>{'‹'}</Text>
          </Pressable>
        )}
      </View>
      <Text
        style={multiline ? styles.titleMultiline : styles.title}
        numberOfLines={multiline ? 2 : 1}
      >
        {title.toUpperCase()}
      </Text>
      <View style={[styles.sideRight, { alignItems: 'flex-end' }]}>
        {home ? (
          <View style={styles.rightRow}>
            <Pressable
              onPress={() => router.navigate('/')}
              hitSlop={8}
              style={({ pressed }) => [styles.homeBtn, pressed && { opacity: 0.6 }]}
            >
              <Feather name="home" size={18} color={Colors.ink} />
            </Pressable>
            {right}
          </View>
        ) : (
          right
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenX,
    minHeight: 48,
    gap: Spacing.sm,
  },
  rowMultiline: {
    alignItems: 'flex-start',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  side: {
    width: 40,
    justifyContent: 'center',
  },
  // El slot derecho se expande al contenido (badge, icono) para que el texto
  // no se corte. minWidth: 40 mantiene la simetría cuando está vacío.
  sideRight: {
    minWidth: 40,
    justifyContent: 'center',
  },
  backHit: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  homeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.paper2,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    fontFamily: FontFamily.body,
    fontSize: 30,
    fontWeight: '700',
    color: Colors.ink,
    lineHeight: 30,
  },
  title: {
    flex: 1,
    fontFamily: FontFamily.display,
    fontSize: FontSize.screenTitle,
    color: Colors.ink,
    textAlign: 'center',
  },
  titleMultiline: {
    flex: 1,
    fontFamily: FontFamily.display,
    fontSize: 26,
    lineHeight: 28,
    color: Colors.ink,
    letterSpacing: 0.5,
  },
});
