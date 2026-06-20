import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

interface Props {
  // 0..1
  value: number;
  height?: number;
  // 'gold' = gradient gold→red (handoff). 'red' = roja sólida (chips).
  variant?: 'gold' | 'red';
  trackColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function ProgressBar({
  value,
  height = 6,
  variant = 'gold',
  trackColor = 'rgba(42,30,22,0.10)',
  style,
}: Props) {
  const pct = Math.max(0, Math.min(1, value));
  const colors: [string, string] =
    variant === 'gold' ? [Colors.gold, Colors.red] : [Colors.red, Colors.redDark];

  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: trackColor },
        style,
      ]}
    >
      <View style={[styles.fill, { width: `${pct * 100}%`, height }]}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[StyleSheet.absoluteFill, { borderRadius: height / 2 }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    minWidth: 4,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
});
