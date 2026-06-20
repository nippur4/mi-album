import { StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily, FontSize, Radius } from '@/constants/theme';

type Status = 'draft' | 'published' | 'read_only' | 'archived';
type Variant = 'free' | 'pro' | Status;

interface Props {
  variant: Variant;
}

const LABEL: Record<Variant, string> = {
  draft: 'BORRADOR',
  published: 'PUBLICADO',
  read_only: 'PAUSADO',
  archived: 'ARCHIVADO',
  free: 'PLAN FREE',
  pro: 'PLAN PRO',
};

function palette(v: Variant): { bg: string; fg: string } {
  switch (v) {
    case 'draft':     return { bg: Colors.paper3, fg: Colors.inkSoft };
    case 'published': return { bg: Colors.green, fg: Colors.greenTextDark };
    case 'read_only': return { bg: Colors.amberWarnBg, fg: Colors.amberWarn };
    case 'archived':  return { bg: Colors.paper3, fg: Colors.muted };
    case 'free':      return { bg: Colors.paper3, fg: Colors.inkSoft };
    case 'pro':       return { bg: Colors.gold, fg: Colors.ink };
  }
}

export function StatusBadge({ variant }: Props) {
  const c = palette(variant);
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{LABEL[variant]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});
