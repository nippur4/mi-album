// Variables de entorno expuestas al cliente.
//
// Convención de Expo: solo las variables con prefijo EXPO_PUBLIC_ se bundlean
// en la app. Cualquier otra cosa (claves de servicio, etc.) NUNCA debe vivir
// acá — solo en Edge Functions.

const required = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new Error(
      `Missing env var ${name}. Asegurate de tener client/.env con esa variable.`,
    );
  }
  return value;
};

export const env = {
  supabaseUrl: required(
    'EXPO_PUBLIC_SUPABASE_URL',
    process.env.EXPO_PUBLIC_SUPABASE_URL,
  ),
  supabaseAnonKey: required(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  ),
  r2PublicBaseUrl: required(
    'EXPO_PUBLIC_R2_PUBLIC_BASE_URL',
    process.env.EXPO_PUBLIC_R2_PUBLIC_BASE_URL,
  ).replace(/\/$/, ''),
};
