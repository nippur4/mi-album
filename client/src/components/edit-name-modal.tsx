import { TextFieldSheet } from '@/components/text-field-sheet';
import { updateDisplayName } from '@/lib/queries/profile';

interface Props {
  visible: boolean;
  currentName: string;
  onClose: () => void;
  onSaved: () => void;
}

export function EditNameModal({ visible, currentName, onClose, onSaved }: Props) {
  return (
    <TextFieldSheet
      visible={visible}
      title="Cambiar nombre"
      label="NOMBRE PÚBLICO"
      hint="Lo van a ver los otros jugadores en intercambios y bandeja."
      initialValue={currentName}
      placeholder="Tu nombre"
      autoCapitalize="words"
      autoCorrect={false}
      minLength={2}
      maxLength={40}
      onSave={(value) => updateDisplayName(value)}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
