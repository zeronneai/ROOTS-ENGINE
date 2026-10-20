"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireClientAccess } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

const CATEGORIES = ["logo", "lugar", "persona", "producto", "otro"] as const;
type Category = (typeof CATEGORIES)[number];

/** Guarda imágenes ya subidas al bucket "brand" como estilo o como biblioteca de la marca. */
export async function addBrandAssetsAction(
  clientId: string,
  items: { path: string; kind: "style" | "library"; category?: Category; label?: string }[],
) {
  const viewer = await requireClientAccess(clientId);
  const db = supabaseAdmin();
  const rows = items.slice(0, 20).map((it) => {
    if (typeof it.path !== "string" || !it.path.startsWith(`${clientId}/`) || it.path.includes("..")) throw new Error("Ruta inválida");
    const category: Category = CATEGORIES.includes(it.category as Category) ? (it.category as Category) : "otro";
    return {
      client_id: clientId,
      kind: it.kind === "style" ? "style" : "library",
      category: it.kind === "style" ? "otro" : category,
      label: it.label?.slice(0, 80) || null,
      path: it.path,
      pinned: it.kind === "library" && category === "logo",
      created_by: viewer.id,
    };
  });
  const { error } = await db.from("brand_assets").insert(rows);
  if (error) throw error;
  revalidatePath(`/c/${clientId}/flyers`);
}

export async function updateBrandAssetAction(
  clientId: string,
  id: string,
  patch: { pinned?: boolean; category?: Category; label?: string },
) {
  await requireClientAccess(clientId);
  const update: Record<string, unknown> = {};
  if (typeof patch.pinned === "boolean") update.pinned = patch.pinned;
  if (patch.category && CATEGORIES.includes(patch.category)) update.category = patch.category;
  if (typeof patch.label === "string") update.label = patch.label.slice(0, 80) || null;
  await supabaseAdmin().from("brand_assets").update(update).eq("id", id).eq("client_id", clientId);
  revalidatePath(`/c/${clientId}/flyers`);
}

export async function deleteBrandAssetAction(clientId: string, id: string) {
  await requireClientAccess(clientId);
  const db = supabaseAdmin();
  const { data } = await db.from("brand_assets").delete().eq("id", id).eq("client_id", clientId).select("path").maybeSingle();
  if (data?.path) await db.storage.from("brand").remove([data.path]);
  revalidatePath(`/c/${clientId}/flyers`);
}

export async function deleteFlyerAction(clientId: string, id: string) {
  await requireClientAccess(clientId);
  const db = supabaseAdmin();
  const { data } = await db.from("flyers").delete().eq("id", id).eq("client_id", clientId).select("output_path").maybeSingle();
  if (data?.output_path) await db.storage.from("brand").remove([data.output_path]);
  revalidatePath(`/c/${clientId}/flyers`);
}

/** Usa un logo generado en el rebranding como el logo oficial (fijo en los flyers). */
export async function adoptRebrandLogoAction(clientId: string, rebrandId: string, path: string) {
  const viewer = await requireClientAccess(clientId);
  if (viewer.role !== "agency") throw new Error("Solo la agencia");
  if (!path.startsWith(`${clientId}/rebrand/${rebrandId}/`) || path.includes("..")) throw new Error("Ruta inválida");
  const db = supabaseAdmin();
  await db.from("brand_assets").update({ pinned: false }).eq("client_id", clientId).eq("category", "logo");
  const { error } = await db
    .from("brand_assets")
    .insert({ client_id: clientId, kind: "library", category: "logo", label: "Logo nuevo (rebranding)", path, pinned: true, created_by: viewer.id });
  if (error) throw error;
  revalidatePath(`/c/${clientId}/flyers`);
  revalidatePath(`/c/${clientId}/rebranding/${rebrandId}`);
}

/** Borra un análisis de rebranding. */
export async function deleteRebrandAction(clientId: string, rebrandId: string) {
  const viewer = await requireClientAccess(clientId);
  if (viewer.role !== "agency") throw new Error("Solo la agencia");
  await supabaseAdmin().from("rebrands").delete().eq("id", rebrandId).eq("client_id", clientId);
  revalidatePath(`/c/${clientId}/rebranding`);
  redirect(`/c/${clientId}/rebranding`);
}
