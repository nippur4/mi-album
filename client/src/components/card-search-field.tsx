import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Colors, FontFamily, FontSize, Radius } from '@/constants/theme';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

// Buscador de una sola línea (nombre o número) para listas de figuritas ya
// cargadas en memoria. Filtra en vivo: sin costo de query.
export function CardSearchField({ value, onChange, placeholder = 'Buscar por nombre o número' }: Props) {
  return (
    <View style={styles.wrap}>
      <Feather name="search" size={16} color={Colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.muted}
        cursorColor={Colors.red}
        selectionColor={Colors.red}
        style={styles.input}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChange('')} hitSlop={8}>
          <Feather name="x" size={16} color={Colors.muted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    color: Colors.ink,
    paddingVertical: 8,
  },
});
