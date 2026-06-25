import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { TextInput } from '@/components/text-input';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { updateDisplayName } from '@/lib/queries/profile';
import { errorMessage } from '@/lib/errors';

interface Props {
  visible: boolean;
  currentName: string;
  onClose: () => void;
  onSaved: () => void;
}

export function EditNameModal({ visible, currentName, onClose, onSaved }: Props) {
  const [value, setValue] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setValue(currentName);
      setError(null);
    }
  }, [visible, currentName]);

  const trimmed = value.trim();
  const canSave = trimmed.length >= 2 && trimmed.length <= 40 && !saving && trimmed !== currentName;

  async function handleSave() {
    setError(null);
    setSaving(true);
    const { error: rpcErr } = await updateDisplayName(trimmed);
    setSaving(false);
    if (rpcErr) {
      setError(errorMessage(rpcErr));
      return;
    }
    onSaved();
    onClose();
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
            <Text style={styles.title}>Cambiar nombre</Text>

            <Text style={styles.label}>NOMBRE PÚBLICO</Text>
            <TextInput
              value={value}
              onChangeText={setValue}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={40}
              placeholder="Tu nombre"
            />
            <Text style={styles.hint}>
              Lo van a ver los otros jugadores en intercambios y bandeja.
            </Text>
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
    marginTop: Spacing.sm,
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
