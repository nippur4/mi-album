import Feather from '@expo/vector-icons/Feather';
import { memo, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BottomSheet, sheetStyles } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { PageTexture } from '@/components/page-texture';
import { TextInput } from '@/components/text-input';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { errorMessage } from '@/lib/errors';
import {
  buildPages,
  CELL_ASPECTS,
  DEFAULT_CELL_ASPECT,
  DEFAULT_PAGE_COLOR,
  DEFAULT_PAGE_LAYOUT,
  DEFAULT_PAGE_ORIENTATION,
  DEFAULT_PAGE_TEXTURE,
  DEFAULT_PAGE_TITLE_ALIGN,
  DEFAULT_PAGE_TITLE_COLOR,
  DEFAULT_PAGE_TITLE_SIZE,
  DEFAULT_PAGE_TITLE_VALIGN,
  LIGHT_TITLE_COLORS,
  PAGE_COLORS,
  PAGE_LAYOUTS,
  PAGE_TEXTURES,
  PAGE_TITLE_COLORS,
  PAGE_TITLE_SIZES,
  resolveColor,
  resolveLayout,
  updateAlbumPages,
  type BuiltPage,
  type PageOrientation,
  type PageOverride,
  type PageTitleAlign,
  type PageTitleVAlign,
} from '@/lib/page-config';
import { Layout as ThemeLayout } from '@/constants/theme';

interface Props {
  visible: boolean;
  albumId: string;
  totalStickers: number;
  // Primer número del álbum (1 salvo el álbum especial que arranca en 0).
  numberStart?: number;
  currentBgColor: string;
  currentTexture: string;
  // Proporción de figurita por defecto (key de CELL_ASPECTS).
  currentCellAspect?: string;
  // Composición por defecto (key de PAGE_LAYOUTS).
  currentLayout?: string;
  currentOverrides: PageOverride[];
  // Si viene, el modal abre directo en el editor de esa hoja (botón de
  // editar sobre la hoja del pager). null/undefined = abre en la lista.
  initialPage?: number | null;
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
  numberStart = 1,
  currentBgColor,
  currentTexture,
  currentCellAspect = DEFAULT_CELL_ASPECT,
  currentLayout = DEFAULT_PAGE_LAYOUT,
  currentOverrides,
  initialPage = null,
  onClose,
  onSaved,
}: Props) {
  const [bgColor, setBgColor] = useState(currentBgColor);
  const [texture, setTexture] = useState(currentTexture);
  const [cellAspect, setCellAspect] = useState(currentCellAspect);
  const [layoutKey, setLayoutKey] = useState(currentLayout);
  const [overrides, setOverrides] = useState<PageOverride[]>(currentOverrides);
  // Tres pantallas: 'main' = defaults del álbum, 'grid' = grilla de todas
  // las hojas, número = editor de esa hoja. Antes la lista de hojas vivía
  // en el mismo scroll que los defaults y el modal quedaba larguísimo.
  const [screen, setScreen] = useState<'main' | 'grid' | number>('main');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setBgColor(currentBgColor);
      setTexture(currentTexture);
      setCellAspect(currentCellAspect);
      setLayoutKey(currentLayout);
      setOverrides(currentOverrides);
      setError(null);
      setScreen(initialPage ?? 'main');
    }
  }, [visible, currentBgColor, currentTexture, currentCellAspect, currentLayout, currentOverrides, initialPage]);

  // Recalculamos las páginas en vivo para que el preview refleje los cambios.
  const pages = useMemo(
    () => buildPages(totalStickers, bgColor, texture, overrides, numberStart, cellAspect, layoutKey),
    [totalStickers, bgColor, texture, overrides, numberStart, cellAspect, layoutKey],
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
      if (merged.cellAspect) cleaned.cellAspect = merged.cellAspect;
      // El título se guarda tal cual se tipea (trim recién al guardar, para
      // no comerse los espacios mientras se escribe); solo-espacios = sin título.
      if (merged.title && merged.title.trim()) cleaned.title = merged.title;
      // Color/alineación/tamaño del título solo tienen sentido con título,
      // y los defaults ('ink'/'center'/'md') no se persisten.
      if (cleaned.title) {
        if (merged.titleColor && merged.titleColor !== DEFAULT_PAGE_TITLE_COLOR) {
          cleaned.titleColor = merged.titleColor;
        }
        if (merged.titleAlign && merged.titleAlign !== DEFAULT_PAGE_TITLE_ALIGN) {
          cleaned.titleAlign = merged.titleAlign;
        }
        if (merged.titleVAlign && merged.titleVAlign !== DEFAULT_PAGE_TITLE_VALIGN) {
          cleaned.titleVAlign = merged.titleVAlign;
        }
        if (merged.titleSize && merged.titleSize !== DEFAULT_PAGE_TITLE_SIZE) {
          cleaned.titleSize = merged.titleSize;
        }
      }
      // 'portrait' es el default — solo persistimos landscape. (Antes este
      // clean directamente descartaba orientation y el chip no persistía.)
      if (merged.orientation === 'landscape') cleaned.orientation = 'landscape';
      // Si el override solo tiene 'page', lo eliminamos.
      const hasContent =
        cleaned.color || cleaned.layout || cleaned.texture || cleaned.cellAspect ||
        cleaned.orientation || cleaned.title;
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
    setCellAspect(DEFAULT_CELL_ASPECT);
    setLayoutKey(DEFAULT_PAGE_LAYOUT);
    setOverrides([]);
  }

  async function onSave() {
    setError(null);
    setSaving(true);
    // Trim de títulos recién acá (ver setOverride: en vivo se guardan crudos).
    const cleanOverrides = overrides.map((o) =>
      o.title ? { ...o, title: o.title.trim() } : o,
    );
    const { error: rpcErr } = await updateAlbumPages(
      albumId,
      bgColor,
      texture,
      cleanOverrides,
      cellAspect,
      layoutKey,
    );
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
      title="Hojas del álbum"
      maxHeight="92%"
      avoidKeyboard="both"
      footer={
        <View style={styles.footerWrap}>
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={sheetStyles.actions}>
            <Button label="Cancelar" variant="outline" onPress={onClose} />
            <Button label="Guardar" onPress={onSave} loading={saving} />
          </View>
        </View>
      }
    >
          {screen === 'main' ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
                <View style={styles.section}>
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
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>TEXTURA POR DEFECTO</Text>
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
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>TAMAÑO DE FIGURITA</Text>
                  <Text style={styles.hint}>
                    Elegí la proporción que mejor le queda a tus imágenes.
                  </Text>
                  <View style={styles.aspectRow}>
                    {CELL_ASPECTS.map((a) => (
                      <AspectChip
                        key={a.key}
                        label={a.name}
                        ratio={a.ratio}
                        selected={cellAspect === a.key}
                        onPress={() => setCellAspect(a.key)}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>COMPOSICIÓN POR DEFECTO</Text>
                  <Text style={styles.hint}>
                    La grilla que usan todas las hojas (salvo las personalizadas).
                  </Text>
                  <View style={styles.layoutList}>
                    {PAGE_LAYOUTS.map((l) => (
                      <Pressable
                        key={l.key}
                        onPress={() => setLayoutKey(l.key)}
                        style={({ pressed }) => [
                          styles.layoutCard,
                          layoutKey === l.key && styles.layoutCardSelected,
                          pressed && styles.layoutCardPressed,
                        ]}
                      >
                        <View style={styles.layoutPreview}>
                          <LayoutPreviewGrid cols={l.cols} rows={l.rows} orientation="portrait" />
                        </View>
                        <Text style={styles.layoutName}>{l.name}</Text>
                        <Text style={styles.layoutCap}>{l.capacity} figus</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Entrada a la grilla de hojas (segunda pantalla). */}
                <Pressable
                  onPress={() => setScreen('grid')}
                  style={({ pressed }) => [styles.pagesNavCard, pressed && { opacity: 0.85 }]}
                >
                  <Feather name="layers" size={18} color={Colors.ink} />
                  <View style={styles.pagesNavText}>
                    <Text style={styles.pagesNavTitle}>Personalizar hojas</Text>
                    <Text style={styles.pagesNavHint}>
                      {pages.length} hojas · color, título y composición por hoja
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={Colors.muted} />
                </Pressable>

                {(bgColor !== DEFAULT_PAGE_COLOR ||
                  texture !== DEFAULT_PAGE_TEXTURE ||
                  cellAspect !== DEFAULT_CELL_ASPECT ||
                  layoutKey !== DEFAULT_PAGE_LAYOUT ||
                  overrides.length > 0) && (
                  <Pressable onPress={resetAll} style={styles.resetBtn}>
                    <Text style={styles.resetText}>Restablecer todo al default</Text>
                  </Pressable>
                )}
            </ScrollView>
          ) : screen === 'grid' ? (
            /* FlatList y no ScrollView: con álbumes grandes (1001 figus ≈ 84
               hojas) los previews no-virtualizados + un SVG de textura por
               hoja trababan el scroll. */
            <FlatList
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              data={pages}
              keyExtractor={(p) => String(p.index)}
              numColumns={3}
              columnWrapperStyle={styles.gridRow}
              initialNumToRender={15}
              windowSize={7}
              removeClippedSubviews
              ListHeaderComponent={
                <View style={styles.gridHeader}>
                  <Pressable onPress={() => setScreen('main')} style={styles.backRow}>
                    <Feather name="chevron-left" size={20} color={Colors.ink} />
                    <Text style={styles.backText}>Ajustes</Text>
                  </Pressable>
                  <Text style={styles.pageNavLabel}>HOJAS · {pages.length}</Text>
                </View>
              }
              renderItem={({ item: p }) => {
                const ov = getOverride(p.index);
                const hasOverride = !!(
                  ov &&
                  (ov.color || ov.layout || ov.texture || ov.orientation || ov.cellAspect || ov.title)
                );
                return (
                  <PageGridItem
                    page={p}
                    hasOverride={hasOverride}
                    onPress={() => setScreen(p.index)}
                  />
                );
              }}
            />
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <PageEditor
                page={screen}
                pageCount={pages.length}
                onNavigate={(i) => setScreen(i)}
                override={getOverride(screen)}
                defaultColor={bgColor}
                defaultLayout={layoutKey}
                onSetColor={(color) => setOverride(screen, { color })}
                onSetLayout={(layout) => setOverride(screen, { layout })}
                onSetTexture={(t) => setOverride(screen, { texture: t })}
                onSetTitle={(title) => setOverride(screen, { title })}
                onSetTitleColor={(c) => setOverride(screen, { titleColor: c })}
                onSetTitleAlign={(a) => setOverride(screen, { titleAlign: a })}
                onSetTitleVAlign={(v) => setOverride(screen, { titleVAlign: v })}
                onSetTitleSize={(s) => setOverride(screen, { titleSize: s })}
                onSetCellAspect={(a) => setOverride(screen, { cellAspect: a })}
                onSetOrientation={(o) => setOverride(screen, { orientation: o })}
                onClear={() => {
                  setOverrides((prev) => prev.filter((o) => o.page !== screen));
                  setScreen('grid');
                }}
                onBack={() => setScreen('grid')}
              />
            </ScrollView>
          )}
    </BottomSheet>
  );
}

// Celda de la grilla de hojas. Memoizada: con álbumes grandes hay ~84 y
// cada una lleva un SVG de textura — sin memo, cada tap re-renderizaba todas.
const PageGridItem = memo(function PageGridItem({
  page: p,
  hasOverride,
  onPress,
}: {
  page: BuiltPage;
  hasOverride: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.gridItem, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.gridPreview, { backgroundColor: resolveColor(p.colorKey) }]}>
        <PageTexture texture={p.textureKey} opacity={0.22} />
        <LayoutPreviewGrid
          cols={p.layout.cols}
          rows={p.layout.rows}
          orientation={p.orientation}
          cellColor="rgba(42,30,22,0.18)"
        />
      </View>
      <Text style={styles.gridLabel} numberOfLines={1}>
        Hoja {p.index + 1}
      </Text>
      {/* Línea fija (con o sin título) para que todas las celdas midan igual. */}
      <Text style={styles.gridMeta} numberOfLines={1}>
        {p.title ?? `${p.layout.name} · ${p.numbers.length} figus`}
      </Text>
      {hasOverride && <View style={styles.gridDot} />}
    </Pressable>
  );
});

function PageEditor({
  page,
  pageCount,
  onNavigate,
  override,
  defaultColor,
  defaultLayout,
  onSetColor,
  onSetLayout,
  onSetTexture,
  onSetTitle,
  onSetTitleColor,
  onSetTitleAlign,
  onSetTitleVAlign,
  onSetTitleSize,
  onSetCellAspect,
  onSetOrientation,
  onClear,
  onBack,
}: {
  page: number;
  pageCount: number;
  onNavigate: (page: number) => void;
  override?: PageOverride;
  defaultColor: string;
  defaultLayout: string;
  onSetColor: (color: string | undefined) => void;
  onSetLayout: (layout: string | undefined) => void;
  onSetTexture: (t: string | undefined) => void;
  onSetTitle: (title: string) => void;
  onSetTitleColor: (c: string) => void;
  onSetTitleAlign: (a: PageTitleAlign) => void;
  onSetTitleVAlign: (v: PageTitleVAlign) => void;
  onSetTitleSize: (s: string) => void;
  onSetCellAspect: (a: string | undefined) => void;
  onSetOrientation: (o: PageOrientation | undefined) => void;
  onClear: () => void;
  onBack: () => void;
}) {
  const selectedColor = override?.color;
  const selectedLayout = override?.layout ?? defaultLayout;
  const selectedTexture = override?.texture;
  const selectedCellAspect = override?.cellAspect;
  const selectedOrientation: PageOrientation = override?.orientation ?? DEFAULT_PAGE_ORIENTATION;
  const layoutObj = resolveLayout(selectedLayout);
  const canPickOrientation = !!layoutObj.supportsLandscape;
  // El color base que vemos en los swatches de textura: el override si lo hay,
  // sino el default del álbum.
  const previewColorKey = selectedColor ?? defaultColor;
  // Si el layout no soporta landscape, el preview siempre muestra portrait.
  const previewOrientation: PageOrientation = canPickOrientation ? selectedOrientation : 'portrait';

  return (
    <View>
      {/* Volver a la lista + paginador de hojas: editar varias seguidas sin
          volver a la lista (y sin perder el scroll). */}
      <View style={styles.editorHeaderRow}>
        <Pressable onPress={onBack} style={styles.backRow}>
          <Feather name="chevron-left" size={20} color={Colors.ink} />
          <Text style={styles.backText}>Hojas</Text>
        </Pressable>
        <View style={styles.pageNav}>
          <Pressable
            onPress={() => onNavigate(page - 1)}
            disabled={page === 0}
            hitSlop={8}
            style={[styles.pageNavBtn, page === 0 && styles.pageNavBtnDisabled]}
          >
            <Feather name="chevron-left" size={18} color={Colors.ink} />
          </Pressable>
          <Text style={styles.pageNavLabel}>
            Hoja {page + 1} / {pageCount}
          </Text>
          <Pressable
            onPress={() => onNavigate(page + 1)}
            disabled={page >= pageCount - 1}
            hitSlop={8}
            style={[styles.pageNavBtn, page >= pageCount - 1 && styles.pageNavBtnDisabled]}
          >
            <Feather name="chevron-right" size={18} color={Colors.ink} />
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>TÍTULO DE ESTA HOJA</Text>
        <Text style={styles.hint}>
          Aparece arriba de la hoja. Dejalo vacío para no mostrar título.
        </Text>
        <TextInput
          value={override?.title ?? ''}
          onChangeText={onSetTitle}
          placeholder="Ej: Jurásico"
          maxLength={40}
          autoCapitalize="sentences"
          returnKeyType="done"
        />
        {!!override?.title?.trim() && (
          <>
            <Text style={[styles.sectionLabel, styles.titleColorLabel]}>COLOR DEL TÍTULO</Text>
            <View style={styles.colorRow}>
              {PAGE_TITLE_COLORS.map((c) => (
                <TitleColorSwatch
                  key={c.key}
                  color={c}
                  selected={(override?.titleColor ?? DEFAULT_PAGE_TITLE_COLOR) === c.key}
                  onPress={() => onSetTitleColor(c.key)}
                />
              ))}
            </View>

            <Text style={[styles.sectionLabel, styles.titleColorLabel]}>TAMAÑO DE LETRA</Text>
            <View style={styles.orientationRow}>
              {PAGE_TITLE_SIZES.map((s) => (
                <TitleSizeChip
                  key={s.key}
                  label={s.name}
                  fontSize={s.fontSize}
                  selected={(override?.titleSize ?? DEFAULT_PAGE_TITLE_SIZE) === s.key}
                  onPress={() => onSetTitleSize(s.key)}
                />
              ))}
            </View>

            <Text style={[styles.sectionLabel, styles.titleColorLabel]}>ALINEACIÓN</Text>
            <View style={styles.orientationRow}>
              {(
                [
                  { key: 'left', icon: 'align-left' },
                  { key: 'center', icon: 'align-center' },
                  { key: 'right', icon: 'align-right' },
                ] as const
              ).map((a) => {
                const selected = (override?.titleAlign ?? DEFAULT_PAGE_TITLE_ALIGN) === a.key;
                return (
                  <Pressable
                    key={a.key}
                    onPress={() => onSetTitleAlign(a.key)}
                    style={({ pressed }) => [
                      styles.alignChip,
                      selected && styles.orientationChipSelected,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Feather
                      name={a.icon}
                      size={18}
                      color={selected ? Colors.ink : Colors.inkSoft}
                    />
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, styles.titleColorLabel]}>POSICIÓN DEL TÍTULO</Text>
            <Text style={styles.hint}>
              Se nota cuando la grilla no llena la hoja y queda espacio libre.
            </Text>
            <View style={styles.vAlignRow}>
              {(
                [
                  { key: 'top', label: 'Borde superior', icon: 'chevrons-up' },
                  { key: 'above', label: 'Sobre las figus', icon: 'arrow-up' },
                  { key: 'below', label: 'Bajo las figus', icon: 'arrow-down' },
                  { key: 'bottom', label: 'Borde inferior', icon: 'chevrons-down' },
                ] as const
              ).map((v) => {
                const selected = (override?.titleVAlign ?? DEFAULT_PAGE_TITLE_VALIGN) === v.key;
                return (
                  <Pressable
                    key={v.key}
                    onPress={() => onSetTitleVAlign(v.key)}
                    style={({ pressed }) => [
                      styles.vAlignChip,
                      selected && styles.orientationChipSelected,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Feather
                      name={v.icon}
                      size={16}
                      color={selected ? Colors.ink : Colors.inkSoft}
                    />
                    <Text
                      style={[styles.orientationLabel, selected && styles.orientationLabelSelected]}
                    >
                      {v.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </View>

      <View style={styles.section}>
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
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>TEXTURA DE ESTA HOJA</Text>
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
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>TAMAÑO DE FIGURITA EN ESTA HOJA</Text>
        <Text style={styles.hint}>Sin marcar = usa el tamaño por defecto.</Text>
        <View style={styles.aspectRow}>
          <AspectChip
            label="Default"
            ratio={null}
            selected={!selectedCellAspect}
            onPress={() => onSetCellAspect(undefined)}
          />
          {CELL_ASPECTS.map((a) => (
            <AspectChip
              key={a.key}
              label={a.name}
              ratio={a.ratio}
              selected={selectedCellAspect === a.key}
              onPress={() => onSetCellAspect(a.key)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>COMPOSICIÓN</Text>
        <View style={styles.layoutList}>
          {PAGE_LAYOUTS.map((l) => (
            <Pressable
              key={l.key}
              onPress={() => {
                // Elegir el layout default del álbum = quitar el override.
                const nextKey = l.key === defaultLayout ? undefined : l.key;
                onSetLayout(nextKey);
                // Si el layout nuevo no soporta landscape, limpiamos la
                // orientación (evita persistir un valor inaplicable).
                if (!l.supportsLandscape && selectedOrientation === 'landscape') {
                  onSetOrientation(undefined);
                }
              }}
              style={({ pressed }) => [
                styles.layoutCard,
                selectedLayout === l.key && styles.layoutCardSelected,
                pressed && styles.layoutCardPressed,
              ]}
            >
              <View style={styles.layoutPreview}>
                <LayoutPreviewGrid
                  cols={l.cols}
                  rows={l.rows}
                  orientation={selectedLayout === l.key ? previewOrientation : 'portrait'}
                />
              </View>
              <Text style={styles.layoutName}>{l.name}</Text>
              <Text style={styles.layoutCap}>{l.capacity} figus</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {canPickOrientation && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ORIENTACIÓN DE LAS FIGURITAS</Text>
          <Text style={styles.hint}>
            En esta composición podés elegir cómo quedan orientadas las figus.
          </Text>
          <View style={styles.orientationRow}>
            <OrientationChip
              label="Vertical"
              orientation="portrait"
              selected={selectedOrientation === 'portrait'}
              onPress={() => onSetOrientation(undefined)}
            />
            <OrientationChip
              label="Horizontal"
              orientation="landscape"
              selected={selectedOrientation === 'landscape'}
              onPress={() => onSetOrientation('landscape')}
            />
          </View>
        </View>
      )}

      {(override?.color ||
        override?.layout ||
        override?.texture ||
        override?.orientation ||
        override?.cellAspect ||
        override?.title) && (
        <Pressable onPress={onClear} style={styles.resetBtn}>
          <Text style={styles.resetText}>Quitar personalización de esta hoja</Text>
        </Pressable>
      )}
    </View>
  );
}

// Chip visual portrait/landscape para el toggle de orientación.
// Chip de proporción de figurita: miniatura con el ratio real + label.
// ratio=null renderiza la opción "Default" (recuadro punteado).
function AspectChip({
  label,
  ratio,
  selected,
  onPress,
}: {
  label: string;
  ratio: number | null;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.aspectChip,
        selected && styles.orientationChipSelected,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.orientationPreviewFrame}>
        {ratio === null ? (
          <View style={styles.aspectDefaultShape} />
        ) : (
          <View
            style={{
              height: 30,
              width: 30 * ratio,
              backgroundColor: selected ? Colors.ink : Colors.borderStrong,
              borderRadius: 2,
            }}
          />
        )}
      </View>
      <Text style={[styles.orientationLabel, selected && styles.orientationLabelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function OrientationChip({
  label,
  orientation,
  selected,
  onPress,
}: {
  label: string;
  orientation: PageOrientation;
  selected: boolean;
  onPress: () => void;
}) {
  // Miniatura de una figurita en la orientación indicada (0.82 o su inverso).
  const aspect =
    orientation === 'landscape'
      ? 1 / ThemeLayout.gridCellAspect
      : ThemeLayout.gridCellAspect;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.orientationChip,
        selected && styles.orientationChipSelected,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.orientationPreviewFrame}>
        <View
          style={{
            width: orientation === 'landscape' ? 32 : 24,
            aspectRatio: aspect,
            backgroundColor: selected ? Colors.ink : Colors.borderStrong,
            borderRadius: 2,
          }}
        />
      </View>
      <Text style={[styles.orientationLabel, selected && styles.orientationLabelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

// Grid de preview de un layout (M rows × N cols). Usa flex puro para
// distribuir las celdas — Yoga calcula tamaños y gaps sin que tengamos que
// hacer cuentas con porcentajes (que se rompían cuando el layout no era
// cuadrado, mismo bug que tenía el AlbumPager).
//
// Si orientation='landscape', las celdas dibujadas quedan apaisadas (fixed
// aspectRatio invertido). Sirve para que el owner vea el resultado real de
// aplicar la orientación antes de aplicar.
function LayoutPreviewGrid({
  cols,
  rows,
  orientation = 'portrait',
  cellColor = 'rgba(42,30,22,0.25)',
}: {
  cols: number;
  rows: number;
  orientation?: PageOrientation;
  cellColor?: string;
}) {
  const baseAspect = ThemeLayout.gridCellAspect;
  const cellAspect = orientation === 'landscape' ? 1 / baseAspect : baseAspect;
  // Fit real dentro del contenedor (misma lógica que el pager): antes las
  // celdas se dimensionaban solo por ancho y en grillas altas (3×4) la mini
  // distribución desbordaba el preview — se notó con los colores oscuros.
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const GAP = 2;
  let cellW = 0;
  if (box) {
    cellW = Math.floor((box.w - GAP * (cols - 1)) / cols);
    const cellHfromW = cellW / cellAspect;
    if (cellHfromW * rows + GAP * (rows - 1) > box.h) {
      const cellH = Math.floor((box.h - GAP * (rows - 1)) / rows);
      cellW = Math.floor(cellH * cellAspect);
    }
  }
  return (
    <View
      style={{ flex: 1, gap: GAP, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {box &&
        cellW > 0 &&
        Array.from({ length: rows }).map((_, r) => (
          <View
            key={r}
            style={{ flexDirection: 'row', gap: GAP, justifyContent: 'center' }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <View
                key={c}
                style={{
                  width: cellW,
                  aspectRatio: cellAspect,
                  backgroundColor: cellColor,
                  borderRadius: 1,
                }}
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

// Chip de tamaño de letra del título: una "A" en Anton a escala + label.
function TitleSizeChip({
  label,
  fontSize,
  selected,
  onPress,
}: {
  label: string;
  fontSize: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.orientationChip,
        selected && styles.orientationChipSelected,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.orientationPreviewFrame}>
        <Text
          style={{
            fontFamily: FontFamily.display,
            fontSize: Math.round(fontSize * 0.8),
            color: selected ? Colors.ink : Colors.borderStrong,
          }}
        >
          A
        </Text>
      </View>
      <Text style={[styles.orientationLabel, selected && styles.orientationLabelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

// Swatch de color de título. Como ColorSwatch pero con el check en color
// contrastante: la paleta de títulos tiene tonos oscuros (tinta, azul...)
// donde el check ink del swatch común desaparecería.
function TitleColorSwatch({
  color,
  selected,
  onPress,
}: {
  color: { key: string; name: string; bg: string };
  selected: boolean;
  onPress: () => void;
}) {
  const lightBg = LIGHT_TITLE_COLORS.has(color.key);
  return (
    <Pressable onPress={onPress} style={styles.swatchWrap}>
      <View
        style={[
          styles.swatch,
          { backgroundColor: color.bg },
          selected && styles.swatchSelected,
        ]}
      >
        {selected && (
          <Feather name="check" size={16} color={lightBg ? Colors.ink : Colors.paper} />
        )}
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
  scroll: { flexShrink: 1 },
  scrollContent: { paddingBottom: Spacing.md, gap: Spacing.md },
  // Bloque visual con borde + fondo suave para separar cada sección del modal.
  // Antes las tres secciones (color/textura/hojas) vivían al hilo en el scroll
  // y la separación era sólo por spacing, se perdía la jerarquía visual.
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.xs,
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
  // El label de color de título va dentro de la misma sección que el input:
  // necesita aire arriba para separarse de él.
  titleColorLabel: {
    marginTop: Spacing.sm,
    marginBottom: 0,
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
  // Card de entrada a la grilla de hojas (pantalla 'grid').
  pagesNavCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  pagesNavText: { flex: 1, gap: 2 },
  pagesNavTitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  pagesNavHint: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 0.8,
  },
  // Grilla de hojas (3 columnas).
  gridRow: {
    gap: Spacing.sm,
  },
  gridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  gridItem: {
    flex: 1,
    // Con numColumns=3, la última fila incompleta estiraría sus celdas para
    // llenar el ancho; el cap las mantiene del mismo tamaño que el resto.
    maxWidth: '31.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 3,
  },
  gridPreview: {
    width: '100%',
    aspectRatio: 0.78,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    overflow: 'hidden',
    padding: 4,
  },
  gridLabel: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '700',
    color: Colors.ink,
  },
  gridMeta: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 0.5,
  },
  gridDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.gold,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  footerWrap: {
    gap: Spacing.xs,
  },
  editorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  pageNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  pageNavBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.paper2,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNavBtnDisabled: {
    opacity: 0.35,
  },
  pageNavLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.ink,
    letterSpacing: 1,
    fontWeight: '700',
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
  aspectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  // Como orientationChip pero SIN flex:1: se auto-dimensiona al contenido
  // (con 4 chips en fila el flex apretaba y el label desbordaba).
  aspectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  aspectDefaultShape: {
    height: 30,
    width: 24,
    borderRadius: 2,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.borderStrong,
  },
  orientationRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  orientationChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  orientationChipSelected: {
    borderColor: Colors.red,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
  },
  // Posición del título: 4 chips en 2 filas.
  vAlignRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  vAlignChip: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  // Chip cuadrado solo-icono para la alineación del título.
  alignChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  orientationPreviewFrame: {
    width: 44,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orientationLabel: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '700',
    color: Colors.inkSoft,
  },
  orientationLabelSelected: {
    color: Colors.ink,
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
  // Vive en el footer del sheet (visible desde cualquiera de las 3 pantallas).
  error: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.red,
  },
});
