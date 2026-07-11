import { useState } from 'react';
import { Text, View } from 'react-native';

import { BottomSheet, sheetStyles } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { TextInput } from '@/components/text-input';
import { errorMessage } from '@/lib/errors';

interface Props {
  visible: boolean;
  title: string;
  label: string;
  hint?: string;
  initialValue: string;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  minLength?: number;
  maxLength?: number;
  // Recibe el valor trimmeado; devuelve { error } estilo supabase (null si ok).
  onSave: (value: string) => Promise<{ error: unknown }>;
  onClose: () => void;
  onSaved: () => void;
}

// Sheet genérico para editar UN campo de texto (nombre de perfil, de álbum,
// etc.): estado + validación por largo + guardado con error inline. Los
// modales concretos son wrappers finos que fijan copy y RPC — para un campo
// nuevo, usar esto en vez de copiar el esqueleto.
export function TextFieldSheet({
  visible,
  title,
  label,
  hint,
  initialValue,
  placeholder,
  autoCapitalize = 'sentences',
  autoCorrect,
  minLength = 1,
  maxLength = 60,
  onSave,
  onClose,
  onSaved,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset al ABRIR (ajuste de estado durante render, sin useEffect — evita
  // el render intermedio con el valor viejo y el lint de setState-in-effect).
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setValue(initialValue);
      setError(null);
    }
  }

  const trimmed = value.trim();
  const canSave =
    trimmed.length >= minLength &&
    trimmed.length <= maxLength &&
    !saving &&
    trimmed !== initialValue;

  async function handleSave() {
    setError(null);
    setSaving(true);
    const { error: rpcErr } = await onSave(trimmed);
    setSaving(false);
    if (rpcErr) {
      setError(errorMessage(rpcErr));
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} avoidKeyboard="both">
      <Text style={sheetStyles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        maxLength={maxLength}
        placeholder={placeholder}
      />
      {hint && <Text style={sheetStyles.hint}>{hint}</Text>}
      {error && <Text style={sheetStyles.error}>{error}</Text>}

      <View style={sheetStyles.actions}>
        <Button label="Cancelar" variant="outline" onPress={onClose} />
        <Button label="Guardar" onPress={handleSave} disabled={!canSave} loading={saving} />
      </View>
    </BottomSheet>
  );
}
