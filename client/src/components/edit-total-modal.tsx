import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Stepper } from '@/components/stepper';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';

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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <SafeAreaView edges={['bottom']} style={{ width: '100%' }}>
            <View style={styles.handle} />
            <Text style={styles.title}>Cambiar cantidad</Text>

            <Text style={styles.label}>TOTAL DE FIGURITAS</Text>
            <Stepper value={value} onChange={setValue} min={1} max={maxTotal} step={5} />

            {tooLow ? (
              <Text style={styles.warn}>
                No podés bajar de {minTotal}: ya tenés cargadas figuritas con números más altos.
                Eliminalas primero si querés un álbum más chico.
              </Text>
            ) : (
              <Text style={styles.hint}>
                Mínimo {minTotal} (por las figuritas ya cargadas). Máximo {maxTotal}.
              </Text>
            )}

            <View style={styles.actions}>
              <Button label="Cancelar" variant="outline" onPress={onClose} />
              <Button label="Guardar" onPress={handleSave} disabled={tooLow || saving} loading={saving} />
            </View>
          </SafeAreaView>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.paper,
    borderTopLeftRadius: Radius.cardLg,
    borderTopRightRadius: Radius.cardLg,
    paddingHorizontal: Spacing.screenX,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderStrong,
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.screenTitle,
    color: Colors.ink,
    marginBottom: Spacing.lg,
  },
  label: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
  },
  hint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.inkSoft,
    marginTop: Spacing.sm,
  },
  warn: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.amberWarn,
    marginTop: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
});
