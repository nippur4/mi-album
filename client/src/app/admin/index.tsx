import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAdminAlbums, useAdminReports } from '@/lib/queries/admin';
import { useDesktopCap } from '@/lib/use-is-desktop';
import { useFocusRefetchStale } from '@/lib/use-focus-refetch';

export default function AdminScreen() {
  const router = useRouter();
  const desktopCap = useDesktopCap(960);
  // Contadores para los badges de las secciones de moderación.
  const { reports } = useAdminReports();
  const { albums } = useAdminAlbums();
  const pendingPublic = albums.filter((a) => !!a.public_requested_at && !a.is_public).length;

  useFocusRefetchStale(['admin', 'albums'], ['admin', 'reports']);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={desktopCap}>
        <ScreenHeader
          title="Admin"
          back
          right={<Feather name="shield" size={20} color={Colors.ink} />}
        />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, desktopCap]}>
        <Text style={styles.sectionLabel}>MODERACIÓN</Text>

        <MenuItem
          icon="globe"
          title="Gestionar álbumes públicos"
          subtitle="Álbumes en el carrusel del inicio + solicitudes para ser público."
          badge={pendingPublic || undefined}
          onPress={() => router.push('/admin/public' as any)}
        />
        <MenuItem
          icon="flag"
          title="Reports"
          subtitle="Álbumes reportados por los usuarios, con el motivo de cada reporte."
          badge={reports.length || undefined}
          onPress={() => router.push('/admin/reports' as any)}
        />
        <MenuItem
          icon="shield"
          title="Moderar álbumes"
          subtitle="Todos los álbumes, con buscador. Bloquear (reversible) o eliminar."
          onPress={() => router.push('/admin/moderate' as any)}
        />

        <Text style={[styles.sectionLabel, { marginTop: Spacing.md }]}>HERRAMIENTAS</Text>

        <MenuItem
          icon="bar-chart-2"
          title="Estadísticas"
          subtitle="Usuarios, actividad diaria, álbumes, figuritas, sobres y cambios."
          onPress={() => router.push('/admin/stats' as any)}
        />
        <MenuItem
          icon="trash-2"
          title="Limpieza de imágenes"
          subtitle="Detecta y borra imágenes huérfanas de R2 (análisis primero, sin riesgo)."
          onPress={() => router.push('/admin/cleanup' as any)}
        />
        <MenuItem
          icon="image"
          title="Plantillas de imágenes"
          subtitle="Carátulas y sobres por defecto disponibles para todos los owners."
          onPress={() => router.push('/admin/presets')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({
  icon,
  title,
  subtitle,
  badge,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  subtitle: string;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.7 }]}>
      <Feather name={icon} size={20} color={Colors.ink} />
      <View style={{ flex: 1 }}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <Feather name="chevron-right" size={20} color={Colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  scroll: {
    paddingHorizontal: Spacing.screenX,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  menuTitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  menuSubtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  sectionLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
    marginTop: Spacing.sm,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    fontWeight: '800',
    color: Colors.paper,
  },
});
