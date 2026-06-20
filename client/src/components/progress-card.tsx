import { StyleSheet, Text, View } from 'react-native';

import { ProgressBar } from '@/components/progress-bar';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';

interface Props {
  current: number;
  total: number;
  // Stats opcionales a la derecha de la barra: "28 repetidas · 53 faltan"
  rightStat?: string;
  // Caption opcional debajo del número grande
  caption?: string;
}

// Card oscura del detalle: número Anton gold gigante + barra + stats.
// Refleja el bloque emblemático del handoff (screen 02).
export function ProgressCard({ current, total, rightStat, caption }: Props) {
  const pct = total > 0 ? current / total : 0;
  const pctText = `${Math.round(pct * 100)}%`;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.numbers}>
          <Text style={styles.current}>{current}</Text>
          <Text style={styles.slash}>/{total}</Text>
        </View>
        {caption && <Text style={styles.caption}>{caption.toUpperCase()}</Text>}
      </View>

      <View style={styles.barRow}>
        <View style={{ flex: 1 }}>
          <ProgressBar value={pct} variant="gold" height={8} trackColor="rgba(255,255,255,0.10)" />
        </View>
        <Text style={styles.pct}>{pctText}</Text>
      </View>

      {rightStat && <Text style={styles.stat}>{rightStat}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.ink,
    borderRadius: Radius.cardLg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.md,
  },
  numbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  current: {
    fontFamily: FontFamily.display,
    fontSize: 38,
    color: Colors.gold,
    lineHeight: 40,
  },
  slash: {
    fontFamily: FontFamily.display,
    fontSize: 18,
    color: Colors.muted,
    marginLeft: 2,
  },
  caption: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  pct: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.bodySmall,
    color: Colors.gold,
    fontWeight: '700',
    minWidth: 38,
    textAlign: 'right',
  },
  stat: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.mutedWarm,
    letterSpacing: 1,
  },
});
