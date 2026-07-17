// Reemplazo drop-in del Alert de react-native que FUNCIONA en web.
//
// react-native-web implementa Alert como no-op (decisión #31): los errores
// desaparecían en silencio y los confirms nunca ejecutaban su callback —
// botones que "no hacían nada". En web delegamos en los diálogos nativos
// del browser:
//   - 0 o 1 botón → window.alert, y después el onPress del botón si existe
//   - 2+ botones  → window.confirm: Aceptar dispara el primer botón que NO
//                   es 'cancel'; Cancelar dispara el botón style 'cancel'
// En nativo delega en el Alert real, sin cambios.
//
// Uso: importar { Alert } de '@/lib/alert' en vez de 'react-native'.
// Para confirms ricos (varias acciones, inputs) preferir BottomSheet in-app.
import { Alert as RNAlert, Platform, type AlertButton } from 'react-native';

function alert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    RNAlert.alert(title, message, buttons);
    return;
  }
  const text = [title, message].filter(Boolean).join('\n\n');
  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }
  const confirmBtn = buttons.find((b) => b.style !== 'cancel');
  const cancelBtn = buttons.find((b) => b.style === 'cancel');
  if (window.confirm(text)) {
    confirmBtn?.onPress?.();
  } else {
    cancelBtn?.onPress?.();
  }
}

export const Alert = { alert };
