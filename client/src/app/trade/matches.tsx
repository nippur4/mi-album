import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ScreenHeader } from '@/components/screen-header';
import { SegmentedControl } from '@/components/segmented-control';
import { StickerCell } from '@/components/sticker-cell';
import { StickerMini } from '@/components/sticker-mini';
import { Colors, FontFamily, FontSize, Layout, Radius, Spacing } from '@/constants/theme';
import { useAlbumDetail } from '@/lib/queries/albums';
import { usePlayerAlbumSideData } from '@/lib/queries/player-album';
import { useAlbumMatches } from '@/lib/queries/trades';
import { useDesktopCap } from '@/lib/use-is-desktop';

type Tab = 'repes' | 'matches';

export default function TradeMatchesScreen() {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const router = useRouter();
  const desktopCap = useDesktopCap(720);
  const [tab, setTab] = useState<Tab>('repes');

  const { album, stickers } = useAlbumDetail(albumId);
  const { collection } = usePlayerAlbumSideData(albumId);
  const { matches, isLoading } = useAlbumMatches(albumId);

  // Repes intercambiables: figuritas que tengo con stock = quantity - (pasted?1:0) > 0
  const myRepes = useMemo(() => {
    const stickerById = new Map(stickers.map((s) => [s.id, s]));
    const out: Array<{ sticker: any; extraCount: number }> = [];
    for (const entry of collection.values()) {
      const sticker = stickerById.get(entry.sticker_id);
      if (!sticker) continue;
      const tradable = entry.quantity - (entry.pasted ? 1 : 0);
      if (tradable > 0) out.push({ sticker, extraCount: tradable });
    }
    out.sort((a, b) => a.sticker.number - b.sticker.number);
    return out;
  }, [collection, stickers]);

  if (!album) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Cambios" back />
        {isLoading && <View style={styles.center}><ActivityIndicator color={Colors.red} /></View>}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={desktopCap}>
        <ScreenHeader title="Cambios" back />
        <View style={styles.subhead}>
          <Text style={styles.subheadAlbum}>{album.name.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={desktopCap}>
        <SegmentedControl
          options={[
            { key: 'repes', label: 'Mis repes', count: myRepes.length },
            { key: 'matches', label: 'Coincidencias', count: matches.length },
          ]}
          value={tab}
          onChange={(k) => setTab(k as Tab)}
        />
        </View>

        <ScrollView contentContainerStyle={[styles.scroll, desktopCap]}>
          {tab === 'repes' ? (
            myRepes.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Aún no tenés figuritas repetidas.</Text>
                <Text style={styles.emptyBody}>
                  Cuando abras sobres y te salgan repetidas las vas a poder cambiar.
                </Text>
              </View>
            ) : (
              <View style={styles.repesGrid}>
                {myRepes.map(({ sticker, extraCount }) => (
                  <View key={sticker.id} style={styles.repeCell}>
                    <StickerCell sticker={sticker} extraCount={extraCount} />
                  </View>
                ))}
              </View>
            )
          ) : matches.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Todavía no hay coincidencias.</Text>
              <Text style={styles.emptyBody}>
                Cuando otros usuarios tengan lo que te falta y vos lo que ellos buscan, aparecen acá.
              </Text>
            </View>
          ) : (
            <View style={{ gap: Spacing.md }}>
              {matches.map((m, i) => (
                <Pressable
                  key={`${m.other_user_id}-${m.they_give_sticker_id}-${m.i_give_sticker_id}-${i}`}
                  style={({ pressed }) => [styles.matchCard, pressed && styles.matchPressed]}
                  onPress={() =>
                    router.push(
                      `/trade/new?albumId=${albumId}&toUser=${m.other_user_id}&offered=${m.i_give_sticker_id}&requested=${m.they_give_sticker_id}`,
                    )
                  }
                >
                  <Avatar source={m.other_user_name || 'Usuario'} size={40} />
                  <View style={styles.matchCenter}>
                    <Text style={styles.matchName}>{m.other_user_name}</Text>
                    <View style={styles.matchRow}>
                      <StickerMini
                        thumbKey={m.i_give_sticker_thumb_key}
                        number={m.i_give_sticker_number}
                        name={m.i_give_sticker_name}
                        rarity={m.i_give_sticker_rarity}
                        size="sm"
                      />
                      <View style={styles.swap}>
                        <Feather name="repeat" size={14} color={Colors.paper} />
                      </View>
                      <StickerMini
                        thumbKey={m.they_give_sticker_thumb_key}
                        number={m.they_give_sticker_number}
                        name={m.they_give_sticker_name}
                        rarity={m.they_give_sticker_rarity}
                        size="sm"
                      />
                    </View>
                  </View>
                  <View style={styles.cta}>
                    <Text style={styles.ctaText}>Ofrecer</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subhead: {
    paddingHorizontal: Spacing.screenX,
    paddingBottom: Spacing.sm,
  },
  subheadAlbum: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 2,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.screenX,
    gap: Spacing.md,
  },
  scroll: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  empty: {
    paddingTop: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  repesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.gridGap,
  },
  repeCell: {
    flexBasis: '23%',
    flexGrow: 0,
    flexShrink: 0,
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  matchPressed: { opacity: 0.85 },
  matchCenter: { flex: 1, gap: 6 },
  matchName: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '700',
    color: Colors.ink,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  swap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    backgroundColor: Colors.red,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  ctaText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '800',
    color: Colors.paper,
    letterSpacing: 0.5,
  },
});
