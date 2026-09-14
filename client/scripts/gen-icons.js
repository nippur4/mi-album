// Genera TODOS los íconos de la app (Android launcher + web favicon/PWA) a
// partir de una sola imagen fuente cuadrada-ish. Recorta a cuadrado con
// `cover` (centrado) y arma las variantes con zona segura donde hace falta.
//
// Uso (desde client/):
//   npm install --no-save jimp@0.22.12
//   node scripts/gen-icons.js assets/images/brand-source.png
//
// jimp es JS puro (sin binarios nativos), así que corre en cualquier lado.
// El color de fondo (para el padding de las variantes con zona segura) se
// muestrea de una esquina de la fuente, así matchea el celeste de la imagen.

const path = require('path');
const Jimp = require('jimp');

const SRC = process.argv[2] || 'assets/images/brand-source.png';
const CENTER = Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE;

async function main() {
  const abs = path.resolve(SRC);
  const probe = await Jimp.read(abs);
  const bgColor = probe.getPixelColor(6, 6); // celeste del cielo (esquina)
  const out = [];

  // Cuadrado por cover (recorta centrado para llenar).
  async function cover(size, outPath) {
    const img = (await Jimp.read(abs)).cover(size, size, CENTER);
    await img.writeAsync(outPath);
    out.push(`${outPath}  ${size}x${size}`);
  }

  // Escena a `inner`% centrada sobre un fondo (sólido o transparente), para
  // las variantes con zona segura (adaptive foreground, maskable).
  async function padded(size, innerRatio, fill, outPath) {
    const canvas = new Jimp(size, size, fill);
    const inner = Math.round(size * innerRatio);
    const fg = (await Jimp.read(abs)).cover(inner, inner, CENTER);
    const off = Math.round((size - inner) / 2);
    canvas.composite(fg, off, off);
    await canvas.writeAsync(outPath);
    out.push(`${outPath}  ${size}x${size} (inner ${Math.round(innerRatio * 100)}%)`);
  }

  // --- App icon (Play listing / iOS / genérico) ---
  await cover(1024, 'assets/images/icon.png');

  // --- Android adaptive ---
  // Foreground: la escena en la zona segura (~66%) sobre transparente. El
  // relleno lo aporta el background.
  await padded(1024, 0.66, 0x00000000, 'assets/images/android-icon-foreground.png');
  // Background: celeste sólido.
  await new Jimp(1024, 1024, bgColor).writeAsync('assets/images/android-icon-background.png');
  out.push('assets/images/android-icon-background.png  1024x1024 (sólido)');

  // --- Web: favicon de la pestaña ---
  await cover(196, 'assets/images/favicon.png');

  // --- Web PWA (public/) ---
  await cover(192, 'public/icon-192.png');
  await cover(512, 'public/icon-512.png');
  await padded(512, 0.8, bgColor, 'public/icon-maskable-512.png'); // maskable: 80% zona segura
  await cover(180, 'public/apple-touch-icon.png');

  const hex = ((bgColor >>> 8) & 0xffffff).toString(16).padStart(6, '0');
  console.log('Generado:\n' + out.map((o) => '  ' + o).join('\n'));
  console.log(`\nColor de fondo detectado: #${hex}`);
  console.log('→ Alineá el backgroundColor del adaptiveIcon en app.json con este color si querés.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
