import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { signOut, useSession } from '@/lib/auth';

export default function ProfileTab() {
  const { session } = useSession();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.inner}>
        <View>
          <Text style={styles.title}>Perfil</Text>
          <Text style={styles.label}>EMAIL</Text>
          <Text style={styles.email}>{session?.user.email ?? '—'}</Text>
        </View>
        <Button label="Cerrar sesión" variant="outline" onPress={signOut} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  inner: {
    flex: 1,
    paddingHorizontal: Spacing.screenX,
    paddingVertical: Spacing.xxl,
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.screenTitle,
    color: Colors.ink,
    marginBottom: Spacing.xl,
  },
  label: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: Spacing.xs,
  },
  email: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
});
