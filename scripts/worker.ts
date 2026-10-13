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
import { directEdit } from "../src/lib/ai/direct-edit";
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
    const file = await download(edit.recordings.storage_path, dir);
    const meta = probe(file);
    const { data: client } = await db.from("clients").select("language").eq("id", edit.client_id).single();
    const t = await transcribeWords(file, client?.language);
    if (!t.words.length) throw new Error("No se detectó voz en el video");
    const transcript: StoredTranscript = { text: t.text, words: t.words, ...meta };
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
    const style = styleForClient(ctx, { moodId: edit.mood_id, edit: edit.style_overrides, presetId: edit.style_id });
    const tr = edit.transcript as StoredTranscript;
    const idea = edit.content_ideas ? { title: edit.content_ideas.title, hooks: edit.content_ideas.hooks } : null;
    const direction = await directEdit({ words: tr.words, style, brand: ctx.brand.data, idea });
    const edl = buildEdl({ words: tr.words, sourceDuration: tr.duration, style, direction });
    await db
      .from("edits")
      .update({
        transcript: { ...tr, direction },
        edl,
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
      .createSignedUrl(edit.recordings.storage_path, 60 * 60 * 6);
    if (error || !signed) throw new Error(`URL firmada: ${error?.message}`);

    const out = path.join(dir, `${edit.id}.mp4`);
    let lastPct = -10;
    await renderAutoEdit(
      { src: signed.signedUrl, edl: edit.edl, style, brand: { name: ctx.client.name, handle: ctx.client.instagram ?? undefined } },
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
