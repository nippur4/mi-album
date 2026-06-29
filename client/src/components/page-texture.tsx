import { StyleSheet } from 'react-native';
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
export function PageTexture({ texture, opacity = 0.18 }: Props) {
  if (texture === 'none') return null;

  // El stroke / fill de cada figura ya viene saturado; la opacidad del
  // <Rect> contenedor controla la intensidad final visible.
  const color = 'rgba(0,0,0,0.9)';

  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>{patternDefs(texture, color)}</Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#tex)`} opacity={opacity} />
    </Svg>
  );
}

function patternDefs(texture: string, color: string) {
  switch (texture) {
    case 'dots':
      return (
        <Pattern id="tex" patternUnits="userSpaceOnUse" width="14" height="14">
          <Circle cx="3" cy="3" r="2.2" fill={color} />
        </Pattern>
      );
    case 'lines':
      return (
        <Pattern id="tex" patternUnits="userSpaceOnUse" width="10" height="10">
          <Line x1="0" y1="5" x2="10" y2="5" stroke={color} strokeWidth="1.6" />
        </Pattern>
      );
    case 'grid':
      return (
        <Pattern id="tex" patternUnits="userSpaceOnUse" width="16" height="16">
          <Path d="M16 0 L0 0 0 16" fill="none" stroke={color} strokeWidth="1.4" />
        </Pattern>
      );
    case 'crosshatch':
      return (
        <Pattern id="tex" patternUnits="userSpaceOnUse" width="12" height="12">
          <Line x1="0" y1="0" x2="12" y2="12" stroke={color} strokeWidth="1.2" />
          <Line x1="12" y1="0" x2="0" y2="12" stroke={color} strokeWidth="1.2" />
        </Pattern>
      );
    case 'diagonals':
      return (
        <Pattern id="tex" patternUnits="userSpaceOnUse" width="10" height="10">
          <Line x1="0" y1="10" x2="10" y2="0" stroke={color} strokeWidth="1.6" />
        </Pattern>
      );
    case 'rings':
      return (
        <Pattern id="tex" patternUnits="userSpaceOnUse" width="18" height="18">
          <Circle cx="9" cy="9" r="3.5" fill="none" stroke={color} strokeWidth="1.6" />
        </Pattern>
      );
    case 'triangles':
      return (
        <Pattern id="tex" patternUnits="userSpaceOnUse" width="16" height="14">
          <Path d="M3 11 L8 3 L13 11 Z" fill="none" stroke={color} strokeWidth="1.4" />
        </Pattern>
      );
    case 'stars':
      // Estrella de 5 puntas, calculada con cos/sin a mano.
      return (
        <Pattern id="tex" patternUnits="userSpaceOnUse" width="20" height="20">
          <Path
            d="M10 2 L12 7.5 L17.6 7.8 L13.2 11.5 L14.8 17 L10 13.8 L5.2 17 L6.8 11.5 L2.4 7.8 L8 7.5 Z"
            fill={color}
          />
        </Pattern>
      );
    case 'plus':
      return (
        <Pattern id="tex" patternUnits="userSpaceOnUse" width="14" height="14">
          <Line x1="7" y1="3" x2="7" y2="11" stroke={color} strokeWidth="1.6" />
          <Line x1="3" y1="7" x2="11" y2="7" stroke={color} strokeWidth="1.6" />
        </Pattern>
      );
    case 'waves':
      return (
        <Pattern id="tex" patternUnits="userSpaceOnUse" width="20" height="10">
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
        <Pattern id="tex" patternUnits="userSpaceOnUse" width="12" height="8">
          <Path
            d="M0 7 L3 1 L6 7 L9 1 L12 7"
            fill="none"
            stroke={color}
            strokeWidth="1.6"
          />
        </Pattern>
      );
    default:
      return null;
  }
}
