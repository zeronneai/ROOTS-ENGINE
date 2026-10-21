import { NextResponse } from "next/server";
import { canAccess } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { connectUrl, SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/zernio";
import { clientProfile } from "@/server/publishing";

/** Regresa el link para conectar una red social del cliente (lo abre su navegador). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!(await canAccess(id))) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { platform?: string };
  const platform = body.platform as SocialPlatform;
  if (!platform || !(platform in SOCIAL_PLATFORMS)) return NextResponse.json({ error: "Red inválida" }, { status: 400 });
  try {
    const profileId = await clientProfile(supabaseAdmin(), id);
    const origin = new URL(req.url).origin;
    const url = await connectUrl(profileId, platform, `${origin}/c/${id}/publicar?conectada=${platform}`);
    return NextResponse.json({ ok: true, result: url });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
