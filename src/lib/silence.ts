import { spawnSync } from "node:child_process";
import type { Word } from "./edl/types";

export type Silence = { start: number; end: number };

/**
 * Detecta silencios reales en el audio con ffmpeg.
 * El umbral se adapta al volumen de cada video (un celular en la calle no suena igual que en un estudio).
 */
export function detectSilences(file: string, minMs = 180): Silence[] {
  const vol = spawnSync("ffmpeg", ["-hide_banner", "-i", file, "-vn", "-af", "volumedetect", "-f", "null", "-"], {
    encoding: "utf8",
  }).stderr ?? "";
  const mean = Number(/mean_volume:\s*(-?[\d.]+) dB/.exec(vol)?.[1]);
  // silencio = 16 dB por debajo del promedio de la voz
  const noise = Number.isFinite(mean) ? Math.max(-55, Math.min(-28, mean - 16)) : -38;

  const log = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-i", file, "-vn", "-af", `silencedetect=noise=${noise.toFixed(1)}dB:d=${(minMs / 1000).toFixed(2)}`, "-f", "null", "-"],
    { encoding: "utf8" },
  ).stderr ?? "";

  const out: Silence[] = [];
  let start: number | null = null;
  for (const line of log.split(/\r?\n/)) {
    const s = /silence_start:\s*(-?[\d.]+)/.exec(line);
    if (s) start = Math.max(0, Number(s[1]));
    const e = /silence_end:\s*([\d.]+)/.exec(line);
    if (e && start !== null) {
      out.push({ start, end: Number(e[1]) });
      start = null;
    }
  }
  return out;
}

/**
 * Whisper local estira cada palabra hasta que empieza la siguiente, así que "no hay pausas".
 * Aquí recortamos cada palabra para que no se coma los silencios que sí midió ffmpeg.
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
