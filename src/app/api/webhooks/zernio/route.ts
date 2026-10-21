import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { mapStatus, postResults } from "@/lib/zernio";

/**
 * Avisos de Zernio: cuando un post se publica o falla, actualizamos su estado.
 * Se registra en zernio.com/dashboard/webhooks con la URL https://TU-DOMINIO/api/webhooks/zernio
 * y el mismo secreto que ZERNIO_WEBHOOK_SECRET.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.ZERNIO_WEBHOOK_SECRET;
  const sig = req.headers.get("x-zernio-signature") ?? req.headers.get("x-late-signature") ?? "";
  if (!secret || !sig) return NextResponse.json({ error: "sin firma" }, { status: 401 });
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return NextResponse.json({ error: "firma inválida" }, { status: 400 });

  const payload = JSON.parse(raw || "{}") as { event?: string; type?: string; post?: Record<string, unknown> };
  const event = payload.event ?? payload.type ?? "";
  const post = payload.post ?? null;
  const postId = (post?._id ?? post?.id) as string | undefined;
  if (!postId || !event.startsWith("post.")) return NextResponse.json({ ok: true });

  const db = supabaseAdmin();
  const status =
    event === "post.published" ? "published" : event === "post.failed" ? "failed" : event === "post.partial" ? "partial" : event === "post.cancelled" ? "canceled" : mapStatus(post);
  const patch: Record<string, unknown> = { results: postResults(post) };
  if (status) patch.status = status;
  if (status === "failed") patch.error = String((post?.error ?? post?.errorMessage ?? "Zernio no pudo publicar") as string).slice(0, 500);
  await db.from("scheduled_posts").update(patch).eq("zernio_post_id", postId);
  return NextResponse.json({ ok: true });
}
