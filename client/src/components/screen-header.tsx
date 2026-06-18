import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';

import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';

interface Props {
  title: string;
  back?: boolean;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function ScreenHeader({ title, back, right, style }: Props) {
  const router = useRouter();
  return (
    <View style={[styles.row, style]}>
      <View style={styles.side}>
        {back && router.canGoBack() && (
          <Pressable onPress={router.back} hitSlop={12} style={styles.backHit}>
            <Text style={styles.chevron}>{'‹'}</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={[styles.side, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenX,
    minHeight: 48,
    gap: Spacing.sm,
  },
  side: {
    width: 40,
    justifyContent: 'center',
  },
  backHit: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  chevron: {
    fontFamily: FontFamily.body,
    fontSize: 30,
    fontWeight: '700',
    color: Colors.ink,
    lineHeight: 30,
  },
  title: {
    flex: 1,
    fontFamily: FontFamily.display,
    fontSize: FontSize.screenTitle,
    color: Colors.ink,
    textAlign: 'center',
  },
});
