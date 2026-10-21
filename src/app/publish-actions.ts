"use server";

import { revalidatePath } from "next/cache";
import { requireClientAccess } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cancelPost, clientProfile } from "@/server/publishing";
import { generateSlotPosts } from "@/server/slots";
import { listAccounts } from "@/lib/zernio";
import { isDropboxFolder } from "@/lib/dropbox";

/** Cancela un post programado. */
export async function cancelPostAction(clientId: string, postId: string) {
  await requireClientAccess(clientId);
  await cancelPost(supabaseAdmin(), clientId, postId);
  revalidatePath(`/c/${clientId}/publicar`);
}

/** Crea una regla del calendario fijo y programa sus próximos posts. */
export async function createSlotAction(
  clientId: string,
  input: { name: string; weekdays: number[]; time: string; timezone: string; accountIds: string[]; dropboxUrl: string; caption: string; deadlineHours: number },
) {
  await requireClientAccess(clientId);
  const db = supabaseAdmin();
  const weekdays = [...new Set(input.weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
  if (!weekdays.length) throw new Error("Escoge al menos un día");
  if (!/^\d{2}:\d{2}$/.test(input.time)) throw new Error("Hora inválida");
  if (!isDropboxFolder(input.dropboxUrl ?? "")) throw new Error("Pega el link de una carpeta de Dropbox (compartida con cualquiera que tenga el link)");
  const profileId = await clientProfile(db, clientId);
  const accounts = (await listAccounts(profileId))
    .filter((a) => input.accountIds.includes(a.id))
    .map((a) => ({ platform: a.platform, accountId: a.id, label: a.name }));
  if (!accounts.length) throw new Error("Escoge al menos una cuenta");
  const { error } = await db.from("posting_slots").insert({
    client_id: clientId,
    name: input.name.trim().slice(0, 60) || "Calendario",
    weekdays,
    time: input.time,
    timezone: input.timezone || "America/Denver",
    accounts,
    dropbox_url: input.dropboxUrl.trim(),
    caption: input.caption.slice(0, 2200),
    deadline_hours: Math.max(0, Math.min(72, Math.round(input.deadlineHours || 0))),
  });
  if (error) throw error;
  await generateSlotPosts(db, clientId);
  revalidatePath(`/c/${clientId}/publicar`);
}

/** Pausa o reactiva una regla. Al pausar, se cancelan sus posts que todavía no tienen video. */
export async function toggleSlotAction(clientId: string, slotId: string, active: boolean) {
  await requireClientAccess(clientId);
  const db = supabaseAdmin();
  await db.from("posting_slots").update({ active }).eq("id", slotId).eq("client_id", clientId);
  if (!active) await db.from("scheduled_posts").update({ status: "canceled" }).eq("slot_id", slotId).eq("status", "waiting_media");
  else await generateSlotPosts(db, clientId);
  revalidatePath(`/c/${clientId}/publicar`);
}

/** Borra una regla (los posts ya publicados se quedan en el historial). */
export async function deleteSlotAction(clientId: string, slotId: string) {
  await requireClientAccess(clientId);
  const db = supabaseAdmin();
  await db.from("scheduled_posts").update({ status: "canceled" }).eq("slot_id", slotId).eq("status", "waiting_media");
  await db.from("posting_slots").delete().eq("id", slotId).eq("client_id", clientId);
  revalidatePath(`/c/${clientId}/publicar`);
}
