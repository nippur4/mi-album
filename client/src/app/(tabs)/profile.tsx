import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { signOut, useSession } from '@/lib/auth';
import { useIsAdmin } from '@/lib/queries/admin';

export default function ProfileTab() {
  const router = useRouter();
  const { session } = useSession();
  const { isAdmin } = useIsAdmin();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.inner}>
        <View>
          <Text style={styles.title}>Perfil</Text>
          <Text style={styles.label}>EMAIL</Text>
          <Text style={styles.email}>{session?.user.email ?? '—'}</Text>

          {isAdmin && (
            <Pressable
              onPress={() => router.push('/admin')}
              style={({ pressed }) => [styles.adminRow, pressed && styles.adminRowPressed]}
            >
              <Feather name="shield" size={18} color={Colors.ink} />
              <Text style={styles.adminLabel}>Panel admin</Text>
              <Feather name="chevron-right" size={20} color={Colors.muted} />
            </Pressable>
          )}
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
  adminRow: {
    marginTop: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  adminRowPressed: { opacity: 0.85 },
  adminLabel: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
});
