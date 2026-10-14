import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeClips } from "../merge-clips";
import { detectBeats } from "../beats";
import { chooseMusic, loadTracks } from "../music";
import { tourCopy } from "../ai/tour";
import { planShots } from "./plan";
import { cleanProperty, type TourEdl } from "./types";
import { getClientContext, styleForClient } from "../../server/engine";

const probeDuration = (file: string) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim()) || 0;

async function download(db: SupabaseClient, bucket: string, storagePath: string, dir: string, name?: string) {
  const { data, error } = await db.storage.from(bucket).download(storagePath);
  if (error || !data) throw new Error(`No se pudo bajar ${storagePath}: ${error?.message}`);
  const file = path.join(dir, name ?? path.basename(storagePath));
  writeFileSync(file, Buffer.from(await data.arrayBuffer()));
  return file;
}

/**
 * Prepara un recorrido inmobiliario completo (lo corre el worker):
 * clips → cuadros para la IA → textos y cuartos → música → ritmo → tomas al ritmo → EDL listo para revisar.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function prepareTour(db: SupabaseClient, edit: any, dir: string, log: (m: string) => void) {
  // 1. clips
  const paths: string[] = [edit.recordings.storage_path, ...(edit.extra_paths ?? [])];
  const files: string[] = [];
  for (const [i, p] of paths.entries()) files.push(await download(db, "recordings", p, dir, `clip-${i}${path.extname(p) || ".mp4"}`));
  let source = files[0];
  let clips = [{ start: 0, end: probeDuration(files[0]) }];
  if (files.length > 1) {
    log(`   uniendo ${files.length} clips del recorrido...`);
    const m = mergeClips(files, dir);
    source = m.file;
    clips = m.clips;
    const sourcePath = `${edit.client_id}/${edit.id}-unido.mp4`;
    const { error } = await db.storage.from("recordings").upload(sourcePath, readFileSync(source), { contentType: "video/mp4", upsert: true });
    if (error) throw new Error(`No se pudo guardar el video unido (${error.message}). Si es muy largo, súbelo en menos clips.`);
    await db.from("edits").update({ source_path: sourcePath }).eq("id", edit.id);
  } else {
    await db.from("edits").update({ source_path: null }).eq("id", edit.id);
  }

  // 2. un cuadro de cada clip para que la IA sepa qué cuarto es
  const frames: { data: string; mediaType: "image/jpeg" }[] = [];
  for (const [i, c] of clips.slice(0, 14).entries()) {
    const out = path.join(dir, `frame-${i}.jpg`);
    try {
      execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", ((c.start + c.end) / 2).toFixed(2), "-i", source, "-frames:v", "1", "-vf", "scale=512:-2", "-q:v", "5", out]);
      frames.push({ data: readFileSync(out).toString("base64"), mediaType: "image/jpeg" });
    } catch {
      // si un cuadro falla seguimos sin él
    }
  }

  // 3. textos, cuartos y canción
  const ctx = await getClientContext(db, edit.client_id);
  const style = styleForClient(ctx, { moodId: edit.mood_id, edit: edit.style_overrides ?? {}, presetId: edit.style_id });
  const property = cleanProperty(edit.property);
  const tracks = await loadTracks(db, edit.client_id);
  const copy = await tourCopy({
    brand: ctx.brand.data,
    client: { name: ctx.client.name, city: ctx.client.city },
    property,
    notes: edit.notes,
    frames,
    tracks: tracks.map((t) => ({ title: t.title, moods: t.moods, energy: t.energy, own: !!t.client_id })),
  });
  const music = chooseMusic({ mode: edit.music_mode, musicId: edit.music_id, tracks, aiPick: copy.musicTrack, style, force: true });

  // 4. ritmo de la canción
  let bpm = 120;
  let beats: number[] = [];
  if (music) {
    const songFile = await download(db, "brand", music.path, dir, `song${path.extname(music.path) || ".mp3"}`);
    const b = detectBeats(songFile);
    bpm = b.bpm;
    beats = b.beats;
    log(`   música: ${music.title} · ${bpm} BPM`);
  } else {
    log("   sin canciones en la biblioteca: el recorrido va sin música (sube canciones en Agencia → Música)");
  }

  // 5. tomas al ritmo
  const plan = planShots({ clips, beats, bpm, targetSeconds: property.seconds ?? 30 });
  if (!plan.shots.length) throw new Error("Los clips son muy cortos para armar el recorrido");
  const edl: TourEdl = {
    type: "tour",
    fps: 30,
    width: 1080,
    height: 1920,
    duration: plan.duration,
    bpm,
    shots: plan.shots,
    beats: plan.beats,
    property,
    copy: { headline: copy.headline, highlights: copy.highlights, cta: copy.cta },
    rooms: copy.rooms,
    music: music ? { ...music, volume: style.music?.volume ?? 0.3 } : null,
  };
  log(`   recorrido: ${plan.shots.length} tomas · ${plan.duration.toFixed(1)} s · cuartos: ${copy.rooms.filter(Boolean).join(", ")}`);
  return { edl, styleId: style.id, clips };
}
