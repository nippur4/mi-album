// <Captcha> — implementación NATIVA (Android/iOS) de hCaptcha.
//
// Usa @hcaptcha/react-native-hcaptcha, que renderiza el challenge dentro de un
// WebView modal (react-native-webview). En modo invisible normalmente resuelve
// sin mostrar nada; si hCaptcha decide desafiar, aparece el modal.
//
// Requiere rebuild de EAS (react-native-webview es módulo nativo).
// En web NO se usa este archivo: metro toma captcha.web.tsx.

import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import ConfirmHcaptcha from '@hcaptcha/react-native-hcaptcha';

import { env } from '@/lib/env';
import type { CaptchaHandle } from '@/lib/captcha';

export const Captcha = forwardRef<CaptchaHandle>((_props, ref) => {
  const formRef = useRef<ConfirmHcaptcha>(null);
  const resolveRef = useRef<((t: string | null) => void) | null>(null);

  const finish = useCallback((token: string | null) => {
    formRef.current?.hide();
    const resolve = resolveRef.current;
    resolveRef.current = null;
    resolve?.(token);
  }, []);

  // onMessage devuelve success=true + token en nativeEvent.data, o un string de
  // error/cancel ('challenge-closed', 'challenge-expired', rate-limited, etc.).
  const onMessage = useCallback(
    (event: any) => {
      const data = event?.nativeEvent?.data;
      if (!data) return;
      if (event.success) {
        event.markUsed?.();
        finish(String(data));
      } else {
        // Cualquier mensaje no-exitoso es terminal (cerró/expiró/error) → null.
        finish(null);
      }
    },
    [finish],
  );

  useImperativeHandle(
    ref,
    () => ({
      getToken() {
        return new Promise<string | null>((resolve) => {
          if (!env.hcaptchaSiteKey || !formRef.current) {
            resolve(null);
            return;
          }
          // Si quedó una espera anterior sin resolver, la cerramos con null.
          resolveRef.current?.(null);
          resolveRef.current = resolve;
          formRef.current.show();
        });
      },
    }),
    [],
  );

  if (!env.hcaptchaSiteKey) return null;

  return (
    <ConfirmHcaptcha
      ref={formRef}
      siteKey={env.hcaptchaSiteKey}
      baseUrl="https://hcaptcha.com"
      languageCode="es"
      size="invisible"
      onMessage={onMessage}
    />
  );
});

Captcha.displayName = 'Captcha';
