import { useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Button } from '@/components/button';
import { TextInput } from '@/components/text-input';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { GOOGLE_SUPPORTED, signInWithGoogle, signInWithMagicLink } from '@/lib/auth';

type Status = 'idle' | 'sending' | 'sent' | 'error' | 'google';

export default function Login() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const trimmed = email.trim();
  const canSubmit = trimmed.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

  async function onMagicLink() {
    Keyboard.dismiss();
    setStatus('sending');
    setErrorMsg(null);
    const { error } = await signInWithMagicLink(trimmed);
    if (error) {
      setStatus('error');
      setErrorMsg(error.message);
      return;
    }
    setStatus('sent');
  }

  async function onGoogle() {
    setStatus('google');
    setErrorMsg(null);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setStatus('error');
        setErrorMsg(error.message);
      }
      // Si OK, supabase redirige a Google. Cuando vuelva con tokens en el
      // hash, detectSessionInUrl auto-setea la session y el _layout redirige
      // a /(tabs).
    } catch (err: any) {
      setStatus('error');
      setErrorMsg('No se pudo iniciar sesión con Google. Probá con tu mail.');
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <View style={styles.hero}>
          <Text style={styles.kicker}>Mi álbum de</Text>
          <Text style={styles.title}>FIGURITAS</Text>
        </View>

        {status === 'sent' ? (
          <View style={styles.sentBlock}>
            <Text style={styles.sentTitle}>Revisá tu mail</Text>
            <Text style={styles.sentBody}>
              Te mandamos un link a <Text style={styles.email}>{trimmed}</Text>. Toca el
              botón del mail para entrar.
            </Text>
            <Button
              label="Cambiar email"
              variant="outline"
              onPress={() => { setStatus('idle'); setEmail(''); }}
            />
          </View>
        ) : (
          <View style={styles.form}>
            {GOOGLE_SUPPORTED && (
              <>
                <Pressable
                  onPress={onGoogle}
                  disabled={status === 'google' || status === 'sending'}
                  style={({ pressed }) => [
                    styles.googleBtn,
                    pressed && styles.googleBtnPressed,
                    (status === 'google' || status === 'sending') && styles.googleBtnDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Continuar con Google"
                >
                  <GoogleLogo />
                  <Text style={styles.googleBtnText}>
                    {status === 'google' ? 'Redirigiendo…' : 'Continuar con Google'}
                  </Text>
                </Pressable>

                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>O ENTRÁ CON TU MAIL</Text>
                  <View style={styles.dividerLine} />
                </View>
              </>
            )}

            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="vos@ejemplo.com"
              returnKeyType="send"
              onSubmitEditing={() => canSubmit && onMagicLink()}
              editable={status !== 'sending' && status !== 'google'}
            />
            {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}
            <Button
              label="Enviarme el link"
              variant="outline"
              onPress={onMagicLink}
              loading={status === 'sending'}
              disabled={!canSubmit || status === 'google'}
            />
            <Text style={styles.fineprint}>
              Te mandamos un link mágico al mail. Sin contraseña.
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Logo de Google oficial (multi-color). SVG inline, sin assets externos.
function GoogleLogo() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <Path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <Path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <Path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  inner: {
    flex: 1,
    paddingHorizontal: Spacing.screenX,
    justifyContent: 'space-between',
    paddingVertical: Spacing.xxl,
  },
  hero: {
    alignItems: 'center',
    marginTop: Spacing.xxl,
  },
  kicker: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabel,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: Spacing.sm,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 56,
    color: Colors.ink,
    letterSpacing: 1,
  },
  form: {
    gap: Spacing.md,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  googleBtnPressed: { opacity: 0.85 },
  googleBtnDisabled: { opacity: 0.6 },
  googleBtnText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  label: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabel,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  fineprint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.muted,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  error: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.red,
  },
  sentBlock: {
    gap: Spacing.md,
    alignItems: 'center',
  },
  sentTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.hBig,
    color: Colors.ink,
    textAlign: 'center',
  },
  sentBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    color: Colors.inkSoft,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  email: {
    fontWeight: '700',
    color: Colors.ink,
  },
});
