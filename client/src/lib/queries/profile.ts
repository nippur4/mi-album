// Profile del user actual (display_name, avatar, is_admin) + mutación de nombre.

import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';

export interface MyProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  is_admin: boolean;
}

export function useMyProfile() {
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
      .select('id, display_name, avatar_url, is_admin')
      .eq('id', uid)
      .maybeSingle();
    setProfile((data ?? null) as MyProfile | null);
    setIsLoading(false);
  }, [uid]);

  useEffect(() => { refetch(); }, [refetch]);

  return { profile, isLoading, refetch };
}

export async function updateDisplayName(newName: string) {
  return supabase.rpc('fn_update_display_name', { p_new_name: newName });
}
