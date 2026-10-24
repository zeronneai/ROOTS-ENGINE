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
  const attempt = Number(body.attempt) || 1;
  const origin = new URL(req.url).origin;

  after(async () => {
    const db = supabaseAdmin();
    try {
      await runWithClient(null, () => runAuditStep(db, id, step));
    } catch (e) {
      console.error(`auditoría ${id} paso ${step}`, e);
      // un reintento por paso (Apify a veces falla a la primera)
      if (attempt < 2) return void (await triggerStep(origin, id, step, attempt + 1).catch((x) => console.error(x)));
      return void (await notifyAudit(db, id, `paso "${step}": ${(e as Error).message}`.slice(0, 300)));
    }
    const next = nextStep(step);
    if (next) {
      await triggerStep(origin, id, next).catch(async (e) => {
        console.error(e);
        await notifyAudit(db, id, `no arrancó el paso "${next}"`);
      });
    } else await notifyAudit(db, id);
  });
  return NextResponse.json({ ok: true, step }, { status: 202 });
}
