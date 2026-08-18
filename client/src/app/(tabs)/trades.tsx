import Feather from '@expo/vector-icons/Feather';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HeaderAvatar } from '@/components/header-avatar';
import { SegmentedControl } from '@/components/segmented-control';
import { FilterChips, TradeFilterPanel } from '@/components/trade-filter-panel';
import { TradeOfferCard } from '@/components/trade-offer-card';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { useMyOffers, type TradeOffer } from '@/lib/queries/trades';
import {
  cardMatches,
  EMPTY_SEARCH,
  PAGE_SIZE,
  RESULTS_CAP,
  userMatches,
  type TradeSearch,
} from '@/lib/trade-filter';
import { useDesktopCap, useIsDesktop } from '@/lib/use-is-desktop';
import { useFocusRefetchStale } from '@/lib/use-focus-refetch';

type Tab = 'received' | 'sent';
// Sub-sección dentro de cada tab. 'closed' agrupa rechazadas + canceladas +
// expiradas: a fines prácticos son lo mismo (no pasó nada).
type Section = 'open' | 'done' | 'closed';

function sectionOf(o: TradeOffer): Section {
  if (o.status === 'pending') return 'open';
  if (o.status === 'accepted') return 'done';
  return 'closed';
}

const SECTION_EMPTY: Record<Section, string> = {
  open: 'No hay ofertas abiertas.',
  done: 'Todavía no se concretó ningún cambio.',
  closed: 'Nada rechazado por acá.',
};

export default function TradesTab() {
  const isDesktop = useIsDesktop();
  const desktopCap = useDesktopCap(1080);
  const [tab, setTab] = useState<Tab>('received');
  const [section, setSection] = useState<Section>('open');
  const [page, setPage] = useState(0);
  // Filtros: álbum (chip, inmediato) + búsqueda de texto (carta/usuario, se
  // aplica recién al tocar "Buscar" en el panel).
  const [albumFilter, setAlbumFilter] = useState<string | null>(null);
  const [search, setSearch] = useState<TradeSearch>(EMPTY_SEARCH);
  const { received, sent, isLoading, isRefetching, refetch } = useMyOffers();

  useFocusRefetchStale(['trades', 'offers']);

  const tabList = tab === 'received' ? received : sent;
  const receivedPending = received.filter((o) => o.status === 'pending').length;
  const sentPending = sent.filter((o) => o.status === 'pending').length;

  // Álbumes presentes en el tab activo (para el chip de filtro).
  const albumOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of tabList) if (!m.has(o.album_id)) m.set(o.album_id, o.album_name);
    return [...m].map(([key, label]) => ({ key, label: label || 'Álbum' }));
  }, [tabList]);

  // El filtro de álbum aplica a los conteos de las sub-secciones (los pills);
  // el de texto se aplica después, dentro de la sección elegida.
  const albumScoped = albumFilter ? tabList.filter((o) => o.album_id === albumFilter) : tabList;

  const counts: Record<Section, number> = { open: 0, done: 0, closed: 0 };
  for (const o of albumScoped) counts[sectionOf(o)]++;

  const sectionList = albumScoped.filter((o) => sectionOf(o) === section);
  const filtered = useMemo(
    () =>
      sectionList.filter((o) => {
        if (search.card && !cardMatches(search.card, [o.offered_sticker, o.requested_sticker]))
          return false;
        // Buscamos por la contraparte: en Recibidas es quien ofrece; en
        // Enviadas, a quién le ofrecí.
        const counterpart = tab === 'received' ? o.from_user_name : o.to_user_name;
        if (search.user && !userMatches(search.user, [counterpart])) return false;
        return true;
      }),
    [sectionList, search, tab],
  );

  // Tope de resultados para no renderear listas enormes; el resto se avisa.
  const capped = filtered.slice(0, RESULTS_CAP);
  const overflowed = filtered.length > RESULTS_CAP;
  const pageCount = Math.max(1, Math.ceil(capped.length / PAGE_SIZE));
  // Clamp defensivo: si la lista se achica (refetch/filtro) la página no queda colgada.
  const safePage = Math.min(page, pageCount - 1);
  const list = capped.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  function goTab(k: Tab) {
    setTab(k);
    setPage(0);
    // El álbum elegido puede no existir en el otro tab → reset para no caer en
    // un estado vacío confuso.
    setAlbumFilter(null);
    setSearch(EMPTY_SEARCH);
  }
  function goSection(k: Section) {
    setSection(k);
    setPage(0);
  }
  function goAlbum(k: string | null) {
    setAlbumFilter(k);
    setPage(0);
  }
  function applySearch(s: TradeSearch) {
    setSearch(s);
    setPage(0);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, desktopCap]}
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
          onChange={(k) => goTab(k as Tab)}
        />

        <SegmentedControl
          options={[
            { key: 'open', label: 'Abiertas', count: counts.open },
            { key: 'done', label: 'Realizadas', count: counts.done },
            { key: 'closed', label: 'Rechazadas', count: counts.closed },
          ]}
          value={section}
          onChange={(k) => goSection(k as Section)}
        />

        {tabList.length > 0 && (
          <TradeFilterPanel search={search} onApply={applySearch} extraActive={albumFilter !== null}>
            {albumOptions.length > 1 && (
              <FilterChips
                label="ÁLBUM"
                options={albumOptions}
                value={albumFilter}
                onChange={goAlbum}
              />
            )}
          </TradeFilterPanel>
        )}

        {isLoading && tabList.length === 0 ? (
          <View style={styles.center}><ActivityIndicator color={Colors.red} /></View>
        ) : tabList.length === 0 ? (
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
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {albumFilter || search.card || search.user
                ? 'Nada coincide con el filtro.'
                : SECTION_EMPTY[section]}
            </Text>
          </View>
        ) : (
          <>
            {overflowed && (
              <Text style={styles.overflowNote}>
                Mostrando los primeros {RESULTS_CAP}. Afiná el filtro para ver el resto.
              </Text>
            )}
            <View style={[styles.cardList, isDesktop && styles.cardGrid]}>
              {list.map((o) => (
                <View key={o.id} style={isDesktop ? styles.gridItem : undefined}>
                  <TradeOfferCard offer={o} side={tab} onResolved={refetch} />
                </View>
              ))}
            </View>

            {pageCount > 1 && (
              <View style={styles.pager}>
                <Pressable
                  onPress={() => setPage(Math.max(0, safePage - 1))}
                  disabled={safePage === 0}
                  hitSlop={8}
                  style={[styles.pagerBtn, safePage === 0 && styles.pagerBtnDisabled]}
                >
                  <Feather name="chevron-left" size={18} color={Colors.ink} />
                </Pressable>
                <Text style={styles.pagerLabel}>
                  {safePage + 1} / {pageCount}
                </Text>
                <Pressable
                  onPress={() => setPage(Math.min(pageCount - 1, safePage + 1))}
                  disabled={safePage >= pageCount - 1}
                  hitSlop={8}
                  style={[styles.pagerBtn, safePage >= pageCount - 1 && styles.pagerBtnDisabled]}
                >
                  <Feather name="chevron-right" size={18} color={Colors.ink} />
                </Pressable>
              </View>
            )}
          </>
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
  overflowNote: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.inkSoft,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  pagerBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.paper2,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagerBtnDisabled: { opacity: 0.35 },
  pagerLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.bodySmall,
    fontWeight: '700',
    color: Colors.ink,
    letterSpacing: 1,
    minWidth: 44,
    textAlign: 'center',
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
