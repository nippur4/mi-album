// Grid de preview de un layout (M rows × N cols). Usa flex puro para
// distribuir las celdas — Yoga calcula tamaños y gaps sin que tengamos que
// hacer cuentas con porcentajes (que se rompían cuando el layout no era
// cuadrado, mismo bug que tenía el AlbumPager).
//
// Si orientation='landscape', las celdas dibujadas quedan apaisadas (fixed
// aspectRatio invertido). Sirve para que el owner vea el resultado real de
// aplicar la orientación antes de aplicar.
//
// Vive acá (y no dentro de edit-pages-modal) porque lo usan también la card de
// diseño de hojas del owner y la pantalla de álbum nuevo, que no deberían
// importar el modal entero.

import { useState } from 'react';
import { View } from 'react-native';

import { Layout as ThemeLayout } from '@/constants/theme';
import type { PageOrientation } from '@/lib/page-config';

export function LayoutPreviewGrid({
  cols,
  rows,
  orientation = 'portrait',
  cellColor = 'rgba(42,30,22,0.25)',
  cellAspect: cellAspectProp,
}: {
  cols: number;
  rows: number;
  orientation?: PageOrientation;
  cellColor?: string;
  // Proporción w/h de la celda. Default: la de la grilla del álbum. Se pasa
  // cuando el preview tiene que reflejar la proporción elegida (ej. "Carta").
  cellAspect?: number;
}) {
  const baseAspect = cellAspectProp ?? ThemeLayout.gridCellAspect;
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
