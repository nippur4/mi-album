// Captcha (hCaptcha) — contrato compartido entre web y nativo.
//
// El componente <Captcha> vive en dos archivos por plataforma que metro resuelve
// solo (captcha.web.tsx en web, captcha.tsx en nativo con WebView). Ambos exponen
// el mismo handle imperativo: getToken() corre el challenge invisible y devuelve
// el token, o null si el usuario canceló / no hay site key configurada.
//
// Solo el magic link (signInWithOtp) necesita token: Supabase gatea con captcha
// los endpoints de OTP/signup/recover, NO el OAuth (Google es un redirect).

import { env } from './env';

// Si no hay site key, el captcha está apagado y el login sigue como siempre.
export const CAPTCHA_ENABLED = env.hcaptchaSiteKey.length > 0;

export interface CaptchaHandle {
  // Devuelve el token de hCaptcha, o null si se canceló / no está configurado.
  getToken(): Promise<string | null>;
}
