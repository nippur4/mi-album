// <Captcha> — implementación WEB de hCaptcha.
//
// Usa @hcaptcha/react-hcaptcha (widget DOM). En modo invisible no muestra nada;
// execute({ async: true }) corre el challenge y resuelve con el token. Metro
// toma este archivo en web; en nativo usa captcha.tsx (WebView).

import { forwardRef, useImperativeHandle, useRef } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

import { env } from '@/lib/env';
import type { CaptchaHandle } from '@/lib/captcha';

export const Captcha = forwardRef<CaptchaHandle>((_props, ref) => {
  const hcRef = useRef<HCaptcha>(null);

  useImperativeHandle(
    ref,
    () => ({
      async getToken() {
        if (!env.hcaptchaSiteKey || !hcRef.current) return null;
        try {
          const res = await hcRef.current.execute({ async: true });
          const token = (res as { response?: string } | undefined)?.response ?? null;
          // Reset para dejar el widget listo por si el usuario reintenta.
          hcRef.current.resetCaptcha();
          return token;
        } catch {
          return null;
        }
      },
    }),
    [],
  );

  if (!env.hcaptchaSiteKey) return null;

  return <HCaptcha ref={hcRef} sitekey={env.hcaptchaSiteKey} size="invisible" />;
});

Captcha.displayName = 'Captcha';
