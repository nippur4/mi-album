import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { joinAlbumByCode } from '@/lib/queries/albums';
import { errorMessage } from '@/lib/errors';

interface Props {
  onJoined: (albumId: string) => void;
  // Callback al ganar focus el input. El parent lo usa para hacer scroll
  // hacia el input cuando aparece el teclado (KeyboardAvoidingView solo
  // no alcanza en muchos casos).
  onInputFocus?: () => void;
}

// Bloque oscuro con input dashed para pegar código o link mialbum://...
export function JoinCodeInput({ onJoined, onInputFocus }: Props) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = value.trim().length > 0 && !submitting;

  async function onSubmit() {
    setSubmitting(true);
    const { data, error } = await joinAlbumByCode(value);
    setSubmitting(false);
    if (error) {
      Alert.alert('No pudimos unirte', errorMessage(error));
      return;
    }
    const result = data as unknown as { album_id: string };
    setValue('');
    onJoined(result.album_id);
  }

  return (
    <View style={styles.block}>
      <Text style={styles.title}>¿Te pasaron un código?</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={setValue}
          placeholder="pegá el link o código"
          placeholderTextColor={Colors.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!submitting}
          onFocus={onInputFocus}
        />
        <Button
          label="Unirme"
          variant="gold"
          onPress={onSubmit}
          disabled={!canSubmit}
          loading={submitting}
          style={styles.button}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: Colors.ink,
    borderRadius: Radius.cardLg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.paper,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: Radius.button,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.muted,
    fontFamily: FontFamily.mono,
    fontSize: FontSize.bodySmall,
    color: Colors.paper,
    letterSpacing: 1.5,
  },
  button: {
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
  },
});
