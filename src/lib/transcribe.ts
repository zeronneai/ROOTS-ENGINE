import { createReadStream } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import type { Word } from "./edl/types";

/**
 * Transcripción con tiempos por palabra.
 *
 * TRANSCRIBE_PROVIDER=local  (default) Whisper corriendo en la misma compu que el worker. Gratis, sin llaves.
 *                            La primera vez descarga whisper.cpp y el modelo a la carpeta .whisper/
 * TRANSCRIBE_PROVIDER=openai Whisper de OpenAI por API (necesita OPENAI_API_KEY). Más rápido en compus lentas.
 *
 * WHISPER_MODEL: small (default, ~470 MB, buen balance) | medium (~1.5 GB, más preciso) | base (rápido, menos preciso)
 */
export async function transcribeWords(videoOrAudioPath: string, language?: string | null): Promise<{ text: string; words: Word[] }> {
  const provider = (process.env.TRANSCRIBE_PROVIDER || "local").toLowerCase();
  return provider === "openai" ? transcribeOpenAI(videoOrAudioPath, language) : transcribeLocal(videoOrAudioPath, language);
}

// ───────────────────────────── Local (whisper.cpp) ─────────────────────────────

const WHISPER_DIR = path.resolve(process.env.WHISPER_DIR || ".whisper");
const WHISPER_VERSION = process.env.WHISPER_CPP_VERSION || "1.5.5";
type Model = "base" | "small" | "medium" | "large-v3-turbo";
const MODEL = (process.env.WHISPER_MODEL || "small") as Model;

let ready: Promise<void> | null = null;

async function ensureWhisper() {
  if (!ready) {
    ready = (async () => {
      const { installWhisperCpp, downloadWhisperModel } = await import("@remotion/install-whisper-cpp");
      console.log(`   whisper: revisando instalación (${MODEL})...`);
      await installWhisperCpp({ to: WHISPER_DIR, version: WHISPER_VERSION, printOutput: false });
      await downloadWhisperModel({
        model: MODEL,
        folder: WHISPER_DIR,
        onProgress: (downloaded, total) => {
          if (total && downloaded === total) console.log("   whisper: modelo descargado");
        },
      });
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

async function transcribeLocal(input: string, language?: string | null) {
  await ensureWhisper();
  const { transcribe, toCaptions } = await import("@remotion/install-whisper-cpp");

  // whisper.cpp necesita WAV 16 kHz mono
  const wav = `${input}.16k.wav`;
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav]);

  const lang = language === "en" ? "en" : language === "es" ? "es" : null; // bilingüe: que detecte solo
  const out = await transcribe({
    inputPath: wav,
    whisperPath: WHISPER_DIR,
    whisperCppVersion: WHISPER_VERSION,
    model: MODEL,
    modelFolder: WHISPER_DIR,
    tokenLevelTimestamps: true,
    splitOnWord: true,
    language: lang,
    printOutput: false,
  });
  const { captions } = toCaptions({ whisperCppOutput: out });

  const words: Word[] = captions
    .map((c) => ({ text: c.text.trim(), start: c.startMs / 1000, end: c.endMs / 1000 }))
    .filter((w) => w.text && !/^\[.*\]$/.test(w.text)); // fuera [Música], [BLANK_AUDIO], etc.
  const text = words.map((w) => w.text).join(" ");
  return { text, words };
}

// ───────────────────────────── OpenAI (opcional) ─────────────────────────────

async function transcribeOpenAI(input: string, language?: string | null) {
  if (!process.env.OPENAI_API_KEY) throw new Error("TRANSCRIBE_PROVIDER=openai necesita OPENAI_API_KEY");
  const mp3 = `${input}.mp3`;
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", mp3]);
  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI();
  const res = (await openai.audio.transcriptions.create({
    file: createReadStream(mp3),
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
    ...(language && language !== "bilingual" ? { language } : {}),
  })) as unknown as { text: string; words?: { word: string; start: number; end: number }[] };
  const words = (res.words ?? []).map((w) => ({ text: w.word.trim(), start: w.start, end: w.end }));
  return { text: res.text, words: attachPunctuation(res.text, words) };
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
