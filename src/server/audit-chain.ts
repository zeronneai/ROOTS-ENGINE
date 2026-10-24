import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AUDIT_STEPS, type AuditStepId } from "@/lib/audit-steps";
import { appUrl, sendEmail, simpleEmail } from "@/lib/email";
import { auditLinks, competitorLinks, loadAudit } from "./audits";
import { auditHtml } from "./audit-html";
import { TIME_ZONE } from "@/lib/time";

/**
 * Auditorías en automático, sin el worker ni una pestaña abierta: cada paso es una llamada
 * a /api/audits/<id>/auto que contesta de inmediato y trabaja después (after). Al terminar
 * un paso, se llama sola para el siguiente. Cada llamada cabe en el límite de Vercel.
 * Red de seguridad: el Apps Script llama /api/audits/tick cada minuto y retoma las que se
 * quedaron paradas (Vercel a veces corta la cadena) o fallaron (2 reintentos por paso).
 */

/** Llave interna para que solo el propio motor pueda encadenar pasos (no hay que configurar nada). */
export function chainKey() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHmac("sha256", secret).update("roots-engine:audit-chain").digest("hex");
}

export function sameSecret(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export const nextStep = (step: AuditStepId) => {
  const i = AUDIT_STEPS.findIndex((s) => s.id === step);
  return AUDIT_STEPS[i + 1]?.id ?? null;
};

/** Dispara un paso. Solo espera el "recibido" (la llamada trabaja por su cuenta). */
export async function triggerStep(origin: string, id: string, step: AuditStepId, attempt = 1) {
  const res = await fetch(`${origin}/api/audits/${id}/auto`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-chain-key": chainKey() },
    body: JSON.stringify({ step, attempt }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`No se pudo arrancar el paso ${step}: ${res.status} ${(await res.text().catch(() => "")).slice(0, 120)}`);
}

const IDLE_MS = 2 * 60_000; // parada sin avanzar: el siguiente paso no arrancó
const STALE_MS = 7 * 60_000; // "corriendo" por más de lo que aguanta Vercel: se murió
const MAX_ATTEMPTS = 3;

type Pending = { id: string; status: string; step: AuditStepId | null; attempts: number; updated_at: string; notified_at: string | null };

/** Retoma las auditorías automáticas paradas o con error. Regresa qué hizo con cada una. */
export async function tickAudits(db: SupabaseClient, run: (id: string, step: AuditStepId) => void) {
  const { data } = await db
    .from("audits")
    .select("id, status, step, attempts, updated_at, notified_at")
    .eq("source", "web")
    .is("report", null)
    .order("created_at")
    .limit(10);
  const now = Date.now();
  const out: { id: string; action: string }[] = [];
  for (const a of (data ?? []) as Pending[]) {
    const age = now - new Date(a.updated_at).getTime();
    let step: AuditStepId | null = null;
    let retry = false;
    if (a.status === "running") {
      if (age < STALE_MS) continue;
      step = a.step ?? AUDIT_STEPS[0].id;
      retry = true;
    } else if (a.status === "error") {
      step = a.step ?? AUDIT_STEPS[0].id;
      retry = true;
    } else {
      if (age < IDLE_MS) continue; // la cadena (o la entrada del sitio) está por arrancar el siguiente
      step = a.step ? nextStep(a.step) : AUDIT_STEPS[0].id;
    }
    if (!step) continue;
    const attempts = retry ? a.attempts + 1 : 0;
    if (attempts >= MAX_ATTEMPTS) {
      if (!a.notified_at) {
        await notifyAudit(db, a.id, `el paso "${step}" falló ${MAX_ATTEMPTS} veces`);
        out.push({ id: a.id, action: "avisada como fallida" });
      }
      continue;
    }
    // apartarla (si otro tick o la cadena la tomó primero, no se repite)
    const { data: claimed } = await db
      .from("audits")
      .update({ status: "running", step, attempts })
      .eq("id", a.id)
      .eq("updated_at", a.updated_at)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;
    run(a.id, step);
    out.push({ id: a.id, action: `${retry ? "reintento" : "sigue"}: ${step}` });
    if (out.length >= 3) break; // máximo 3 a la vez por minuto
  }
  return out;
}

export const notifyTo = () =>
  (process.env.AUDIT_NOTIFY_EMAIL || "p.rootsagency@gmail.com")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** Avisa a la agencia: lista para revisar y mandar, o falló y hay que correrla a mano. */
export async function notifyAudit(db: SupabaseClient, id: string, failed?: string) {
  const a = await loadAudit(db, id);
  if (!a) return;
  const portal = `${appUrl()}/agency/auditorias/${a.id}`;
  const contact = [a.contact_name, a.contact_email, a.contact_phone].filter(Boolean).join(" · ");
  const mail = failed
    ? simpleEmail(
        `Auditoría de ${a.business_name}: falló`,
        [`No se pudo terminar sola (${failed}).`, "Ábrela en el portal, revisa los datos y dale Reintentar desde aquí.", contact ? `Contacto: ${contact}` : ""].filter(Boolean),
        { label: "Abrir en el portal", href: portal },
      )
    : simpleEmail(
        `Auditoría lista: ${a.business_name} (${a.report?.score ?? "?"}/100)`,
        [
          a.report?.headline ?? "",
          "Revísala antes de mandarla. Desde el portal copias el link para el prospecto.",
          contact ? `Contacto: ${contact}` : "",
          `Link para el prospecto: ${appUrl()}/auditoria/${a.share_token}`,
        ].filter(Boolean),
        { label: "Revisar en el portal", href: portal },
      );
  const subject = failed ? `⚠ Auditoría con error: ${a.business_name}` : `✦ Auditoría lista: ${a.business_name}`;
  // Primero por el Apps Script del sitio (manda con Gmail, sin Resend); si no hay llave, por Resend
  // la auditoría completa en HTML: el Apps Script la convierte a PDF y la adjunta
  const html =
    !failed && a.report
      ? auditHtml({
          r: a.report,
          business: a.business_name,
          city: a.city,
          date: new Date(a.report_at ?? a.created_at).toLocaleDateString(a.language === "es" ? "es-MX" : "en-US", { timeZone: TIME_ZONE, day: "numeric", month: "long", year: "numeric" }),
          lang: a.language,
          links: auditLinks(a),
          compLinks: competitorLinks(a.research),
          shareUrl: `${appUrl()}/auditoria/${a.share_token}`,
        })
      : "";
  const filename = `Auditoria ${a.business_name}`.replace(/[^\p{L}\p{N} ._-]/gu, "").trim().slice(0, 80);
  let r = await notifyViaAppsScript({
    html,
    filename,
    subject,
    business: a.business_name,
    score: a.report?.score ?? null,
    headline: failed ? `Falló: ${failed}` : (a.report?.headline ?? ""),
    contact,
    portal,
    share: `${appUrl()}/auditoria/${a.share_token}`,
    failed: !!failed,
  });
  if (!r.sent) {
    console.error("auditoría: Apps Script no mandó el aviso", r.reason);
    r = await sendEmail({ to: notifyTo(), subject, ...mail });
  }
  if (r.sent) await db.from("audits").update({ notified_at: new Date().toISOString() }).eq("id", id);
  else console.error("auditoría: no se mandó el aviso", r.reason);
}

/** El Apps Script del formulario de purpleroots.agency, el mismo que ya manda los correos del sitio. */
const APPS_SCRIPT_URL =
  process.env.AUDIT_NOTIFY_WEBHOOK ||
  "https://script.google.com/macros/s/AKfycby_FcqUjJIuyfwG6ZnxvOLqeETVAW6NBGGya7YUYJfKe0I3FifQwPO8vGfwm3Vlhiov5g/exec";

async function notifyViaAppsScript(d: { html: string; filename: string; subject: string; business: string; score: number | null; headline: string; contact: string; portal: string; share: string; failed: boolean }) {
  const key = process.env.AUDIT_INTAKE_KEY;
  if (!key) return { sent: false, reason: "Falta AUDIT_INTAKE_KEY" };
  try {
    const body = new URLSearchParams({
      action: "audit_ready",
      key,
      subject: d.subject,
      business: d.business,
      score: d.score == null ? "" : String(d.score),
      headline: d.headline,
      contact: d.contact,
      portal: d.portal,
      share: d.share,
      failed: d.failed ? "1" : "",
      html: d.html,
      filename: d.filename,
    });
    const res = await fetch(APPS_SCRIPT_URL, { method: "POST", body, redirect: "follow", signal: AbortSignal.timeout(30000) });
    const text = (await res.text()).trim();
    // "audit-ok" solo lo contesta la versión nueva del script (la vieja contesta "ok" sin mandar nada)
    return text.startsWith("audit-ok") ? { sent: true, reason: null } : { sent: false, reason: `Apps Script: ${res.status} ${text.slice(0, 120)}` };
  } catch (e) {
    return { sent: false, reason: (e as Error).message };
  }
}
