import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, FontFamily, Radius, Shadow } from '@/constants/theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'gold' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

// CTA con la "sombra dura" del handoff: borde inferior sólido que sugiere
// botón físico apilado. En press se hunde (translateY +5, shadow 0).
export function Button({ label, onPress, variant = 'primary', disabled, loading, style }: Props) {
  const palette = variantPalette[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: palette.bg },
        Shadow.cta(palette.shadow),
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, { color: palette.fg }]}>
        {loading ? '...' : label}
      </Text>
    </Pressable>
  );
}

const variantPalette = {
  primary: { bg: Colors.red, fg: '#FFFFFF', shadow: Colors.redShadow },
  gold:    { bg: Colors.gold, fg: Colors.ink, shadow: Colors.goldDarker },
  outline: { bg: 'transparent', fg: Colors.ink, shadow: Colors.borderStrong },
} as const;

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: 24,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ translateY: 5 }],
    shadowOpacity: 0,
    elevation: 0,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontFamily: FontFamily.body,
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
