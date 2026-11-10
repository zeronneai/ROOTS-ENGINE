import { NextResponse } from "next/server";
import { getViewer } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateMetricsReport } from "@/server/metrics-report";
import { parseDays } from "@/components/metrics/fmt";

export const maxDuration = 300;

/** Botón "Reporte completo": arma el reporte con IA a partir de lo que mide el panel. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (viewer?.role !== "agency") return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { days?: number };
  try {
    const reportId = await generateMetricsReport(supabaseAdmin(), id, parseDays(String(body.days ?? "")), viewer.id);
    return NextResponse.json({ result: { id: reportId } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
