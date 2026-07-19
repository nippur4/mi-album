import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { callEdgeFunction } from '@/lib/edge';
import { useDesktopCap } from '@/lib/use-is-desktop';

interface GcResult {
  listed: number;
  live_keys: number;
  orphans: number;
  skipped_recent: number;
  deleted: number;
  failed: number;
  remaining: number;
  dry_run: boolean;
  sample: string[];
}

// Limpieza de imágenes huérfanas en R2 (admin-only). Dos pasos deliberados:
// primero "Analizar" (dry run, solo informa), después "Eliminar" habilitado
// recién con el análisis a la vista. El server (gc_orphan_images) igual
// defaultea a dry run y nunca toca objetos subidos en las últimas 24h.
export default function AdminCleanupScreen() {
  const desktopCap = useDesktopCap(760);
  const [running, setRunning] = useState<'scan' | 'delete' | null>(null);
  const [result, setResult] = useState<GcResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(dryRun: boolean) {
    setRunning(dryRun ? 'scan' : 'delete');
    setError(null);
    try {
      const r = await callEdgeFunction<GcResult>(
        'gc_orphan_images',
        { dry_run: dryRun, max_delete: 500 },
        // Lista el bucket completo + borra de a 500: puede tardar.
        { timeoutMs: 120_000 },
      );
      setResult(r);
    } catch (err: any) {
      setError(err?.error ?? 'Falló la limpieza.');
    } finally {
      setRunning(null);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={desktopCap}>
        <ScreenHeader
          title="Limpieza R2"
          back
          right={<Feather name="trash-2" size={20} color={Colors.ink} />}
        />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, desktopCap]}>
        <View style={styles.card}>
          <Text style={styles.cardText}>
            La DB guarda solo keys y nunca borra de R2: quedan imágenes huérfanas al
            eliminar álbumes/figuritas/plantillas o re-subir una imagen. Analizá
            primero (no borra nada); lo subido en las últimas 24 h nunca se toca.
          </Text>
        </View>

        <Button
          label={running === 'scan' ? 'Analizando…' : 'Analizar (no borra nada)'}
          variant="outline"
          onPress={() => run(true)}
          disabled={running !== null}
          loading={running === 'scan'}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        {result && (
          <View style={styles.card}>
            <Stat label="OBJETOS EN R2" value={result.listed} />
            <Stat label="KEYS VIVAS EN DB" value={result.live_keys} />
            <Stat label="HUÉRFANAS" value={result.orphans} highlight />
            <Stat label="RECIENTES (SALTEADAS)" value={result.skipped_recent} />
            {!result.dry_run && (
              <>
                <Stat label="BORRADAS" value={result.deleted} />
                {result.failed > 0 && <Stat label="FALLARON" value={result.failed} />}
                <Stat label="QUEDAN" value={result.remaining} />
              </>
            )}
            {result.sample.length > 0 && (
              <>
                <Text style={styles.sampleLabel}>MUESTRA</Text>
                {result.sample.slice(0, 8).map((k) => (
                  <Text key={k} style={styles.sampleKey} numberOfLines={1}>
                    {k}
                  </Text>
                ))}
              </>
            )}
          </View>
        )}

        {result && result.remaining > 0 && (
          <Button
            label={
              running === 'delete'
                ? 'Borrando…'
                : `Eliminar ${Math.min(result.remaining, 500)} huérfana${result.remaining === 1 ? '' : 's'}`
            }
            onPress={() => run(false)}
            disabled={running !== null}
            loading={running === 'delete'}
          />
        )}
        {result && result.orphans === 0 && (
          <Text style={styles.clean}>✓ Sin huérfanas — el bucket está limpio.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, highlight && { color: Colors.red }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  scroll: {
    padding: Spacing.screenX,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 6,
  },
  cardText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
    lineHeight: 20,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  statLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.2,
  },
  statValue: {
    fontFamily: FontFamily.display,
    fontSize: 18,
    color: Colors.ink,
  },
  sampleLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.2,
    marginTop: Spacing.sm,
  },
  sampleKey: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.inkSoft,
  },
  error: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.red,
  },
  clean: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '700',
    color: Colors.green,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
});
