import { Feather } from '@expo/vector-icons';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Colors, FontFamily, FontSize, Layout, Radius, Spacing } from '@/constants/theme';
import {
  buildPages,
  DEFAULT_PAGE_COLOR,
  resolveColor,
  type BuiltPage,
  type PageOverride,
} from '@/lib/page-config';

interface Props {
  totalStickers: number;
  renderCell: (number: number) => ReactNode;
  headerLabel?: string;
  // Color de hoja por defecto (key del paleta). Default 'paper'.
  pageBgColor?: string;
  // Overrides por página (color y/o layout).
  pageOverrides?: PageOverride[];
}

const FLIP_THRESHOLD = 0.25;
const FLIP_DURATION = 380;
const PERSPECTIVE = 1100;

export function AlbumPager({
  totalStickers,
  renderCell,
  headerLabel,
  pageBgColor = DEFAULT_PAGE_COLOR,
  pageOverrides = [],
}: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const [currentPage, setCurrentPage] = useState(0);

  const pageWidth = screenWidth;
  const innerWidth = pageWidth - 2 * Spacing.screenX;

  // Altura de la hoja: fija para todos los layouts, calculada del default 3×4
  // con aspectRatio gridCellAspect — los otros layouts ajustan su celda
  // adentro para llenar el espacio sin desbordar.
  const defaultCellWidth = (innerWidth - 2 * Spacing.gridGap) / 3;
  const defaultCellHeight = defaultCellWidth / Layout.gridCellAspect;
  const pageHeight = defaultCellHeight * 4 + Spacing.gridGap * 3 + Spacing.md * 2;

  const pages: BuiltPage[] = useMemo(
    () => buildPages(totalStickers, pageBgColor, pageOverrides),
    [totalStickers, pageBgColor, pageOverrides],
  );
  const pageCount = Math.max(1, pages.length);

  const progress = useSharedValue(0);

  const commitPage = useCallback((delta: number) => {
    setCurrentPage((p) => Math.max(0, Math.min(pageCount - 1, p + delta)));
    progress.value = 0;
  }, [pageCount, progress]);

  const snapTo = useCallback((target: -1 | 0 | 1) => {
    progress.value = withTiming(target, { duration: FLIP_DURATION }, (finished) => {
      if (finished && target !== 0) {
        runOnJS(commitPage)(target === -1 ? 1 : -1);
      }
    });
  }, [progress, commitPage]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-15, 15])
        .failOffsetY([-20, 20])
        .onChange((e) => {
          'worklet';
          const delta = e.changeX / pageWidth;
          let next = progress.value + delta;
          if (next > 1) next = 1;
          if (next < -1) next = -1;
          if (currentPage === 0 && next > 0) next = 0;
          if (currentPage === pageCount - 1 && next < 0) next = 0;
          progress.value = next;
        })
        .onEnd((e) => {
          'worklet';
          const v = progress.value;
          const vel = e.velocityX;
          let target: -1 | 0 | 1 = 0;
          if (v < -FLIP_THRESHOLD || vel < -800) {
            if (currentPage < pageCount - 1) target = -1;
          } else if (v > FLIP_THRESHOLD || vel > 800) {
            if (currentPage > 0) target = 1;
          }
          progress.value = withTiming(target, { duration: FLIP_DURATION }, (finished) => {
            if (finished && target !== 0) {
              runOnJS(commitPage)(target === -1 ? 1 : -1);
            }
          });
        }),
    [progress, currentPage, pageCount, pageWidth, commitPage],
  );

  const activeStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const rotateY = interpolate(p, [-1, 0, 1], [-45, 0, 45]);
    const translateX = interpolate(p, [-1, 0, 1], [-pageWidth * 0.7, 0, pageWidth * 0.7]);
    const opacity = interpolate(Math.abs(p), [0, 0.6, 1], [1, 0.85, 0]);
    const shadowOpacity = interpolate(Math.abs(p), [0, 0.5, 1], [0.08, 0.25, 0.05]);
    return {
      transform: [
        { perspective: PERSPECTIVE },
        { translateX },
        { rotateY: `${rotateY}deg` },
      ],
      opacity,
      shadowOpacity,
    };
  });

  const nextPageOpacity = useAnimatedStyle(() => ({
    opacity: progress.value < 0 ? 1 : 0,
  }));
  const prevPageOpacity = useAnimatedStyle(() => ({
    opacity: progress.value > 0 ? 1 : 0,
  }));

  function goTo(dir: -1 | 1) {
    if (dir === -1 && currentPage > 0) snapTo(1);
    if (dir === 1 && currentPage < pageCount - 1) snapTo(-1);
  }

  function renderPageContent(pageIdx: number) {
    if (pageIdx < 0 || pageIdx >= pages.length) return null;
    const page = pages[pageIdx];
    const { layout, numbers, colorKey } = page;
    const bg = resolveColor(colorKey);

    // La celda interior tiene aspectRatio:0.82 propio. Para que NUNCA pelee
    // con el slot, le doy al slot el mismo aspectRatio (en vez de width+height
    // explícitos). Yoga calcula height = width/aspectRatio nativamente y el
    // cell adentro respeta el slot al pie.
    const aspect = Layout.gridCellAspect; // width / height
    const availW = innerWidth - Spacing.gridGap * (layout.cols - 1);
    const availH = pageHeight - Spacing.md * 2 - Spacing.gridGap * (layout.rows - 1);

    // cellW máximo según el eje horizontal:
    let cellW = availW / layout.cols;
    // Si la altura calculada (cellW/aspect)*rows excede la altura disponible,
    // recortamos cellW para que entren.
    const cellHfromW = cellW / aspect;
    if (cellHfromW * layout.rows > availH) {
      const cellH = availH / layout.rows;
      cellW = cellH * aspect;
    }

    const gridW = cellW * layout.cols + Spacing.gridGap * (layout.cols - 1);

    return (
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
                // Slot con width fija + aspectRatio: Yoga calcula la altura
                // matching el aspectRatio del cell adentro → no overflow.
                style={{ width: cellW, aspectRatio: aspect, overflow: 'hidden' }}
              >
                {n !== undefined && renderCell(n)}
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        {headerLabel ? (
          <Text style={styles.headerLabel}>{headerLabel}</Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <View style={styles.pagerNav}>
          <Pressable
            onPress={() => goTo(-1)}
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
            onPress={() => goTo(1)}
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
        }}
      >
        <Animated.View pointerEvents="none" style={[styles.layer, nextPageOpacity]}>
          {renderPageContent(currentPage + 1)}
        </Animated.View>

        <Animated.View pointerEvents="none" style={[styles.layer, prevPageOpacity]}>
          {renderPageContent(currentPage - 1)}
        </Animated.View>

        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.layer, styles.activeLayer, activeStyle]}>
            {renderPageContent(currentPage)}
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
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
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  activeLayer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  // La hoja se renderiza como card con border + shadow, así se distingue del
  // body de la app sin depender solo del color. El tamaño es FIJO (calculado
  // en pageHeight según el layout default 3×4), independiente del layout que
  // la hoja use por dentro — las celdas se ajustan al espacio disponible y
  // el grid se centra cuando el aspectRatio deja margen.
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
