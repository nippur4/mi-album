import { StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';

export interface ChecklistItem {
  label: string;
  done: boolean;
  hint?: string;
}

interface Props {
  items: ChecklistItem[];
}

// Card oscura con checklist tipo "Cargá la carátula", "Cargá las figuritas".
// Cada ítem: bullet (check/empty) + label + opcional hint a la derecha.
export function Checklist({ items }: Props) {
  return (
    <View style={styles.card}>
      {items.map((item, i) => (
        <View key={i} style={[styles.row, i > 0 && styles.rowDivider]}>
          <View style={[styles.bullet, item.done && styles.bulletDone]}>
            {item.done && <Text style={styles.bulletCheck}>✓</Text>}
          </View>
          <View style={styles.textCol}>
            <Text style={[styles.label, item.done && styles.labelDone]}>{item.label}</Text>
            {item.hint && (
              <Text style={[styles.hint, item.done && styles.hintDone]}>{item.hint}</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.ink,
    borderRadius: Radius.cardLg,
    padding: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  bullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletDone: {
    backgroundColor: Colors.green,
    borderColor: Colors.green,
  },
  bulletCheck: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    fontWeight: '800',
    color: Colors.greenTextDark,
    lineHeight: 14,
  },
  label: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '600',
    color: Colors.paper,
  },
  labelDone: {
    color: Colors.muted,
    textDecorationLine: 'line-through',
  },
  hint: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabel,
    color: Colors.gold,
    letterSpacing: 1,
  },
  hintDone: {
    color: Colors.green,
  },
});
