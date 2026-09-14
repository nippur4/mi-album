// Catálogo estático de logros. Vive en el cliente (no en la DB) para poder
// iterar nombres/íconos/umbrales sin migraciones — el server solo provee los
// números crudos (lib/queries/achievements.ts → fn_my_achievement_stats).
//
// Cada logro tiene un ícono Feather, un nombre divertido y una explicación
// breve. `evaluate(stats)` devuelve si está desbloqueado + el progreso
// (current/target) para pintar la barra de los logros por umbral.

import type { AchievementStats } from '@/lib/queries/achievements';

export type AchievementCategory = 'packs' | 'completed' | 'created' | 'special';

export interface AchievementProgress {
  unlocked: boolean;
  current: number;
  target: number;
}

export interface AchievementDef {
  id: string;
  icon: string; // nombre de ícono Feather
  name: string;
  description: string;
  category: AchievementCategory;
  evaluate: (s: AchievementStats) => AchievementProgress;
}

// Los 3 álbumes especiales curados (espejo del server en migración 0063).
const SPECIAL = {
  avatars: '29a1fa90-85b3-48fc-b452-2b7f64bd327b',
  numbers: 'ecbf4497-e5d7-4732-88a2-75f7b39a2749',
  dinos: 'd1227449-f10c-41e6-8483-5bef42b9fb0a',
} as const;

// Logro por umbral: se desbloquea cuando el valor llega al target.
function tier(
  id: string,
  icon: string,
  name: string,
  description: string,
  category: AchievementCategory,
  value: (s: AchievementStats) => number,
  target: number,
): AchievementDef {
  return {
    id,
    icon,
    name,
    description,
    category,
    evaluate: (s) => {
      const current = value(s);
      return { unlocked: current >= target, current, target };
    },
  };
}

// Logro binario por completar un álbum especial puntual.
function special(
  id: string,
  icon: string,
  name: string,
  description: string,
  albumId: string,
): AchievementDef {
  return {
    id,
    icon,
    name,
    description,
    category: 'special',
    evaluate: (s) => {
      const unlocked = s.completed_special_ids.includes(albumId);
      return { unlocked, current: unlocked ? 1 : 0, target: 1 };
    },
  };
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // --- Abrir sobres ---
  tier('packs_1', 'package', 'El primer sobre', 'Abriste tu primer sobre. Ya no hay vuelta atrás.', 'packs', (s) => s.packs_opened, 1),
  tier('packs_10', 'package', 'Agarrando la mano', 'Abriste 10 sobres.', 'packs', (s) => s.packs_opened, 10),
  tier('packs_100', 'package', 'Fiebre de figus', 'Abriste 100 sobres.', 'packs', (s) => s.packs_opened, 100),
  tier('packs_1000', 'package', 'Leyenda del kiosco', 'Abriste 1000 sobres. ¿Comés figuritas?', 'packs', (s) => s.packs_opened, 1000),

  // --- Completar álbumes ---
  tier('complete_1', 'check-circle', '¡Nace un coleccionista!', 'Completaste tu primer álbum.', 'completed', (s) => s.albums_completed, 1),
  tier('complete_3', 'check-circle', 'Coleccionista serio', 'Completaste 3 álbumes.', 'completed', (s) => s.albums_completed, 3),
  tier('complete_5', 'check-circle', 'Máquina de completar', 'Completaste 5 álbumes.', 'completed', (s) => s.albums_completed, 5),
  tier('complete_10', 'check-circle', 'Nada te falta', 'Completaste 10 álbumes.', 'completed', (s) => s.albums_completed, 10),

  // --- Crear álbumes ---
  tier('create_1', 'edit-3', 'Nace un autor', 'Creaste tu primer álbum.', 'created', (s) => s.albums_created, 1),
  tier('create_3', 'edit-3', 'Editorial propia', 'Creaste 3 álbumes.', 'created', (s) => s.albums_created, 3),
  tier('create_5', 'edit-3', 'Imperio figuritero', 'Creaste 5 álbumes.', 'created', (s) => s.albums_created, 5),

  // --- Álbumes especiales ---
  special('special_avatars', 'smile', 'Cara conocida', 'Completaste el álbum de avatares.', SPECIAL.avatars),
  special('special_numbers', 'hash', 'Rey de los desafíos', 'Completaste el álbum de los 1001 números.', SPECIAL.numbers),
  special('special_dinos', 'zap', 'Jurásico total', 'Completaste el álbum de dinosaurios.', SPECIAL.dinos),
];

export const CATEGORY_ORDER: AchievementCategory[] = ['packs', 'completed', 'created', 'special'];

export const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  packs: 'Abriendo sobres',
  completed: 'Completando álbumes',
  created: 'Creando álbumes',
  special: 'Álbumes especiales',
};

export function unlockedCount(stats: AchievementStats): number {
  return ACHIEVEMENTS.reduce((n, a) => n + (a.evaluate(stats).unlocked ? 1 : 0), 0);
}
