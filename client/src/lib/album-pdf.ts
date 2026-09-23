// Generación de un PDF descargable del álbum: portada + grilla de figuritas.
//
// Dos usos (el caller decide qué figuritas pasar):
//   - Vista jugador  → solo las pegadas al momento.
//   - Vista owner/editor → todas las cargadas.
//
// Nativo (Android/iOS): expo-print arma el PDF desde HTML y lo guardamos en el
// cache dir; lo renombramos al nombre del álbum y lo abrimos con expo-sharing
// (el user elige guardar/compartir). Web: expo-print no soporta printToFileAsync,
// así que caemos a printAsync → diálogo de impresión del browser ("Guardar como
// PDF").
//
// Las imágenes se referencian por URL pública de R2: el WebView de impresión las
// baja al renderizar (requiere red). Los presets (gradientes locales) se dibujan
// con CSS. Ver lib/storage.ts + lib/presets.ts.

import { Platform } from 'react-native';
import * as Print from 'expo-print';

import type { Album, Sticker } from '@/lib/queries/albums';
import { RarityFrame } from '@/constants/theme';
import { canDownloadAlbum, recordAlbumDownload } from '@/lib/download-limit';
import { getPreset } from '@/lib/presets';
import { ADS_SUPPORTED, showRewardedAd } from '@/lib/rewarded-ad';
import { isPreset, presetIdFromKey, r2Url } from '@/lib/storage';

interface Options {
  album: Album;
  // Ya filtradas por el caller (pegadas / todas). El helper las ordena por número.
  stickers: Sticker[];
  // Línea bajo el título en la portada (ej. "Mi colección · 12 / 50").
  subtitle: string;
  // Usuario actual: para el límite de 1 descarga por álbum por semana.
  userId: string;
}

// Resultado de intentar una descarga:
//   - ok: se descargó (o se abrió el diálogo en web).
//   - ad-skipped: no completó la propaganda → no se descargó.
//   - rate-limited: ya lo descargó esta semana → nextAt = cuándo vuelve.
export type DownloadOutcome =
  | { status: 'ok' }
  | { status: 'ad-skipped' }
  | { status: 'rate-limited'; nextAt: number };

// Escapa texto para incrustar seguro en el HTML (nombres de álbum/figurita).
function esc(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Nombre de archivo seguro para el PDF a partir del nombre del álbum.
function safeFileName(name: string): string {
  const base = (name || 'album')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // saca tildes/diacríticos
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'album';
}

// Devuelve el HTML del fondo de una "media" (carátula o celda): imagen R2 si hay,
// gradiente si es preset, o un bloque de color con la inicial como último recurso.
function mediaBackground(key: string | null | undefined, seed: string): string {
  const url = r2Url(key);
  if (url) return `<img class="media-img" src="${esc(url)}" />`;
  if (isPreset(key)) {
    const preset = getPreset(presetIdFromKey(key as string));
    if (preset) {
      return `<div class="media-gradient" style="background:linear-gradient(180deg, ${preset.colors[0]}, ${preset.colors[1]})"></div>`;
    }
  }
  const initial = esc((seed.trim()[0] ?? '?').toUpperCase());
  return `<div class="media-fallback"><span>${initial}</span></div>`;
}

function buildHtml({ album, stickers, subtitle }: Options): string {
  const ordered = [...stickers].sort((a, b) => a.number - b.number);

  const cover = mediaBackground(
    album.cover_large_key ?? album.cover_thumb_key,
    album.name,
  );

  const cells = ordered
    .map((s) => {
      const media = mediaBackground(s.large_key ?? s.thumb_key, s.name);
      const border = RarityFrame[s.rarity] ?? RarityFrame.common;
      const num = String(s.number).padStart(3, '0');
      return `
        <div class="cell">
          <div class="thumb" style="border-color:${border}">
            ${media}
            <span class="num">${num}</span>
          </div>
          <div class="cname">${esc(s.name)}</div>
        </div>`;
    })
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: A4; margin: 12mm; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #2A1E16;
    background: #FBF3E2;
  }

  /* ---- Portada ---- */
  .cover { page-break-after: always; text-align: center; padding-top: 8mm; }
  .cover-media {
    position: relative;
    width: 78mm;
    height: 97mm;               /* ~4:5 */
    margin: 0 auto 8mm;
    border-radius: 6mm;
    overflow: hidden;
    border: 3px solid #E8B24A;
    background: #F3E7CF;
  }
  .cover-title {
    font-size: 30pt;
    font-weight: 800;
    letter-spacing: 0.5px;
    line-height: 1.05;
    margin: 0 8mm;
  }
  .cover-sub {
    margin-top: 4mm;
    font-size: 12pt;
    font-weight: 600;
    color: #9C8E79;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .cover-brand {
    margin-top: 10mm;
    font-size: 9pt;
    letter-spacing: 2px;
    color: #B89B6E;
    text-transform: uppercase;
  }

  /* ---- Grilla ---- */
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 5mm;
  }
  .cell { break-inside: avoid; page-break-inside: avoid; text-align: center; }
  .thumb {
    position: relative;
    width: 100%;
    padding-bottom: 122%;       /* ~0.82 aspecto de la grilla */
    border-radius: 3mm;
    overflow: hidden;
    border: 2px solid #B89B6E;
    background: #F3E7CF;
  }
  .num {
    position: absolute;
    top: 2mm; left: 2mm;
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: #FBF3E2;
    background: rgba(42,30,22,0.65);
    padding: 0.5mm 1.5mm;
    border-radius: 1mm;
  }
  .cname {
    margin-top: 1.5mm;
    font-size: 8.5pt;
    font-weight: 600;
    line-height: 1.15;
    color: #2A1E16;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  /* ---- Media (compartido portada/celda) ---- */
  .media-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .media-gradient { position: absolute; inset: 0; }
  .media-fallback {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    background: #C98F2A; color: #FBF3E2;
    font-size: 40pt; font-weight: 800;
  }
  .cover-media .media-fallback { font-size: 64pt; }
</style>
</head>
<body>
  <section class="cover">
    <div class="cover-media">${cover}</div>
    <h1 class="cover-title">${esc(album.name)}</h1>
    <div class="cover-sub">${esc(subtitle)}</div>
    <div class="cover-brand">Mi Álbum de Figuritas</div>
  </section>
  <section class="grid">${cells}</section>
</body>
</html>`;
}

// Genera y ofrece el PDF. Ver DownloadOutcome. Lanza solo si algo falla de
// verdad (el caller muestra el error); rate-limit y ad-skip son estados, no
// errores.
export async function downloadAlbumPdf(opts: Options): Promise<DownloadOutcome> {
  // Límite: 1 descarga por álbum por semana (client-side). Se chequea ANTES de
  // la propaganda para no hacerlo mirar un ad y después bloquearlo.
  const gate = await canDownloadAlbum(opts.userId, opts.album.id);
  if (!gate.allowed && gate.nextAt != null) {
    return { status: 'rate-limited', nextAt: gate.nextAt };
  }

  // Propaganda antes de descargar (rewarded ad). Solo donde hay ads reales
  // (Android): si el user la cierra antes de terminar o no hay inventario,
  // showRewardedAd resuelve false → no descargamos. En web/iOS no hay rewarded
  // ad (ADS_SUPPORTED=false), así que la descarga sigue directo.
  if (ADS_SUPPORTED) {
    const rewarded = await showRewardedAd();
    if (!rewarded) return { status: 'ad-skipped' };
  }

  const html = buildHtml(opts);

  // Web: no hay printToFileAsync; el diálogo de impresión del browser permite
  // "Guardar como PDF". Es el equivalente a "descargar" en web.
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    await recordAlbumDownload(opts.userId, opts.album.id);
    return { status: 'ok' };
  }

  // Módulos nativos (no existen en web): require perezoso para que el bundle
  // web nunca los evalúe. Solo llegamos acá en Android/iOS.
  const Sharing = require('expo-sharing') as typeof import('expo-sharing');
  const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');

  const { uri } = await Print.printToFileAsync({ html });

  // Renombramos el PDF temporal al nombre del álbum para que el share/guardado
  // muestre un nombre lindo. Best-effort: si falla, compartimos el original.
  let shareUri = uri;
  try {
    const generated = new File(uri);
    const targetName = `${safeFileName(opts.album.name)}.pdf`;
    const existing = new File(Paths.cache, targetName);
    if (existing.exists) existing.delete();
    generated.rename(targetName);
    shareUri = generated.uri;
  } catch {
    shareUri = uri;
  }

  if (!(await Sharing.isAvailableAsync())) {
    // Sin capa de share (raro en Android/iOS reales): al menos no rompemos.
    throw new Error('Compartir no está disponible en este dispositivo.');
  }
  await Sharing.shareAsync(shareUri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Descargar álbum',
  });
  await recordAlbumDownload(opts.userId, opts.album.id);
  return { status: 'ok' };
}
