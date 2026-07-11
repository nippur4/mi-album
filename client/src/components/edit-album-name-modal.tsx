import { TextFieldSheet } from '@/components/text-field-sheet';
import { updateAlbumContent } from '@/lib/queries/albums';

interface Props {
  visible: boolean;
  albumId: string;
  currentName: string;
  onClose: () => void;
  onSaved: () => void;
}

// Renombrar el álbum mientras se edita (draft only — el gate real está en
// fn_update_album_content).
export function EditAlbumNameModal({ visible, albumId, currentName, onClose, onSaved }: Props) {
  return (
    <TextFieldSheet
      visible={visible}
      title="Renombrar álbum"
      label="NOMBRE DEL ÁLBUM"
      hint="Lo ven los jugadores al unirse y en sus listados."
      initialValue={currentName}
      placeholder="Nombre del álbum"
      maxLength={60}
      onSave={(value) => updateAlbumContent(albumId, { name: value })}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
