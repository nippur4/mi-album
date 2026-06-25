// Profile del user actual (display_name, avatar, is_admin) + mutaciones.
//
// Vive en un Context global montado al nivel root para que un solo fetch
// alimente a todos los HeaderAvatar y consumers. Sin esto, cada tab tenía
// su propia copia de profile en state y los cambios (avatar/nombre) no se
// veían en las demás hasta refetch manual.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { createElement } from 'react';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';

export interface MyProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  avatar_thumb_key: string | null;
  is_admin: boolean;
}

interface ProfileCtx {
  profile: MyProfile | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const ProfileContext = createContext<ProfileCtx | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const uid = session?.user.id;
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!uid) {
      setProfile(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, avatar_thumb_key, is_admin')
      .eq('id', uid)
      .maybeSingle();
    setProfile((data ?? null) as MyProfile | null);
    setIsLoading(false);
  }, [uid]);

  useEffect(() => { refetch(); }, [refetch]);

  return createElement(ProfileContext.Provider, { value: { profile, isLoading, refetch } }, children);
}

export function useMyProfile(): ProfileCtx {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useMyProfile must be used inside <ProfileProvider>');
  }
  return ctx;
}

export async function updateDisplayName(newName: string) {
  return supabase.rpc('fn_update_display_name', { p_new_name: newName });
}

// p_thumb_key=null → vuelve al avatar default (iniciales+color hash).
export async function updateAvatar(thumbKey: string | null) {
  return supabase.rpc('fn_update_avatar', { p_thumb_key: thumbKey });
}
