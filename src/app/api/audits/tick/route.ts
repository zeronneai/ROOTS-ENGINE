import { after, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runWithClient } from "@/lib/usage";
import { runAuditStep } from "@/server/audits";
import { nextStep, notifyAudit, sameSecret, tickAudits, triggerStep } from "@/server/audit-chain";
import type { AuditStepId } from "@/lib/audit-steps";

export const maxDuration = 300;

/**
 * Lo llama el Apps Script del sitio cada minuto. Retoma las auditorías automáticas que se
 * quedaron paradas o fallaron. Contesta de inmediato; los pasos corren después.
 */
export async function POST(req: Request) {
  if (!sameSecret(req.headers.get("x-audit-key"), process.env.AUDIT_INTAKE_KEY)) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  const db = supabaseAdmin();
  const origin = new URL(req.url).origin;
  const jobs: Promise<void>[] = [];
  const done = await tickAudits(db, (id, step) => {
    jobs.push(
      (async () => {
        try {
          await runWithClient(null, () => runAuditStep(db, id, step as AuditStepId));
          await db.from("audits").update({ attempts: 0 }).eq("id", id);
        } catch (e) {
          console.error(`auditoría ${id} paso ${step} (tick)`, e);
          return;
        }
        const next = nextStep(step);
        if (next) await triggerStep(origin, id, next).catch((e) => console.error("auditoría: la retoma el siguiente tick", e));
        else await notifyAudit(db, id);
      })(),
    );
  });
  if (jobs.length) after(() => Promise.all(jobs).then(() => undefined));
  return NextResponse.json({ ok: true, done });
}
