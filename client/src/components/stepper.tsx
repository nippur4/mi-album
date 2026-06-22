import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';

interface Props {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  // Si se provee, los botones ± saltan los valores que estén en el set.
  // Si tipeás un valor excluido, al perder foco se ajusta al próximo disponible.
  excluded?: Set<number>;
}

// Stepper editable: los botones ± mueven por `step` (saltando excluidos si
// se pasan), el input central acepta tipear cualquier número entero y al
// perder foco clampea + salta al próximo disponible si tipeaste uno excluido.
export function Stepper({ value, onChange, min = 1, max = 1000, step = 1, excluded }: Props) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  // Próximo valor permitido (no excluido) avanzando `dir`. null si no hay.
  function nextAllowed(start: number, dir: 1 | -1): number | null {
    let n = start;
    while (n >= min && n <= max) {
      if (!excluded?.has(n)) return n;
      n += dir;
    }
    return null;
  }

  const candidateDec = nextAllowed(value - step, -1);
  const candidateInc = nextAllowed(value + step, 1);
  const canDec = candidateDec !== null;
  const canInc = candidateInc !== null;

  function clamp(n: number) {
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  function commitText() {
    const parsed = parseInt(text.replace(/[^0-9]/g, ''), 10);
    const intended = Number.isFinite(parsed) ? clamp(parsed) : min;
    let next = intended;
    if (excluded?.has(next)) {
      next = nextAllowed(intended, 1) ?? nextAllowed(intended, -1) ?? intended;
    }
    onChange(next);
    setText(String(next));
  }

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => canDec && onChange(candidateDec!)}
        disabled={!canDec}
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed, !canDec && styles.btnDisabled]}
      >
        <Text style={styles.btnLabel}>−</Text>
      </Pressable>
      <TextInput
        style={styles.valueInput}
        value={text}
        onChangeText={(t) => setText(t.replace(/[^0-9]/g, ''))}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); commitText(); }}
        onSubmitEditing={commitText}
        keyboardType="number-pad"
        returnKeyType="done"
        selectTextOnFocus
        maxLength={4}
        textAlign="center"
      />
      <Pressable
        onPress={() => canInc && onChange(candidateInc!)}
        disabled={!canInc}
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed, !canInc && styles.btnDisabled]}
      >
        <Text style={styles.btnLabel}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  btn: {
    width: 52,
    height: 52,
    borderRadius: Radius.button,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    // sombra dura estilo CTA
    shadowColor: Colors.redShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  btnPressed: {
    transform: [{ translateY: 4 }],
    shadowOpacity: 0,
    elevation: 0,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnLabel: {
    fontFamily: FontFamily.display,
    fontSize: 28,
    color: '#FFFFFF',
    lineHeight: 30,
  },
  valueInput: {
    flex: 1,
    height: 52,
    fontFamily: FontFamily.display,
    fontSize: 30,
    color: Colors.ink,
    padding: 0,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
