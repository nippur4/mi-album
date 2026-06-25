import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { TextInput } from '@/components/text-input';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { errorMessage } from '@/lib/errors';
import { updateAdminPreset, type PresetImage } from '@/lib/queries/presets';

interface Props {
  preset: PresetImage | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EditPresetNameModal({ preset, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preset) {
      setName(preset.name);
      setSortOrder(String(preset.sort_order));
      setError(null);
    }
  }, [preset]);

  const trimmedName = name.trim();
  const sortParsed = Number.parseInt(sortOrder, 10);
  const canSave =
    !!preset &&
    trimmedName.length >= 1 &&
    trimmedName.length <= 60 &&
    Number.isFinite(sortParsed) &&
    !saving;

  async function handleSave() {
    if (!preset) return;
    setError(null);
    setSaving(true);
    const { error: rpcErr } = await updateAdminPreset({
      id: preset.id,
      name: trimmedName,
      sort_order: Number.isFinite(sortParsed) ? sortParsed : 0,
    });
    setSaving(false);
    if (rpcErr) {
      setError(errorMessage(rpcErr));
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Modal visible={preset !== null} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <SafeAreaView edges={['bottom']} style={{ width: '100%' }}>
              <View style={styles.handle} />
              <Text style={styles.title}>Editar plantilla</Text>

              <Text style={styles.label}>NOMBRE</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                autoCapitalize="sentences"
                maxLength={60}
                placeholder="Nombre visible al elegir"
              />

              <Text style={[styles.label, { marginTop: Spacing.md }]}>ORDEN</Text>
              <TextInput
                value={sortOrder}
                onChangeText={setSortOrder}
                keyboardType="number-pad"
                placeholder="0"
              />
              <Text style={styles.hint}>Más bajo = aparece primero en el picker.</Text>
              {error && <Text style={styles.error}>{error}</Text>}

              <View style={styles.actions}>
                <Button label="Cancelar" variant="outline" onPress={onClose} />
                <Button label="Guardar" onPress={handleSave} disabled={!canSave} loading={saving} />
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
    marginTop: Spacing.xs,
  },
  error: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.red,
    marginTop: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
});
