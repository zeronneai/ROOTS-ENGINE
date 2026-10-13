import { NextResponse } from "next/server";
import { canAccess } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  analyzeTopPosts,
  discoverCompetitors,
  generatePlan,
  generateReport,
  scanCompetitors,
  synthesizeBrandFor,
} from "@/server/engine";
import { ENGINE_STEPS } from "@/lib/engine-steps";

export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string; step: string }> };

/** Un paso del motor. Regresa { skipped } cuando no aplica (ej. no tiene redes propias). */
export async function POST(_req: Request, ctx: Ctx) {
  const { id, step } = await ctx.params;
  const viewer = await canAccess(id);
  if (!viewer || viewer.role !== "agency") return NextResponse.json({ error: "Solo la agencia" }, { status: 403 });
  if (!ENGINE_STEPS.some((s) => s.id === step)) return NextResponse.json({ error: "Paso desconocido" }, { status: 400 });
  const db = supabaseAdmin();

  try {
    let result: unknown = null;
    let skipped: string | null = null;
    switch (step) {
      case "own": {
        const r = await scanCompetitors(db, id, 30, "own");
        if (!r.scanned) skipped = "No tiene Instagram o TikTok propio registrado";
        result = r;
        break;
      }
      case "brand":
        result = await synthesizeBrandFor(db, id);
        break;
      case "discover": {
        const { count } = await db
          .from("competitors")
          .select("id", { count: "exact", head: true })
          .eq("client_id", id)
          .eq("is_own_account", false);
        if ((count ?? 0) >= 5) skipped = `Ya vigila ${count} cuentas`;
        else result = await discoverCompetitors(db, id);
        break;
      }
      case "scan":
        result = await scanCompetitors(db, id, 20, "others");
        break;
      case "analyze":
        result = await analyzeTopPosts(db, id, 8);
        break;
      case "report":
        result = await generateReport(db, id);
        break;
      case "plan":
        result = await generatePlan(db, id);
        break;
    }
    return NextResponse.json({ ok: true, skipped, result });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: (e as Error).message ?? String(e) }, { status: 500 });
  }
}
