import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { Avatar } from '@/components/avatar';
import { useSession } from '@/lib/auth';
import { useMyProfile } from '@/lib/queries/profile';

interface Props {
  size?: number;
}

// Avatar del usuario logueado, en todas las pantallas de tab. Tap lleva a /profile.
// Resuelve el display_name de profile → user_metadata → mail antes del @.
export function HeaderAvatar({ size = 40 }: Props) {
  const router = useRouter();
  const { session } = useSession();
  const { profile } = useMyProfile();

  const displayName =
    profile?.display_name ??
    (session?.user.user_metadata?.display_name as string | undefined) ??
    session?.user.email?.split('@')[0] ??
    'Vos';

  return (
    <Pressable
      onPress={() => router.push('/profile')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Abrir perfil"
    >
      <Avatar
        source={displayName}
        size={size}
        imageKey={profile?.avatar_thumb_key ?? null}
      />
    </Pressable>
  );
}
