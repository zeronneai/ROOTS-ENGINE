"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAgency } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { NICHES } from "@/lib/styles/presets";
import { PLAN_TIERS } from "@/lib/types";

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
const handle = (v: string | null) => (v ? v.replace(/^@/, "").replace(/\/$/, "").split("/").pop()! : null);
const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export type FormState = { error?: string; ok?: string } | null;

async function findProfile(email: string) {
  const { data } = await supabaseAdmin().from("profiles").select("id, role, client_id").eq("email", email).maybeSingle();
  return data;
}

// ───────────────────── Acceso con contraseña (agencia → cliente existente) ─────────────────────

/** La agencia crea o cambia el acceso con contraseña de un cliente. */
export async function setClientPasswordAction(clientId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireAgency();
  const email = str(form, "email")?.toLowerCase();
  const password = str(form, "password");
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return { error: "Escribe un correo válido" };
  if (!password || password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres" };

  const db = supabaseAdmin();
  const profile = await findProfile(email);
  if (profile?.role === "agency") return { error: "Ese correo es de la agencia. Usa otro para el cliente." };
  if (profile?.client_id && profile.client_id !== clientId) return { error: "Ese correo ya pertenece a otro cliente." };

  await db.from("members").upsert({ email, role: "client", client_id: clientId });
  if (profile) {
    const { error } = await db.auth.admin.updateUserById(profile.id, { password });
    if (error) return { error: error.message };
  } else {
    const { error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) return { error: error.message };
  }
  revalidatePath(`/c/${clientId}/ajustes`);
  return { ok: `Listo. ${email} ya puede entrar en /login con su contraseña.` };
}

// ───────────────────── Links de registro (cliente nuevo) ─────────────────────

export async function createInviteAction(form: FormData) {
  await requireAgency();
  const tier = str(form, "plan_tier");
  await supabaseAdmin()
    .from("signup_invites")
    .insert({ label: str(form, "label"), plan_tier: tier && tier in PLAN_TIERS ? tier : "plan" });
  revalidatePath("/agency");
}

export async function deleteInviteAction(token: string) {
  await requireAgency();
  await supabaseAdmin().from("signup_invites").delete().eq("token", token).is("used_at", null);
  revalidatePath("/agency");
}

/** Registro del cliente nuevo: crea su negocio y su cuenta, y entra directo a su portal. */
export async function signupAction(token: string, _prev: FormState, form: FormData): Promise<FormState> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { error: "Link inválido" };
  const db = supabaseAdmin();
  const { data: invite } = await db.from("signup_invites").select("*").eq("token", token).maybeSingle();
  if (!invite) return { error: "Este link no existe. Pídele uno nuevo a Purple Roots." };
  if (invite.used_at) return { error: "Este link ya se usó. Entra en /login con tu correo y contraseña." };

  const name = str(form, "business");
  const email = str(form, "email")?.toLowerCase();
  const password = str(form, "password");
  const niche = str(form, "niche");
  if (!name) return { error: "Escribe el nombre de tu negocio" };
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return { error: "Escribe un correo válido" };
  if (!password || password.length < 8) return { error: "Tu contraseña debe tener al menos 8 caracteres" };
  if (await findProfile(email)) return { error: "Ese correo ya tiene cuenta. Entra en /login." };

  const instagram = handle(str(form, "instagram"));
  const tiktok = handle(str(form, "tiktok"));
  const { data: client, error } = await db
    .from("clients")
    .insert({
      name,
      slug: slugify(name),
      niche: NICHES.some((n) => n.id === niche) ? niche : "otro",
      city: str(form, "city") ?? "El Paso, TX",
      language: str(form, "language") ?? "es",
      instagram,
      tiktok,
      website: str(form, "website"),
      google_maps_url: str(form, "google_maps_url"),
      plan_tier: invite.plan_tier,
      status: "onboarding",
    })
    .select()
    .single();
  if (error || !client) return { error: "No se pudo crear tu negocio. Intenta otra vez." };

  await db.from("brand_profiles").insert({ client_id: client.id });
  const own = [
    instagram ? { client_id: client.id, platform: "instagram", handle: instagram.toLowerCase(), is_own_account: true } : null,
    tiktok ? { client_id: client.id, platform: "tiktok", handle: tiktok.toLowerCase(), is_own_account: true } : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);
  if (own.length) await db.from("competitors").insert(own);

  await db.from("members").upsert({ email, role: "client", client_id: client.id });
  const { error: uErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: str(form, "name") },
  });
  if (uErr) {
    await db.from("clients").delete().eq("id", client.id);
    return { error: uErr.message };
  }
  await db.from("signup_invites").update({ used_at: new Date().toISOString(), client_id: client.id }).eq("token", token);

  // inicio de sesión normal con su correo y contraseña
  const supabase = await supabaseServer();
  const { error: sErr } = await supabase.auth.signInWithPassword({ email, password });
  if (sErr) redirect(`/login?next=/c/${client.id}`);
  redirect(`/c/${client.id}`);
}
