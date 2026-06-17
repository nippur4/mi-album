// Cliente Supabase compartido por toda la app.
//
// Deps requeridas (instalar antes del primer uso):
//   npm i @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
//
// El polyfill de URL es necesario en RN para que el cliente Supabase resuelva
// los endpoints internamente. Importarlo ANTES de createClient.

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { env } from './env';
import type { Database } from './database.types';

export const supabase = createClient<Database>(
  env.supabaseUrl,
  env.supabaseAnonKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
