import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';

export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<'joining' | 'error'>('joining');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    (async () => {
      const { data, error } = await supabase.rpc('fn_join_album', { p_share_code: code });
      if (error) {
        setStatus('error');
        setErrMsg(errorMessage(error));
        return;
      }
      const result = data as unknown as { album_id: string; joined: boolean; welcome_packs: number };
      router.replace(`/album/${result.album_id}`);
    })();
  }, [code, router]);

  if (status === 'joining') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Uniéndote..." back />
        <View style={styles.center}>
          <ActivityIndicator color={Colors.red} size="large" />
          <Text style={styles.label}>CÓDIGO</Text>
          <Text style={styles.code}>{code}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="No pudimos unirte" back />
      <View style={styles.center}>
        <Text style={styles.label}>CÓDIGO</Text>
        <Text style={styles.code}>{code}</Text>
        <Text style={styles.error}>{errMsg}</Text>
        <Button label="Volver" variant="outline" onPress={() => router.replace('/(tabs)')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.screenX,
    gap: Spacing.md,
  },
  label: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 2,
    marginTop: Spacing.xl,
  },
  code: {
    fontFamily: FontFamily.display,
    fontSize: 42,
    color: Colors.ink,
    letterSpacing: 4,
  },
  error: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    color: Colors.red,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});
