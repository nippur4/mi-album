import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { errorMessage } from '@/lib/errors';
import { useAdminStats, type AdminStatsDaily } from '@/lib/queries/admin';
import { useDesktopCap } from '@/lib/use-is-desktop';
import { useFocusRefetchStale } from '@/lib/use-focus-refetch';

// Hues de datos validados (contraste ≥3:1 sobre blanco + CVD-safe entre sí).
// Los números y labels van SIEMPRE en tinta — el color solo identifica la serie.
const BAR_BLUE = '#2D63AB';
const BAR_TERRACOTTA = '#B4552D';

export default function AdminStatsScreen() {
  const desktopCap = useDesktopCap(960);
  const { stats, isLoading, isRefetching, error, refetch } = useAdminStats();

  useFocusRefetchStale(['admin', 'stats']);

  const totals = stats?.totals;
  const daily = stats?.daily ?? [];
  const activeToday = daily.length > 0 ? daily[daily.length - 1].active : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={desktopCap}>
        <ScreenHeader
          title="Estadísticas"
          back
          right={<Feather name="bar-chart-2" size={20} color={Colors.ink} />}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, desktopCap]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.red} />
        }
      >
        {error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{errorMessage({ message: error })}</Text>
          </View>
        ) : isLoading && !stats ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.red} />
          </View>
        ) : totals ? (
          <>
            <View style={styles.tileGrid}>
              <StatTile
                label="USUARIOS"
                value={totals.total_users}
                sub={`+${totals.new_users_7d} esta semana`}
              />
              <StatTile label="ACTIVOS HOY" value={activeToday} sub="con sesión usada hoy" />
              <StatTile
                label="ÁLBUMES"
                value={totals.total_albums}
                sub={`${totals.published_albums} publicados`}
              />
              <StatTile
                label="JUGADORES / ÁLBUM"
                value={totals.avg_players_per_album ?? '—'}
                sub={`${totals.total_memberships} membresías`}
              />
              <StatTile label="FIGURITAS CARGADAS" value={totals.total_stickers} sub="en la DB (owners)" />
              <StatTile
                label="EN COLECCIONES"
                value={totals.stickers_owned}
                sub={`${totals.stickers_pasted} pegadas`}
              />
              <StatTile
                label="SOBRES ABIERTOS"
                value={totals.packs_opened}
                sub={`${totals.packs_pending} sin abrir`}
              />
              <StatTile
                label="CAMBIOS ACEPTADOS"
                value={totals.trades_accepted}
                sub={`${totals.trades_pending} pendientes`}
              />
            </View>

            <DailyBarChart
              title="USUARIOS ACTIVOS POR DÍA"
              hint="Actores distintos que usaron su sesión (login o refresh) — proxy de DAU."
              data={daily}
              field="active"
              color={BAR_BLUE}
            />

            <DailyBarChart
              title="LOGINS POR DÍA"
              hint="Inicios de sesión explícitos (magic link + Google). Con sesión persistente son raros."
              data={daily}
              field="logins"
              color={BAR_TERRACOTTA}
            />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      {sub ? <Text style={styles.tileSub}>{sub}</Text> : null}
    </View>
  );
}

const CHART_H = 110;

// Barras diarias (14 días). Serie única: el título nombra la serie, así que no
// hay leyenda. Labels selectivos: el máximo lleva su valor fijo; tap en una
// barra muestra día + valor abajo (equivalente táctil del tooltip).
function DailyBarChart({
  title,
  hint,
  data,
  field,
  color,
}: {
  title: string;
  hint: string;
  data: AdminStatsDaily[];
  field: 'active' | 'logins' | 'signups';
  color: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const values = data.map((d) => d[field]);
  const max = Math.max(...values, 1);
  const maxIdx = values.indexOf(Math.max(...values));
  const hasData = values.some((v) => v > 0);

  function fmtDay(iso: string) {
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
  }

  return (
    <View style={styles.chartCard}>
      <Text style={styles.tileLabel}>{title}</Text>
      <Text style={styles.chartHint}>{hint}</Text>

      {!hasData ? (
        <Text style={styles.chartEmpty}>Sin actividad en los últimos 14 días.</Text>
      ) : (
        <>
          <View style={styles.chartRow}>
            {data.map((d, i) => {
              const v = d[field];
              const h = v === 0 ? 2 : Math.max(4, Math.round((v / max) * CHART_H));
              const isSel = selected === i;
              return (
                <Pressable
                  key={d.day}
                  style={styles.barSlot}
                  onPress={() => setSelected(isSel ? null : i)}
                >
                  {/* Label fijo solo en el máximo (selectivo, no en cada barra) */}
                  {i === maxIdx && v > 0 && !isSel && (
                    <Text style={styles.barValue}>{v}</Text>
                  )}
                  {isSel && <Text style={styles.barValue}>{v}</Text>}
                  <View
                    style={[
                      styles.bar,
                      {
                        height: h,
                        backgroundColor: v === 0 ? Colors.border : color,
                        opacity: selected !== null && !isSel ? 0.45 : 1,
                      },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>
          <View style={styles.chartBaseline} />
          <View style={styles.chartAxis}>
            <Text style={styles.axisLabel}>{fmtDay(data[0].day)}</Text>
            {selected !== null && (
              <Text style={[styles.axisLabel, styles.axisSelected]}>
                {fmtDay(data[selected].day)} · {values[selected]}
              </Text>
            )}
            <Text style={styles.axisLabel}>{fmtDay(data[data.length - 1].day)}</Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  scroll: { padding: Spacing.screenX, paddingBottom: Spacing.xl, gap: Spacing.md },
  center: { paddingVertical: Spacing.xl, alignItems: 'center' },
  errorText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.red,
    textAlign: 'center',
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 2,
  },
  tileLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
  },
  tileValue: {
    fontFamily: FontFamily.display,
    fontSize: 30,
    color: Colors.ink,
    lineHeight: 36,
  },
  tileSub: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.inkSoft,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 4,
  },
  chartHint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.inkSoft,
    marginBottom: Spacing.sm,
  },
  chartEmpty: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.muted,
    fontStyle: 'italic',
    paddingVertical: Spacing.md,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: CHART_H + 18, // deja lugar al label del valor arriba
  },
  barSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  barValue: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.ink,
  },
  chartBaseline: {
    height: 1,
    backgroundColor: Colors.borderStrong,
  },
  chartAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  axisLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 0.5,
  },
  axisSelected: {
    color: Colors.ink,
    fontWeight: '700',
  },
});
