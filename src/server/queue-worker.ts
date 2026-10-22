/**
 * Worker: revisa las carpetas de Dropbox de "Aprobar videos".
 * Baja los videos nuevos (se salta los que ya están, por contenido aunque les cambien el nombre),
 * los sube al storage, la IA prepara copy y 3 textos virales, y le avisa al cliente por correo.
 * Solo lo usa el worker (ffmpeg + Whisper).
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listDropboxFolder, mimeFor } from "../lib/dropbox";
import { withFooter } from "../lib/ai/caption";
import { runWithClient } from "../lib/usage";
import { analyzeMedia, shrinkVideo } from "./auto-caption";
import { clientFooter, generateCaptions, generateHooks } from "./captions";
import { notifyNewForApproval } from "./queue-notify";

const MAX_PER_RUN = 6; // si hay más, sigue en la siguiente vuelta
const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB) || 50;

type Folder = { id: string; client_id: string; name: string; dropbox_url: string };

export async function scanFolders(db: SupabaseClient, log: (m: string) => void) {
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { data } = await db
    .from("content_folders")
    .select("id, client_id, name, dropbox_url")
    .or(`refresh_requested_at.not.is.null,and(auto_check.eq.true,or(last_checked_at.is.null,last_checked_at.lt.${hourAgo}))`)
    .order("refresh_requested_at", { ascending: true, nullsFirst: false })
    .limit(2);
  let did = false;
  for (const folder of (data ?? []) as Folder[]) {
    await db.from("content_folders").update({ refresh_requested_at: null, last_checked_at: new Date().toISOString(), last_result: "Revisando la carpeta..." }).eq("id", folder.id);
    did = true;
    try {
      const r = await runWithClient(folder.client_id, () => scanFolder(db, folder, log));
      const parts = [
        r.added ? `${r.added} nuevo${r.added > 1 ? "s" : ""}` : "",
        r.replaced ? `${r.replaced} corregido${r.replaced > 1 ? "s" : ""}` : "",
      ].filter(Boolean);
      const msg = parts.length
        ? `${parts.join(" y ")} para aprobar${r.more ? ", siguen más" : ""}`
        : r.failed
          ? `${r.failed} no se pudieron preparar`
          : "Sin videos nuevos";
      await db
        .from("content_folders")
        .update({ last_result: msg, ...(r.more ? { refresh_requested_at: new Date().toISOString() } : {}) })
        .eq("id", folder.id);
      if (r.added || r.replaced) await notifyNewForApproval(db, folder.client_id, r.added + r.replaced, log);
    } catch (e) {
      log(`✗ carpeta ${folder.name}: ${(e as Error).message}`);
      await db.from("content_folders").update({ last_result: `Error: ${(e as Error).message}`.slice(0, 300) }).eq("id", folder.id);
    }
  }
  return did;
}

async function scanFolder(db: SupabaseClient, folder: Folder, log: (m: string) => void) {
  log(`→ revisando carpeta "${folder.name}"`);
  const files = await listDropboxFolder(folder.dropbox_url);
  const [{ data: known }, { data: posted }] = await Promise.all([
    db.from("queue_items").select("id, file_hash, file_name, status, version, created_at").eq("client_id", folder.client_id).eq("folder_id", folder.id).order("created_at"),
    db.from("scheduled_posts").select("media_name").eq("client_id", folder.client_id).eq("dropbox_url", folder.dropbox_url).not("media_name", "is", null),
  ]);
  const { data: allHashes } = await db.from("queue_items").select("file_hash").eq("client_id", folder.client_id);
  const hashes = new Set((allHashes ?? []).map((k) => k.file_hash));
  // el último video de la carpeta con ese nombre (para detectar versiones corregidas)
  const byName = new Map((known ?? []).map((k) => [k.file_name as string, k as { id: string; status: string; version: number }]));
  const alreadyPosted = new Set((posted ?? []).map((p) => p.media_name as string));
  const footer = await clientFooter(db, folder.client_id);

  let added = 0;
  let replaced = 0;
  let failed = 0;
  let more = false;
  for (const f of files) {
    if (alreadyPosted.has(f.name) && !byName.has(f.name)) continue;
    if (added + replaced + failed >= MAX_PER_RUN) {
      more = true;
      break;
    }
    const raw = await f.read();
    const hash = createHash("sha256").update(raw).digest("hex");
    if (hashes.has(hash)) continue;
    hashes.add(hash);

    // mismo nombre que uno que todavía no se publica = el editor lo corrigió: se reemplaza en la misma tarjeta
    const prev = byName.get(f.name);
    if (prev && ["pending", "approved", "rejected"].includes(prev.status)) {
      try {
        const media = f.kind === "video" ? shrinkVideo(raw, f.name, MAX_UPLOAD_MB) : { buffer: raw, name: f.name };
        const ext = (media.name.split(".").pop() || "mp4").toLowerCase();
        const version = (prev.version ?? 1) + 1;
        const mediaPath = `${folder.client_id}/queue/${prev.id}-v${version}.${ext}`;
        const { error: upErr } = await db.storage.from("recordings").upload(mediaPath, media.buffer, { contentType: mimeFor(media.name), upsert: true });
        if (upErr) throw new Error(`No se pudo guardar el video: ${upErr.message}`);
        await db
          .from("queue_items")
          .update({ file_hash: hash, file_size: f.size, media_path: mediaPath, version, replaced_at: new Date().toISOString(), status: "pending", approved_at: null, overlay_text: null, error: null })
          .eq("id", prev.id);
        log(`   ↺ ${f.name}: versión ${version} (se conserva el copy)`);
        replaced++;
      } catch (e) {
        failed++;
        log(`   ✗ ${f.name}: ${(e as Error).message}`);
      }
      continue;
    }

    const { data: item } = await db
      .from("queue_items")
      .insert({ client_id: folder.client_id, folder_id: folder.id, file_name: f.name, file_hash: hash, file_size: f.size, kind: f.kind, status: "processing" })
      .select("id")
      .single();
    if (!item) continue; // ya existía (otro worker)
    log(`   preparando ${f.name}`);
    try {
      const media = f.kind === "video" ? shrinkVideo(raw, f.name, MAX_UPLOAD_MB) : { buffer: raw, name: f.name };
      const ext = (media.name.split(".").pop() || "mp4").toLowerCase();
      const mediaPath = `${folder.client_id}/queue/${item.id}.${ext}`;
      const { error: upErr } = await db.storage.from("recordings").upload(mediaPath, media.buffer, { contentType: mimeFor(media.name), upsert: true });
      if (upErr) throw new Error(`No se pudo guardar el video: ${upErr.message}`);

      const { frames, transcript } = await analyzeMedia(db, folder.client_id, { buffer: media.buffer, name: media.name, kind: f.kind });
      // 3 opciones de copy; si el editor dejó un .txt, ese va primero y es el que queda escogido
      const options = (await generateCaptions(db, folder.client_id, { frames, transcript })).options;
      if (f.caption) options.unshift({ kind: "editor", text: withFooter(f.caption, footer) });
      const hooks = f.kind === "video" ? (await generateHooks(db, folder.client_id, { frames, transcript })).hooks : [];
      await db
        .from("queue_items")
        .update({ media_path: mediaPath, caption: options[0].text.slice(0, 2200), captions: options, transcript, hooks, status: "pending", error: null })
        .eq("id", item.id);
      added++;
    } catch (e) {
      failed++;
      log(`   ✗ ${f.name}: ${(e as Error).message}`);
      await db.from("queue_items").update({ status: "failed", error: (e as Error).message.slice(0, 500) }).eq("id", item.id);
    }
  }
  log(`   listo: ${added} nuevos${replaced ? `, ${replaced} corregidos` : ""}${failed ? `, ${failed} con error` : ""}${more ? " (siguen más)" : ""}`);
  return { added, replaced, failed, more };
}
