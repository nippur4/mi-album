import Feather from '@expo/vector-icons/Feather';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/progress-bar';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import {
  ACHIEVEMENTS,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  unlockedCount,
  type AchievementDef,
} from '@/lib/achievements';
import { useAchievementStats, type AchievementStats } from '@/lib/queries/achievements';
import { useDesktopCap } from '@/lib/use-is-desktop';
import { useFocusRefetchStale } from '@/lib/use-focus-refetch';

export default function AchievementsScreen() {
  const { stats } = useAchievementStats();
  const desktopCap = useDesktopCap(560);
  // Al desbloquear un logro (abrir sobres, pegar, crear álbum) el stat cambia:
  // refetch al recuperar foco si está stale, sin polling.
  useFocusRefetchStale(['achievements']);

  const total = ACHIEVEMENTS.length;
  const unlocked = unlockedCount(stats);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Logros" back />
      <ScrollView contentContainerStyle={[styles.scroll, desktopCap]}>
        {/* Resumen */}
        <View style={styles.summary}>
          <Feather name="award" size={22} color={Colors.gold} />
          <Text style={styles.summaryText}>
            {unlocked} de {total} logros
          </Text>
        </View>
        <ProgressBar value={total > 0 ? unlocked / total : 0} height={8} />

        {CATEGORY_ORDER.map((cat) => {
          const defs = ACHIEVEMENTS.filter((a) => a.category === cat);
          if (defs.length === 0) return null;
          return (
            <View key={cat} style={styles.section}>
              <Text style={styles.sectionLabel}>{CATEGORY_LABEL[cat]}</Text>
              <View style={styles.cards}>
                {defs.map((def) => (
                  <AchievementCard key={def.id} def={def} stats={stats} />
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function AchievementCard({ def, stats }: { def: AchievementDef; stats: AchievementStats }) {
  const { unlocked, current, target } = def.evaluate(stats);
  // Barra de progreso solo para logros por umbral no cumplidos aún y con más de
  // un paso (los binarios de especiales no la muestran).
  const showProgress = !unlocked && target > 1;
  const ratio = target > 0 ? Math.min(1, current / target) : 0;

  return (
    <View style={[styles.card, unlocked && styles.cardUnlocked]}>
      <View style={[styles.iconWrap, unlocked ? styles.iconWrapOn : styles.iconWrapOff]}>
        <Feather
          name={def.icon as any}
          size={22}
          color={unlocked ? Colors.ink : Colors.muted}
        />
        {!unlocked && (
          <View style={styles.lockBadge}>
            <Feather name="lock" size={10} color={Colors.paper} />
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        <Text style={[styles.cardName, !unlocked && styles.cardNameOff]} numberOfLines={1}>
          {def.name}
        </Text>
        <Text style={styles.cardDesc} numberOfLines={2}>
          {def.description}
        </Text>
        {showProgress && (
          <View style={styles.progressRow}>
            <ProgressBar value={ratio} height={5} />
            <Text style={styles.progressText}>
              {Math.min(current, target)}/{target}
            </Text>
          </View>
        )}
      </View>

      {unlocked && (
        <Feather name="check-circle" size={20} color={Colors.green} style={styles.check} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  scroll: {
    paddingHorizontal: Spacing.screenX,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  summaryText: {
    fontFamily: FontFamily.display,
    fontSize: 22,
    color: Colors.ink,
    letterSpacing: 0.5,
  },
  section: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  sectionLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  cards: {
    gap: Spacing.listGap,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  cardUnlocked: {
    backgroundColor: '#FFFFFF',
    borderColor: Colors.gold,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapOn: {
    backgroundColor: Colors.gold,
  },
  iconWrapOff: {
    backgroundColor: Colors.paper3,
  },
  lockBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.paper2,
  },
  cardBody: { flex: 1, gap: 2 },
  cardName: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '800',
    color: Colors.ink,
  },
  cardNameOff: {
    color: Colors.inkSoft,
  },
  cardDesc: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
    lineHeight: 17,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 6,
  },
  progressText: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.muted,
    fontWeight: '700',
    letterSpacing: 0.5,
    minWidth: 46,
    textAlign: 'right',
  },
  check: {
    marginLeft: Spacing.xs,
  },
});
