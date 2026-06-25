import { View } from 'react-native';

import { Colors } from '@/constants/theme';

// Ruta dummy: la tab "QR" intercepta el tabPress en _layout y abre un modal.
// Esta pantalla solo se montaría si la navegación se gatilla por otro medio.
export default function QrTabPlaceholder() {
  return <View style={{ flex: 1, backgroundColor: Colors.paper }} />;
}
