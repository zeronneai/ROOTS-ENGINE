import "server-only";

/**
 * Revisión rápida de un sitio web para la auditoría: lo que ve un cliente al entrar
 * (título, promesa, botones, teléfono, formularios, WhatsApp, reservas) y lo básico técnico
 * (https, móvil, velocidad del servidor, SEO, píxeles). También saca las redes que enlaza,
 * para encontrar las redes de la competencia sin buscarlas a mano.
 */

export type SiteCheck = {
  url: string;
  finalUrl: string | null;
  ok: boolean;
  status: number | null;
  error: string | null;
  https: boolean;
  responseMs: number | null;
  htmlKb: number | null;
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  h2: string[];
  lang: string | null;
  mobileViewport: boolean;
  phoneLinks: string[];
  emailLinks: string[];
  whatsapp: boolean;
  forms: number;
  bookingTools: string[];
  ctaTexts: string[];
  images: number;
  imagesWithoutAlt: number;
  schemaTypes: string[];
  tracking: string[];
  socials: { instagram: string[]; tiktok: string[]; facebook: string[]; youtube: string[] };
  /** el texto visible, recortado, para que Claude lea la promesa y la oferta */
  text: string | null;
  /** probablemente armado con JavaScript: casi no trae texto en el HTML */
  clientRendered: boolean;
};

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const strip = (html: string) => decode(html.replace(/<[^>]+>/g, " "));
const uniq = <T,>(xs: T[]) => [...new Set(xs)];

function allMatches(html: string, re: RegExp, group = 1) {
  const out: string[] = [];
  for (const m of html.matchAll(re)) if (m[group]) out.push(m[group]);
  return out;
}

const SKIP_HANDLES = new Set(["p", "reel", "reels", "explore", "stories", "tv", "share", "sharer", "sharer.php", "tr", "plugins", "dialog", "hashtag", "watch", "embed", "channel", "c", "user", "intent"]);

function handlesFrom(links: string[], re: RegExp) {
  return uniq(
    links
      .map((l) => l.match(re)?.[1]?.toLowerCase())
      .filter((h): h is string => !!h && !SKIP_HANDLES.has(h) && h.length > 1),
  ).slice(0, 3);
}

const BOOKING = [
  ["calendly", /calendly\.com/i],
  ["Square", /squareup\.com|square\.site/i],
  ["Vagaro", /vagaro\.com/i],
  ["Booksy", /booksy\.com/i],
  ["Fresha", /fresha\.com/i],
  ["Acuity", /acuityscheduling\.com/i],
  ["GlossGenius", /glossgenius\.com/i],
  ["Mindbody", /mindbodyonline\.com|mindbody\.io/i],
  ["OpenTable", /opentable\.com/i],
  ["Toast", /toasttab\.com/i],
  ["Shopify", /cdn\.shopify\.com|myshopify\.com/i],
  ["Stripe", /js\.stripe\.com|buy\.stripe\.com/i],
  ["Wix Bookings", /wix-bookings|bookings\.wix/i],
] as const;

const TRACKERS = [
  ["Meta Pixel", /connect\.facebook\.net\/[^"']*fbevents|fbq\(/i],
  ["Google Analytics", /googletagmanager\.com\/gtag|google-analytics\.com|gtag\(/i],
  ["Google Tag Manager", /googletagmanager\.com\/gtm\.js/i],
  ["TikTok Pixel", /analytics\.tiktok\.com/i],
  ["Roots Engine", /roots-engine\.vercel\.app\/t\.js/i],
] as const;

const CTA_WORDS =
  /\b(book|schedule|call|contact|get started|get a quote|free|consult|order|buy|shop|reserve|apply|sign up|join|start|agenda|reserva|llama|cont[aá]ct|cotiza|compra|consulta|inscr[ií]bete|empieza)\b/i;

export async function checkSite(raw: string): Promise<SiteCheck> {
  const url = raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`;
  const base: SiteCheck = {
    url,
    finalUrl: null,
    ok: false,
    status: null,
    error: null,
    https: url.startsWith("https://"),
    responseMs: null,
    htmlKb: null,
    title: null,
    metaDescription: null,
    h1: [],
    h2: [],
    lang: null,
    mobileViewport: false,
    phoneLinks: [],
    emailLinks: [],
    whatsapp: false,
    forms: 0,
    bookingTools: [],
    ctaTexts: [],
    images: 0,
    imagesWithoutAlt: 0,
    schemaTypes: [],
    tracking: [],
    socials: { instagram: [], tiktok: [], facebook: [], youtube: [] },
    text: null,
    clientRendered: false,
  };
  const t0 = Date.now();
  let html: string;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RootsEngineAudit/1.0)", Accept: "text/html" },
    });
    base.status = res.status;
    base.finalUrl = res.url || url;
    base.https = (res.url || url).startsWith("https://");
    html = await res.text();
    base.responseMs = Date.now() - t0;
    base.ok = res.ok;
    if (!res.ok) {
      base.error = `El sitio respondió ${res.status}`;
      return base;
    }
  } catch (e) {
    base.error = (e as Error).name === "TimeoutError" ? "No cargó en 15 segundos" : `No se pudo abrir: ${(e as Error).message}`;
    return base;
  }

  base.htmlKb = Math.round(Buffer.byteLength(html) / 1024);
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  base.title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim() ? decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)![1]) : null;
  base.metaDescription =
    html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i)?.[1] ??
    null;
  if (base.metaDescription) base.metaDescription = decode(base.metaDescription);
  base.h1 = allMatches(body, /<h1[^>]*>([\s\S]*?)<\/h1>/gi).map(strip).filter(Boolean).slice(0, 4);
  base.h2 = allMatches(body, /<h2[^>]*>([\s\S]*?)<\/h2>/gi).map(strip).filter(Boolean).slice(0, 10);
  base.lang = html.match(/<html[^>]*\slang=["']([^"']+)["']/i)?.[1] ?? null;
  base.mobileViewport = /<meta[^>]+name=["']viewport["']/i.test(html);

  const hrefs = allMatches(html, /href=["']([^"']+)["']/gi);
  base.phoneLinks = uniq(hrefs.filter((h) => /^tel:/i.test(h)).map((h) => h.replace(/^tel:/i, ""))).slice(0, 4);
  base.emailLinks = uniq(hrefs.filter((h) => /^mailto:/i.test(h)).map((h) => h.replace(/^mailto:/i, "").split("?")[0])).slice(0, 4);
  base.whatsapp = hrefs.some((h) => /wa\.me|whatsapp\.com|api\.whatsapp/i.test(h));
  base.forms = (body.match(/<form[\s>]/gi) ?? []).length;
  base.bookingTools = BOOKING.filter(([, re]) => re.test(html)).map(([n]) => n);
  base.tracking = TRACKERS.filter(([, re]) => re.test(html)).map(([n]) => n);

  const buttons = [
    ...allMatches(body, /<button[^>]*>([\s\S]*?)<\/button>/gi),
    ...allMatches(body, /<a[^>]*>([\s\S]*?)<\/a>/gi),
  ]
    .map(strip)
    .filter((t) => t.length > 1 && t.length < 40 && CTA_WORDS.test(t));
  base.ctaTexts = uniq(buttons).slice(0, 12);

  const imgs = allMatches(body, /<img([^>]*)>/gi, 1);
  base.images = imgs.length;
  base.imagesWithoutAlt = imgs.filter((a) => !/\salt=/i.test(a)).length; // alt="" (decorativa) cuenta como bien

  base.schemaTypes = uniq(
    allMatches(html, /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi).flatMap((j) =>
      allMatches(j, /"@type"\s*:\s*"([^"]+)"/g),
    ),
  ).slice(0, 10);

  base.socials = {
    instagram: handlesFrom(hrefs, /instagram\.com\/([A-Za-z0-9._]+)/i),
    tiktok: handlesFrom(hrefs, /tiktok\.com\/@([A-Za-z0-9._]+)/i),
    facebook: handlesFrom(hrefs, /facebook\.com\/([A-Za-z0-9.\-]+)/i),
    youtube: handlesFrom(hrefs, /youtube\.com\/(?:@|c\/|channel\/)?([A-Za-z0-9._\-]+)/i),
  };

  const text = strip(body);
  base.text = text ? text.slice(0, 6000) : null;
  base.clientRendered = text.length < 300;
  return base;
}

/** Normaliza lo que escriben (link, @handle o handle) a un handle limpio. */
export function handleOf(v: string | null | undefined, platform: "instagram" | "tiktok" | "facebook") {
  if (!v) return null;
  const s = v.trim();
  const re =
    platform === "instagram"
      ? /instagram\.com\/([A-Za-z0-9._]+)/i
      : platform === "tiktok"
        ? /tiktok\.com\/@?([A-Za-z0-9._]+)/i
        : /facebook\.com\/([A-Za-z0-9.\-]+)/i;
  const m = s.match(re);
  const h = (m ? m[1] : s).replace(/^@/, "").replace(/\/.*$/, "").trim().toLowerCase();
  return h || null;
}
