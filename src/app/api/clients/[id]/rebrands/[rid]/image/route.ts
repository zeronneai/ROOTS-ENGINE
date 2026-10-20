import { NextResponse } from "next/server";
import { canAccess } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runWithClient } from "@/lib/usage";
import { generateRebrandImage } from "@/server/rebrands";

export const maxDuration = 300;

/** Genera el logo, monograma o mockup de una dirección del rebranding. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string; rid: string }> }) {
  const { id, rid } = await ctx.params;
  const viewer = await canAccess(id);
  if (!viewer || viewer.role !== "agency") return NextResponse.json({ error: "Solo la agencia" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const direction = body.direction === "A" || body.direction === "B" || body.direction === "C" ? body.direction : null;
  const kind = body.kind === "logo" || body.kind === "monogram" || body.kind === "mockup" ? body.kind : null;
  if (!direction || !kind) return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  try {
    const path = await runWithClient(id, () =>
      generateRebrandImage(supabaseAdmin(), id, rid, { direction, kind, index: Number(body.index) || 0 }),
    );
    return NextResponse.json({ ok: true, result: path });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: (e as Error).message ?? String(e) }, { status: 500 });
  }
}
