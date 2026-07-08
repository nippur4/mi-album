import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ScreenHeader } from '@/components/screen-header';
import { SegmentedControl } from '@/components/segmented-control';
import { StickerCell } from '@/components/sticker-cell';
import { StickerMini } from '@/components/sticker-mini';
import { Colors, FontFamily, FontSize, Layout, Radius, Spacing } from '@/constants/theme';
import { useAlbumDetail } from '@/lib/queries/albums';
import { usePlayerAlbumSideData } from '@/lib/queries/player-album';
import { setTradePrefs, useAlbumMatches, useTradeLimitStatus, type TradeLimitStatus } from '@/lib/queries/trades';
import { useDesktopCap } from '@/lib/use-is-desktop';

type Tab = 'repes' | 'matches';

export default function TradeMatchesScreen() {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const router = useRouter();
  const desktopCap = useDesktopCap(720);
  const [tab, setTab] = useState<Tab>('repes');

  const { album, stickers } = useAlbumDetail(albumId);
  const {
    collection,
    tradeWhenComplete,
    acceptOwned,
    refetch: refetchSide,
  } = usePlayerAlbumSideData(albumId);
  const { matches, isLoading } = useAlbumMatches(albumId);
  const { status: tradeLimit } = useTradeLimitStatus(albumId);
  // Default a habilitado mientras carga, para no ocultar acciones de más.
  const tradeEnabled = tradeLimit?.enabled !== false;

  // ¿Completé este álbum? (pegadas >= total) — para el hint de las settings.
  const pastedCount = useMemo(
    () => [...collection.values()].filter((e) => e.pasted).length,
    [collection],
  );
  const isComplete = !!album && album.total_stickers > 0 && pastedCount >= album.total_stickers;

  // Figuritas que puedo cambiar: stock = quantity - (pasted?1:0) > 0. Incluye
  // dos casos distintos que NO hay que confundir:
  //   - Repe real: la tengo pegada y me sobran copias (repeCount = quantity - 1 > 0).
  //   - Sin pegar: la tengo pero no la pegué (aunque sea una sola). Es cambiable,
  //     pero NO es "repe" — sólo está sin pegar. Se muestra con estado to_paste.
  const tradables = useMemo(() => {
    const stickerById = new Map(stickers.map((s) => [s.id, s]));
    const out: Array<{ sticker: any; repeCount: number; pasted: boolean }> = [];
    for (const entry of collection.values()) {
      const sticker = stickerById.get(entry.sticker_id);
      if (!sticker) continue;
      const tradable = entry.quantity - (entry.pasted ? 1 : 0);
      if (tradable > 0) {
        out.push({ sticker, repeCount: Math.max(0, entry.quantity - 1), pasted: entry.pasted });
      }
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
        <TradeRuleBanner status={tradeLimit} />
        <SegmentedControl
          options={[
            { key: 'repes', label: 'Para cambiar', count: tradables.length },
            { key: 'matches', label: 'Coincidencias', count: matches.length },
          ]}
          value={tab}
          onChange={(k) => setTab(k as Tab)}
        />
        </View>

        <ScrollView contentContainerStyle={[styles.scroll, desktopCap]}>
          {tab === 'repes' ? (
            tradables.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Aún no tenés figuritas para cambiar.</Text>
                <Text style={styles.emptyBody}>
                  Cuando te sobren repetidas o tengas figuritas sin pegar las vas a poder cambiar.
                </Text>
              </View>
            ) : (
              <View style={styles.repesGrid}>
                {tradables.map(({ sticker, repeCount, pasted }) => (
                  <View key={sticker.id} style={styles.repeCell}>
                    {/* Repe real (pegada + sobran) → badge "REPE ×N". Sin pegar →
                        estado to_paste (gold), NO se marca como repe. */}
                    <StickerCell
                      sticker={sticker}
                      state={pasted ? 'pasted' : 'to_paste'}
                      extraCount={repeCount}
                    />
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
                  disabled={!tradeEnabled}
                  style={({ pressed }) => [
                    styles.matchCard,
                    pressed && styles.matchPressed,
                    !tradeEnabled && styles.matchDisabled,
                  ]}
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

          <TradePrefsSection
            albumId={albumId!}
            tradeWhenComplete={tradeWhenComplete}
            acceptOwned={acceptOwned}
            isComplete={isComplete}
            onSaved={refetchSide}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// Settings de cambio del jugador para ESTE álbum (por-usuario-por-álbum),
// default off. El lugar más intuitivo para definirlas es acá, en CAMBIOS.
function TradePrefsSection({
  albumId,
  tradeWhenComplete,
  acceptOwned,
  isComplete,
  onSaved,
}: {
  albumId: string;
  tradeWhenComplete: boolean;
  acceptOwned: boolean;
  isComplete: boolean;
  onSaved: () => void;
}) {
  const [twc, setTwc] = useState(tradeWhenComplete);
  const [ao, setAo] = useState(acceptOwned);
  const [busy, setBusy] = useState(false);

  // Sincronizar si cambia el server (refetch tras guardar / entrar).
  useEffect(() => { setTwc(tradeWhenComplete); setAo(acceptOwned); }, [tradeWhenComplete, acceptOwned]);

  async function save(nextTwc: boolean, nextAo: boolean) {
    const prevTwc = twc, prevAo = ao;
    setTwc(nextTwc); setAo(nextAo);
    setBusy(true);
    const { error } = await setTradePrefs(albumId, nextTwc, nextAo);
    setBusy(false);
    if (error) {
      setTwc(prevTwc); setAo(prevAo);
      return;
    }
    onSaved();
  }

  return (
    <View style={styles.prefs}>
      <Text style={styles.prefsLabel}>MIS PREFERENCIAS DE CAMBIO</Text>

      <View style={styles.prefRow}>
        <View style={styles.prefText}>
          <Text style={styles.prefTitle}>Seguir cambiando con álbum completo</Text>
          <Text style={styles.prefHint}>
            Al completar no recibís sobres nuevos, pero podés cambiar tus repes para ayudar a un amigo.
          </Text>
        </View>
        <Switch
          value={twc}
          onValueChange={(v) => save(v, ao)}
          disabled={busy}
          trackColor={{ true: Colors.green, false: Colors.paper3 }}
          thumbColor={twc ? Colors.paper : Colors.paper2}
        />
      </View>

      <View style={styles.prefRow}>
        <View style={styles.prefText}>
          <Text style={styles.prefTitle}>Aceptar figuritas que ya tengo</Text>
          <Text style={styles.prefHint}>
            Permití recibir en un cambio una figurita repetida (hace falta para ayudar cuando completaste).
          </Text>
        </View>
        <Switch
          value={ao}
          onValueChange={(v) => save(twc, v)}
          disabled={busy}
          trackColor={{ true: Colors.green, false: Colors.paper3 }}
          thumbColor={ao ? Colors.paper : Colors.paper2}
        />
      </View>

      {isComplete && twc && !ao && (
        <Text style={styles.prefWarn}>
          Para ayudar con tus repes necesitás también "Aceptar figuritas que ya tengo".
        </Text>
      )}
    </View>
  );
}

// Banner con las reglas de intercambio del álbum, para que el jugador las
// conozca antes de intentar cambiar (antes solo se enteraba con el error).
const PERIOD_LABEL: Record<string, string> = { day: 'día', week: 'semana', month: 'mes' };

function TradeRuleBanner({ status }: { status: TradeLimitStatus | null }) {
  if (!status) return null; // cargando

  let icon: 'slash' | 'repeat' | 'alert-circle' = 'repeat';
  let text: string;
  let tone: 'off' | 'ok' | 'warn' = 'ok';

  if (!status.enabled) {
    icon = 'slash';
    tone = 'off';
    text = 'Los cambios están desactivados en este álbum.';
  } else if (status.unlimited) {
    text = 'Cambios sin límite en este álbum.';
  } else {
    const period = PERIOD_LABEL[status.period ?? 'day'] ?? 'período';
    const count = status.count ?? 0;
    const remaining = status.remaining ?? 0;
    tone = remaining === 0 ? 'warn' : 'ok';
    icon = remaining === 0 ? 'alert-circle' : 'repeat';
    text = `Hasta ${count} cambio${count === 1 ? '' : 's'} por ${period}. Te queda${remaining === 1 ? '' : 'n'} ${remaining}.`;
  }

  const color = tone === 'off' ? Colors.muted : tone === 'warn' ? Colors.amberWarn : Colors.ink;
  return (
    <View style={[styles.ruleBanner, tone === 'off' && styles.ruleBannerOff]}>
      <Feather name={icon} size={14} color={color} />
      <Text style={[styles.ruleText, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  ruleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  ruleBannerOff: {
    borderColor: Colors.muted,
  },
  ruleText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '600',
  },
  matchDisabled: {
    opacity: 0.5,
  },
  prefs: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.md,
  },
  prefsLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  prefText: { flex: 1, gap: 2 },
  prefTitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '700',
    color: Colors.ink,
  },
  prefHint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.inkSoft,
    lineHeight: 16,
  },
  prefWarn: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.amberWarn,
  },
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
