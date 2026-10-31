import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { siteStats } from "@/server/web";

/**
 * Las visitas de UN sitio para el panel propio del cliente (servidor a servidor).
 *   GET /api/sites/stats?dias=7   Authorization: Bearer <read_token del sitio>
 * Solo lectura. El token se copia en Roots Engine: cliente → Sitio web → Código del sitio.
 * Nunca va en el navegador: el panel del cliente lo usa desde su propio servidor.
 */
const DAYS = [1, 7, 30, 90];
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!/^[0-9a-f]{64}$/.test(token)) return NextResponse.json({ error: "Sin acceso" }, { status: 401, headers: NO_STORE });

  const db = supabaseAdmin();
  const { data: site } = await db.from("sites").select("id, domain").eq("read_token", token).maybeSingle();
  if (!site) return NextResponse.json({ error: "Sin acceso" }, { status: 401, headers: NO_STORE });

  const asked = Number(new URL(req.url).searchParams.get("dias"));
  const days = DAYS.includes(asked) ? asked : 7;
  try {
    const { stats, live } = await siteStats(db, site.id, days);
    return NextResponse.json({ domain: site.domain, days, stats, live, at: new Date().toISOString() }, { headers: NO_STORE });
  } catch (err) {
    console.error("[sites/stats]", err);
    return NextResponse.json({ error: "No pude leer las visitas" }, { status: 500, headers: NO_STORE });
  }
}
