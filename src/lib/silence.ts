import { execFileSync } from "node:child_process";
import type { Word } from "./edl/types";

export type Silence = { start: number; end: number };
export type AudioStats = { floorDb: number; speechDb: number; thresholdDb: number };

const RATE = 16000;
const FRAME = 320; // 20 ms

/**
 * Detecta pausas midiendo el volumen del audio cada 20 ms.
 * El umbral se calcula con el propio video: entre el ruido de fondo (lo más bajo) y la voz (lo más alto),
 * así funciona igual en un estudio callado que grabando con el celular en la calle.
 */
export function detectSilences(file: string, minMs = 180): { silences: Silence[]; stats: AudioStats | null } {
  const pcm = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-vn", "-ac", "1", "-ar", String(RATE), "-f", "s16le", "-"], {
    maxBuffer: 1024 * 1024 * 512,
  });
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
  const n = Math.floor(samples.length / FRAME);
  if (n < 10) return { silences: [], stats: null };

  const db = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let sum = 0;
    for (let i = f * FRAME; i < (f + 1) * FRAME; i++) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / FRAME) / 32768;
    db[f] = 20 * Math.log10(Math.max(rms, 1e-6));
  }
  const sorted = Array.from(db).sort((a, b) => a - b);
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const floorDb = pct(0.08);
  const speechDb = pct(0.92);
  const spread = speechDb - floorDb;
  // si casi no hay diferencia entre ruido y voz, usamos un margen fijo bajo la voz
  const thresholdDb = spread < 12 ? speechDb - 14 : floorDb + Math.max(6, spread * 0.38);

  const minFrames = Math.ceil(minMs / 20);
  const silences: Silence[] = [];
  let runStart = -1;
  for (let f = 0; f <= n; f++) {
    const quiet = f < n && db[f] < thresholdDb;
    if (quiet && runStart < 0) runStart = f;
    if (!quiet && runStart >= 0) {
      if (f - runStart >= minFrames) silences.push({ start: +((runStart * FRAME) / RATE).toFixed(3), end: +((f * FRAME) / RATE).toFixed(3) });
      runStart = -1;
    }
  }
  return {
    silences,
    stats: { floorDb: +floorDb.toFixed(1), speechDb: +speechDb.toFixed(1), thresholdDb: +thresholdDb.toFixed(1) },
  };
}

/**
 * Whisper local estira cada palabra hasta que empieza la siguiente, así que "no hay pausas".
 * Aquí recortamos cada palabra para que no se coma los silencios medidos en el audio.
 */
export function fitWordsToSilences(words: Word[], silences: Silence[]): Word[] {
  if (!silences.length) return words;
  return words.map((w) => {
    let { start, end } = w;
    for (const s of silences) {
      if (s.end <= start || s.start >= end) continue;
      const inside = s.start <= start && s.end >= end;
      if (inside) continue; // palabra dicha muy bajito: la dejamos como está
      if (s.start <= start) start = s.end; // el silencio tapa el inicio
      else if (s.end >= end) end = s.start; // el silencio tapa el final
      else {
        // silencio en medio de la "palabra": nos quedamos con el lado más largo
        if (s.start - start >= end - s.end) end = s.start;
        else start = s.end;
      }
    }
    if (end - start < 0.06) return w;
    return { ...w, start: +start.toFixed(3), end: +end.toFixed(3) };
  });
}
