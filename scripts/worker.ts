/**
 * ROOTS ENGINE worker: transcribe, dirige y renderiza las ediciones.
 * Corre en una compu o servidor con ffmpeg (no en Vercel):
 *   npm run worker
 *
 * Flujo de `edits.status`:
 *   queued → transcribing → directing → review → (aprobado en el portal) render_queued → rendering → done
 *   mode = 'agency' → agency_editing (lo toma el equipo de PRA)
 */
import "./load-env";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { supabaseAdmin } from "../src/lib/supabase/admin";
import { transcribeWords } from "../src/lib/transcribe";
import { detectSilences, fitWordsToSilences, type AudioStats, type Silence } from "../src/lib/silence";
import { directEdit } from "../src/lib/ai/direct-edit";
import { moodFromDescription } from "../src/lib/ai/mood";
import { mergeClips } from "../src/lib/merge-clips";
import { assetUrlsForEdl, signedAssets } from "../src/lib/assets";
import { PRICES, recordUsage, runWithClient } from "../src/lib/usage";
import { prepareTour } from "../src/lib/tour/prepare";
import { chooseMusic, loadTracks } from "../src/lib/music";
import { sanitizeOverrides } from "../src/lib/styles/sanitize";
import { deepMerge } from "../src/lib/styles/merge";
import { buildEdl, detectBroll } from "../src/lib/edl/build";
import { detectBeats } from "../src/lib/beats";
import { isNeutral, measureClipGrades, type ClipGrade } from "../src/lib/grade";
import { getClientContext, styleForClient } from "../src/server/engine";
import { renderAutoEdit } from "../src/server/render";
import type { Word } from "../src/lib/edl/types";
import type { BrollCopy, Direction } from "../src/lib/edl/build";
import { hybridCopy } from "../src/lib/tour/hybrid";

const db = supabaseAdmin();
const AUTO_RENDER = process.env.AUTO_RENDER === "true";
const POLL_MS = 5000;

export type StoredTranscript = {
  text: string;
  words: Word[];
  duration: number;
  width: number;
  height: number;
  silences?: Silence[];
  audio?: AudioStats | null;
  /** dónde empieza y termina cada clip cuando se subieron varios */
  clips?: { start: number; end: number }[];
  /** corrección de color medida por clip */
  grades?: { start: number; end: number; grade: ClipGrade }[];
  /** híbrido: nombre de cada toma sin voz, datos y frases */
  brollCopy?: BrollCopy;
  direction?: Direction;
};

async function claim(from: string, to: string) {
  const { data } = await db.from("edits").select("id").eq("status", from).order("created_at").limit(1);
  if (!data?.length) return null;
  const { data: claimed } = await db
    .from("edits")
    .update({ status: to, error: null })
    .eq("id", data[0].id)
    .eq("status", from)
    .select("*, recordings(storage_path), content_ideas(title, hooks)")
    .maybeSingle();
  return claimed;
}

async function download(storagePath: string, dir: string) {
  const { data, error } = await db.storage.from("recordings").download(storagePath);
  if (error || !data) throw new Error(`No se pudo bajar ${storagePath}: ${error?.message}`);
  const file = path.join(dir, path.basename(storagePath));
  writeFileSync(file, Buffer.from(await data.arrayBuffer()));
  return file;
}

function probe(file: string) {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", file,
  ]).toString();
  const j = JSON.parse(out);
  let duration = Number(j.format?.duration);
  if (!Number.isFinite(duration)) {
    // webm de navegador a veces no trae duración: la sacamos decodificando
    const log = spawnSync("ffmpeg", ["-v", "info", "-i", file, "-f", "null", "-"], { encoding: "utf8" }).stderr ?? "";
    const m = [...log.matchAll(/time=(\d+):(\d+):([\d.]+)/g)].pop();
    duration = m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : NaN;
  }
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("No se pudo leer la duración del video");
  return { duration, width: j.streams?.[0]?.width ?? 1080, height: j.streams?.[0]?.height ?? 1920 };
}

async function fail(id: string, err: unknown) {
  console.error(`✗ edit ${id}`, err);
  await db.from("edits").update({ status: "failed", error: String((err as Error)?.message ?? err) }).eq("id", id);
}

// ── 1. transcribir ──
async function stepTranscribe() {
  const edit = await claim("queued", "transcribing");
  if (!edit) return false;
  if (edit.mode === "agency") {
    await db.from("edits").update({ status: "agency_editing" }).eq("id", edit.id);
    return true;
  }
  const dir = mkdtempSync(path.join(tmpdir(), "roots-"));
  if (edit.kind === "tour") {
    try {
      console.log(`→ preparando recorrido ${edit.id}`);
      const { edl, styleId, clips } = await runWithClient(edit.client_id, () => prepareTour(db, edit, dir, console.log));
      await db
        .from("edits")
        .update({
          edl,
          transcript: { tour: true, clips, duration: edl.duration, words: [] },
          style_id: edit.style_id ?? styleId,
          status: AUTO_RENDER ? "render_queued" : "review",
        })
        .eq("id", edit.id);
    } catch (e) {
      await fail(edit.id, e);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    return true;
  }
  try {
    console.log(`→ transcribiendo ${edit.id}`);
    let file = await download(edit.recordings.storage_path, dir);
    let clips: { start: number; end: number }[] | undefined;
    const extra: string[] = edit.extra_paths ?? [];
    if (extra.length) {
      console.log(`   uniendo ${extra.length + 1} clips...`);
      const files = [file];
      for (const p of extra) files.push(await download(p, dir));
      const merged = mergeClips(files, dir);
      file = merged.file;
      clips = merged.clips;
      const sourcePath = `${edit.client_id}/${edit.id}-unido.mp4`;
      const { error: upErr } = await db.storage
        .from("recordings")
        .upload(sourcePath, readFileSync(file), { contentType: "video/mp4", upsert: true });
      if (upErr) throw new Error(`No se pudo guardar el video unido (${upErr.message}). Si es muy largo, súbelo en menos clips.`);
      await db.from("edits").update({ source_path: sourcePath }).eq("id", edit.id);
    }
    const meta = probe(file);
    const { data: client } = await db.from("clients").select("language").eq("id", edit.client_id).single();
    const t = await transcribeWords(file, client?.language);
    if (!t.words.length && !clips) throw new Error("No se detectó voz en el video. Si son tomas sin hablar, súbelo como Cinemático o Recorrido.");
    const { silences, stats } = detectSilences(file);
    const words = fitWordsToSilences(t.words, silences);
    const pauses = silences.filter((s) => s.end - s.start >= 0.3).length;
    console.log(`   ${words.length} palabras · ${pauses} pausas detectadas · "${t.text.slice(0, 70)}${t.text.length > 70 ? "..." : ""}"`);
    if (stats) console.log(`   audio: ruido ${stats.floorDb} dB · voz ${stats.speechDb} dB · corte bajo ${stats.thresholdDb} dB`);
    // corrección automática de color: una medición por clip (o una para todo el video)
    const ranges = clips ?? [{ start: 0, end: meta.duration }];
    const grades = measureClipGrades(file, ranges).map((grade, i) => ({ ...ranges[i], grade }));
    const fixed = grades.filter((g) => !isNeutral(g.grade)).length;
    if (fixed) console.log(`   color: corrigiendo ${fixed} de ${grades.length} clip(s)`);
    // híbrido: la IA ve las tomas sin voz para ponerles nombre, datos y frases
    let brollCopy: BrollCopy | undefined;
    const brollClips = detectBroll(words, clips, edit.clip_modes ?? []);
    if (brollClips.length) {
      try {
        brollCopy = await runWithClient(edit.client_id, () => hybridCopy(db, edit, file, brollClips, dir));
        console.log(`   tomas: ${brollCopy.labels.filter(Boolean).join(", ") || "sin nombre"} · ${brollCopy.specs.length} dato(s) · ${brollCopy.highlights.length} frase(s)`);
      } catch (e) {
        console.error("   no se pudieron escribir los textos de las tomas", e);
      }
    }
    const transcript: StoredTranscript = { text: t.text, words, silences, audio: stats, clips, grades, brollCopy, ...meta };
    await db.from("edits").update({ transcript, status: "directing" }).eq("id", edit.id);
  } catch (e) {
    await fail(edit.id, e);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return true;
}

// ── 2. dirigir (Claude decide cortes, zooms, emojis) ──
async function stepDirect() {
  const edit = await claim("directing", "directing_claimed");
  if (!edit) return false;
  await runWithClient(edit.client_id, () => directOne(edit));
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function directOne(edit: any) {
  try {
    console.log(`→ dirigiendo ${edit.id}`);
    const ctx = await getClientContext(db, edit.client_id);
    let overrides = edit.style_overrides ?? {};
    const notes: string | null = edit.notes?.trim() || null;
    if (notes && edit.mode === "auto") {
      // "más motion graphics", "textos en 3D", "más elegante": se vuelve ajuste de estilo de este video
      try {
        const base = styleForClient(ctx, { moodId: edit.mood_id, edit: overrides, presetId: edit.style_id });
        const asked = await moodFromDescription({ description: notes, currentStyle: base });
        overrides = sanitizeOverrides(deepMerge(asked.overrides as Record<string, unknown>, overrides as Record<string, unknown>));
        console.log(`   instrucciones: "${notes.slice(0, 80)}" → ${JSON.stringify(overrides)}`);
      } catch (e) {
        console.error("   no se pudieron convertir las instrucciones a estilo", e);
      }
    }
    const style = styleForClient(ctx, { moodId: edit.mood_id, edit: overrides, presetId: edit.style_id });
    const tr = edit.transcript as StoredTranscript;
    const idea = edit.content_ideas ? { title: edit.content_ideas.title, hooks: edit.content_ideas.hooks } : null;
    const assets = await signedAssets(db, edit.assets);
    if (assets.length) console.log(`   ${assets.length} imagen(es) del cliente`);
    const tracks = await loadTracks(db, edit.client_id);
    const direction = await directEdit({
      words: tr.words,
      style,
      brand: ctx.brand.data,
      idea,
      notes,
      assets,
      tracks: tracks.map((t) => ({ title: t.title, moods: t.moods, energy: t.energy, own: !!t.client_id })),
    });
    direction.music = chooseMusic({ mode: edit.music_mode, musicId: edit.music_id, tracks, aiPick: direction.musicTrack, style });
    if (direction.music) console.log(`   música: ${direction.music.title}`);
    // video híbrido: clips sin voz entran como tomas, del largo de unos golpes de la canción
    direction.grades = tr.grades;
    direction.brollCopy = tr.brollCopy;
    direction.broll = detectBroll(tr.words, tr.clips, edit.clip_modes ?? []);
    if (direction.broll.length) {
      if (direction.music) {
        const dir = mkdtempSync(path.join(tmpdir(), "roots-m-"));
        try {
          const { data } = await db.storage.from("brand").download(direction.music.path);
          if (data) {
            const song = path.join(dir, `song${path.extname(direction.music.path) || ".mp3"}`);
            writeFileSync(song, Buffer.from(await data.arrayBuffer()));
            const { bpm } = detectBeats(song);
            const beat = 60 / bpm;
            direction.brollShot = +(beat * (beat * 4 > 2.8 ? 2 : 4)).toFixed(3);
          }
        } catch (e) {
          console.error("   no se pudo leer el ritmo de la canción", e);
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      }
      console.log(`   híbrido: ${direction.broll.length} clip(s) de tomas sin voz${direction.brollShot ? ` · tomas de ${direction.brollShot}s` : ""}`);
    }
    const edl = buildEdl({ words: tr.words, sourceDuration: tr.duration, style, direction });
    const cutSecs = tr.duration - edl.segments.reduce((a, s) => a + s.end - s.start, 0);
    console.log(
      `   estilo ${style.name} · cortes: ${edl.segments.length - 1} (${cutSecs.toFixed(1)}s fuera, ${direction.removeWords.length} palabras malas)` +
        ` · zooms: ${edl.zooms.length} · emojis: ${edl.emojis.length} · textos animados: ${edl.callouts?.length ?? 0}` +
        ` · imágenes: ${edl.images?.length ?? 0}` +
        (direction.broll?.length ? ` · tomas sin voz: ${edl.segments.filter((s) => s.broll).length}` : ""),
    );
    await db
      .from("edits")
      .update({
        transcript: { ...tr, direction },
        edl,
        style_overrides: overrides,
        style_id: edit.style_id ?? style.id,
        status: AUTO_RENDER ? "render_queued" : "review",
      })
      .eq("id", edit.id)
      .eq("status", "directing_claimed");
  } catch (e) {
    await fail(edit.id, e);
  }
}

// ── 3. render ──
async function stepRender() {
  const edit = await claim("render_queued", "rendering");
  if (!edit) return false;
  const dir = mkdtempSync(path.join(tmpdir(), "roots-r-"));
  try {
    console.log(`→ renderizando ${edit.id}`);
    const ctx = await getClientContext(db, edit.client_id);
    const style = styleForClient(ctx, { moodId: edit.mood_id, edit: edit.style_overrides, presetId: edit.style_id });
    const { data: signed, error } = await db.storage
      .from("recordings")
      .createSignedUrl(edit.source_path ?? edit.recordings.storage_path, 60 * 60 * 6);
    if (error || !signed) throw new Error(`URL firmada: ${error?.message}`);

    const out = path.join(dir, `${edit.id}.mp4`);
    let lastPct = -10;
    const progress = (p: number) => {
      const pct = Math.round(p * 100);
      if (pct - lastPct >= 10) {
        lastPct = pct;
        console.log(`   ${pct}%`);
      }
    };
    const musicPath: string | undefined = edit.edl?.music?.path;
    const musicUrl = musicPath ? (await db.storage.from("brand").createSignedUrl(musicPath, 60 * 60 * 6)).data?.signedUrl ?? null : null;
    const brand = { name: ctx.client.name, handle: ctx.client.instagram ?? undefined };
    if (edit.edl?.type === "tour") {
      const { data: logo } = await db.from("brand_assets").select("path").eq("client_id", edit.client_id).eq("category", "logo").limit(1).maybeSingle();
      const logoUrl = logo?.path ? (await db.storage.from("brand").createSignedUrl(logo.path, 60 * 60 * 6)).data?.signedUrl ?? null : null;
      await renderAutoEdit({ src: signed.signedUrl, edl: edit.edl, style, brand: { ...brand, logoUrl }, musicUrl }, out, progress, "Tour");
    } else {
      await renderAutoEdit(
        { src: signed.signedUrl, edl: edit.edl, style, brand, assetUrls: await assetUrlsForEdl(db, edit.edl), musicUrl },
        out,
        progress,
      );
    }
    const final = fitUnderLimit(out, dir);
    const outputPath = `${edit.client_id}/${edit.id}.mp4`;
    const { error: upErr } = await db.storage
      .from("renders")
      .upload(outputPath, readFileSync(final), { contentType: "video/mp4", upsert: true });
    if (upErr) throw upErr;
    await db.from("edits").update({ status: "done", output_path: outputPath }).eq("id", edit.id);
    await recordUsage({ kind: "render", detail: "Render de video", costUsd: PRICES.render, clientId: edit.client_id, units: { editId: edit.id } });
    if (edit.idea_id) await db.from("content_ideas").update({ status: "edited" }).eq("id", edit.idea_id);
    console.log(`✓ listo ${edit.id}`);
  } catch (e) {
    await fail(edit.id, e);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return true;
}

/**
 * El plan gratis de Supabase acepta archivos de hasta 50 MB (MAX_UPLOAD_MB para cambiarlo).
 * Si el MP4 se pasa, lo volvemos a comprimir calculando el bitrate para que quepa.
 */
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 50;
function fitUnderLimit(file: string, dir: string) {
  const limit = MAX_UPLOAD_MB * 1024 * 1024 * 0.92;
  const size = statSync(file).size;
  if (size <= limit) return file;
  const { duration } = probe(file);
  const audioKbps = 160;
  const videoKbps = Math.max(1500, Math.floor((limit * 8) / duration / 1000 - audioKbps));
  console.log(`   el MP4 pesa ${(size / 1e6).toFixed(0)} MB, comprimiendo a ~${(videoKbps / 1000).toFixed(1)} Mbps para que quepa...`);
  const out = path.join(dir, "final.mp4");
  execFileSync("ffmpeg", [
    "-v", "error", "-y", "-i", file,
    "-c:v", "libx264", "-preset", "medium", "-b:v", `${videoKbps}k`, "-maxrate", `${videoKbps}k`, "-bufsize", `${videoKbps * 2}k`,
    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", `${audioKbps}k`, "-movflags", "+faststart", out,
  ]);
  console.log(`   listo: ${(statSync(out).size / 1e6).toFixed(0)} MB`);
  return out;
}

/** Si el worker se cayó a medio proceso, regresa esas ediciones a la fila. */
async function sweepStale() {
  const cutoff = new Date(Date.now() - 45 * 60 * 1000).toISOString();
  const back: Record<string, string> = { transcribing: "queued", directing_claimed: "directing", rendering: "render_queued" };
  for (const [from, to] of Object.entries(back)) {
    await db.from("edits").update({ status: to }).eq("status", from).lt("updated_at", cutoff);
  }
}

function checkFfmpeg() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    console.error("✗ No encuentro ffmpeg. En Windows: winget install Gyan.FFmpeg  (y cierra y abre la terminal)");
    process.exit(1);
  }
}

async function loop() {
  checkFfmpeg();
  console.log(`ROOTS ENGINE worker arriba · transcripción: ${process.env.TRANSCRIBE_PROVIDER || "local"} · auto-render: ${AUTO_RENDER}`);
  await sweepStale();
  setInterval(sweepStale, 10 * 60 * 1000);
  for (;;) {
    const did = (await stepTranscribe()) || (await stepDirect()) || (await stepRender());
    if (!did) await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

loop();
