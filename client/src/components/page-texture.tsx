import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, Path, Pattern, Rect } from 'react-native-svg';

interface Props {
  texture: string;
  // Opacidad de la textura. Subimos el default a 0.18 para que se note bien
  // sin tapar las figuritas (que están encima en otro layer).
  opacity?: number;
}

// Render de la textura como capa absoluta. Se posiciona con StyleSheet.absoluteFill
// dentro de un container relativo. La hoja del AlbumPager la pone entre el
// background color y el grid de figuritas.
//
// Las texturas usan SVG patterns: una <Pattern> con tile pequeño + un <Rect>
// que llena el viewport con ese pattern. Cero assets, todo vectorial.
//
// El tamaño se mide con onLayout y se pasa en píxeles exactos: en web los
// porcentajes sobre <svg>/<rect> resolvían contra el tamaño intrínseco
// default (300×150) y la textura cubría solo un parche de la hoja.
export function PageTexture({ texture, opacity = 0.18 }: Props) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  if (texture === 'none') return null;

  // El stroke / fill de cada figura ya viene saturado; la opacidad del
  // <Rect> contenedor controla la intensidad final visible.
  const color = 'rgba(0,0,0,0.9)';
  // Id único por textura: en web todos los SVG comparten documento y un id
  // repetido ("tex") puede resolver al pattern de OTRO svg montado antes.
  const patternId = `tex-${texture}`;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) =>
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
    >
      {size && size.w > 0 && size.h > 0 && (
        <Svg width={size.w} height={size.h}>
          <Defs>{patternDefs(texture, color, patternId)}</Defs>
          <Rect
            x="0"
            y="0"
            width={size.w}
            height={size.h}
            fill={`url(#${patternId})`}
            opacity={opacity}
          />
        </Svg>
      )}
    </View>
  );
}

function patternDefs(texture: string, color: string, id: string) {
  switch (texture) {
    case 'dots':
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width="14" height="14">
          <Circle cx="3" cy="3" r="2.2" fill={color} />
        </Pattern>
      );
    case 'lines':
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width="10" height="10">
          <Line x1="0" y1="5" x2="10" y2="5" stroke={color} strokeWidth="1.6" />
        </Pattern>
      );
    case 'grid':
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width="16" height="16">
          <Path d="M16 0 L0 0 0 16" fill="none" stroke={color} strokeWidth="1.4" />
        </Pattern>
      );
    case 'crosshatch':
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width="12" height="12">
          <Line x1="0" y1="0" x2="12" y2="12" stroke={color} strokeWidth="1.2" />
          <Line x1="12" y1="0" x2="0" y2="12" stroke={color} strokeWidth="1.2" />
        </Pattern>
      );
    case 'diagonals':
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width="10" height="10">
          <Line x1="0" y1="10" x2="10" y2="0" stroke={color} strokeWidth="1.6" />
        </Pattern>
      );
    case 'rings':
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width="18" height="18">
          <Circle cx="9" cy="9" r="3.5" fill="none" stroke={color} strokeWidth="1.6" />
        </Pattern>
      );
    case 'triangles':
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width="16" height="14">
          <Path d="M3 11 L8 3 L13 11 Z" fill="none" stroke={color} strokeWidth="1.4" />
        </Pattern>
      );
    case 'stars':
      // Estrella de 5 puntas, calculada con cos/sin a mano.
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width="20" height="20">
          <Path
            d="M10 2 L12 7.5 L17.6 7.8 L13.2 11.5 L14.8 17 L10 13.8 L5.2 17 L6.8 11.5 L2.4 7.8 L8 7.5 Z"
            fill={color}
          />
        </Pattern>
      );
    case 'plus':
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width="14" height="14">
          <Line x1="7" y1="3" x2="7" y2="11" stroke={color} strokeWidth="1.6" />
          <Line x1="3" y1="7" x2="11" y2="7" stroke={color} strokeWidth="1.6" />
        </Pattern>
      );
    case 'waves':
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width="20" height="10">
          <Path
            d="M0 5 Q5 0 10 5 T20 5"
            fill="none"
            stroke={color}
            strokeWidth="1.6"
          />
        </Pattern>
      );
    case 'zigzag':
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width="12" height="8">
          <Path
            d="M0 7 L3 1 L6 7 L9 1 L12 7"
            fill="none"
            stroke={color}
            strokeWidth="1.6"
          />
        </Pattern>
      );
    case 'paws':
      // Huella de dino de 3 dedos: almohadilla + dedos arriba. Dos pisadas
      // por tile en diagonal, como caminando.
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width="26" height="26">
          <Circle cx="8" cy="9.5" r="3" fill={color} />
          <Circle cx="4.2" cy="4.5" r="1.5" fill={color} />
          <Circle cx="8" cy="3.2" r="1.6" fill={color} />
          <Circle cx="11.8" cy="4.5" r="1.5" fill={color} />
          <Circle cx="20" cy="21.5" r="3" fill={color} />
          <Circle cx="16.2" cy="16.5" r="1.5" fill={color} />
          <Circle cx="20" cy="15.2" r="1.6" fill={color} />
          <Circle cx="23.8" cy="16.5" r="1.5" fill={color} />
        </Pattern>
      );
    case 'scales':
      // Escamas de reptil: filas de semicírculos, la fila de arriba corrida
      // medio tile. Los arcos que se salen del tile los completa el tile
      // vecino (el pattern clipea, el tiling empalma).
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width="16" height="16">
          <Path d="M0 16 A8 8 0 0 1 16 16" fill="none" stroke={color} strokeWidth="1.4" />
          <Path d="M-8 8 A8 8 0 0 1 8 8" fill="none" stroke={color} strokeWidth="1.4" />
          <Path d="M8 8 A8 8 0 0 1 24 8" fill="none" stroke={color} strokeWidth="1.4" />
        </Pattern>
      );
    case 'bones':
      // Huesito de caricatura en diagonal: caña + dos nudillos por punta.
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width="20" height="20">
          <Line x1="7" y1="13" x2="13" y2="7" stroke={color} strokeWidth="2.2" />
          <Circle cx="5.6" cy="11.6" r="2" fill={color} />
          <Circle cx="8.4" cy="14.4" r="2" fill={color} />
          <Circle cx="11.6" cy="5.6" r="2" fill={color} />
          <Circle cx="14.4" cy="8.4" r="2" fill={color} />
        </Pattern>
      );
    case 'ferns':
      // Fronda de helecho: tallo central + pinnas laterales en ángulo.
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width="20" height="22">
          <Path d="M10 3 L10 19" fill="none" stroke={color} strokeWidth="1.5" />
          <Path
            d="M10 6 L6 3.5 M10 6 L14 3.5 M10 10 L5 7.5 M10 10 L15 7.5 M10 14 L5.5 11.5 M10 14 L14.5 11.5 M10 18 L7 16 M10 18 L13 16"
            fill="none"
            stroke={color}
            strokeWidth="1.3"
          />
        </Pattern>
      );
    default:
      return null;
  }
}
