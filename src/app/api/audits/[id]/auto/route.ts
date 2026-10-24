import { after, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runWithClient } from "@/lib/usage";
import { AUDIT_STEPS, type AuditStepId } from "@/lib/audit-steps";
import { runAuditStep } from "@/server/audits";
import { chainKey, nextStep, notifyAudit, sameSecret, triggerStep } from "@/server/audit-chain";

export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

/** Un paso de una auditoría automática. Contesta al instante y trabaja después; al terminar llama al siguiente. */
export async function POST(req: Request, ctx: Ctx) {
  if (!sameSecret(req.headers.get("x-chain-key"), chainKey())) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { step?: string; attempt?: number };
  const step = body.step as AuditStepId;
  if (!AUDIT_STEPS.some((s) => s.id === step)) return NextResponse.json({ error: "Paso desconocido" }, { status: 400 });
  const origin = new URL(req.url).origin;

  after(async () => {
    const db = supabaseAdmin();
    try {
      await runWithClient(null, () => runAuditStep(db, id, step));
      await db.from("audits").update({ attempts: 0 }).eq("id", id);
    } catch (e) {
      // queda con status "error": el tick de cada minuto la reintenta y avisa si se rinde
      console.error(`auditoría ${id} paso ${step}`, e);
      return;
    }
    const next = nextStep(step);
    if (next) await triggerStep(origin, id, next).catch((e) => console.error("auditoría: la cadena se cortó, la retoma el tick", e));
    else await notifyAudit(db, id);
  });
  return NextResponse.json({ ok: true, step }, { status: 202 });
}
