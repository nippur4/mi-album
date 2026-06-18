import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { Stepper } from '@/components/stepper';
import { TextInput } from '@/components/text-input';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { createAlbum } from '@/lib/queries/albums';
import { useIsPro } from '@/lib/queries/subscriptions';
import { errorMessage } from '@/lib/errors';

const FREE_MAX = 75;
const PRO_MAX = 1000;

export default function NewAlbumScreen() {
  const router = useRouter();
  const { isPro } = useIsPro();
  const maxStickers = isPro ? PRO_MAX : FREE_MAX;

  const [name, setName] = useState('');
  const [total, setTotal] = useState(50);
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Si el plan cambia (load tardío de useIsPro) y el total supera el cap nuevo,
  // bajarlo al cap.
  useEffect(() => {
    if (total > maxStickers) setTotal(maxStickers);
  }, [maxStickers, total]);

  const canSubmit = name.trim().length > 0 && total >= 1 && total <= maxStickers && !submitting;

  async function onSubmit() {
    Keyboard.dismiss();
    setSubmitting(true);
    setErrMsg(null);
    const { data, error } = await createAlbum(name.trim(), total);
    setSubmitting(false);
    if (error) {
      setErrMsg(errorMessage(error));
      return;
    }
    const albumId = data as unknown as string;
    router.replace(`/album/${albumId}`);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Nuevo álbum" back />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={styles.label}>NOMBRE</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="El Gran Bestiario"
            autoCapitalize="words"
            maxLength={60}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>CANTIDAD DE FIGURITAS</Text>
          <Stepper value={total} onChange={setTotal} min={1} max={maxStickers} step={5} />
          <Text style={styles.hint}>
            {isPro
              ? 'Hasta 1000 figuritas (Pro).'
              : `Free: máximo ${FREE_MAX}. Pro permite hasta ${PRO_MAX}.`}
          </Text>
        </View>

        {errMsg && <Text style={styles.error}>{errMsg}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Crear borrador" onPress={onSubmit} disabled={!canSubmit} loading={submitting} />
        <Text style={styles.fineprint}>
          Vas a poder cargar las figuritas y la carátula en el siguiente paso.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  scroll: {
    paddingHorizontal: Spacing.screenX,
    paddingTop: Spacing.lg,
    paddingBottom: 200,
    gap: Spacing.xl,
  },
  field: {
    gap: Spacing.sm,
  },
  label: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  hint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.inkSoft,
    marginTop: Spacing.xs,
  },
  error: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.red,
  },
  footer: {
    paddingHorizontal: Spacing.screenX,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  fineprint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.muted,
    textAlign: 'center',
  },
});
