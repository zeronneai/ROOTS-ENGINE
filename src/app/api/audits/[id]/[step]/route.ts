import { NextResponse } from "next/server";
import { getViewer } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runWithClient } from "@/lib/usage";
import { AUDIT_STEPS, type AuditStepId } from "@/lib/audit-steps";
import { runAuditStep } from "@/server/audits";

export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string; step: string }> };

/** Un paso de la auditoría (solo la agencia). */
export async function POST(_req: Request, ctx: Ctx) {
  const { id, step } = await ctx.params;
  const viewer = await getViewer();
  if (viewer?.role !== "agency") return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  if (!AUDIT_STEPS.some((s) => s.id === step)) return NextResponse.json({ error: "Paso desconocido" }, { status: 400 });
  try {
    // el gasto de una auditoría no es de ningún cliente todavía
    const result = await runWithClient(null, () => runAuditStep(supabaseAdmin(), id, step as AuditStepId));
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: (e as Error).message ?? String(e) }, { status: 500 });
  }
}
