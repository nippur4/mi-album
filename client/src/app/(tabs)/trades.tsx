import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SegmentedControl } from '@/components/segmented-control';
import { TradeOfferCard } from '@/components/trade-offer-card';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useMyOffers } from '@/lib/queries/trades';

type Tab = 'received' | 'sent';

export default function TradesTab() {
  const [tab, setTab] = useState<Tab>('received');
  const { received, sent, isLoading, refetch } = useMyOffers();

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const list = tab === 'received' ? received : sent;
  const receivedPending = received.filter((o) => o.status === 'pending').length;
  const sentPending = sent.filter((o) => o.status === 'pending').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={Colors.red} />}
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>INTERCAMBIO</Text>
          <Text style={styles.title}>OFERTAS</Text>
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
          <View style={{ gap: Spacing.listGap }}>
            {list.map((o) => (
              <TradeOfferCard key={o.id} offer={o} side={tab} onResolved={refetch} />
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
  header: { gap: Spacing.xs },
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
