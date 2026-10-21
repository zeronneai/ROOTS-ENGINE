"use server";

import { revalidatePath } from "next/cache";
import { requireClientAccess } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Da de alta un sitio para medirlo. */
export async function addSiteAction(clientId: string, form: FormData) {
  const viewer = await requireClientAccess(clientId);
  if (viewer.role !== "agency") throw new Error("Solo la agencia");
  const raw = String(form.get("domain") ?? "").trim();
  const domain = raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) throw new Error("Dominio inválido");
  await supabaseAdmin().from("sites").insert({ client_id: clientId, domain });
  revalidatePath(`/c/${clientId}/web`);
}

/** Deja de medir un sitio (borra sus datos). */
export async function deleteSiteAction(clientId: string, siteId: string) {
  const viewer = await requireClientAccess(clientId);
  if (viewer.role !== "agency") throw new Error("Solo la agencia");
  await supabaseAdmin().from("sites").delete().eq("id", siteId).eq("client_id", clientId);
  revalidatePath(`/c/${clientId}/web`);
}
