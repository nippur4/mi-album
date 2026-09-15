// Genera TODOS los íconos de la app (Android launcher + web favicon/PWA) a
// partir de una sola imagen fuente cuadrada-ish. Recorta a cuadrado con
// `cover` (centrado) y arma las variantes con zona segura donde hace falta.
//
// Uso (desde client/):
//   node scripts/gen-icons.js assets/images/logoApp.png
//
// jimp es JS puro (sin binarios nativos), así que corre en cualquier lado.
// El color de fondo (para el padding de las variantes con zona segura) se
// muestrea de una esquina de la fuente, así matchea el fondo de la imagen.
//
// NOTA API: escrito para jimp v1.x (named export `Jimp`, métodos con objeto
// `{ w, h }`, `write` async). La versión 0.22 vieja usaba `.cover(w,h)` +
// `.writeAsync()` — no confundir si se revisa un diff viejo.

const path = require('path');
const { Jimp } = require('jimp');

const SRC = process.argv[2] || 'assets/images/logoApp.png';

async function main() {
  const abs = path.resolve(SRC);
  const probe = await Jimp.read(abs);
  const bgColor = probe.getPixelColor(6, 6); // fondo de la esquina (canvas del logo)
  const out = [];

  // Cuadrado por cover (recorta centrado para llenar).
  async function cover(size, outPath) {
    const img = (await Jimp.read(abs)).cover({ w: size, h: size });
    await img.write(outPath);
    out.push(`${outPath}  ${size}x${size}`);
  }

  // Escena a `inner`% centrada sobre un fondo (sólido o transparente), para
  // las variantes con zona segura (adaptive foreground, maskable).
  async function padded(size, innerRatio, fill, outPath) {
    const canvas = new Jimp({ width: size, height: size, color: fill });
    const inner = Math.round(size * innerRatio);
    const fg = (await Jimp.read(abs)).cover({ w: inner, h: inner });
    const off = Math.round((size - inner) / 2);
    canvas.composite(fg, off, off);
    await canvas.write(outPath);
    out.push(`${outPath}  ${size}x${size} (inner ${Math.round(innerRatio * 100)}%)`);
  }

  // --- App icon (Play listing / iOS / genérico) ---
  await cover(1024, 'assets/images/icon.png');

  // --- Android adaptive ---
  // Foreground: la escena en la zona segura (~66%) sobre transparente. El
  // relleno lo aporta el background.
  await padded(1024, 0.66, 0x00000000, 'assets/images/android-icon-foreground.png');
  // Background: color sólido muestreado de la esquina de la fuente.
  await new Jimp({ width: 1024, height: 1024, color: bgColor }).write(
    'assets/images/android-icon-background.png'
  );
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
