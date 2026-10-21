import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Recibe las visitas del código t.js que va en cada sitio. Público, sin cookies. */
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|whatsapp|curl|wget|python|vercel/i;
const siteCache = new Map<string, { id: string; at: number } | null>();

const str = (v: unknown, max: number) => (typeof v === "string" && v ? v.slice(0, max) : null);

function device(ua: string, width: number) {
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "Tablet";
  if (/Mobi|iPhone|Android/i.test(ua) || (width && width < 760)) return "Celular";
  return "Compu";
}
const browser = (ua: string) => (/Edg\//.test(ua) ? "Edge" : /Instagram/.test(ua) ? "Instagram" : /FBAN|FBAV/.test(ua) ? "Facebook" : /TikTok|musical_ly/i.test(ua) ? "TikTok" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Otro");
const os = (ua: string) => (/iPhone|iPad|iOS/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Otro");

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  const ua = req.headers.get("user-agent") ?? "";
  if (BOT.test(ua)) return new NextResponse(null, { status: 204, headers: CORS });
  let b: Record<string, unknown>;
  try {
    b = JSON.parse(await req.text());
  } catch {
    return new NextResponse(null, { status: 400, headers: CORS });
  }
  const key = str(b.k, 64);
  const type = b.t === "pageview" || b.t === "leave" || b.t === "click" ? b.t : null;
  if (!key || !type || !str(b.v, 64) || !str(b.s, 64)) return new NextResponse(null, { status: 400, headers: CORS });

  const db = supabaseAdmin();
  let site = siteCache.get(key);
  if (site === undefined || (site && Date.now() - site.at > 10 * 60_000)) {
    const { data } = await db.from("sites").select("id").eq("key", key).maybeSingle();
    site = data ? { id: data.id, at: Date.now() } : null;
    siteCache.set(key, site);
  }
  if (!site) return new NextResponse(null, { status: 404, headers: CORS });

  let refDomain: string | null = null;
  const referrer = str(b.r, 500);
  if (referrer) {
    try {
      refDomain = new URL(referrer).hostname.replace(/^www\./, "");
      const origin = req.headers.get("origin");
      if (origin && new URL(origin).hostname.replace(/^www\./, "") === refDomain) refDomain = null; // navegación interna
    } catch {
      refDomain = null;
    }
  }
  const u = (b.u ?? {}) as Record<string, unknown>;
  const width = Number(b.w) || 0;
  const city = req.headers.get("x-vercel-ip-city");
  await db.from("web_events").insert({
    site_id: site.id,
    type,
    visitor: str(b.v, 64),
    session: str(b.s, 64),
    path: str(b.p, 300) ?? "/",
    title: str(b.ti, 200),
    referrer,
    ref_domain: refDomain,
    utm_source: str(u.utm_source, 100),
    utm_medium: str(u.utm_medium, 100),
    utm_campaign: str(u.utm_campaign, 100),
    device: device(ua, width),
    browser: browser(ua),
    os: os(ua),
    country: req.headers.get("x-vercel-ip-country"),
    city: city ? decodeURIComponent(city) : null,
    duration_ms: type === "leave" ? Math.max(0, Math.min(3_600_000, Math.round(Number(b.d) || 0))) : null,
    scroll: type === "leave" ? Math.max(0, Math.min(100, Math.round(Number(b.sc) || 0))) : null,
    label: type === "click" ? str(b.l, 80) : null,
  });
  return new NextResponse(null, { status: 204, headers: CORS });
}
