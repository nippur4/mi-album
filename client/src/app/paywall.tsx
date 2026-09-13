import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, FontFamily, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';
import {
  PURCHASES_SUPPORTED,
  useIsPro,
  useProActions,
  useProOffering,
} from '@/lib/queries/subscriptions';
import { useDesktopCap } from '@/lib/use-is-desktop';

// Los beneficios de Pro (espejo de los gates reales del owner). Si se agrega o
// saca un gate, actualizar acá para que el paywall no mienta.
const PRO_FEATURES: { icon: keyof typeof Feather.glyphMap; title: string; desc: string }[] = [
  { icon: 'grid', title: 'Hasta 1000 figuritas', desc: 'Armá álbumes grandes. En free el tope es 30.' },
  { icon: 'camera', title: 'Sobres por QR', desc: 'Repartí sobres escaneando un QR en persona.' },
  { icon: 'calendar', title: 'Sobre semanal', desc: 'Elegí frecuencia diaria o semanal del sobre.' },
  { icon: 'gift', title: 'Más figuritas de bienvenida', desc: 'Arrancá a tus jugadores con más figuritas.' },
  { icon: 'star', title: 'Rarezas especiales', desc: 'Figuritas rara, épica y legendaria.' },
  { icon: 'package', title: 'Hasta 10 sobres diarios', desc: 'Regulá cuántos sobres entregás por día.' },
  { icon: 'repeat', title: 'Control de intercambios', desc: 'Definí el límite de cambios de tu álbum.' },
];

const MANAGE_SUB_URL =
  'https://play.google.com/store/account/subscriptions?sku=pro_monthly&package=mi.album.figuritas';

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const desktopCap = useDesktopCap(560);
  const { reason } = useLocalSearchParams<{ reason?: string }>();

  const { isPro } = useIsPro();
  const { offering } = useProOffering();
  const { buy, restore } = useProActions();

  const [busy, setBusy] = useState<null | 'buy' | 'restore'>(null);
  const [purchased, setPurchased] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onBuy() {
    setErr(null);
    setInfo(null);
    setBusy('buy');
    const r = await buy();
    setBusy(null);
    if (r.ok) {
      setPurchased(true);
    } else if (!r.cancelled) {
      setErr(r.message ?? 'No se pudo completar la compra.');
    }
  }

  async function onRestore() {
    setErr(null);
    setInfo(null);
    setBusy('restore');
    const ok = await restore();
    setBusy(null);
    if (ok) {
      setPurchased(true);
    } else {
      setInfo('No encontramos una suscripción activa en esta cuenta de Google.');
    }
  }

  const priceLabel = offering?.priceString ? `${offering.priceString} / mes` : null;

  // --- Estado: confirmación de compra (screen 13) --------------------------
  if (purchased || (isPro && !busy)) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={desktopCap}>
          <ScreenHeader title="" close />
        </View>
        <ScrollView contentContainerStyle={[styles.scroll, desktopCap]}>
          <View style={styles.confirmHero}>
            <View style={styles.confirmBadge}>
              <Feather name="check" size={40} color={Colors.ink} />
            </View>
            <Text style={styles.confirmTitle}>{purchased ? '¡YA SOS PRO!' : 'SOS PRO'}</Text>
            <Text style={styles.confirmSub}>
              {purchased
                ? 'Se activaron todos los beneficios. Ya podés armar álbumes más grandes y con más economía.'
                : 'Tu suscripción está activa. Gracias por bancar el proyecto 🙌'}
            </Text>
          </View>

          <FeatureList compact />

          <View style={{ height: Spacing.lg }} />

          {Platform.OS === 'android' && (
            <Pressable onPress={() => Linking.openURL(MANAGE_SUB_URL)} style={styles.linkRow}>
              <Feather name="settings" size={16} color={Colors.inkSoft} />
              <Text style={styles.linkText}>Gestionar suscripción en Google Play</Text>
            </Pressable>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + Spacing.sm, Spacing.xl) }]}>
          <Button label="Listo" onPress={() => (router.canGoBack() ? router.back() : router.navigate('/'))} />
        </View>
      </SafeAreaView>
    );
  }

  // --- Estado: paywall (screen 12) -----------------------------------------
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={desktopCap}>
        <ScreenHeader title="" close />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, desktopCap]}>
        <View style={styles.hero}>
          <View style={styles.crown}>
            <Feather name="award" size={28} color={Colors.ink} />
          </View>
          <Text style={styles.heroTitle}>MI ÁLBUM{'\n'}PRO</Text>
          <Text style={styles.heroSub}>
            {reason ?? 'Desbloqueá todo lo que necesitás para armar el álbum que querés.'}
          </Text>
        </View>

        <FeatureList />

        {err && <Text style={styles.error}>{err}</Text>}
        {info && <Text style={styles.info}>{info}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + Spacing.sm, Spacing.xl) }]}>
        {PURCHASES_SUPPORTED ? (
          <>
            <Button
              label={priceLabel ? `Hacerme Pro — ${priceLabel}` : 'Hacerme Pro'}
              variant="gold"
              onPress={onBuy}
              loading={busy === 'buy'}
              disabled={!!busy}
            />
            <Pressable onPress={onRestore} disabled={!!busy} style={styles.restoreBtn}>
              <Text style={styles.restoreText}>
                {busy === 'restore' ? 'Restaurando…' : 'Restaurar compras'}
              </Text>
            </Pressable>
            <Text style={styles.fineprint}>
              Suscripción mensual que se renueva sola. Cancelá cuando quieras desde Google Play.
            </Text>
          </>
        ) : (
          <View style={styles.unavailable}>
            <Feather name="smartphone" size={18} color={Colors.inkSoft} />
            <Text style={styles.unavailableText}>
              La suscripción Pro está disponible en la app de Android.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function FeatureList({ compact }: { compact?: boolean }) {
  const items = compact ? PRO_FEATURES.slice(0, 4) : PRO_FEATURES;
  return (
    <View style={styles.features}>
      {items.map((f) => (
        <View key={f.title} style={styles.featureRow}>
          <View style={styles.featureIcon}>
            <Feather name={f.icon} size={18} color={Colors.goldDarker} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.featureTitle}>{f.title}</Text>
            {!compact && <Text style={styles.featureDesc}>{f.desc}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  scroll: {
    paddingHorizontal: Spacing.screenX,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  crown: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.cta(Colors.goldDarker),
  },
  heroTitle: {
    fontFamily: FontFamily.display,
    fontSize: 40,
    lineHeight: 40,
    color: Colors.ink,
    textAlign: 'center',
    letterSpacing: 1,
    marginTop: Spacing.sm,
  },
  heroSub: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    color: Colors.inkSoft,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  features: {
    gap: Spacing.md,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.amberWarnBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  featureDesc: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  error: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.red,
    textAlign: 'center',
  },
  info: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.amberWarn,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: Spacing.screenX,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  restoreBtn: {
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
  },
  restoreText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '700',
    color: Colors.inkSoft,
    textDecorationLine: 'underline',
  },
  fineprint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.muted,
    textAlign: 'center',
  },
  unavailable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  unavailableText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
  },
  // Confirmación
  confirmHero: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  confirmBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.cta(Colors.goldDarker),
  },
  confirmTitle: {
    fontFamily: FontFamily.display,
    fontSize: 34,
    lineHeight: 36,
    color: Colors.ink,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  confirmSub: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    color: Colors.inkSoft,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  linkText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '700',
    color: Colors.inkSoft,
    textDecorationLine: 'underline',
  },
});
