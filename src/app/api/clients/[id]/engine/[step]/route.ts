import { NextResponse } from "next/server";
import { canAccess } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  analyzeTopPosts,
  discoverCompetitors,
  generatePlan,
  generateReport,
  researchGoogle,
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
  if (!viewer) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  if (!ENGINE_STEPS.some((s) => s.id === step)) return NextResponse.json({ error: "Paso desconocido" }, { status: 400 });
  const db = supabaseAdmin();
  if (viewer.role !== "agency") {
    // el cliente puede correr su análisis una vez por semana
    const { data: last } = await db.from("reports").select("created_at").eq("client_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const age = last ? Date.now() - new Date(last.created_at).getTime() : Infinity;
    const fresh = age < 7 * 864e5;
    // el plan va justo después del reporte en la cadena: se permite si el reporte es de hace minutos
    const finishingRun = step === "plan" && age < 15 * 60 * 1000;
    if (fresh && !finishingRun) return NextResponse.json({ error: "Tu análisis se puede actualizar una vez por semana" }, { status: 429 });
  }

  try {
    let result: unknown = null;
    let skipped: string | null = null;
    switch (step) {
      case "own": {
        const [r, g] = await Promise.all([scanCompetitors(db, id, 30, "own"), researchGoogle(db, id)]);
        if (!r.scanned && !g.found) skipped = "No se encontraron redes propias ni perfil de Google";
        result = { ...r, google: g };
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
