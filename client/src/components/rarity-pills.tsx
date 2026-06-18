import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily, FontSize, RarityFrame, Radius, Spacing } from '@/constants/theme';
import type { Rarity } from '@/lib/queries/stickers';

const ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
const LABEL: Record<Rarity, string> = {
  common: 'Común',
  rare: 'Rara',
  epic: 'Épica',
  legendary: 'Legendaria',
};

interface Props {
  value: Rarity;
  onChange: (r: Rarity) => void;
}

export function RarityPills({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {ORDER.map((r) => {
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
              {LABEL[r]}
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
