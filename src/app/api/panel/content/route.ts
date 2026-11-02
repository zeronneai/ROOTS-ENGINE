import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Aprobar videos desde el panel propio del cliente (servidor a servidor), sin entrar a Roots Engine.
 *   GET  /api/panel/content            Authorization: Bearer <panel_token del cliente>
 *   POST /api/panel/content { action, id, ... }
 *     save     { caption }                       guarda el copy sin aprobar
 *     approve  { caption, overlayText?, mediaPath? }  aprueba (mediaPath = video con el texto ya quemado)
 *     reject   {}                                descarta
 *     pending  {}                                regresa a por aprobar
 *     upload   { ext }                           link firmado para subir el video con texto
 * El token se copia en Roots Engine: cliente → Aprobar → Panel propio del cliente. Nunca va en el navegador.
 * Las carpetas de Dropbox no salen por aquí: solo la agencia las ve y las cambia.
 */
const NO_STORE = { "Cache-Control": "no-store" };
const deny = () => NextResponse.json({ error: "Sin acceso" }, { status: 401, headers: NO_STORE });
const clean = (s: unknown) => String(s ?? "").replace(/\s*[—–]\s*/g, ", ").slice(0, 2200);

async function auth(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const db = supabaseAdmin();
  const { data } = await db.from("clients").select("id, name").eq("panel_token", token).maybeSingle();
  return data ? { db, client: data as { id: string; name: string } } : null;
}

type Row = {
  id: string; file_name: string; kind: "video" | "image"; status: string; caption: string;
  hooks: { text: string; angle: string }[] | null; captions: { kind: string; text: string }[] | null;
  version: number | null; media_path: string | null; overlay_text: string | null; approved_at: string | null; approved_by: string | null; created_at: string;
  scheduled_posts: { status: string; scheduled_for: string; results: { platform: string; url: string | null }[] | null } | null;
};

export async function GET(req: Request) {
  const a = await auth(req);
  if (!a) return deny();
  const { db, client } = a;
  const [{ data: rows }, { data: upcoming }] = await Promise.all([
    db.from("queue_items")
      .select("id, file_name, kind, status, caption, hooks, captions, version, media_path, overlay_text, approved_at, approved_by, created_at, scheduled_posts!queue_items_scheduled_post_id_fkey(status, scheduled_for, results)")
      .eq("client_id", client.id).neq("status", "failed").order("created_at", { ascending: true }).limit(300),
    db.from("scheduled_posts").select("scheduled_for").eq("client_id", client.id).eq("media_source", "queue").eq("status", "waiting_media").order("scheduled_for").limit(40),
  ]);
  const items = (rows ?? []) as unknown as Row[];
  const keep = (s: string, n: number) => items.filter((i) => i.status === s).slice(-n);
  const list = [...keep("processing", 50), ...keep("pending", 100), ...keep("approved", 100), ...keep("scheduled", 40), ...keep("rejected", 20)];
  const paths = list.filter((i) => i.status !== "rejected" && i.media_path).map((i) => i.media_path!);
  const { data: signed } = paths.length ? await db.storage.from("recordings").createSignedUrls(paths, 60 * 60 * 3) : { data: [] };
  const urls = new Map((signed ?? []).map((d) => [d.path, d.signedUrl]));
  const out = list.map((i) => ({
    id: i.id, name: i.file_name, kind: i.kind, status: i.status, caption: i.caption, captions: i.captions ?? [], hooks: i.hooks ?? [],
    version: i.version ?? 1, overlayText: i.overlay_text, approvedAt: i.approved_at, approvedBy: i.approved_by, createdAt: i.created_at,
    url: i.media_path ? (urls.get(i.media_path) ?? null) : null,
    post: i.scheduled_posts ? { status: i.scheduled_posts.status, at: i.scheduled_posts.scheduled_for, links: (i.scheduled_posts.results ?? []).filter((r) => r.url) } : null,
  }));
  return NextResponse.json({ client: client.name, items: out, slots: (upcoming ?? []).map((u) => u.scheduled_for), at: new Date().toISOString() }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  const a = await auth(req);
  if (!a) return deny();
  const { db, client } = a;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(b.id ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Falta el video" }, { status: 400, headers: NO_STORE });
  const by = String(b.by ?? "Panel del cliente").slice(0, 60);
  const done = async (p: PromiseLike<{ error: unknown; data?: unknown[] | null }>) => {
    const { error, data } = await p;
    if (error) return NextResponse.json({ error: "No se pudo guardar" }, { status: 500, headers: NO_STORE });
    if (Array.isArray(data) && !data.length) return NextResponse.json({ error: "Ese video ya cambió de estado" }, { status: 409, headers: NO_STORE });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  };
  switch (b.action) {
    case "save":
      return done(db.from("queue_items").update({ caption: clean(b.caption) }).eq("id", id).eq("client_id", client.id).in("status", ["pending", "approved"]).select("id"));
    case "approve": {
      const update: Record<string, unknown> = { caption: clean(b.caption), status: "approved", approved_at: new Date().toISOString(), approved_by: by };
      if (b.mediaPath) {
        const mp = String(b.mediaPath);
        if (!mp.startsWith(`${client.id}/queue/${id}-`) || mp.includes("..")) return NextResponse.json({ error: "Archivo inválido" }, { status: 400, headers: NO_STORE });
        update.media_path = mp;
        update.overlay_text = String(b.overlayText ?? "").slice(0, 200) || null;
      }
      return done(db.from("queue_items").update(update).eq("id", id).eq("client_id", client.id).in("status", ["pending", "approved"]).select("id"));
    }
    case "reject":
      return done(db.from("queue_items").update({ status: "rejected" }).eq("id", id).eq("client_id", client.id).in("status", ["pending", "approved"]).select("id"));
    case "pending":
      return done(db.from("queue_items").update({ status: "pending", approved_at: null }).eq("id", id).eq("client_id", client.id).in("status", ["approved", "rejected"]).select("id"));
    case "upload": {
      const { data: it } = await db.from("queue_items").select("id").eq("id", id).eq("client_id", client.id).in("status", ["pending", "approved"]).maybeSingle();
      if (!it) return NextResponse.json({ error: "Ese video ya cambió de estado" }, { status: 409, headers: NO_STORE });
      const ext = b.ext === "jpg" ? "jpg" : "mp4";
      const path = `${client.id}/queue/${id}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      const { data, error } = await db.storage.from("recordings").createSignedUploadUrl(path);
      if (error || !data) return NextResponse.json({ error: "No se pudo preparar la subida" }, { status: 500, headers: NO_STORE });
      return NextResponse.json({ ok: true, path, url: data.signedUrl }, { headers: NO_STORE });
    }
    default:
      return NextResponse.json({ error: "Acción desconocida" }, { status: 400, headers: NO_STORE });
  }
}
