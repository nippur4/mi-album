import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily, FontSize, RarityFrame, Radius, Spacing } from '@/constants/theme';
import { RARITY_LABEL, RARITY_ORDER } from '@/lib/rarity';
import type { Rarity } from '@/lib/queries/stickers';

interface Props {
  value: Rarity;
  onChange: (r: Rarity) => void;
}

export function RarityPills({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {RARITY_ORDER.map((r) => {
        const selected = value === r;
        return (
          <Pressable
            key={r}
            onPress={() => onChange(r)}
            style={[
              styles.pill,
              { borderColor: RarityFrame[r] },
              selected && { backgroundColor: RarityFrame[r] },
            ]}
          >
            <Text style={[styles.text, selected && styles.textSelected]}>
              {RARITY_LABEL[r]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 2,
  },
  text: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '700',
    color: Colors.ink,
  },
  textSelected: {
    color: Colors.paper,
  },
});
