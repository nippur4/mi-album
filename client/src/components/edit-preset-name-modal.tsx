import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { BottomSheet, sheetStyles } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { TextInput } from '@/components/text-input';
import { Spacing } from '@/constants/theme';
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
    <BottomSheet
      visible={preset !== null}
      onClose={onClose}
      title="Editar plantilla"
      avoidKeyboard="both"
    >
      <Text style={sheetStyles.label}>NOMBRE</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        autoCapitalize="sentences"
        maxLength={60}
        placeholder="Nombre visible al elegir"
      />

      <Text style={[sheetStyles.label, { marginTop: Spacing.md }]}>ORDEN</Text>
      <TextInput
        value={sortOrder}
        onChangeText={setSortOrder}
        keyboardType="number-pad"
        placeholder="0"
      />
      <Text style={[sheetStyles.hint, { marginTop: Spacing.xs }]}>
        Más bajo = aparece primero en el picker.
      </Text>
      {error && <Text style={sheetStyles.error}>{error}</Text>}

      <View style={sheetStyles.actions}>
        <Button label="Cancelar" variant="outline" onPress={onClose} />
        <Button label="Guardar" onPress={handleSave} disabled={!canSave} loading={saving} />
      </View>
    </BottomSheet>
  );
}
