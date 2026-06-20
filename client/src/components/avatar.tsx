import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, FontFamily } from '@/constants/theme';

interface Props {
  // Texto base para derivar iniciales (display_name, nombre de álbum, etc.)
  source: string;
  size?: number;
  // Override de color de fondo. Sin este, se hashea el source para consistencia.
  bgColor?: string;
  style?: StyleProp<ViewStyle>;
}

// Paleta de fondos (consistente con StickerHues / theme).
const BG_PALETTE = [
  '#D23A2E', // red
  '#5B8DEF', // blue
  '#7FB83E', // green
  '#E8B24A', // gold
  '#3FB6A8', // teal
  '#B36BD4', // violet
  '#EE6FA0', // pink
  '#F2A03D', // amber
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initials(s: string, max = 3): string {
  const words = s.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length >= max) return words.slice(0, max).map((w) => w[0]).join('').toUpperCase();
  // Una sola palabra: tomar las primeras max letras
  return words[0].slice(0, max).toUpperCase();
}

export function Avatar({ source, size = 46, bgColor, style }: Props) {
  const bg = bgColor ?? BG_PALETTE[hash(source) % BG_PALETTE.length];
  const initialsText = initials(source);
  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        style,
      ]}
    >
      <Text
        style={[
          styles.initials,
          { fontSize: Math.max(11, size * 0.32) },
        ]}
      >
        {initialsText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: FontFamily.mono,
    fontWeight: '700',
    color: Colors.paper,
    letterSpacing: 1,
  },
});
