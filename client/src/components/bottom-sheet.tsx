// Bottom sheet base compartido por todos los modales de la app.
//
// Reemplaza el esqueleto Modal + KeyboardAvoidingView + backdrop + sheet +
// handle + title que estaba copiado en 10 componentes. Cada modal aporta solo
// su contenido (children) y, si necesita acciones sticky abajo del scroll,
// las pasa por `footer` (van dentro del SafeAreaView, fuera del scroll).
//
// Dos layouts posibles:
//   - Sin footer: todo el contenido va dentro del SafeAreaView (edges bottom).
//   - Con footer: children van en un slot que se comprime (flexShrink/minHeight
//     0, o flex:1 si el sheet tiene `height` fijo) y el footer va en su propio
//     SafeAreaView al fondo. Así el scroll de adentro siempre recibe una altura
//     acotada y las acciones nunca quedan fuera del viewport.

import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  // Acciones sticky abajo (fuera del scroll de children).
  footer?: ReactNode;
  // Limita la altura del sheet (ej. '92%'). Sin esto, el sheet crece según contenido.
  maxHeight?: DimensionValue;
  // Altura FIJA del sheet (ej. '90%'). Para modales largos que siempre llenan
  // la pantalla: con altura definida el slot de children puede usar flex:1 y
  // el ScrollView de adentro queda acotado sí o sí (con maxHeight el alto es
  // auto y el scroll depende de que el shrink se propague bien).
  height?: DimensionValue;
  // 'both': padding en iOS + height en Android (modales con TextInput).
  // 'ios': padding solo en iOS; Android se apoya en el resize nativo de la window.
  avoidKeyboard?: 'both' | 'ios';
  // false deshabilita el tap en backdrop (ej. mientras corre un upload).
  dismissable?: boolean;
  // Override del botón atrás de Android / gesto de cierre. Default: onClose.
  onRequestClose?: () => void;
}

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  footer,
  maxHeight,
  height,
  avoidKeyboard,
  dismissable = true,
  onRequestClose,
}: Props) {
  const body = (
    // El backdrop es un View y el área tappable es un Pressable absoluto DETRÁS
    // del sheet: así el sheet no queda envuelto en un Pressable y no hay
    // negociación de responder entre ese Pressable y el scroll de adentro.
    <View style={styles.backdrop}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={dismissable ? onClose : undefined}
        accessible={false}
      />
      <View
        style={[
          styles.sheet,
          maxHeight != null && { maxHeight, overflow: 'hidden' },
          height != null && { height, overflow: 'hidden' },
        ]}
      >
        <View style={styles.handle} />
        {title != null && <Text style={styles.title}>{title}</Text>}

        {footer != null ? (
          <>
            {/* Slot que se comprime para que el scroll de children reciba una
                altura acotada. Con `height` fijo puede crecer (flex:1) y así el
                footer queda pegado abajo; con maxHeight solo se encoge. */}
            <View style={height != null ? styles.footerBodyFixed : styles.footerBody}>
              {children}
            </View>
            <SafeAreaView edges={['bottom']}>{footer}</SafeAreaView>
          </>
        ) : (
          // flexShrink 1 (RN defaultea 0): sin esto, con maxHeight en el sheet
          // este wrapper NO se comprime — desborda clipeado y el ScrollView de
          // adentro recibe altura ilimitada → no scrollea (bug del avatar
          // picker en web mobile). minHeight 0 evita el piso min-content que
          // el flexbox de web impone al comprimir contenedores con scroll.
          <SafeAreaView edges={['bottom']} style={styles.noFooterBody}>
            {children}
          </SafeAreaView>
        )}
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onRequestClose ?? onClose}
    >
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : avoidKeyboard === 'both'
                ? 'height'
                : undefined
          }
          style={{ flex: 1 }}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
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
  noFooterBody: {
    width: '100%',
    flexShrink: 1,
    minHeight: 0,
  },
  // Mismo criterio que noFooterBody, pero para el layout con footer.
  footerBody: {
    width: '100%',
    flexShrink: 1,
    minHeight: 0,
  },
  // Sheet de altura fija: el slot ocupa todo lo que sobra entre el título y el
  // footer, así el ScrollView de adentro tiene un viewport exacto.
  footerBodyFixed: {
    width: '100%',
    flex: 1,
    minHeight: 0,
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
});

// Estilos de campos compartidos por los modales de formulario (label mono,
// hint, error, fila de acciones). Importarlos evita re-declararlos por modal.
export const sheetStyles = StyleSheet.create({
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
