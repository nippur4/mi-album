import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';

interface Props {
  title: string;
  subtitle?: string;
}

// Placeholder usado mientras las pantallas se van construyendo. El estilo es
// consistente con el theme (paper bg + título Anton) para que el shell ya
// "sienta" el producto desde el día 1.
export function ScreenPlaceholder({ title, subtitle }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.inner}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle ?? 'Próximamente.'}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.paper,
  },
  inner: {
    flex: 1,
    paddingHorizontal: Spacing.screenX,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.hBig,
    color: Colors.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabel,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
});
