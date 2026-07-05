import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { BottomSheet, sheetStyles } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { TextInput } from '@/components/text-input';
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
    <BottomSheet visible={visible} onClose={onClose} title="Cambiar nombre" avoidKeyboard="both">
      <Text style={sheetStyles.label}>NOMBRE PÚBLICO</Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={40}
        placeholder="Tu nombre"
      />
      <Text style={sheetStyles.hint}>
        Lo van a ver los otros jugadores en intercambios y bandeja.
      </Text>
      {error && <Text style={sheetStyles.error}>{error}</Text>}

      <View style={sheetStyles.actions}>
        <Button label="Cancelar" variant="outline" onPress={onClose} />
        <Button label="Guardar" onPress={handleSave} disabled={!canSave} loading={saving} />
      </View>
    </BottomSheet>
  );
}
