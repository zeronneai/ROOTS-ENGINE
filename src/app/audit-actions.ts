"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAgency } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

export type AuditFormState = { error?: string; ok?: string } | null;

function fields(form: FormData) {
  return {
    business_name: str(form, "business_name"),
    intro: str(form, "intro"),
    category: str(form, "category"),
    city: str(form, "city") ?? "El Paso, TX",
    website: str(form, "website"),
    google_maps_url: str(form, "google_maps_url"),
    instagram: str(form, "instagram"),
    tiktok: str(form, "tiktok"),
    facebook: str(form, "facebook"),
    team_notes: str(form, "team_notes"),
    language: str(form, "language") === "es" ? "es" : "en",
    contact_name: str(form, "contact_name"),
    contact_email: str(form, "contact_email"),
    contact_phone: str(form, "contact_phone"),
  };
}

/** Nueva auditoría: guarda lo que nos dieron y abre su página para correrla. */
export async function createAuditAction(_prev: AuditFormState, form: FormData): Promise<AuditFormState> {
  const viewer = await requireAgency();
  const f = fields(form);
  if (!f.business_name) return { error: "Falta el nombre del negocio" };
  const { data, error } = await supabaseAdmin()
    .from("audits")
    .insert({ ...f, created_by: viewer.id })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/agency/auditorias");
  redirect(`/agency/auditorias/${data.id}?correr=1`);
}

/** Corregir los datos (por ejemplo, un Instagram mal escrito) antes de volver a correrla. */
export async function updateAuditAction(id: string, _prev: AuditFormState, form: FormData): Promise<AuditFormState> {
  await requireAgency();
  const f = fields(form);
  if (!f.business_name) return { error: "Falta el nombre del negocio" };
  const { error } = await supabaseAdmin().from("audits").update(f).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/agency/auditorias/${id}`);
  return { ok: "Guardado. Vuelve a correr la auditoría para usar los datos nuevos." };
}

export async function deleteAuditAction(id: string) {
  await requireAgency();
  await supabaseAdmin().from("audits").delete().eq("id", id);
  revalidatePath("/agency/auditorias");
  redirect("/agency/auditorias");
}
