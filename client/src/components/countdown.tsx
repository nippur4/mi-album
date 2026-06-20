import { useEffect, useState } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { Colors, FontFamily, FontSize } from '@/constants/theme';

interface Props {
  // ms epoch al que apunta el contador
  target: number;
  style?: StyleProp<TextStyle>;
  onReachZero?: () => void;
}

// Muestra HH:MM:SS en mono. Tick cada segundo.
export function Countdown({ target, style, onReachZero }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, target - now);
  useEffect(() => {
    if (remaining === 0 && onReachZero) onReachZero();
  }, [remaining, onReachZero]);

  return <Text style={[styles.text, style]}>{format(remaining)}</Text>;
}

function format(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
function pad(n: number) { return n.toString().padStart(2, '0'); }

const styles = StyleSheet.create({
  text: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.red,
    letterSpacing: 2,
  },
});
