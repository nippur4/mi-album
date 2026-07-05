import Feather from '@expo/vector-icons/Feather';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BottomSheet, sheetStyles } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { Stepper } from '@/components/stepper';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { errorMessage } from '@/lib/errors';
import { proFeatureHint } from '@/lib/upsell-copy';
import {
  applyMode,
  DEFAULT_TRADE_CONFIG,
  limitToPresetKey,
  modeFromConfig,
  PACK_SIZE_OPTIONS,
  TRADE_LIMIT_OPTIONS,
  updateAlbumEconomy,
  WELCOME_FREE_OPTIONS,
  WELCOME_PRO_OPTIONS,
  type DeliveryMode,
  type PackConfig,
  type TradeConfig,
} from '@/lib/queries/economy';

interface Props {
  visible: boolean;
  albumId: string;
  currentConfig: PackConfig;
  currentTradeConfig: TradeConfig;
  isPro: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const WEEKLY_HOURS = 168;
const DAILY_HOURS = 24;

// Modal de configuración de economía. Se usa tanto al publicar (donde forma
// parte del checklist) como después (mientras esté published o draft).
// Free: solo "sobre diario" + 1 sobre + frecuencia diaria. Pro: todo.
export function EditEconomyModal({
  visible,
  albumId,
  currentConfig,
  currentTradeConfig,
  isPro,
  onClose,
  onSaved,
}: Props) {
  const [config, setConfig] = useState<PackConfig>(currentConfig);
  const [tradeConfig, setTradeConfig] = useState<TradeConfig>(currentTradeConfig);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resetear cuando se abre, para no arrastrar edits cancelados.
  useEffect(() => {
    if (visible) {
      setConfig(currentConfig);
      setTradeConfig(currentTradeConfig);
      setError(null);
    }
  }, [visible, currentConfig, currentTradeConfig]);

  const mode = modeFromConfig(config);
  const packSize = config.pack_size ?? 5;
  const weekly = config.daily.cooldown_hours >= WEEKLY_HOURS;
  const welcomeCount = config.welcome?.enabled ? (config.welcome.count ?? 1) : 0;
  const welcomeOptions = isPro ? WELCOME_PRO_OPTIONS : WELCOME_FREE_OPTIONS;
  const tradeLimitKey = limitToPresetKey(tradeConfig.limit);

  function setWelcomeCount(n: number) {
    setConfig((c) => ({
      ...c,
      welcome: n === 0
        ? { enabled: false, count: 0 }
        : { enabled: true, count: n },
    }));
  }

  function setTradeEnabled(enabled: boolean) {
    if (!isPro) return; // free no puede tocar el toggle
    setTradeConfig((t) => ({ ...t, enabled }));
  }

  function setTradeLimitKey(key: string) {
    if (!isPro) return;
    const option = TRADE_LIMIT_OPTIONS.find((o) => o.key === key);
    if (!option) return;
    setTradeConfig((t) => ({ ...t, limit: option.value ?? null }));
  }

  function setMode(m: DeliveryMode) {
    // Free no puede elegir QR ni ambos
    if (!isPro && (m === 'qr' || m === 'both')) return;
    setConfig((c) => applyMode(c, m));
  }

  function setDailyCount(n: number) {
    setConfig((c) => ({ ...c, daily: { ...c.daily, count: n } }));
  }
  function setQrCount(n: number) {
    setConfig((c) => ({ ...c, qr: { ...c.qr, count: n } }));
  }
  function setWeekly(isWeekly: boolean) {
    if (!isPro && isWeekly) return;
    setConfig((c) => ({
      ...c,
      daily: { ...c.daily, cooldown_hours: isWeekly ? WEEKLY_HOURS : DAILY_HOURS },
    }));
  }
  function setPackSize(n: number) {
    setConfig((c) => ({ ...c, pack_size: n }));
  }

  const canSave = useMemo(() => {
    if (mode === 'none') return false;
    // Free: forzar daily.count=1 y diaria
    if (!isPro) {
      if (mode !== 'daily') return false;
      if (config.daily.count !== 1) return false;
      if (config.daily.cooldown_hours !== DAILY_HOURS) return false;
    }
    return !saving;
  }, [mode, isPro, config, saving]);

  async function onSave() {
    setError(null);
    setSaving(true);
    const payload: PackConfig = {
      ...config,
      // Free: normalizar daily.count=1 y cooldown_hours=24
      daily: !isPro && mode === 'daily'
        ? { ...config.daily, count: 1, cooldown_hours: DAILY_HOURS }
        : config.daily,
    };
    // Free no puede editar trades, así que mandamos siempre el default enabled
    // sin límite. Si el owner era Pro antes y ahora es free, esto normaliza.
    const tradePayload: TradeConfig = isPro ? tradeConfig : DEFAULT_TRADE_CONFIG;
    const { error: rpcErr } = await updateAlbumEconomy(albumId, payload, tradePayload);
    setSaving(false);
    if (rpcErr) {
      setError(errorMessage(rpcErr));
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Cómo se consiguen las figuritas"
      maxHeight="92%"
      avoidKeyboard="ios"
      footer={
        <View style={sheetStyles.actions}>
          <Button label="Cancelar" variant="outline" onPress={onClose} />
          <Button label="Guardar" onPress={onSave} disabled={!canSave} loading={saving} />
        </View>
      }
    >
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
                {/* Modo */}
                <Text style={styles.label}>MODO</Text>
                <View style={styles.modeList}>
                  <ModeOption
                    title="Solo sobre diario"
                    subtitle="Los jugadores reclaman 1 sobre por día gratis."
                    selected={mode === 'daily'}
                    locked={false}
                    onPress={() => setMode('daily')}
                  />
                  <ModeOption
                    title="Solo QR"
                    subtitle="Los jugadores escanean tu QR para sumar sobres."
                    selected={mode === 'qr'}
                    locked={!isPro}
                    onPress={() => setMode('qr')}
                  />
                  <ModeOption
                    title="Ambos"
                    subtitle="Sobre diario + escaneo de QR."
                    selected={mode === 'both'}
                    locked={!isPro}
                    onPress={() => setMode('both')}
                  />
                </View>

                {/* Daily config */}
                {(mode === 'daily' || mode === 'both') && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Sobre diario</Text>
                    <Text style={styles.fieldLabel}>FRECUENCIA</Text>
                    <View style={styles.chipRow}>
                      <Chip
                        label="Diaria"
                        selected={!weekly}
                        onPress={() => setWeekly(false)}
                      />
                      <Chip
                        label="Semanal"
                        selected={weekly}
                        locked={!isPro}
                        onPress={() => setWeekly(true)}
                      />
                    </View>
                    <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>
                      SOBRES POR PERÍODO
                    </Text>
                    {isPro ? (
                      <Stepper
                        value={config.daily.count}
                        onChange={setDailyCount}
                        min={1}
                        max={10}
                        step={1}
                      />
                    ) : (
                      <View style={styles.freeNotice}>
                        <Text style={styles.freeNoticeText}>
                          {proFeatureHint('Gratis: 1 sobre por día. Configurar más es Pro.')}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* QR config */}
                {(mode === 'qr' || mode === 'both') && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Por escaneo de QR</Text>
                    <Text style={styles.fieldLabel}>SOBRES POR ESCANEO</Text>
                    <Stepper
                      value={config.qr.count}
                      onChange={setQrCount}
                      min={1}
                      max={10}
                      step={1}
                    />
                    <Text style={styles.hint}>
                      Cada jugador puede escanear una vez por día (cooldown 24 hs).
                    </Text>
                  </View>
                )}

                {/* Pack size */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Tamaño del sobre</Text>
                  <Text style={styles.fieldLabel}>FIGURITAS POR SOBRE</Text>
                  <View style={styles.chipRow}>
                    {PACK_SIZE_OPTIONS.map((n) => (
                      <Chip
                        key={n}
                        label={String(n)}
                        selected={packSize === n}
                        onPress={() => setPackSize(n)}
                      />
                    ))}
                  </View>
                </View>

                {/* Welcome pack */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Sobre de bienvenida</Text>
                  <Text style={styles.fieldLabel}>CUÁNTOS SOBRES AL UNIRSE</Text>
                  <View style={styles.chipRow}>
                    {welcomeOptions.map((n) => (
                      <Chip
                        key={n}
                        label={n === 0 ? 'Sin welcome' : String(n)}
                        selected={welcomeCount === n}
                        onPress={() => setWelcomeCount(n)}
                      />
                    ))}
                  </View>
                  {!isPro && (
                    <Text style={styles.hint}>
                      {proFeatureHint('Free: 0, 1 o 3 sobres. Cualquier otra cantidad es Pro.')}
                    </Text>
                  )}
                </View>

                {/* Intercambios */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Intercambios</Text>
                  {!isPro ? (
                    <View style={styles.freeNotice}>
                      <Text style={styles.freeNoticeText}>
                        {proFeatureHint('Gratis: los jugadores pueden intercambiar sin límite. Configurar restricciones es Pro.')}
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.fieldLabel}>PERMITIR INTERCAMBIOS</Text>
                      <View style={styles.chipRow}>
                        <Chip
                          label="Sí"
                          selected={tradeConfig.enabled}
                          onPress={() => setTradeEnabled(true)}
                        />
                        <Chip
                          label="No"
                          selected={!tradeConfig.enabled}
                          onPress={() => setTradeEnabled(false)}
                        />
                      </View>
                      {tradeConfig.enabled && (
                        <>
                          <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>
                            LÍMITE POR JUGADOR
                          </Text>
                          <View style={styles.chipRow}>
                            {TRADE_LIMIT_OPTIONS.map((o) => (
                              <Chip
                                key={o.key}
                                label={o.label}
                                selected={tradeLimitKey === o.key}
                                onPress={() => setTradeLimitKey(o.key)}
                              />
                            ))}
                          </View>
                        </>
                      )}
                    </>
                  )}
                </View>

                {error && <Text style={styles.error}>{error}</Text>}
            </ScrollView>
    </BottomSheet>
  );
}

function ModeOption({
  title,
  subtitle,
  selected,
  locked,
  onPress,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  locked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      style={({ pressed }) => [
        styles.modeCard,
        selected && styles.modeCardSelected,
        pressed && !locked && styles.modeCardPressed,
        locked && styles.modeCardLocked,
      ]}
    >
      <View style={styles.modeText}>
        <View style={styles.modeTitleRow}>
          <Text style={styles.modeTitle}>{title}</Text>
          {locked && (
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          )}
        </View>
        <Text style={styles.modeSub}>{subtitle}</Text>
      </View>
      {selected && (
        <View style={styles.check}>
          <Feather name="check" size={16} color={Colors.paper} />
        </View>
      )}
    </Pressable>
  );
}

function Chip({
  label,
  selected,
  locked,
  onPress,
}: {
  label: string;
  selected: boolean;
  locked?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && !locked && styles.chipPressed,
        locked && styles.chipLocked,
      ]}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
        {label}
      </Text>
      {locked && (
        <View style={styles.chipProBadge}>
          <Text style={styles.proBadgeText}>PRO</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // flexShrink:1 le permite al ScrollView comprimirse cuando el sheet llega
  // al maxHeight, dejando espacio fijo para las actions de abajo. Sin esto
  // el contenido empuja a las actions fuera del viewport y no se ve Guardar.
  scroll: { flexShrink: 1 },
  scrollContent: { paddingBottom: Spacing.md },
  label: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
  },
  fieldLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
  },
  section: {
    marginTop: Spacing.lg,
    gap: Spacing.xs,
  },
  sectionTitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
    marginBottom: Spacing.sm,
  },
  modeList: {
    gap: Spacing.sm,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  modeCardSelected: {
    borderColor: Colors.red,
    backgroundColor: '#FFFFFF',
  },
  modeCardPressed: {
    opacity: 0.85,
  },
  modeCardLocked: {
    opacity: 0.6,
  },
  modeText: { flex: 1, gap: 2 },
  modeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  modeTitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  modeSub: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBadge: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proBadgeText: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    color: Colors.ink,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    minWidth: 60,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.paper2,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  chipSelected: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  chipPressed: {
    opacity: 0.85,
  },
  chipLocked: {
    opacity: 0.6,
  },
  chipLabel: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  chipLabelSelected: {
    color: Colors.paper,
  },
  chipProBadge: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  hint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.inkSoft,
    marginTop: Spacing.xs,
  },
  freeNotice: {
    backgroundColor: Colors.paper2,
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  freeNoticeText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
  },
  error: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.red,
    marginTop: Spacing.md,
  },
});
