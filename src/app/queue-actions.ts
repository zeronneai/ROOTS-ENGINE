"use server";

import { revalidatePath } from "next/cache";
import { requireClientAccess } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isDropboxFolder } from "@/lib/dropbox";
import { clientProfile, schedulePost } from "@/server/publishing";
import { listAccounts } from "@/lib/zernio";

const page = (clientId: string) => revalidatePath(`/c/${clientId}/aprobar`);

async function agency(clientId: string) {
  const viewer = await requireClientAccess(clientId);
  if (viewer.role !== "agency") throw new Error("Solo la agencia");
  return viewer;
}

/** La agencia conecta una carpeta de Dropbox. Se revisa de una vez y luego cada hora. */
export async function addFolderAction(clientId: string, form: FormData) {
  await agency(clientId);
  const url = String(form.get("url") ?? "").trim();
  const name = String(form.get("name") ?? "").trim().slice(0, 60) || "Carpeta del editor";
  if (!/dropbox\.com\//i.test(url)) throw new Error("Pega el link de una carpeta de Dropbox");
  if (!isDropboxFolder(url)) throw new Error("Ese link no es de una carpeta. En Dropbox: Compartir la carpeta, copiar link.");
  await supabaseAdmin().from("content_folders").insert({ client_id: clientId, name, dropbox_url: url, refresh_requested_at: new Date().toISOString(), last_result: "En cola para revisar" });
  page(clientId);
}

/** "Buscar videos nuevos": el worker la revisa en cuanto se libere. */
export async function refreshFolderAction(clientId: string, folderId: string) {
  await agency(clientId);
  await supabaseAdmin()
    .from("content_folders")
    .update({ refresh_requested_at: new Date().toISOString(), last_result: "En cola para revisar" })
    .eq("id", folderId)
    .eq("client_id", clientId);
  page(clientId);
}

export async function toggleFolderAutoAction(clientId: string, folderId: string, auto: boolean) {
  await agency(clientId);
  await supabaseAdmin().from("content_folders").update({ auto_check: auto }).eq("id", folderId).eq("client_id", clientId);
  page(clientId);
}

export async function deleteFolderAction(clientId: string, folderId: string) {
  await agency(clientId);
  await supabaseAdmin().from("content_folders").delete().eq("id", folderId).eq("client_id", clientId);
  page(clientId);
}

/** Guarda el copy sin aprobar todavía. */
export async function saveItemCaptionAction(clientId: string, itemId: string, caption: string) {
  await requireClientAccess(clientId);
  await supabaseAdmin()
    .from("queue_items")
    .update({ caption: caption.replace(/\s*[—–]\s*/g, ", ").slice(0, 2200) })
    .eq("id", itemId)
    .eq("client_id", clientId)
    .in("status", ["pending", "approved"]);
  page(clientId);
}

/** Aprobar: queda en la fila. Si escogieron texto viral, el navegador ya subió el video con el texto. */
export async function approveItemAction(clientId: string, itemId: string, input: { caption: string; overlayText?: string | null; newMediaPath?: string | null }) {
  const viewer = await requireClientAccess(clientId);
  const update: Record<string, unknown> = {
    caption: input.caption.replace(/\s*[—–]\s*/g, ", ").slice(0, 2200),
    status: "approved",
    approved_at: new Date().toISOString(),
    approved_by: viewer.email ?? viewer.role,
  };
  if (input.newMediaPath) {
    if (!input.newMediaPath.startsWith(`${clientId}/queue/`) || input.newMediaPath.includes("..")) throw new Error("Archivo inválido");
    update.media_path = input.newMediaPath;
    update.overlay_text = input.overlayText?.slice(0, 200) ?? null;
  }
  const { error } = await supabaseAdmin().from("queue_items").update(update).eq("id", itemId).eq("client_id", clientId).in("status", ["pending", "approved"]);
  if (error) throw error;
  page(clientId);
}

export async function rejectItemAction(clientId: string, itemId: string) {
  await requireClientAccess(clientId);
  await supabaseAdmin().from("queue_items").update({ status: "rejected" }).eq("id", itemId).eq("client_id", clientId).in("status", ["pending", "approved"]);
  page(clientId);
}

/** Regresa un video a "por aprobar" (sale de la fila o se recupera de descartados). */
export async function backToPendingAction(clientId: string, itemId: string) {
  await requireClientAccess(clientId);
  await supabaseAdmin()
    .from("queue_items")
    .update({ status: "pending", approved_at: null })
    .eq("id", itemId)
    .eq("client_id", clientId)
    .in("status", ["approved", "rejected"]);
  page(clientId);
}

/** Si falló al prepararse, se borra para que la siguiente revisión lo vuelva a intentar. */
export async function retryItemAction(clientId: string, itemId: string) {
  await agency(clientId);
  const db = supabaseAdmin();
  const { data } = await db.from("queue_items").delete().eq("id", itemId).eq("client_id", clientId).eq("status", "failed").select("folder_id").maybeSingle();
  if (data?.folder_id) await db.from("content_folders").update({ refresh_requested_at: new Date().toISOString() }).eq("id", data.folder_id);
  page(clientId);
}

/** La agencia programa un aprobado a mano, en una fecha específica, fuera del calendario fijo. */
export async function scheduleItemAction(clientId: string, itemId: string, input: { when: string; timezone: string }) {
  const viewer = await agency(clientId);
  const db = supabaseAdmin();
  const { data: it } = await db.from("queue_items").select("*").eq("id", itemId).eq("client_id", clientId).eq("status", "approved").maybeSingle();
  if (!it?.media_path) throw new Error("Ese video ya no está en la fila");
  const accounts = await listAccounts(await clientProfile(db, clientId));
  if (!accounts.length) throw new Error("Conecta al menos una red en Publicar");
  const { data: claimed } = await db.from("queue_items").update({ status: "scheduled" }).eq("id", itemId).eq("status", "approved").select("id");
  if (!claimed?.length) throw new Error("Ese video ya se programó");
  try {
    const postId = await schedulePost(db, clientId, viewer.id, {
      source: "upload",
      mediaPath: it.media_path,
      caption: it.caption,
      accountIds: accounts.filter((a) => a.healthy !== false).map((a) => a.id),
      scheduledFor: new Date(input.when).toISOString(),
      timezone: input.timezone,
    });
    await db.from("queue_items").update({ scheduled_post_id: postId }).eq("id", itemId);
    await db.from("scheduled_posts").update({ queue_item_id: itemId, media_name: it.file_name }).eq("id", postId);
  } catch (e) {
    await db.from("queue_items").update({ status: "approved" }).eq("id", itemId);
    throw e;
  }
  page(clientId);
}
