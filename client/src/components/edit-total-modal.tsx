import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet, sheetStyles } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { Stepper } from '@/components/stepper';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';

interface Props {
  visible: boolean;
  currentTotal: number;
  minTotal: number;  // no se puede bajar por debajo del max(number) ya cargado
  maxTotal: number;  // 75 free, 1000 pro
  onClose: () => void;
  onSave: (n: number) => Promise<void>;
}

export function EditTotalModal({ visible, currentTotal, minTotal, maxTotal, onClose, onSave }: Props) {
  const [value, setValue] = useState(currentTotal);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setValue(currentTotal);
  }, [visible, currentTotal]);

  const tooLow = value < minTotal;

  async function handleSave() {
    if (tooLow) return;
    setSaving(true);
    try {
      await onSave(value);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Cambiar cantidad" avoidKeyboard="both">
      <Text style={sheetStyles.label}>TOTAL DE FIGURITAS</Text>
      <Stepper value={value} onChange={setValue} min={1} max={maxTotal} step={5} />

      {tooLow ? (
        <Text style={styles.warn}>
          No podés bajar de {minTotal}: ya tenés cargadas figuritas con números más altos.
          Eliminalas primero si querés un álbum más chico.
        </Text>
      ) : (
        <Text style={sheetStyles.hint}>
          Mínimo {minTotal} (por las figuritas ya cargadas). Máximo {maxTotal}.
        </Text>
      )}

      <View style={sheetStyles.actions}>
        <Button label="Cancelar" variant="outline" onPress={onClose} />
        <Button label="Guardar" onPress={handleSave} disabled={tooLow || saving} loading={saving} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  warn: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.amberWarn,
    marginTop: Spacing.sm,
  },
});
