"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAgency, requireClientAccess } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { StyleOverrides } from "@/lib/styles/types";

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const handles = (raw: string | null) =>
  (raw ?? "")
    .split(/[\s,]+/)
    .map((h) => h.trim().replace(/^@/, "").replace(/\/$/, "").split("/").pop()!)
    .filter(Boolean);

// ───────────────────────────── Clientes ─────────────────────────────

/** Alta de cliente: la agencia mete lo que ya sabe; el resto lo completa Claude y el cliente. */
export async function createClientAction(form: FormData) {
  await requireAgency();
  const db = supabaseAdmin();
  const name = str(form, "name");
  if (!name) throw new Error("Falta el nombre");

  const { data: client, error } = await db
    .from("clients")
    .insert({
      name,
      slug: slugify(name),
      niche: str(form, "niche"),
      city: str(form, "city") ?? "El Paso, TX",
      language: str(form, "language") ?? "es",
      instagram: str(form, "instagram")?.replace(/^@/, ""),
      tiktok: str(form, "tiktok")?.replace(/^@/, ""),
      website: str(form, "website"),
      plan_tier: str(form, "plan_tier") ?? "plan",
      status: "onboarding",
    })
    .select()
    .single();
  if (error) throw error;

  await db.from("brand_profiles").insert({ client_id: client.id });

  const notes = str(form, "notes");
  if (notes)
    await db.from("brand_inputs").insert({ client_id: client.id, kind: "note", title: "Lo que ya sabemos", content: notes, added_by_role: "agency" });

  const comps = [
    ...handles(str(form, "competitors_ig")).map((h) => ({ platform: "instagram", handle: h, is_own_account: false })),
    ...handles(str(form, "competitors_tt")).map((h) => ({ platform: "tiktok", handle: h, is_own_account: false })),
  ];
  if (client.instagram) comps.push({ platform: "instagram", handle: client.instagram, is_own_account: true });
  if (client.tiktok) comps.push({ platform: "tiktok", handle: client.tiktok, is_own_account: true });
  if (comps.length) await db.from("competitors").insert(comps.map((c) => ({ ...c, client_id: client.id })));

  const email = str(form, "client_email");
  if (email) await db.from("members").upsert({ email: email.toLowerCase(), role: "client", client_id: client.id });

  redirect(`/c/${client.id}`);
}

export async function updateClientAction(clientId: string, form: FormData) {
  await requireAgency();
  await supabaseAdmin()
    .from("clients")
    .update({
      name: str(form, "name"),
      niche: str(form, "niche"),
      city: str(form, "city"),
      language: str(form, "language"),
      plan_tier: str(form, "plan_tier"),
      status: str(form, "status"),
      instagram: str(form, "instagram")?.replace(/^@/, ""),
      tiktok: str(form, "tiktok")?.replace(/^@/, ""),
      website: str(form, "website"),
    })
    .eq("id", clientId);
  revalidatePath(`/c/${clientId}`, "layout");
}

export async function addMemberAction(clientId: string, form: FormData) {
  await requireAgency();
  const email = str(form, "email");
  if (!email) return;
  await supabaseAdmin().from("members").upsert({ email: email.toLowerCase(), role: "client", client_id: clientId });
  revalidatePath(`/c/${clientId}/ajustes`);
}

export async function addAgencyMemberAction(form: FormData) {
  await requireAgency();
  const email = str(form, "email");
  if (!email) return;
  await supabaseAdmin().from("members").upsert({ email: email.toLowerCase(), role: "agency", client_id: null });
  revalidatePath("/agency");
}

// ───────────────────────────── Brand Brain ─────────────────────────────

/** Agencia o cliente agregan algo: nota, link, referencia. Se suma al Brand Brain al re-sintetizar. */
export async function addBrandInputAction(clientId: string, form: FormData) {
  const viewer = await requireClientAccess(clientId);
  const kind = str(form, "kind") ?? "note";
  const content = str(form, "content");
  const url = str(form, "url");
  if (!content && !url) return;
  await supabaseAdmin()
    .from("brand_inputs")
    .insert({
      client_id: clientId,
      kind,
      title: str(form, "title"),
      content,
      url,
      mood_id: str(form, "mood_id"),
      added_by: viewer.id,
      added_by_role: viewer.role,
    });
  revalidatePath(`/c/${clientId}/marca`);
}

export async function deleteBrandInputAction(clientId: string, inputId: string) {
  await requireAgency();
  await supabaseAdmin().from("brand_inputs").delete().eq("id", inputId).eq("client_id", clientId);
  revalidatePath(`/c/${clientId}/marca`);
}

// ───────────────────────────── Competencia ─────────────────────────────

export async function addCompetitorsAction(clientId: string, form: FormData) {
  const viewer = await requireClientAccess(clientId);
  const platform = str(form, "platform") ?? "instagram";
  const list = handles(str(form, "handles"));
  if (!list.length) return;
  const db = supabaseAdmin();
  if (viewer.role === "agency") {
    await db
      .from("competitors")
      .upsert(list.map((h) => ({ client_id: clientId, platform, handle: h })), { onConflict: "client_id,platform,handle", ignoreDuplicates: true });
  } else {
    // el cliente sugiere; la agencia decide
    await db.from("brand_inputs").insert({
      client_id: clientId,
      kind: "link",
      title: "Cuentas que el cliente admira / compite",
      content: list.map((h) => `@${h} (${platform})`).join(", "),
      added_by: viewer.id,
      added_by_role: "client",
    });
  }
  revalidatePath(`/c/${clientId}/competencia`);
}

export async function removeCompetitorAction(clientId: string, competitorId: string) {
  await requireAgency();
  await supabaseAdmin().from("competitors").delete().eq("id", competitorId).eq("client_id", clientId);
  revalidatePath(`/c/${clientId}/competencia`);
}

// ───────────────────────────── Estilo ─────────────────────────────

export async function saveStyleAction(
  clientId: string,
  state: { presetId: string | null; moodId: string | null; overrides: StyleOverrides },
) {
  await requireClientAccess(clientId);
  const db = supabaseAdmin();
  await db.from("clients").update({ edit_style_id: state.presetId }).eq("id", clientId);
  await db
    .from("brand_profiles")
    .upsert({ client_id: clientId, style_overrides: state.overrides, active_mood_id: state.moodId }, { onConflict: "client_id" });
  revalidatePath(`/c/${clientId}`, "layout");
}

export async function setActiveMoodAction(clientId: string, moodId: string | null) {
  await requireClientAccess(clientId);
  await supabaseAdmin().from("brand_profiles").upsert({ client_id: clientId, active_mood_id: moodId }, { onConflict: "client_id" });
  revalidatePath(`/c/${clientId}`, "layout");
}

export async function deleteMoodAction(clientId: string, moodId: string) {
  await requireClientAccess(clientId);
  await supabaseAdmin().from("moods").delete().eq("id", moodId).eq("client_id", clientId);
  revalidatePath(`/c/${clientId}`, "layout");
}

// ───────────────────────────── Plan ─────────────────────────────

export async function setIdeaStatusAction(clientId: string, ideaId: string, status: string) {
  await requireClientAccess(clientId);
  await supabaseAdmin().from("content_ideas").update({ status }).eq("id", ideaId).eq("client_id", clientId);
  revalidatePath(`/c/${clientId}/plan`);
}

// ───────────────────────────── Videos ─────────────────────────────

/** Después de subir el archivo a Storage desde el navegador: registra la grabación y crea la edición. */
export async function registerRecordingAction(
  clientId: string,
  input: { storagePath: string; originalName: string; ideaId: string | null; mode: "auto" | "agency"; notes?: string },
) {
  const viewer = await requireClientAccess(clientId);
  if (!input.storagePath.startsWith(`${clientId}/`)) throw new Error("Ruta inválida");
  const db = supabaseAdmin();
  const { data: rec, error } = await db
    .from("recordings")
    .insert({
      client_id: clientId,
      idea_id: input.ideaId,
      storage_path: input.storagePath,
      original_name: input.originalName,
      uploaded_by: viewer.id,
    })
    .select()
    .single();
  if (error) throw error;
  await db.from("edits").insert({
    client_id: clientId,
    recording_id: rec.id,
    idea_id: input.ideaId,
    mode: input.mode,
    notes: input.notes ?? null,
    status: "queued",
  });
  if (input.ideaId) await db.from("content_ideas").update({ status: "recorded" }).eq("id", input.ideaId);
  revalidatePath(`/c/${clientId}/videos`);
}

export async function retryEditAction(clientId: string, editId: string) {
  await requireClientAccess(clientId);
  const db = supabaseAdmin();
  const { data } = await db.from("edits").select("transcript, edl").eq("id", editId).single();
  const status = data?.edl ? "render_queued" : data?.transcript ? "directing" : "queued";
  await db.from("edits").update({ status, error: null }).eq("id", editId).eq("client_id", clientId);
  revalidatePath(`/c/${clientId}/videos`);
}
