import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { LayoutPreviewGrid } from '@/components/layout-preview-grid';
import { ScreenHeader } from '@/components/screen-header';
import { StatusBadge } from '@/components/status-badge';
import { Stepper } from '@/components/stepper';
import { TextInput } from '@/components/text-input';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { createAlbum } from '@/lib/queries/albums';
import {
  CELL_ASPECTS,
  DEFAULT_CELL_ASPECT,
  DEFAULT_PAGE_COLOR,
  DEFAULT_PAGE_LAYOUT,
  DEFAULT_PAGE_TEXTURE,
  PAGE_COLORS,
  PAGE_LAYOUTS,
  resolveCellAspect,
  resolveColor,
  resolveLayout,
  updateAlbumPages,
} from '@/lib/page-config';
import { useIsPro } from '@/lib/queries/subscriptions';
import { useDesktopCap } from '@/lib/use-is-desktop';
import { errorMessage } from '@/lib/errors';

const FREE_MAX = 30;
const PRO_MAX = 1000;

export default function NewAlbumScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const desktopCap = useDesktopCap(560);
  const { isPro } = useIsPro();
  const maxStickers = isPro ? PRO_MAX : FREE_MAX;

  const [name, setName] = useState('');
  const [total, setTotal] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  // Diseño de las hojas. Se elige acá (no después) porque la composición y la
  // proporción definen cómo queda repartido el álbum y, sobre todo, con qué
  // recorte se suben las figuritas — conviene decidirlo antes de cargarlas.
  const [layoutKey, setLayoutKey] = useState(DEFAULT_PAGE_LAYOUT);
  const [cellAspect, setCellAspect] = useState(DEFAULT_CELL_ASPECT);
  const [bgColor, setBgColor] = useState(DEFAULT_PAGE_COLOR);

  useEffect(() => {
    if (total > maxStickers) setTotal(maxStickers);
  }, [maxStickers, total]);

  const canSubmit = name.trim().length > 0 && total >= 1 && total <= maxStickers && !submitting;

  const layout = resolveLayout(layoutKey);
  const pageCount = Math.max(1, Math.ceil(total / layout.capacity));

  async function onSubmit() {
    Keyboard.dismiss();
    setSubmitting(true);
    setErrMsg(null);
    const { data, error } = await createAlbum(name.trim(), total);
    if (error) {
      setSubmitting(false);
      setErrMsg(errorMessage(error));
      return;
    }
    const albumId = data as unknown as string;
    // Diseño elegido: un RPC extra, y solo si toca algo distinto del default.
    // Si falla no cortamos la creación (el álbum ya existe) — la card de hojas
    // del borrador muestra el estado real y se reconfigura desde ahí.
    if (
      layoutKey !== DEFAULT_PAGE_LAYOUT ||
      cellAspect !== DEFAULT_CELL_ASPECT ||
      bgColor !== DEFAULT_PAGE_COLOR
    ) {
      await updateAlbumPages(
        albumId,
        bgColor,
        DEFAULT_PAGE_TEXTURE,
        [],
        cellAspect,
        layoutKey,
      );
    }
    setSubmitting(false);
    // El logro "creaste tu primer/3/5 álbumes" depende de este conteo.
    qc.invalidateQueries({ queryKey: ['achievements'] });
    router.replace(`/album/${albumId}`);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={desktopCap}>
        <ScreenHeader title="" back right={<StatusBadge variant={isPro ? 'pro' : 'free'} />} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, desktopCap]} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>NUEVO{'\n'}ÁLBUM</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>NOMBRE</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="El Gran Bestiario"
            autoCapitalize="words"
            maxLength={60}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>CANTIDAD DE FIGURITAS</Text>
          <Stepper value={total} onChange={setTotal} min={1} max={maxStickers} step={5} />
          <Text style={styles.hint}>
            {isPro
              ? `Hasta ${PRO_MAX} figuritas (Pro).`
              : Platform.OS === 'web'
                ? `Free: máximo ${FREE_MAX}. Para tener hasta ${PRO_MAX}, bajate la app Android.`
                : `Free: máximo ${FREE_MAX}. Pro permite hasta ${PRO_MAX}.`}
          </Text>
          {!isPro && Platform.OS !== 'web' && (
            <Button
              label="Hacerme Pro"
              variant="gold"
              style={styles.proCta}
              onPress={() =>
                router.push(
                  `/paywall?reason=${encodeURIComponent(
                    `En free podés armar álbumes de hasta ${FREE_MAX} figuritas. Con Pro llegás a ${PRO_MAX}.`,
                  )}` as any,
                )
              }
            />
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>DISEÑO Y DISTRIBUCIÓN DE LAS HOJAS</Text>

          {/* Preview vivo: lo que elegís abajo se ve acá antes de crear nada. */}
          <View style={styles.previewCard}>
            <View style={[styles.preview, { backgroundColor: resolveColor(bgColor) }]}>
              <LayoutPreviewGrid
                cols={layout.cols}
                rows={layout.rows}
                cellColor="rgba(42,30,22,0.18)"
                cellAspect={resolveCellAspect(cellAspect)}
              />
            </View>
            <View style={styles.previewText}>
              <Text style={styles.previewTitle}>
                {pageCount} {pageCount === 1 ? 'hoja' : 'hojas'} de {layout.name}
              </Text>
              <Text style={styles.previewHint}>
                {total} figuritas, {layout.capacity} por hoja.
              </Text>
              <View style={styles.previewNote}>
                <Feather name="layers" size={12} color={Colors.muted} />
                <Text style={styles.previewNoteText}>
                  Después podés sumarle texturas, títulos y cambiar hoja por hoja.
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.subLabel}>COMPOSICIÓN</Text>
          <View style={styles.layoutList}>
            {PAGE_LAYOUTS.map((l) => (
              <Pressable
                key={l.key}
                onPress={() => setLayoutKey(l.key)}
                style={({ pressed }) => [
                  styles.layoutCard,
                  layoutKey === l.key && styles.layoutCardSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.layoutPreview}>
                  <LayoutPreviewGrid cols={l.cols} rows={l.rows} />
                </View>
                <Text style={styles.layoutName}>{l.name}</Text>
                <Text style={styles.layoutCap}>{l.capacity} figus</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.subLabel}>TAMAÑO DE FIGURITA</Text>
          <Text style={styles.hint}>
            La proporción con la que vas a recortar cada imagen.
          </Text>
          <View style={styles.aspectRow}>
            {CELL_ASPECTS.map((a) => (
              <Pressable
                key={a.key}
                onPress={() => setCellAspect(a.key)}
                style={({ pressed }) => [
                  styles.aspectChip,
                  cellAspect === a.key && styles.aspectChipSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.aspectShape, { aspectRatio: a.ratio }]} />
                <Text
                  style={[
                    styles.aspectLabel,
                    cellAspect === a.key && styles.aspectLabelSelected,
                  ]}
                >
                  {a.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.subLabel}>COLOR DE HOJA</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.colorRow}
          >
            {PAGE_COLORS.map((c) => (
              <Pressable
                key={c.key}
                onPress={() => setBgColor(c.key)}
                style={[
                  styles.swatch,
                  { backgroundColor: c.bg },
                  bgColor === c.key && styles.swatchSelected,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Color ${c.name}`}
              />
            ))}
          </ScrollView>
        </View>

        {errMsg && <Text style={styles.error}>{errMsg}</Text>}
      </ScrollView>

      <View
        style={[
          styles.footer,
          // Arriba de la barra del sistema (3 botones Android / pill de gestos).
          { paddingBottom: Math.max(insets.bottom + Spacing.sm, Spacing.xl) },
        ]}
      >
        <Button label="Crear borrador" onPress={onSubmit} disabled={!canSubmit} loading={submitting} />
        <Text style={styles.fineprint}>
          Después vas a poder cargar las figuritas, la carátula y afinar las hojas.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  scroll: {
    paddingHorizontal: Spacing.screenX,
    paddingTop: Spacing.md,
    paddingBottom: 200,
    gap: Spacing.xl,
  },
  hero: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  heroTitle: {
    fontFamily: FontFamily.display,
    fontSize: 48,
    lineHeight: 48,
    color: Colors.ink,
    letterSpacing: 1,
  },
  field: { gap: Spacing.sm },
  proCta: { marginTop: Spacing.sm },
  pressed: { opacity: 0.85 },
  // Sub-label dentro de una sección (la sección ya tiene su label mono).
  subLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
    marginTop: Spacing.md,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.cardLg,
    borderWidth: 2,
    borderColor: Colors.borderStrong,
    padding: Spacing.md,
  },
  // Misma proporción que los previews de hoja del editor.
  preview: {
    width: 72,
    aspectRatio: 0.78,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    padding: 4,
  },
  previewText: { flex: 1, gap: 2 },
  previewTitle: {
    fontFamily: FontFamily.display,
    fontSize: 20,
    color: Colors.ink,
    letterSpacing: 0.3,
    lineHeight: 24,
  },
  previewHint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.inkSoft,
  },
  previewNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: Spacing.xs,
  },
  previewNoteText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSize.captionSmall,
    color: Colors.muted,
    lineHeight: 14,
  },
  layoutList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  layoutCard: {
    width: '31%',
    backgroundColor: Colors.paper2,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  layoutCardSelected: {
    borderColor: Colors.red,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
  },
  layoutPreview: {
    width: '100%',
    aspectRatio: 0.75,
    backgroundColor: Colors.paper3,
    borderRadius: 4,
    padding: 4,
  },
  layoutName: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '700',
    color: Colors.ink,
  },
  layoutCap: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1,
  },
  aspectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  aspectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
  },
  aspectChipSelected: {
    borderColor: Colors.red,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
  },
  // Rectangulito con la proporción real del chip.
  aspectShape: {
    width: 14,
    borderRadius: 2,
    backgroundColor: 'rgba(42,30,22,0.3)',
  },
  aspectLabel: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '700',
    color: Colors.inkSoft,
  },
  aspectLabelSelected: { color: Colors.ink },
  colorRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: 2,
    paddingRight: Spacing.md,
  },
  swatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  swatchSelected: {
    borderColor: Colors.ink,
    borderWidth: 3,
  },
  label: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  hint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.inkSoft,
    marginTop: Spacing.xs,
  },
  error: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.red,
  },
  footer: {
    paddingHorizontal: Spacing.screenX,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  fineprint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.muted,
    textAlign: 'center',
  },
});
