import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';

interface Props {
  page: number; // 0-indexed
  pageCount: number;
  onChange: (p: number) => void;
}

export function Pager({ page, pageCount, onChange }: Props) {
  if (pageCount <= 1) return null;
  return (
    <View style={styles.pager}>
      <Pressable
        onPress={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        hitSlop={8}
        style={[styles.btn, page === 0 && styles.disabled]}
      >
        <Feather name="chevron-left" size={18} color={Colors.ink} />
      </Pressable>
      <Text style={styles.label}>
        {page + 1} / {pageCount}
      </Text>
      <Pressable
        onPress={() => onChange(Math.min(pageCount - 1, page + 1))}
        disabled={page >= pageCount - 1}
        hitSlop={8}
        style={[styles.btn, page >= pageCount - 1 && styles.disabled]}
      >
        <Feather name="chevron-right" size={18} color={Colors.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  btn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.paper2,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.35 },
  label: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.bodySmall,
    fontWeight: '700',
    color: Colors.ink,
    letterSpacing: 1,
    minWidth: 44,
    textAlign: 'center',
  },
});
