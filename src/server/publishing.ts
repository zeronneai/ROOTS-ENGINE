/**
 * Publicación programada: guarda el post, consigue el video (del motor, subido o de Dropbox)
 * y lo manda a Zernio, que lo publica a la hora indicada aunque ninguna compu esté prendida.
 * Los posts con video de Dropbox esperan (waiting_media) y el worker los resuelve 15 min antes.
 * Sin "server-only": el worker también lo usa.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPost, deletePost, ensureProfile, getPost, listAccounts, mapStatus, postResults, uploadMedia, SOCIAL_PLATFORMS } from "../lib/zernio";
import { fetchDropboxMedia, isDropboxFolder, mimeFor } from "../lib/dropbox";
import { withFooter } from "../lib/ai/caption";
import { clientFooter } from "./captions";
import { runWithClient } from "../lib/usage";

export type PostRow = {
  id: string;
  client_id: string;
  caption: string;
  title: string | null;
  accounts: { platform: string; accountId: string; label?: string }[];
  scheduled_for: string;
  timezone: string;
  media_source: "edit" | "upload" | "dropbox_file" | "dropbox_folder" | "none";
  edit_id: string | null;
  media_path: string | null;
  dropbox_url: string | null;
  media_name: string | null;
  status: string;
  zernio_post_id: string | null;
};

/** El profile de Zernio del cliente (lo crea y lo guarda la primera vez). */
export async function clientProfile(db: SupabaseClient, clientId: string) {
  const { data: client, error } = await db.from("clients").select("id, name, zernio_profile_id").eq("id", clientId).single();
  if (error || !client) throw new Error("Cliente no encontrado");
  const id = await ensureProfile(client);
  if (id !== client.zernio_profile_id) await db.from("clients").update({ zernio_profile_id: id }).eq("id", clientId);
  return id;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function schedulePost(db: SupabaseClient, clientId: string, userId: string | null, body: Record<string, unknown>) {
  const source = String(body.source ?? "");
  if (!["edit", "upload", "dropbox_file", "dropbox_folder", "none"].includes(source)) throw new Error("Escoge de dónde sale el video");
  const when = new Date(String(body.scheduledFor ?? ""));
  if (isNaN(when.getTime())) throw new Error("Fecha y hora inválidas");
  if (when.getTime() < Date.now() - 5 * 60_000) throw new Error("Esa hora ya pasó");

  // solo cuentas conectadas de este cliente
  const profileId = await clientProfile(db, clientId);
  const mine = await listAccounts(profileId);
  const wanted = (Array.isArray(body.accountIds) ? body.accountIds : []).map(String);
  const accounts = mine.filter((a) => wanted.includes(a.id)).map((a) => ({ platform: a.platform, accountId: a.id, label: a.name }));
  if (!accounts.length) throw new Error("Escoge al menos una cuenta");

  const caption = str(body.caption, 2200);
  const row = {
    client_id: clientId,
    caption,
    title: str(body.title, 100) || null,
    accounts,
    scheduled_for: when.toISOString(),
    timezone: str(body.timezone, 60) || "America/Denver",
    media_source: source,
    edit_id: source === "edit" ? str(body.editId, 60) || null : null,
    media_path: source === "upload" ? str(body.mediaPath, 300) || null : null,
    dropbox_url: source.startsWith("dropbox") ? str(body.dropboxUrl, 600) || null : null,
    idea_id: str(body.ideaId, 60) || null,
    created_by: userId,
  };
  if (source === "edit" && !row.edit_id) throw new Error("Escoge el video");
  if (source === "upload" && (!row.media_path || !row.media_path.startsWith(`${clientId}/`) || row.media_path.includes(".."))) throw new Error("Sube el archivo");
  if (source.startsWith("dropbox")) {
    if (!row.dropbox_url || !/dropbox\.com\//i.test(row.dropbox_url)) throw new Error("Pega un link de Dropbox");
    if (source === "dropbox_folder" && !isDropboxFolder(row.dropbox_url)) throw new Error("Ese link no es de una carpeta. Usa la opción de archivo o comparte la carpeta.");
  }
  if (source === "none" && accounts.some((a) => a.platform !== "facebook")) throw new Error("Instagram, TikTok y YouTube necesitan video o imagen");

  const { data: saved, error } = await db.from("scheduled_posts").insert(row).select("*").single();
  if (error) throw error;
  // si ya tenemos el video, se manda de una vez a Zernio (así no depende de que el worker esté prendido)
  if (!source.startsWith("dropbox")) await pushPost(db, saved as PostRow);
  return saved.id as string;
}

/** Consigue el archivo del post. */
async function resolveMedia(db: SupabaseClient, row: PostRow): Promise<{ buffer: Buffer; name: string; kind: "video" | "image"; caption?: string | null } | null> {
  if (row.media_source === "none") return null;
  if (row.media_source === "edit") {
    const { data: edit } = await db.from("edits").select("output_path, status").eq("id", row.edit_id).eq("client_id", row.client_id).single();
    if (!edit?.output_path) throw new Error("Ese video todavía no está exportado");
    const { data, error } = await db.storage.from("renders").download(edit.output_path);
    if (error || !data) throw new Error("No se pudo leer el video del motor");
    return { buffer: Buffer.from(await data.arrayBuffer()), name: edit.output_path.split("/").pop() ?? "video.mp4", kind: "video" };
  }
  if (row.media_source === "upload") {
    const { data, error } = await db.storage.from("recordings").download(row.media_path!);
    if (error || !data) throw new Error("No se pudo leer el archivo subido");
    const name = row.media_path!.split("/").pop() ?? "video.mp4";
    return { buffer: Buffer.from(await data.arrayBuffer()), name, kind: /\.(jpe?g|png|webp)$/i.test(name) ? "image" : "video" };
  }
  // Dropbox: en carpetas, no repetir archivos que ya usamos con el mismo link
  const used = row.media_source === "dropbox_folder" ? await usedNames(db, row.dropbox_url!, row.id) : [];
  const m = await fetchDropboxMedia(row.dropbox_url!, used);
  await db.from("scheduled_posts").update({ media_name: m.name }).eq("id", row.id);
  return m;
}

/** Archivos de una carpeta de Dropbox que ya se usaron en otros posts. */
export async function usedNames(db: SupabaseClient, dropboxUrl: string, exceptId?: string) {
  let q = db.from("scheduled_posts").select("media_name").eq("dropbox_url", dropboxUrl).not("media_name", "is", null).neq("status", "failed");
  if (exceptId) q = q.neq("id", exceptId);
  const { data } = await q;
  return (data ?? []).map((r) => r.media_name as string);
}

/** Manda el post a Zernio. */
/** El worker le pasa autoCaption (ffmpeg + Whisper); en Vercel no existe y el copy queda como está. */
export type AutoCaptionFn = (db: SupabaseClient, clientId: string, media: { buffer: Buffer; name: string; kind: "video" | "image" }, platforms: string[]) => Promise<string>;

export async function pushPost(db: SupabaseClient, input: PostRow, opts: { autoCaption?: AutoCaptionFn } = {}) {
  let row = input;
  try {
    const media = await resolveMedia(db, row);
    let caption = row.caption;
    if (media?.caption) {
      // el copy puede venir en un .txt junto al video en Dropbox
      caption = media.caption;
    } else if (!caption.trim() && media && row.media_source.startsWith("dropbox")) {
      // sin .txt y sin copy: la IA lo escribe viendo el video (corre en el worker)
      try {
        const write = opts.autoCaption;
        if (write) caption = await runWithClient(row.client_id, () => write(db, row.client_id, media, row.accounts.map((a) => a.platform)));
      } catch (e) {
        console.warn(`   no se pudo escribir el copy con IA: ${(e as Error).message}`);
      }
    }
    // el cierre fijo del cliente (ej. teléfono) siempre va
    caption = withFooter(caption, await clientFooter(db, row.client_id)).slice(0, 2200);
    if (caption !== row.caption) {
      row = { ...row, caption };
      await db.from("scheduled_posts").update({ caption }).eq("id", row.id);
    }
    const mediaUrl = media ? await uploadMedia(media.buffer, media.name.replace(/[^\w.-]+/g, "_"), mimeFor(media.name)) : null;
    const { id, post } = await createPost({
      caption: row.caption,
      title: row.title,
      mediaUrl,
      mediaType: media?.kind ?? "video",
      accounts: row.accounts,
      scheduledFor: new Date(row.scheduled_for),
      timezone: row.timezone,
      ref: row.id,
    });
    await db
      .from("scheduled_posts")
      .update({ zernio_post_id: id, status: mapStatus(post) ?? "scheduled", results: postResults(post), error: null })
      .eq("id", row.id);
  } catch (e) {
    await db.from("scheduled_posts").update({ status: "failed", error: (e as Error).message.slice(0, 500) }).eq("id", row.id);
    throw e;
  }
}

/** Revisa en Zernio cómo van los posts cuya hora ya pasó (por si no llegó el webhook). */
export async function syncPosts(db: SupabaseClient, clientId: string) {
  const { data } = await db
    .from("scheduled_posts")
    .select("id, zernio_post_id")
    .eq("client_id", clientId)
    .eq("status", "scheduled")
    .not("zernio_post_id", "is", null)
    .lt("scheduled_for", new Date(Date.now() - 60_000).toISOString())
    .limit(10);
  for (const r of data ?? []) {
    try {
      const post = await getPost(r.zernio_post_id!);
      const st = mapStatus(post);
      if (st && st !== "scheduled") await db.from("scheduled_posts").update({ status: st, results: postResults(post) }).eq("id", r.id);
    } catch {
      // se reintenta en la siguiente visita
    }
  }
}

/** Cancela un post (en Zernio también, si ya estaba allá). */
export async function cancelPost(db: SupabaseClient, clientId: string, postId: string) {
  const { data: row } = await db.from("scheduled_posts").select("*").eq("id", postId).eq("client_id", clientId).single();
  if (!row) throw new Error("No encontré el post");
  if (row.zernio_post_id && row.status === "scheduled") await deletePost(row.zernio_post_id);
  await db.from("scheduled_posts").update({ status: "canceled" }).eq("id", postId);
}

/** Worker: posts con video de Dropbox que se publican en los próximos 15 min. */
export async function resolveWaitingPosts(db: SupabaseClient, log: (m: string) => void, autoCaption?: AutoCaptionFn) {
  const { data } = await db
    .from("scheduled_posts")
    .select("*")
    .eq("status", "waiting_media")
    .lte("scheduled_for", new Date(Date.now() + 15 * 60_000).toISOString())
    .order("scheduled_for")
    .limit(3);
  for (const row of (data ?? []) as PostRow[]) {
    // lo marcamos para que otro worker no lo tome al mismo tiempo
    const { data: claimed } = await db.from("scheduled_posts").update({ status: "scheduled" }).eq("id", row.id).eq("status", "waiting_media").select("id");
    if (!claimed?.length) continue;
    log(`→ publicando ${row.id} (${row.accounts.map((a) => SOCIAL_PLATFORMS[a.platform as keyof typeof SOCIAL_PLATFORMS] ?? a.platform).join(", ")}) con video de Dropbox`);
    try {
      await pushPost(db, row, { autoCaption });
      log("   listo, enviado a Zernio");
    } catch (e) {
      log(`   falló: ${(e as Error).message}`);
    }
  }
  return (data ?? []).length > 0;
}
