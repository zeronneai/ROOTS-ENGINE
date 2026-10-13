import { createReadStream } from "node:fs";
import OpenAI from "openai";
import type { Word } from "./edl/types";

/**
 * Transcribe con timestamps por palabra.
 * Proveedor: OpenAI Whisper (barato y bueno en español/spanglish).
 * El audio debe pesar < 25MB: el worker extrae mp3 mono 64k antes de mandarlo.
 */
export async function transcribeWords(audioPath: string, language?: string): Promise<{ text: string; words: Word[] }> {
  if (!process.env.OPENAI_API_KEY) throw new Error("Falta OPENAI_API_KEY en el .env (se usa para transcribir)");
  const openai = new OpenAI();
  const res = (await openai.audio.transcriptions.create({
    file: createReadStream(audioPath),
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
    ...(language && language !== "bilingual" ? { language } : {}),
  })) as unknown as { text: string; words?: { word: string; start: number; end: number }[] };

  return {
    text: res.text,
    words: (res.words ?? []).map((w) => ({ text: w.word.trim(), start: w.start, end: w.end })),
  };
}

/**
 * Whisper a veces regresa palabras sin puntuación; la re-inyectamos desde el texto
 * completo para que los subtítulos corten bien por frase.
 */
export function attachPunctuation(text: string, words: Word[]): Word[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  const strip = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  let j = 0;
  return words.map((w) => {
    const target = strip(w.text);
    for (let k = j; k < Math.min(tokens.length, j + 4); k++) {
      if (strip(tokens[k]) === target) {
        j = k + 1;
        return { ...w, text: tokens[k] };
      }
    }
    return w;
  });
}
