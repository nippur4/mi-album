import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { BottomSheet, sheetStyles } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { TextInput } from '@/components/text-input';
import { updateAlbumContent } from '@/lib/queries/albums';
import { errorMessage } from '@/lib/errors';

interface Props {
  visible: boolean;
  albumId: string;
  currentName: string;
  onClose: () => void;
  onSaved: () => void;
}

// Renombrar el álbum mientras se edita (draft only — el gate real está en
// fn_update_album_content). Mismo patrón que EditNameModal del perfil.
export function EditAlbumNameModal({ visible, albumId, currentName, onClose, onSaved }: Props) {
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
  const canSave = trimmed.length >= 1 && trimmed.length <= 60 && !saving && trimmed !== currentName;

  async function handleSave() {
    setError(null);
    setSaving(true);
    const { error: rpcErr } = await updateAlbumContent(albumId, { name: trimmed });
    setSaving(false);
    if (rpcErr) {
      setError(errorMessage(rpcErr));
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Renombrar álbum" avoidKeyboard="both">
      <Text style={sheetStyles.label}>NOMBRE DEL ÁLBUM</Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        autoCapitalize="sentences"
        maxLength={60}
        placeholder="Nombre del álbum"
      />
      <Text style={sheetStyles.hint}>
        Lo ven los jugadores al unirse y en sus listados.
      </Text>
      {error && <Text style={sheetStyles.error}>{error}</Text>}

      <View style={sheetStyles.actions}>
        <Button label="Cancelar" variant="outline" onPress={onClose} />
        <Button label="Guardar" onPress={handleSave} disabled={!canSave} loading={saving} />
      </View>
    </BottomSheet>
  );
}
