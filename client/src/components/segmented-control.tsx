import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';

interface Option {
  key: string;
  label: string;
  count?: number;
}

interface Props {
  options: Option[];
  value: string;
  onChange: (key: string) => void;
}

// Pill segmentado del handoff: el activo en rojo lleno, los inactivos outline.
export function SegmentedControl({ options, value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.pill, active && styles.pillActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {o.label}
            </Text>
            {typeof o.count === 'number' && (
              <Text style={[styles.count, active && styles.countActive]}>
                {o.count}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  pillActive: {
    backgroundColor: Colors.red,
    borderColor: Colors.red,
  },
  label: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '700',
    color: Colors.inkSoft,
  },
  labelActive: {
    color: Colors.paper,
  },
  count: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.muted,
    fontWeight: '700',
  },
  countActive: {
    color: Colors.paper,
    opacity: 0.85,
  },
});
