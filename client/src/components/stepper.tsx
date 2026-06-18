import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';

interface Props {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

// Stepper editable: los botones ± mueven por `step`, pero el input central
// también acepta tipear cualquier número entero. Al salir del foco, clampea
// a [min, max] (durante la edición permite valores intermedios para que el
// teclado no salte mientras tipeás).
export function Stepper({ value, onChange, min = 1, max = 1000, step = 1 }: Props) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  const canDec = value - step >= min;
  const canInc = value + step <= max;

  function clamp(n: number) {
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  function commitText() {
    const parsed = parseInt(text.replace(/[^0-9]/g, ''), 10);
    const next = Number.isFinite(parsed) ? clamp(parsed) : min;
    onChange(next);
    setText(String(next));
  }

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => canDec && onChange(value - step)}
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
        onPress={() => canInc && onChange(value + step)}
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
    backgroundColor: Colors.paper2,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    backgroundColor: Colors.paper3,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnLabel: {
    fontFamily: FontFamily.display,
    fontSize: 28,
    color: Colors.ink,
    lineHeight: 30,
  },
  valueInput: {
    flex: 1,
    height: 52,
    fontFamily: FontFamily.display,
    fontSize: 30,
    color: Colors.ink,
    padding: 0,
  },
});
