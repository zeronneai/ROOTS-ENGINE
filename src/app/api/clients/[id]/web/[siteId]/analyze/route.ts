import { NextResponse } from "next/server";
import { canAccess } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runWithClient } from "@/lib/usage";
import { analyzeSite } from "@/server/web";

export const maxDuration = 120;

/** Análisis con IA de los últimos 30 días del sitio (solo cuando se pide). */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string; siteId: string }> }) {
  const { id, siteId } = await ctx.params;
  if (!(await canAccess(id))) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  try {
    const result = await runWithClient(id, () => analyzeSite(supabaseAdmin(), id, siteId));
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
