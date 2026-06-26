import { Feather } from '@expo/vector-icons';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Colors, FontFamily, FontSize, Layout, Spacing } from '@/constants/theme';

interface Props {
  totalStickers: number;
  perPage?: number;
  renderCell: (number: number) => ReactNode;
  headerLabel?: string;
}

const FLIP_THRESHOLD = 0.25;     // % de pageWidth para que el flip se complete
const FLIP_DURATION = 380;       // ms
const PERSPECTIVE = 1100;

// Pager con efecto de hoja: la página activa rota rotateY 0→±180 sobre su eje
// vertical (con backfaceVisibility hidden, así "desaparece" al pasar 90°) y
// detrás queda la página entrante. El swipe se maneja con PanGestureHandler,
// las flechas disparan la misma animación programáticamente. Custom con
// Reanimated/Gesture Handler — sin libs externas, sin rebuild.
export function AlbumPager({ totalStickers, perPage = 12, renderCell, headerLabel }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const pageCount = Math.max(1, Math.ceil(totalStickers / perPage));
  const [currentPage, setCurrentPage] = useState(0);

  const pageWidth = screenWidth;
  const innerWidth = pageWidth - 2 * Spacing.screenX;
  const cellWidth = (innerWidth - 2 * Spacing.gridGap) / 3;
  const cellHeight = cellWidth / Layout.gridCellAspect;
  const pageHeight = cellHeight * 4 + Spacing.gridGap * 3 + Spacing.md * 2;

  const pages = useMemo(() => {
    const out: number[][] = [];
    for (let p = 0; p < pageCount; p++) {
      const start = p * perPage + 1;
      const end = Math.min(start + perPage - 1, totalStickers);
      const nums: number[] = [];
      for (let n = start; n <= end; n++) nums.push(n);
      out.push(nums);
    }
    return out;
  }, [pageCount, perPage, totalStickers]);

  // progress: -1 → flip completo hacia la siguiente página (swipe izquierdo)
  //           +1 → flip completo hacia la anterior (swipe derecho)
  //            0 → página actual centrada
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
          // Limitar a [-1, 1]
          if (next > 1) next = 1;
          if (next < -1) next = -1;
          // Desactivar en los extremos
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

  // Estilo de la página activa: rota rotateY hasta ±45° (sutil tilt de hoja)
  // y se desplaza lateralmente para "salir" de pantalla, mientras la opacidad
  // se desvanece al final del flip para ocultarla justo cuando la entrante
  // ya está visible debajo.
  const activeStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const rotateY = interpolate(p, [-1, 0, 1], [-45, 0, 45]);
    const translateX = interpolate(p, [-1, 0, 1], [-pageWidth * 0.7, 0, pageWidth * 0.7]);
    const opacity = interpolate(
      Math.abs(p),
      [0, 0.6, 1],
      [1, 0.85, 0],
    );
    const shadowOpacity = interpolate(
      Math.abs(p),
      [0, 0.5, 1],
      [0.08, 0.25, 0.05],
    );
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

  // Estilo del fondo: la página siguiente o la previa, según el sentido del swipe.
  const nextPageOpacity = useAnimatedStyle(() => {
    // visible cuando flip hacia adelante (progress < 0)
    return { opacity: progress.value < 0 ? 1 : 0 };
  });
  const prevPageOpacity = useAnimatedStyle(() => {
    return { opacity: progress.value > 0 ? 1 : 0 };
  });

  function goTo(dir: -1 | 1) {
    // -1 = anterior (progress → +1 visualmente); +1 = siguiente (progress → -1)
    if (dir === -1 && currentPage > 0) snapTo(1);
    if (dir === 1 && currentPage < pageCount - 1) snapTo(-1);
  }

  function renderPageContent(pageIdx: number) {
    if (pageIdx < 0 || pageIdx >= pages.length) return null;
    const nums = pages[pageIdx];
    const slots = [...nums, ...Array(perPage - nums.length).fill(null)];
    return (
      <View style={[styles.page, { width: pageWidth, height: pageHeight }]}>
        <View style={styles.grid}>
          {slots.map((n, i) =>
            n === null ? (
              <View key={`empty-${i}`} style={styles.gridCellPlaceholder} />
            ) : (
              <View key={n} style={styles.gridCell}>
                {renderCell(n)}
              </View>
            ),
          )}
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
        {/* Página entrante (siguiente), visible solo durante flip izquierdo */}
        <Animated.View
          pointerEvents="none"
          style={[styles.layer, nextPageOpacity]}
        >
          {renderPageContent(currentPage + 1)}
        </Animated.View>

        {/* Página entrante (anterior), visible solo durante flip derecho */}
        <Animated.View
          pointerEvents="none"
          style={[styles.layer, prevPageOpacity]}
        >
          {renderPageContent(currentPage - 1)}
        </Animated.View>

        {/* Página activa con animación + gesture */}
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
  // La página activa lleva sombra animada para acentuar el flip.
  activeLayer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  page: {
    backgroundColor: Colors.paper,
    paddingHorizontal: Spacing.screenX,
    paddingVertical: Spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.gridGap,
  },
  gridCell: {
    flexBasis: '31.5%',
    flexGrow: 0,
    flexShrink: 0,
  },
  gridCellPlaceholder: {
    flexBasis: '31.5%',
    flexGrow: 0,
    flexShrink: 0,
    aspectRatio: Layout.gridCellAspect,
  },
});
