import "server-only";
import { NextResponse } from "next/server";
import { canAccess, type Viewer } from "./auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

/** Valida acceso al cliente y corre la acción con el cliente admin. */
export function clientRoute(
  fn: (args: { clientId: string; viewer: Viewer; body: Record<string, unknown>; db: ReturnType<typeof supabaseAdmin> }) => Promise<unknown>,
  opts: { agencyOnly?: boolean } = {},
) {
  return async (req: Request, ctx: Ctx) => {
    const { id } = await ctx.params;
    const viewer = await canAccess(id);
    if (!viewer) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
    if (opts.agencyOnly && viewer.role !== "agency")
      return NextResponse.json({ error: "Solo la agencia" }, { status: 403 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    try {
      const result = await fn({ clientId: id, viewer, body, db: supabaseAdmin() });
      return NextResponse.json({ ok: true, result });
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: (e as Error).message ?? String(e) }, { status: 500 });
    }
  };
}
