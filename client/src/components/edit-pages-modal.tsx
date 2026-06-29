import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { PageTexture } from '@/components/page-texture';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { errorMessage } from '@/lib/errors';
import {
  buildPages,
  DEFAULT_PAGE_COLOR,
  DEFAULT_PAGE_LAYOUT,
  DEFAULT_PAGE_TEXTURE,
  PAGE_COLORS,
  PAGE_LAYOUTS,
  PAGE_TEXTURES,
  resolveColor,
  resolveLayout,
  updateAlbumPages,
  type PageOverride,
} from '@/lib/page-config';

interface Props {
  visible: boolean;
  albumId: string;
  totalStickers: number;
  currentBgColor: string;
  currentTexture: string;
  currentOverrides: PageOverride[];
  onClose: () => void;
  onSaved: () => void;
}

// Modal de configuración de hojas. Dos partes:
//   1) Color + textura por defecto (paletas predefinidas).
//   2) Lista de páginas, cada una con preview + tap para overridear color/layout/texture.
export function EditPagesModal({
  visible,
  albumId,
  totalStickers,
  currentBgColor,
  currentTexture,
  currentOverrides,
  onClose,
  onSaved,
}: Props) {
  const [bgColor, setBgColor] = useState(currentBgColor);
  const [texture, setTexture] = useState(currentTexture);
  const [overrides, setOverrides] = useState<PageOverride[]>(currentOverrides);
  const [editingPage, setEditingPage] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setBgColor(currentBgColor);
      setTexture(currentTexture);
      setOverrides(currentOverrides);
      setError(null);
      setEditingPage(null);
    }
  }, [visible, currentBgColor, currentTexture, currentOverrides]);

  // Recalculamos las páginas en vivo para que el preview refleje los cambios.
  const pages = useMemo(
    () => buildPages(totalStickers, bgColor, texture, overrides),
    [totalStickers, bgColor, texture, overrides],
  );

  function getOverride(page: number): PageOverride | undefined {
    return overrides.find((o) => o.page === page);
  }

  function setOverride(page: number, patch: Partial<PageOverride>) {
    setOverrides((prev) => {
      const ix = prev.findIndex((o) => o.page === page);
      const merged: PageOverride = ix >= 0
        ? { ...prev[ix], ...patch }
        : { page, ...patch };
      const cleaned: PageOverride = { page };
      if (merged.color) cleaned.color = merged.color;
      if (merged.layout) cleaned.layout = merged.layout;
      if (merged.texture) cleaned.texture = merged.texture;
      // Si el override solo tiene 'page' (sin color/layout/texture), lo eliminamos.
      const hasContent = cleaned.color || cleaned.layout || cleaned.texture;
      if (!hasContent) {
        return prev.filter((o) => o.page !== page);
      }
      if (ix >= 0) {
        const out = [...prev];
        out[ix] = cleaned;
        return out;
      }
      return [...prev, cleaned];
    });
  }

  function resetAll() {
    setBgColor(DEFAULT_PAGE_COLOR);
    setTexture(DEFAULT_PAGE_TEXTURE);
    setOverrides([]);
  }

  async function onSave() {
    setError(null);
    setSaving(true);
    const { error: rpcErr } = await updateAlbumPages(albumId, bgColor, texture, overrides);
    setSaving(false);
    if (rpcErr) {
      setError(errorMessage(rpcErr));
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Hojas del álbum</Text>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {editingPage === null ? (
              <>
                <Text style={styles.sectionLabel}>COLOR DE HOJA POR DEFECTO</Text>
                <View style={styles.colorRow}>
                  {PAGE_COLORS.map((c) => (
                    <ColorSwatch
                      key={c.key}
                      color={c}
                      selected={bgColor === c.key}
                      onPress={() => setBgColor(c.key)}
                    />
                  ))}
                </View>

                <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>
                  TEXTURA POR DEFECTO
                </Text>
                <View style={styles.textureRow}>
                  {PAGE_TEXTURES.map((t) => (
                    <TextureSwatch
                      key={t.key}
                      textureKey={t.key}
                      name={t.name}
                      baseColor={bgColor}
                      selected={texture === t.key}
                      onPress={() => setTexture(t.key)}
                    />
                  ))}
                </View>

                <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>
                  HOJAS · {pages.length}
                </Text>
                <Text style={styles.hint}>
                  Tocá una hoja para cambiar su color o composición.
                </Text>
                <View style={styles.pageList}>
                  {pages.map((p) => {
                    const ov = getOverride(p.index);
                    const hasOverride = !!(ov && (ov.color || ov.layout || ov.texture));
                    return (
                      <Pressable
                        key={p.index}
                        onPress={() => setEditingPage(p.index)}
                        style={({ pressed }) => [
                          styles.pageRow,
                          pressed && styles.pageRowPressed,
                        ]}
                      >
                        <View
                          style={[
                            styles.pagePreview,
                            { backgroundColor: resolveColor(p.colorKey) },
                          ]}
                        >
                          <PageTexture texture={p.textureKey} opacity={0.22} />
                          <LayoutPreviewGrid
                            cols={p.layout.cols}
                            rows={p.layout.rows}
                            cellColor="rgba(42,30,22,0.18)"
                          />
                        </View>
                        <View style={styles.pageText}>
                          <Text style={styles.pageTitle}>
                            Hoja {p.index + 1}
                          </Text>
                          <Text style={styles.pageMeta}>
                            {p.layout.name} · {p.numbers.length} figus
                          </Text>
                          {hasOverride && (
                            <Text style={styles.overrideBadge}>PERSONALIZADA</Text>
                          )}
                        </View>
                        <Feather name="chevron-right" size={20} color={Colors.muted} />
                      </Pressable>
                    );
                  })}
                </View>

                {(bgColor !== DEFAULT_PAGE_COLOR || overrides.length > 0) && (
                  <Pressable onPress={resetAll} style={styles.resetBtn}>
                    <Text style={styles.resetText}>Restablecer todo al default</Text>
                  </Pressable>
                )}

                {error && <Text style={styles.error}>{error}</Text>}
              </>
            ) : (
              <PageEditor
                page={editingPage}
                override={getOverride(editingPage)}
                defaultColor={bgColor}
                onSetColor={(color) => setOverride(editingPage, { color })}
                onSetLayout={(layout) => setOverride(editingPage, { layout })}
                onSetTexture={(t) => setOverride(editingPage, { texture: t })}
                onClear={() => {
                  setOverrides((prev) => prev.filter((o) => o.page !== editingPage));
                  setEditingPage(null);
                }}
                onBack={() => setEditingPage(null)}
              />
            )}
          </ScrollView>

          <SafeAreaView edges={['bottom']}>
            <View style={styles.actions}>
              <Button label="Cancelar" variant="outline" onPress={onClose} />
              <Button label="Guardar" onPress={onSave} loading={saving} />
            </View>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PageEditor({
  page,
  override,
  defaultColor,
  onSetColor,
  onSetLayout,
  onSetTexture,
  onClear,
  onBack,
}: {
  page: number;
  override?: PageOverride;
  defaultColor: string;
  onSetColor: (color: string | undefined) => void;
  onSetLayout: (layout: string | undefined) => void;
  onSetTexture: (t: string | undefined) => void;
  onClear: () => void;
  onBack: () => void;
}) {
  const selectedColor = override?.color;
  const selectedLayout = override?.layout ?? DEFAULT_PAGE_LAYOUT;
  const selectedTexture = override?.texture;
  // El color base que vemos en los swatches de textura: el override si lo hay,
  // sino el default del álbum.
  const previewColorKey = selectedColor ?? defaultColor;

  return (
    <View>
      <Pressable onPress={onBack} style={styles.backRow}>
        <Feather name="chevron-left" size={20} color={Colors.ink} />
        <Text style={styles.backText}>Hoja {page + 1}</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>COLOR DE ESTA HOJA</Text>
      <Text style={styles.hint}>Sin marcar = usa el color por defecto.</Text>
      <View style={styles.colorRow}>
        <ColorSwatchDefault
          selected={!selectedColor}
          onPress={() => onSetColor(undefined)}
        />
        {PAGE_COLORS.map((c) => (
          <ColorSwatch
            key={c.key}
            color={c}
            selected={selectedColor === c.key}
            onPress={() => onSetColor(c.key)}
          />
        ))}
      </View>

      <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>
        TEXTURA DE ESTA HOJA
      </Text>
      <Text style={styles.hint}>Sin marcar = usa la textura por defecto.</Text>
      <View style={styles.textureRow}>
        <TextureSwatchDefault
          selected={!selectedTexture}
          onPress={() => onSetTexture(undefined)}
        />
        {PAGE_TEXTURES.map((t) => (
          <TextureSwatch
            key={t.key}
            textureKey={t.key}
            name={t.name}
            baseColor={previewColorKey}
            selected={selectedTexture === t.key}
            onPress={() => onSetTexture(t.key)}
          />
        ))}
      </View>

      <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>
        COMPOSICIÓN
      </Text>
      <View style={styles.layoutList}>
        {PAGE_LAYOUTS.map((l) => (
          <Pressable
            key={l.key}
            onPress={() =>
              onSetLayout(l.key === DEFAULT_PAGE_LAYOUT ? undefined : l.key)
            }
            style={({ pressed }) => [
              styles.layoutCard,
              selectedLayout === l.key && styles.layoutCardSelected,
              pressed && styles.layoutCardPressed,
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

      {(override?.color || override?.layout) && (
        <Pressable onPress={onClear} style={styles.resetBtn}>
          <Text style={styles.resetText}>Quitar personalización de esta hoja</Text>
        </Pressable>
      )}
    </View>
  );
}

// Grid de preview de un layout (M rows × N cols). Usa flex puro para
// distribuir las celdas — Yoga calcula tamaños y gaps sin que tengamos que
// hacer cuentas con porcentajes (que se rompían cuando el layout no era
// cuadrado, mismo bug que tenía el AlbumPager).
function LayoutPreviewGrid({
  cols,
  rows,
  cellColor = 'rgba(42,30,22,0.25)',
}: {
  cols: number;
  rows: number;
  cellColor?: string;
}) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      {Array.from({ length: rows }).map((_, r) => (
        <View key={r} style={{ flex: 1, flexDirection: 'row', gap: 2 }}>
          {Array.from({ length: cols }).map((_, c) => (
            <View
              key={c}
              style={{ flex: 1, backgroundColor: cellColor, borderRadius: 1 }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function TextureSwatch({
  textureKey,
  name,
  baseColor,
  selected,
  onPress,
}: {
  textureKey: string;
  name: string;
  baseColor: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.swatchWrap}>
      <View
        style={[
          styles.textureSwatch,
          { backgroundColor: resolveColor(baseColor) },
          selected && styles.swatchSelected,
        ]}
      >
        <PageTexture texture={textureKey} opacity={0.25} />
        {selected && (
          <View style={styles.textureCheck}>
            <Feather name="check" size={14} color={Colors.paper} />
          </View>
        )}
      </View>
      <Text style={styles.swatchLabel}>{name}</Text>
    </Pressable>
  );
}

function TextureSwatchDefault({
  selected,
  onPress,
}: {
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.swatchWrap}>
      <View
        style={[
          styles.textureSwatch,
          styles.swatchDefault,
          selected && styles.swatchSelected,
        ]}
      >
        <Feather name="x" size={18} color={Colors.muted} />
      </View>
      <Text style={styles.swatchLabel}>Default</Text>
    </Pressable>
  );
}

function ColorSwatch({
  color,
  selected,
  onPress,
}: {
  color: { key: string; name: string; bg: string };
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.swatchWrap}>
      <View
        style={[
          styles.swatch,
          { backgroundColor: color.bg },
          selected && styles.swatchSelected,
        ]}
      >
        {selected && <Feather name="check" size={16} color={Colors.ink} />}
      </View>
      <Text style={styles.swatchLabel}>{color.name}</Text>
    </Pressable>
  );
}

function ColorSwatchDefault({
  selected,
  onPress,
}: {
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.swatchWrap}>
      <View style={[styles.swatch, styles.swatchDefault, selected && styles.swatchSelected]}>
        <Feather name="x" size={18} color={Colors.muted} />
      </View>
      <Text style={styles.swatchLabel}>Default</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.paper,
    borderTopLeftRadius: Radius.cardLg,
    borderTopRightRadius: Radius.cardLg,
    paddingHorizontal: Spacing.screenX,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  scroll: { flexShrink: 1 },
  scrollContent: { paddingBottom: Spacing.md },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderStrong,
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.screenTitle,
    color: Colors.ink,
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
    marginBottom: Spacing.xs,
  },
  hint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.inkSoft,
    marginBottom: Spacing.sm,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  textureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  textureSwatch: {
    width: 56,
    height: 56,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textureCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchWrap: {
    alignItems: 'center',
    gap: 4,
    width: 64,
  },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: {
    borderColor: Colors.ink,
    borderWidth: 3,
  },
  swatchDefault: {
    backgroundColor: Colors.paper2,
    borderStyle: 'dashed',
    borderColor: Colors.muted,
  },
  swatchLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.inkSoft,
    letterSpacing: 0.5,
  },
  pageList: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  pageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  pageRowPressed: { opacity: 0.85 },
  pagePreview: {
    width: 52,
    height: 64,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    padding: 4,
  },
  pageText: { flex: 1, gap: 2 },
  pageTitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  pageMeta: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 0.8,
  },
  overrideBadge: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    fontWeight: '800',
    color: Colors.gold,
    letterSpacing: 1,
    marginTop: 2,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  backText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  layoutList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
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
  layoutCardPressed: { opacity: 0.85 },
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
    letterSpacing: 0.5,
  },
  resetBtn: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  resetText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.red,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  error: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.red,
    marginTop: Spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
});
