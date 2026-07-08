// Generador de efectos de sonido para la apertura de sobres.
//
// Sintetiza WAVs (16-bit PCM mono 44.1kHz) sin dependencias — solo DSP a mano.
// Reproducible: `node scripts/gen-sfx.js` reescribe assets/sounds/*.wav.
// Los archivos son REEMPLAZABLES por sonidos curados con el mismo nombre.
//
// Sonidos:
//   pack-shake  rustle suave al tocar el sobre
//   pack-open   whoosh + shimmer del momento de apertura (el "wow")
//   card-pop    pop sutil por cada figurita que aterriza
//   sparkle     chime brillante para figuritas nuevas (rara+)
//   legendary   fanfarria ascendente si sale épica/legendaria nueva
//   paste       "thunk" satisfactorio al pegar

const fs = require('fs');
const path = require('path');

const SR = 44100;
const OUT = path.join(__dirname, '..', 'assets', 'sounds');

const buf = (sec) => new Float32Array(Math.ceil(SR * sec));

function normalize(s, target = 0.9) {
  let peak = 0;
  for (let i = 0; i < s.length; i++) peak = Math.max(peak, Math.abs(s[i]));
  if (peak > 0) { const g = target / peak; for (let i = 0; i < s.length; i++) s[i] *= g; }
  return s;
}

// Fade de ~3ms en los bordes para evitar clicks de discontinuidad.
function fadeEdges(s, ms = 3) {
  const n = Math.floor((ms / 1000) * SR);
  for (let i = 0; i < n && i < s.length; i++) {
    const g = i / n;
    s[i] *= g;
    s[s.length - 1 - i] *= g;
  }
  return s;
}

function lowpass(s, cutoff) {
  const dt = 1 / SR, rc = 1 / (2 * Math.PI * cutoff), a = dt / (rc + dt);
  let prev = 0;
  for (let i = 0; i < s.length; i++) { prev += a * (s[i] - prev); s[i] = prev; }
  return s;
}
function highpass(s, cutoff) {
  const dt = 1 / SR, rc = 1 / (2 * Math.PI * cutoff), a = rc / (rc + dt);
  let pin = 0, pout = 0;
  for (let i = 0; i < s.length; i++) { const x = s[i]; const y = a * (pout + x - pin); pout = y; pin = x; s[i] = y; }
  return s;
}

// Campana: fundamental + parciales con decay exponencial.
function addBell(s, t0, freq, dur, amp, partials = [[1, 1], [2, 0.5], [3, 0.25], [4.2, 0.12]]) {
  const start = Math.floor(t0 * SR), len = Math.floor(dur * SR);
  for (let i = 0; i < len; i++) {
    const idx = start + i; if (idx >= s.length) break;
    const t = i / SR, env = Math.exp(-t / (dur * 0.35));
    let v = 0;
    for (const [ph, pa] of partials) v += pa * Math.sin(2 * Math.PI * freq * ph * t);
    s[idx] += amp * env * v;
  }
}

function addNoise(s, t0, dur, amp, decay = 0.3) {
  const start = Math.floor(t0 * SR), len = Math.floor(dur * SR);
  for (let i = 0; i < len; i++) {
    const idx = start + i; if (idx >= s.length) break;
    const t = i / SR, env = Math.exp(-t / (dur * decay));
    s[idx] += amp * env * (Math.random() * 2 - 1);
  }
}

// Barrido de frecuencia con fase continua (sin clicks).
function addSweep(s, t0, f0, f1, dur, amp, decay = 0.12) {
  const start = Math.floor(t0 * SR), len = Math.floor(dur * SR);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const idx = start + i; if (idx >= s.length) break;
    const t = i / SR, f = f0 + (f1 - f0) * (t / dur);
    ph += (2 * Math.PI * f) / SR;
    const env = Math.exp(-t / decay) * Math.min(1, t / 0.008);
    s[idx] += amp * env * Math.sin(ph);
  }
}

// --- Sonidos ---------------------------------------------------------------

function packShake() {
  const s = buf(0.28), n = buf(0.28);
  addNoise(n, 0, 0.28, 0.6, 1.0);
  lowpass(n, 4000); highpass(n, 800);
  for (let i = 0; i < s.length; i++) {
    const t = i / SR;
    const env = Math.exp(-t / 0.15) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 22 * t));
    s[i] += n[i] * env * 0.7;
  }
  return fadeEdges(normalize(s, 0.55));
}

function packOpen() {
  const s = buf(0.7), n = buf(0.7);
  addNoise(n, 0, 0.5, 0.9, 0.5);
  lowpass(n, 3500); highpass(n, 300);
  for (let i = 0; i < s.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.05) * Math.exp(-t / 0.28);
    s[i] += n[i] * env * 0.8;
  }
  addSweep(s, 0, 250, 950, 0.28, 0.35, 0.12);
  addBell(s, 0.14, 1568, 0.5, 0.18);
  addBell(s, 0.18, 2093, 0.45, 0.15);
  addBell(s, 0.22, 2637, 0.4, 0.12);
  return fadeEdges(normalize(s, 0.92));
}

function cardPop() {
  const s = buf(0.14);
  addNoise(s, 0, 0.01, 0.5, 0.5); highpass(s, 1200);
  let ph = 0; const dur = 0.12;
  for (let i = 0; i < Math.floor(dur * SR); i++) {
    const t = i / SR, f = 420 - 180 * (t / dur);
    ph += (2 * Math.PI * f) / SR;
    s[i] += 0.7 * Math.exp(-t / 0.035) * Math.sin(ph);
  }
  return fadeEdges(normalize(s, 0.8));
}

function sparkle() {
  const s = buf(0.55), n = buf(0.55);
  const notes = [1760, 2217, 2637, 3136];
  notes.forEach((f, k) => addBell(s, k * 0.04, f, 0.4 - k * 0.04, 0.22 - k * 0.02, [[1, 1], [2.01, 0.4], [3.3, 0.18]]));
  addNoise(n, 0, 0.5, 0.3, 0.5); highpass(n, 4000);
  for (let i = 0; i < s.length; i++) s[i] += n[i] * Math.exp(-(i / SR) / 0.25) * 0.25;
  return fadeEdges(normalize(s, 0.85));
}

function legendary() {
  const s = buf(1.3), n = buf(1.3);
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  const partials = [[1, 1], [2, 0.5], [3, 0.28], [4.1, 0.14], [5.4, 0.08]];
  notes.forEach((f, k) => addBell(s, k * 0.12, f, 1.0, 0.28, partials));
  let ph = 0;
  for (let i = 0; i < Math.floor(0.4 * SR); i++) {
    ph += (2 * Math.PI * 130.8) / SR;
    s[i] += 0.3 * Math.exp(-(i / SR) / 0.15) * Math.sin(ph);
  }
  addBell(s, 0.5, 2093, 0.7, 0.16);
  addBell(s, 0.56, 2637, 0.65, 0.13);
  addNoise(n, 0.45, 0.8, 0.25, 0.5); highpass(n, 5000);
  for (let i = 0; i < s.length; i++) { const t = Math.max(0, i / SR - 0.45); s[i] += n[i] * Math.exp(-t / 0.35) * 0.2; }
  return fadeEdges(normalize(s, 0.95));
}

function paste() {
  const s = buf(0.2);
  addNoise(s, 0, 0.008, 0.4, 0.4); lowpass(s, 2000);
  let ph = 0; const dur = 0.18;
  for (let i = 0; i < Math.floor(dur * SR); i++) {
    const t = i / SR, f = 160 - 30 * (t / dur);
    ph += (2 * Math.PI * f) / SR;
    s[i] += 0.8 * Math.exp(-t / 0.05) * Math.sin(ph);
  }
  addBell(s, 0.02, 880, 0.12, 0.12);
  return fadeEdges(normalize(s, 0.85));
}

// --- WAV -------------------------------------------------------------------

function writeWav(name, samples) {
  const n = samples.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    b.writeInt16LE((v * 32767) | 0, 44 + i * 2);
  }
  const file = path.join(OUT, name);
  fs.writeFileSync(file, b);
  console.log(`  ${name}  ${(b.length / 1024).toFixed(1)} KB`);
}

fs.mkdirSync(OUT, { recursive: true });
console.log('Generando SFX en assets/sounds/:');
writeWav('pack-shake.wav', packShake());
writeWav('pack-open.wav', packOpen());
writeWav('card-pop.wav', cardPop());
writeWav('sparkle.wav', sparkle());
writeWav('legendary.wav', legendary());
writeWav('paste.wav', paste());
console.log('Listo.');
