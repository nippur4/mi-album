import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HeaderAvatar } from '@/components/header-avatar';
import { SegmentedControl } from '@/components/segmented-control';
import { TradeOfferCard } from '@/components/trade-offer-card';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useMyOffers } from '@/lib/queries/trades';
import { useIsDesktop } from '@/lib/use-is-desktop';

type Tab = 'received' | 'sent';

export default function TradesTab() {
  const isDesktop = useIsDesktop();
  const [tab, setTab] = useState<Tab>('received');
  const { received, sent, isLoading, isRefetching, refetch } = useMyOffers();

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const list = tab === 'received' ? received : sent;
  const receivedPending = received.filter((o) => o.status === 'pending').length;
  const sentPending = sent.filter((o) => o.status === 'pending').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.red} />}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>INTERCAMBIO</Text>
            <Text style={styles.title}>OFERTAS</Text>
          </View>
          <HeaderAvatar size={44} />
        </View>

        <SegmentedControl
          options={[
            { key: 'received', label: 'Recibidas', count: receivedPending || received.length },
            { key: 'sent', label: 'Enviadas', count: sentPending || sent.length },
          ]}
          value={tab}
          onChange={(k) => setTab(k as Tab)}
        />

        {isLoading && list.length === 0 ? (
          <View style={styles.center}><ActivityIndicator color={Colors.red} /></View>
        ) : list.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {tab === 'received' ? 'No tenés ofertas recibidas.' : 'Todavía no enviaste ninguna.'}
            </Text>
            <Text style={styles.emptyBody}>
              {tab === 'received'
                ? 'Cuando alguien quiera intercambiar te aparecen acá.'
                : 'Entrá a un álbum, mirá las coincidencias y proponé un cambio.'}
            </Text>
          </View>
        ) : (
          <View style={[styles.cardList, isDesktop && styles.cardGrid]}>
            {list.map((o) => (
              <View key={o.id} style={isDesktop ? styles.gridItem : undefined}>
                <TradeOfferCard offer={o} side={tab} onResolved={refetch} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  scroll: {
    paddingHorizontal: Spacing.screenX,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerText: { gap: Spacing.xs, flex: 1 },
  cardList: {
    gap: Spacing.listGap,
  },
  // Desktop: ofertas en 2 columnas.
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    flexBasis: '48%',
    flexGrow: 1,
    maxWidth: 540,
  },
  kicker: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 32,
    color: Colors.ink,
    letterSpacing: 1,
  },
  center: { paddingVertical: Spacing.xxl, alignItems: 'center' },
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
});
