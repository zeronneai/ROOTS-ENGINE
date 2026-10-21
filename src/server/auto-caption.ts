/**
 * Worker: escribe el copy de un video que llegó sin copy (ej. de Dropbox sin .txt).
 * Saca fotos del video con ffmpeg, transcribe con Whisper y le pasa todo a Claude.
 * Se importa dinámico desde publishing.ts para que Vercel no cargue ffmpeg ni Whisper.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { transcribeWords } from "../lib/transcribe";
import { generateCaption } from "./captions";

export async function autoCaption(
  db: SupabaseClient,
  clientId: string,
  media: { buffer: Buffer; name: string; kind: "video" | "image" },
  platforms: string[],
) {
  const dir = mkdtempSync(path.join(tmpdir(), "roots-caption-"));
  try {
    const input = path.join(dir, `in${path.extname(media.name) || (media.kind === "image" ? ".jpg" : ".mp4")}`);
    writeFileSync(input, media.buffer);
    const frames = extractFrames(input, dir, media.kind);
    let transcript: string | null = null;
    if (media.kind === "video") {
      try {
        const { data } = await db.from("clients").select("language").eq("id", clientId).single();
        transcript = (await transcribeWords(input, data?.language)).text;
      } catch {
        transcript = null; // sin audio o Whisper falló: igual se escribe con las fotos
      }
    }
    const out = await generateCaption(db, clientId, { frames, transcript, platforms });
    return out.caption;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function extractFrames(input: string, dir: string, kind: "video" | "image") {
  const scale = "scale='min(640,iw)':-2";
  if (kind === "image") {
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", input, "-vf", scale, "-frames:v", "1", path.join(dir, "f01.jpg")]);
  } else {
    let duration = 10;
    try {
      duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", input]).toString().trim()) || 10;
    } catch {}
    const n = 6;
    for (let i = 0; i < n; i++) {
      const t = ((i + 0.5) / n) * duration;
      try {
        execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", t.toFixed(2), "-i", input, "-vf", scale, "-frames:v", "1", "-q:v", "4", path.join(dir, `f${String(i).padStart(2, "0")}.jpg`)]);
      } catch {}
    }
  }
  return readdirSync(dir)
    .filter((f) => /^f\d+\.jpg$/.test(f))
    .sort()
    .map((f) => ({ data: readFileSync(path.join(dir, f)).toString("base64"), mediaType: "image/jpeg" as const }));
}
