import Feather from '@expo/vector-icons/Feather';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Colors, FontFamily, FontSize, Layout, Radius, Spacing } from '@/constants/theme';
import {
  buildPages,
  DEFAULT_CELL_ASPECT,
  DEFAULT_PAGE_COLOR,
  DEFAULT_PAGE_LAYOUT,
  DEFAULT_PAGE_TEXTURE,
  resolveCellAspect,
  resolveColor,
  type BuiltPage,
  type PageOverride,
} from '@/lib/page-config';
import { PageTexture } from '@/components/page-texture';

interface Props {
  totalStickers: number;
  // Primer número del álbum (1 salvo el álbum especial que arranca en 0).
  numberStart?: number;
  // cellStyle viene con el aspectRatio efectivo (respeta orientation de la
  // hoja). El caller debe pasarlo al StickerCell/Empty/Missing como `style`.
  renderCell: (number: number, cellStyle: ViewStyle) => ReactNode;
  headerLabel?: string;
  pageBgColor?: string;
  pageTexture?: string;
  // Proporción de figurita por defecto del álbum (key de CELL_ASPECTS).
  pageCellAspect?: string;
  // Composición por defecto del álbum (key de PAGE_LAYOUTS).
  pageLayout?: string;
  pageOverrides?: PageOverride[];
}

const FLIP_DURATION = 380;
const PERSPECTIVE = 1100;
const SWIPE_VEL_THRESHOLD = 600;

// Pager con efecto de hoja. Approach "carousel" con una sola posición
// fraccionaria (position) que crece sin reset — eliminar el reset evita el
// tirón entre el commit JS (setCurrentPage) y el UI (progress=0) que antes
// se desincronizaban.
//
// position 0 = primera página centrada; 1.5 = entre página 2 y 3; etc.
// Cada página renderiza con rotateY = interpolate(idx - position).
export function AlbumPager({
  totalStickers,
  numberStart = 1,
  renderCell,
  headerLabel,
  pageBgColor = DEFAULT_PAGE_COLOR,
  pageTexture = DEFAULT_PAGE_TEXTURE,
  pageCellAspect = DEFAULT_CELL_ASPECT,
  pageLayout = DEFAULT_PAGE_LAYOUT,
  pageOverrides = [],
}: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const [currentPage, setCurrentPage] = useState(0);

  // Ancho real del contenedor (medido con onLayout sobre el wrap, que vive
  // dentro del padding screenX del caller). En mobile coincide con
  // screenWidth - 2*screenX, así que el fallback inicial no produce salto.
  // En desktop web el contenido está capeado (DesktopCapped) y acá es donde
  // window width rompería el layout.
  const [wrapWidth, setWrapWidth] = useState<number | null>(null);

  const pageWidth = (wrapWidth ?? screenWidth - 2 * Spacing.screenX) + 2 * Spacing.screenX;
  const innerWidth = pageWidth - 2 * Spacing.screenX;
  const defaultCellWidth = (innerWidth - 2 * Spacing.gridGap) / 3;
  const defaultCellHeight = defaultCellWidth / Layout.gridCellAspect;
  const pageHeight = defaultCellHeight * 4 + Spacing.gridGap * 3 + Spacing.md * 2;

  const pages: BuiltPage[] = useMemo(
    () =>
      buildPages(totalStickers, pageBgColor, pageTexture, pageOverrides, numberStart, pageCellAspect, pageLayout),
    [totalStickers, pageBgColor, pageTexture, pageOverrides, numberStart, pageCellAspect, pageLayout],
  );
  const pageCount = Math.max(1, pages.length);

  // Posición fraccionaria del "centro virtual". Cuando es entero, esa página
  // está centrada. Durante el swipe se vuelve fraccionario.
  const position = useSharedValue(0);

  const onSettledPage = useCallback((idx: number) => {
    setCurrentPage(idx);
  }, []);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-15, 15])
        .failOffsetY([-20, 20])
        .onChange((e) => {
          'worklet';
          let next = position.value - e.changeX / pageWidth;
          if (next < 0) next = 0;
          if (next > pageCount - 1) next = pageCount - 1;
          position.value = next;
        })
        .onEnd((e) => {
          'worklet';
          const v = position.value;
          let target = Math.round(v);
          // Velocidad alta sobrepone la posición: completa el flip aunque
          // el dedo no haya cruzado la mitad.
          if (e.velocityX < -SWIPE_VEL_THRESHOLD) target = Math.ceil(v);
          else if (e.velocityX > SWIPE_VEL_THRESHOLD) target = Math.floor(v);
          if (target < 0) target = 0;
          if (target > pageCount - 1) target = pageCount - 1;
          position.value = withTiming(target, { duration: FLIP_DURATION }, (finished) => {
            if (finished) runOnJS(onSettledPage)(target);
          });
        }),
    [position, pageWidth, pageCount, onSettledPage],
  );

  function goTo(idx: number) {
    const clamped = Math.max(0, Math.min(pageCount - 1, idx));
    position.value = withTiming(clamped, { duration: FLIP_DURATION }, (finished) => {
      'worklet';
      if (finished) runOnJS(onSettledPage)(clamped);
    });
  }

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => setWrapWidth(e.nativeEvent.layout.width)}
    >
      <View style={styles.header}>
        {headerLabel ? (
          <Text style={styles.headerLabel}>{headerLabel}</Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <View style={styles.pagerNav}>
          <Pressable
            onPress={() => goTo(currentPage - 1)}
            disabled={currentPage === 0}
            hitSlop={8}
            style={({ pressed }) => [
              styles.navBtn,
              pressed && styles.navBtnPressed,
              currentPage === 0 && styles.navBtnDisabled,
            ]}
          >
            <Feather name="chevron-left" size={20} color={Colors.ink} />
          </Pressable>
          <Text style={styles.pageCount}>
            {currentPage + 1} / {pageCount}
          </Text>
          <Pressable
            onPress={() => goTo(currentPage + 1)}
            disabled={currentPage === pageCount - 1}
            hitSlop={8}
            style={({ pressed }) => [
              styles.navBtn,
              pressed && styles.navBtnPressed,
              currentPage === pageCount - 1 && styles.navBtnDisabled,
            ]}
          >
            <Feather name="chevron-right" size={20} color={Colors.ink} />
          </Pressable>
        </View>
      </View>

      <View
        style={{
          width: pageWidth,
          height: pageHeight,
          marginHorizontal: -Spacing.screenX,
          overflow: 'hidden',
        }}
      >
        <GestureDetector gesture={pan}>
          <View style={{ width: pageWidth, height: pageHeight }}>
            {pages.map((page, idx) => {
              // Solo renderear páginas a distancia ≤ 1 del current (buffer
              // para que el flip muestre la página vecina sin pop-in).
              if (Math.abs(idx - currentPage) > 1) return null;
              return (
                <AnimatedPage
                  key={idx}
                  idx={idx}
                  position={position}
                  pageWidth={pageWidth}
                  pageHeight={pageHeight}
                  innerWidth={innerWidth}
                  page={page}
                  renderCell={renderCell}
                />
              );
            })}
          </View>
        </GestureDetector>
      </View>
    </View>
  );
}

interface AnimatedPageProps {
  idx: number;
  position: SharedValue<number>;
  pageWidth: number;
  pageHeight: number;
  innerWidth: number;
  page: BuiltPage;
  renderCell: (number: number, cellStyle: ViewStyle) => ReactNode;
}

function AnimatedPage({
  idx,
  position,
  pageWidth,
  pageHeight,
  innerWidth,
  page,
  renderCell,
}: AnimatedPageProps) {
  const { layout, numbers, colorKey, orientation } = page;
  const bg = resolveColor(colorKey);

  // Portrait: la proporción configurada de la hoja (clásica 0.82, carta 2:3,
  // cuadrada 1:1). Landscape: invertida. La hoja mantiene su tamaño fijo:
  // la lógica de fit de abajo achica las celdas si el grid no entra.
  const baseAspect = resolveCellAspect(page.cellAspectKey);
  const aspect = orientation === 'landscape' ? 1 / baseAspect : baseAspect;
  const SAFETY_MARGIN = 4;
  const availW = innerWidth - Spacing.gridGap * (layout.cols - 1) - SAFETY_MARGIN;
  const availH = pageHeight - Spacing.md * 2 - Spacing.gridGap * (layout.rows - 1);
  let cellW = Math.floor(availW / layout.cols);
  const cellHfromW = cellW / aspect;
  if (cellHfromW * layout.rows > availH) {
    const cellH = Math.floor(availH / layout.rows);
    cellW = Math.floor(cellH * aspect);
  }
  const gridW = cellW * layout.cols + Spacing.gridGap * (layout.cols - 1);

  // Distancia al centro virtual. -1 = página a la izquierda (saliendo / por
  // entrar desde der), 0 = centrada, 1 = página a la derecha.
  const animatedStyle = useAnimatedStyle(() => {
    const distance = idx - position.value;
    const clamped = Math.max(-1, Math.min(1, distance));
    // Translate: cada página está en su slot absoluto. translateX la mueve
    // al lugar correcto según la position virtual.
    const translateX = -position.value * pageWidth + idx * pageWidth;
    // RotateY se aplica cuando la página está cerca del centro (transición).
    const rotateY = interpolate(clamped, [-1, 0, 1], [25, 0, -25], Extrapolation.CLAMP);
    const opacity = interpolate(
      Math.abs(clamped),
      [0, 1],
      [1, 0.35],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateX },
        { perspective: PERSPECTIVE },
        { rotateY: `${rotateY}deg` },
      ],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          width: pageWidth,
          height: pageHeight,
        },
        animatedStyle,
      ]}
    >
      <View
        style={[
          styles.page,
          {
            width: pageWidth,
            height: pageHeight,
            backgroundColor: bg,
          },
        ]}
      >
        {/* Textura entre el color de fondo y el grid de figuritas */}
        <PageTexture texture={page.textureKey} />
        <View
          style={[
            styles.grid,
            { width: gridW, alignSelf: 'center' },
          ]}
        >
          {Array.from({ length: layout.capacity }).map((_, i) => {
            const n = numbers[i];
            return (
              <View
                key={n ?? `empty-${i}`}
                style={{ width: cellW, aspectRatio: aspect, overflow: 'hidden' }}
              >
                {n !== undefined && renderCell(n, { aspectRatio: aspect })}
              </View>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
    flex: 1,
  },
  pagerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.paper2,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnPressed: { opacity: 0.6 },
  navBtnDisabled: { opacity: 0.35 },
  pageCount: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.bodySmall,
    fontWeight: '700',
    color: Colors.ink,
    letterSpacing: 1,
    minWidth: 40,
    textAlign: 'center',
  },
  page: {
    paddingHorizontal: Spacing.screenX,
    paddingVertical: Spacing.md,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.gridGap,
  },
});
