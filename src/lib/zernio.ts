/**
 * Zernio (antes Late): publica y programa en Instagram, TikTok, Facebook y YouTube.
 * Cada cliente es un "profile" de Zernio; el cliente conecta sus redes con un link y publicamos con sus cuentas.
 * Docs: https://docs.zernio.com
 */
const BASE = "https://zernio.com/api/v1";

export const SOCIAL_PLATFORMS = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  youtube: "YouTube",
} as const;
export type SocialPlatform = keyof typeof SOCIAL_PLATFORMS;

export type SocialAccount = { id: string; platform: string; name: string; picture: string | null; healthy: boolean };

function key() {
  const k = process.env.ZERNIO_API_KEY;
  if (!k) throw new Error("Falta ZERNIO_API_KEY (zernio.com → API keys) en las variables de Vercel y en .env.local");
  return k;
}

async function z<T = Record<string, unknown>>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key()}`, ...(init.json !== undefined ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) },
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok && res.status !== 409) {
    const msg = (data as { error?: string; message?: string } | null)?.error ?? (data as { message?: string } | null)?.message ?? text.slice(0, 200);
    throw new Error(`Zernio ${res.status}: ${msg}`);
  }
  return (data ?? {}) as T;
}

/** Profile del cliente en Zernio (lo crea la primera vez). */
export async function ensureProfile(client: { id: string; name: string; zernio_profile_id: string | null }) {
  if (client.zernio_profile_id) return client.zernio_profile_id;
  const out = await z<{ profile?: { _id: string }; details?: { existingProfileId?: string } }>("/profiles", {
    method: "POST",
    json: { name: client.name.slice(0, 80), externalId: client.id },
  });
  const id = out.profile?._id ?? out.details?.existingProfileId;
  if (!id) throw new Error("Zernio no regresó el profile");
  return id;
}

/** Link para que el cliente conecte una red (lo abre en su navegador). */
export async function connectUrl(profileId: string, platform: SocialPlatform, redirectUrl: string) {
  const q = new URLSearchParams({ profileId, redirect_url: redirectUrl });
  const out = await z<{ authUrl?: string; url?: string }>(`/connect/${platform}?${q}`);
  const url = out.authUrl ?? out.url;
  if (!url) throw new Error("Zernio no regresó el link para conectar");
  return url;
}

/** Cuentas conectadas de un cliente. */
export async function listAccounts(profileId: string): Promise<SocialAccount[]> {
  const out = await z<{ accounts?: Record<string, unknown>[] }>(`/accounts?${new URLSearchParams({ profileId })}`);
  return (out.accounts ?? []).map((a) => ({
    id: String(a._id ?? a.id),
    platform: String(a.platform ?? ""),
    name: String(a.displayName ?? a.username ?? a.name ?? a.platform ?? ""),
    picture: (a.profilePicture ?? a.avatarUrl ?? a.picture ?? null) as string | null,
    healthy: a.isActive !== false && a.status !== "error",
  }));
}

/** Sube un archivo al almacenamiento de Zernio y regresa la URL pública para el post. */
export async function uploadMedia(file: Buffer, filename: string, contentType: string) {
  const pre = await z<{ uploadUrl: string; publicUrl: string }>("/media/presign", {
    method: "POST",
    json: { filename, contentType, size: file.length },
  });
  const put = await fetch(pre.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: new Uint8Array(file) });
  if (!put.ok) throw new Error(`No se pudo subir el video a Zernio (${put.status})`);
  return pre.publicUrl;
}

/** Crea el post en Zernio: programado, o inmediato si la hora ya pasó. */
export async function createPost(input: {
  caption: string;
  title?: string | null;
  mediaUrl: string | null;
  mediaType: "video" | "image";
  accounts: { platform: string; accountId: string }[];
  scheduledFor: Date;
  timezone: string;
  ref: string;
}) {
  const now = Date.now() + 60_000;
  const body: Record<string, unknown> = {
    content: input.caption,
    platforms: input.accounts.map((a) => ({
      platform: a.platform,
      accountId: a.accountId,
      ...(a.platform === "youtube" ? { platformSpecificData: { title: (input.title || input.caption.split("\n")[0] || "Video").slice(0, 100) } } : {}),
    })),
    timezone: input.timezone,
    metadata: { rootsPostId: input.ref },
    ...(input.mediaUrl ? { mediaItems: [{ url: input.mediaUrl, type: input.mediaType }] } : {}),
    ...(input.scheduledFor.getTime() <= now ? { publishNow: true } : { scheduledFor: input.scheduledFor.toISOString() }),
  };
  const out = await z<{ post?: Record<string, unknown>; postId?: string; error?: string; details?: { existingPostId?: string } }>("/posts", {
    method: "POST",
    json: body,
    headers: { "x-request-id": input.ref },
  });
  const id = (out.post?._id as string | undefined) ?? out.postId ?? out.details?.existingPostId;
  if (!id) throw new Error(out.error ?? "Zernio no regresó el post");
  return { id, post: out.post ?? null };
}

/** Estado actual de un post en Zernio. */
export async function getPost(postId: string) {
  const out = await z<{ post?: Record<string, unknown> }>(`/posts/${postId}`);
  return out.post ?? null;
}

/** Cancela un post programado. */
export async function deletePost(postId: string) {
  await z(`/posts/${postId}`, { method: "DELETE" });
}

/** Normaliza el resultado por red de un post de Zernio. */
export function postResults(post: Record<string, unknown> | null) {
  const plats = (post?.platforms ?? []) as Record<string, unknown>[];
  return plats.map((p) => ({
    platform: String(p.platform ?? ""),
    status: String(p.status ?? ""),
    url: (p.platformPostUrl ?? p.url ?? null) as string | null,
    error: (p.errorMessage ?? p.error ?? null) as string | null,
  }));
}

/** Traduce el estado de Zernio al nuestro. */
export function mapStatus(post: Record<string, unknown> | null): "scheduled" | "published" | "partial" | "failed" | null {
  const s = String(post?.status ?? "");
  if (s === "published") return "published";
  if (s === "partial") return "partial";
  if (s === "failed") return "failed";
  if (s === "scheduled" || s === "publishing" || s === "pending") return "scheduled";
  return null;
}
