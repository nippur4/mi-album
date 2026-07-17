// Efectos de sonido (expo-audio). Manager mínimo de one-shots para la apertura
// de sobres. Los WAV viven en assets/sounds/ (generados por scripts/gen-sfx.js,
// reemplazables por sonidos curados con el mismo nombre).
//
// Respetamos el switch de silencio del teléfono (playsInSilentMode: false) y no
// cortamos la música del usuario (mixWithOthers). Sin ajuste de mute propio.
//
// Degradación silenciosa: si el módulo nativo no está (dev build viejo sin
// rebuild), createAudioPlayer tira y quedamos sin sonido, sin romper la UI.

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

const SOURCES = {
  shake: require('../../assets/sounds/pack-shake.wav'),
  open: require('../../assets/sounds/pack-open.wav'),
  card: require('../../assets/sounds/card-pop.wav'),
  sparkle: require('../../assets/sounds/sparkle.wav'),
  legendary: require('../../assets/sounds/legendary.wav'),
  paste: require('../../assets/sounds/paste.wav'),
  dinoRoar: require('../../assets/sounds/dino-roar.wav'),
  dinoScreech: require('../../assets/sounds/dino-screech.wav'),
} as const;

export type SfxName = keyof typeof SOURCES;

// Álbumes con set de sonidos temático en la apertura de sobres. Por ahora solo
// el de dinosaurios: rugido al abrir + chillido en épica/legendaria.
const DINO_ALBUM_IDS = new Set(['d1227449-f10c-41e6-8483-5bef42b9fb0a']);

export type SfxTheme = 'dino' | null;

export function albumSfxTheme(albumId: string | null | undefined): SfxTheme {
  return albumId && DINO_ALBUM_IDS.has(albumId) ? 'dino' : null;
}

// 'card' suena una vez por figurita (escalonado) → pool para que los pops
// solapados no se corten entre sí.
const CARD_POOL = 4;

let players: Partial<Record<SfxName, AudioPlayer>> = {};
let cardPool: AudioPlayer[] = [];
let cardIx = 0;
let ready = false;

export function initSfx() {
  if (ready) return;
  ready = true;
  try {
    setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
    for (const key of Object.keys(SOURCES) as SfxName[]) {
      if (key === 'card') continue;
      players[key] = createAudioPlayer(SOURCES[key]);
    }
    cardPool = Array.from({ length: CARD_POOL }, () => createAudioPlayer(SOURCES.card));
  } catch {
    // Audio no disponible: seguimos sin sonido.
  }
}

export function playSfx(name: SfxName, volume = 1) {
  try {
    const p = name === 'card' ? cardPool[cardIx++ % cardPool.length] : players[name];
    if (!p) return;
    p.volume = volume;
    p.seekTo(0);
    p.play();
  } catch {
    // no-op
  }
}
