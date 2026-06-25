import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { TextInput } from '@/components/text-input';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { signInWithMagicLink } from '@/lib/auth';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export default function Login() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const trimmed = email.trim();
  const canSubmit = trimmed.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

  async function onSubmit() {
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
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="vos@ejemplo.com"
              returnKeyType="send"
              onSubmitEditing={() => canSubmit && onSubmit()}
              editable={status !== 'sending'}
            />
            {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}
            <Button
              label="Enviarme el link"
              onPress={onSubmit}
              loading={status === 'sending'}
              disabled={!canSubmit}
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
