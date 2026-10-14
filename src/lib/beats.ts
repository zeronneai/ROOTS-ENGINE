import { execFileSync } from "node:child_process";

/**
 * Detecta el tempo (BPM) y los golpes (beats) de una canción, para cortar el video al ritmo.
 * Método clásico: envolvente de "ataques" (subidas de energía) → autocorrelación para el tempo →
 * fase que mejor cae sobre los ataques. No es perfecto en canciones raras, pero en música de redes funciona bien.
 */
export function detectBeats(file: string, maxSeconds = 120): { bpm: number; beats: number[]; duration: number } {
  const RATE = 11025;
  const HOP = 256; // ~23 ms
  const pcm = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-t", String(maxSeconds), "-vn", "-ac", "1", "-ar", String(RATE), "-f", "s16le", "-"], {
    maxBuffer: 1024 * 1024 * 256,
  });
  const x = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
  const duration = x.length / RATE;
  const n = Math.floor(x.length / HOP);
  if (n < 50) return { bpm: 120, beats: grid(120, 0, duration), duration };

  // energía por ventana (log) y su subida = "ataques"
  const energy = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let s = 0;
    for (let i = f * HOP; i < (f + 1) * HOP; i++) s += (x[i] / 32768) ** 2;
    energy[f] = Math.log1p(1000 * (s / HOP));
  }
  const onset = new Float32Array(n);
  for (let f = 1; f < n; f++) onset[f] = Math.max(0, energy[f] - energy[f - 1]);
  // quitar la tendencia local para que resalten los golpes
  const W = 16;
  const env = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let m = 0;
    let c = 0;
    for (let k = Math.max(0, f - W); k < Math.min(n, f + W); k++) {
      m += onset[k];
      c++;
    }
    env[f] = Math.max(0, onset[f] - m / c);
  }

  // tempo: autocorrelación entre 70 y 170 BPM, con preferencia suave alrededor de 115
  const fps = RATE / HOP;
  let best = { lag: Math.round((fps * 60) / 120), score: -Infinity };
  for (let bpm = 70; bpm <= 170; bpm += 0.5) {
    const lag = (fps * 60) / bpm;
    let s = 0;
    for (let f = 0; f + lag * 2 < n; f++) {
      const a = env[f];
      if (!a) continue;
      s += a * (interp(env, f + lag) + 0.5 * interp(env, f + lag * 2));
    }
    const weight = Math.exp(-0.5 * (Math.log2(bpm / 115) / 0.9) ** 2);
    if (s * weight > best.score) best = { lag, score: s * weight };
  }
  // afinar tempo y fase juntos: la combinación cuyos golpes caen sobre más ataques
  const coarse = (fps * 60) / best.lag;
  let fit = { bpm: coarse, phase: 0, sum: -Infinity };
  for (let b = coarse - 1.5; b <= coarse + 1.5; b += 0.05) {
    const lag = (fps * 60) / b;
    for (let p = 0; p < lag; p += 0.5) {
      let s = 0;
      for (let t = p; t < n; t += lag) s += interp(env, t);
      if (s > fit.sum) fit = { bpm: b, phase: p, sum: s };
    }
  }
  const bpm = +fit.bpm.toFixed(2);

  // cada golpe se ajusta al ataque real más cercano (±70 ms), así no se acumula desfase
  const beats = grid(fit.bpm, fit.phase / fps, duration).map((t) => {
    const f0 = Math.round(t * fps);
    let bf = f0;
    for (let f = Math.max(1, f0 - 3); f <= Math.min(n - 1, f0 + 3); f++) if (env[f] > env[bf]) bf = f;
    return env[bf] > 0 ? +((bf + 0.5) / fps).toFixed(3) : t; // centro del cuadro donde sube la energía
  });
  return { bpm, beats, duration };
}

function interp(a: Float32Array, i: number) {
  const k = Math.floor(i);
  if (k < 0 || k + 1 >= a.length) return 0;
  const t = i - k;
  return a[k] * (1 - t) + a[k + 1] * t;
}

function grid(bpm: number, offset: number, duration: number) {
  const step = 60 / bpm;
  const out: number[] = [];
  for (let t = offset; t < duration; t += step) out.push(+t.toFixed(3));
  return out;
}
