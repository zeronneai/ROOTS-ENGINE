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
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { supabaseAdmin } from "../src/lib/supabase/admin";
import { transcribeWords } from "../src/lib/transcribe";
import { detectSilences, fitWordsToSilences, type AudioStats, type Silence } from "../src/lib/silence";
import { directEdit } from "../src/lib/ai/direct-edit";
import { moodFromDescription } from "../src/lib/ai/mood";
import { mergeClips } from "../src/lib/merge-clips";
import { assetUrlsForEdl, signedAssets } from "../src/lib/assets";
import { sanitizeOverrides } from "../src/lib/styles/sanitize";
import { deepMerge } from "../src/lib/styles/merge";
import { buildEdl } from "../src/lib/edl/build";
import { getClientContext, styleForClient } from "../src/server/engine";
import { renderAutoEdit } from "../src/server/render";
import type { Word } from "../src/lib/edl/types";
import type { Direction } from "../src/lib/edl/build";

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
  try {
    console.log(`→ transcribiendo ${edit.id}`);
    let file = await download(edit.recordings.storage_path, dir);
    const extra: string[] = edit.extra_paths ?? [];
    if (extra.length) {
      console.log(`   uniendo ${extra.length + 1} clips...`);
      const files = [file];
      for (const p of extra) files.push(await download(p, dir));
      file = mergeClips(files, dir);
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
    if (!t.words.length) throw new Error("No se detectó voz en el video");
    const { silences, stats } = detectSilences(file);
    const words = fitWordsToSilences(t.words, silences);
    const pauses = silences.filter((s) => s.end - s.start >= 0.3).length;
    console.log(`   ${words.length} palabras · ${pauses} pausas detectadas · "${t.text.slice(0, 70)}${t.text.length > 70 ? "..." : ""}"`);
    if (stats) console.log(`   audio: ruido ${stats.floorDb} dB · voz ${stats.speechDb} dB · corte bajo ${stats.thresholdDb} dB`);
    const transcript: StoredTranscript = { text: t.text, words, silences, audio: stats, ...meta };
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
    const direction = await directEdit({ words: tr.words, style, brand: ctx.brand.data, idea, notes, assets });
    const edl = buildEdl({ words: tr.words, sourceDuration: tr.duration, style, direction });
    const cutSecs = tr.duration - edl.segments.reduce((a, s) => a + s.end - s.start, 0);
    console.log(
      `   estilo ${style.name} · cortes: ${edl.segments.length - 1} (${cutSecs.toFixed(1)}s fuera, ${direction.removeWords.length} palabras malas)` +
        ` · zooms: ${edl.zooms.length} · emojis: ${edl.emojis.length} · textos animados: ${edl.callouts?.length ?? 0}` +
        ` · imágenes: ${edl.images?.length ?? 0}`,
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
  return true;
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
    await renderAutoEdit(
      {
        src: signed.signedUrl,
        edl: edit.edl,
        style,
        brand: { name: ctx.client.name, handle: ctx.client.instagram ?? undefined },
        assetUrls: await assetUrlsForEdl(db, edit.edl),
      },
      out,
      (p) => {
        const pct = Math.round(p * 100);
        if (pct - lastPct >= 10) {
          lastPct = pct;
          console.log(`   ${pct}%`);
        }
      },
    );
    const outputPath = `${edit.client_id}/${edit.id}.mp4`;
    const { error: upErr } = await db.storage
      .from("renders")
      .upload(outputPath, readFileSync(out), { contentType: "video/mp4", upsert: true });
    if (upErr) throw upErr;
    await db.from("edits").update({ status: "done", output_path: outputPath }).eq("id", edit.id);
    if (edit.idea_id) await db.from("content_ideas").update({ status: "edited" }).eq("id", edit.idea_id);
    console.log(`✓ listo ${edit.id}`);
  } catch (e) {
    await fail(edit.id, e);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return true;
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
