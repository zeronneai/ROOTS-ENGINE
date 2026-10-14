/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { NextResponse } from "next/server";
import { canAccess, type Viewer } from "./auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runWithClient } from "@/lib/usage";

type Ctx = { params: Promise<{ id: string }> };

export function editRoute(
  fn: (args: { edit: Record<string, any>; viewer: Viewer; body: Record<string, unknown>; db: ReturnType<typeof supabaseAdmin> }) => Promise<unknown>,
) {
  return async (req: Request, ctx: Ctx) => {
    const { id } = await ctx.params;
    const db = supabaseAdmin();
    const { data: edit } = await db.from("edits").select("*, content_ideas(title, hooks)").eq("id", id).maybeSingle();
    if (!edit) return NextResponse.json({ error: "No existe" }, { status: 404 });
    const viewer = await canAccess(edit.client_id);
    if (!viewer) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    try {
      return NextResponse.json({ ok: true, result: await runWithClient(edit.client_id, () => fn({ edit, viewer, body, db })) });
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: (e as Error).message ?? String(e) }, { status: 500 });
    }
  };
}
