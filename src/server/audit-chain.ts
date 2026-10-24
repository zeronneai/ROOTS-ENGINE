import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AUDIT_STEPS, type AuditStepId } from "@/lib/audit-steps";
import { appUrl, sendEmail, simpleEmail } from "@/lib/email";
import { loadAudit } from "./audits";

/**
 * Auditorías en automático, sin el worker ni una pestaña abierta: cada paso es una llamada
 * a /api/audits/<id>/auto que contesta de inmediato y trabaja después (after). Al terminar
 * un paso, se llama sola para el siguiente. Cada llamada cabe en el límite de Vercel.
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
  if (!res.ok) throw new Error(`No se pudo arrancar el paso ${step}: ${res.status}`);
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
  const r = await sendEmail({ to: notifyTo(), subject: failed ? `⚠ Auditoría con error: ${a.business_name}` : `✦ Auditoría lista: ${a.business_name}`, ...mail });
  if (r.sent) await db.from("audits").update({ notified_at: new Date().toISOString() }).eq("id", id);
  else console.error("auditoría: no se mandó el aviso", r.reason);
}
