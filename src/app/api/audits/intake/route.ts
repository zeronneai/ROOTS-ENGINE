import { after, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AUDIT_STEPS } from "@/lib/audit-steps";
import { sameSecret, triggerStep } from "@/server/audit-chain";

/**
 * Entrada de las auditorías que piden en purpleroots.agency/audit.
 * La manda el Apps Script del formulario (con la llave AUDIT_INTAKE_KEY), crea la auditoría
 * y la arranca sola. Al terminar llega un correo a la agencia para revisarla y mandarla.
 */
type Body = {
  form?: string;
  name?: string;
  biz?: string;
  social?: string;
  msg?: string;
  email?: string;
  phone?: string;
  lang?: string;
  source?: string;
};

const clean = (v: unknown, max = 300) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

function platformOf(social: string) {
  if (/tiktok\.com|^@?[^/]*tiktok/i.test(social)) return "tiktok" as const;
  if (/facebook\.com|fb\.com/i.test(social)) return "facebook" as const;
  return "instagram" as const;
}

export async function POST(req: Request) {
  const key = process.env.AUDIT_INTAKE_KEY;
  if (!key) return NextResponse.json({ error: "Falta AUDIT_INTAKE_KEY en Vercel" }, { status: 503 });
  if (!sameSecret(req.headers.get("x-audit-key"), key)) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const b = ((await req.json().catch(() => null)) ?? {}) as Body;
  const social = clean(b.social, 200);
  const email = clean(b.email, 120)?.toLowerCase() ?? null;
  const handle = social ? (social.match(/(?:instagram|tiktok|facebook)\.com\/@?([A-Za-z0-9._\-]+)/i)?.[1] ?? social.replace(/^@/, "")) : null;
  const business = clean(b.biz, 120) ?? (handle ? `@${handle}` : null);
  if (!business) return NextResponse.json({ error: "Falta el negocio o la cuenta" }, { status: 400 });

  const db = supabaseAdmin();
  // el mismo prospecto dos veces en 24 h (doble clic, popup y página): no se repite
  if (email) {
    const { data: dup } = await db
      .from("audits")
      .select("id")
      .eq("contact_email", email)
      .gte("created_at", new Date(Date.now() - 864e5).toISOString())
      .limit(1)
      .maybeSingle();
    if (dup) return NextResponse.json({ ok: true, id: dup.id, duplicate: true });
  }

  const p = social ? platformOf(social) : null;
  const lang = b.lang === "es" || /(^|\/)es(\/|$)/.test(b.source ?? "") ? "es" : "en";
  const msg = clean(b.msg, 1000);
  const { data: row, error } = await db
    .from("audits")
    .insert({
      business_name: business,
      instagram: p === "instagram" ? social : null,
      tiktok: p === "tiktok" ? social : null,
      facebook: p === "facebook" ? social : null,
      intro: msg ? `What they told us is their biggest challenge: ${msg}` : null,
      language: lang,
      contact_name: clean(b.name, 120),
      contact_email: email,
      contact_phone: clean(b.phone, 40),
      team_notes: `Pidió la auditoría en purpleroots.agency (${b.form === "popup" ? "popup" : "página /audit"}).`,
      source: "web",
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const origin = new URL(req.url).origin;
  after(() => triggerStep(origin, row.id, AUDIT_STEPS[0].id).catch((e) => console.error("auditoría: no arrancó", e)));
  return NextResponse.json({ ok: true, id: row.id });
}
