/**
 * Scraping de Instagram y TikTok vía Apify (https://apify.com).
 * Actores usados (se pueden cambiar por env):
 *   IG:     apify/instagram-reel-scraper
 *   IG hashtags: apify/instagram-hashtag-scraper
 *   TikTok: clockworks/tiktok-scraper (perfiles y hashtags)
 */

export type ScrapedPost = {
  platform: "instagram" | "tiktok";
  handle: string;
  externalId: string;
  url: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  caption: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  duration: number | null;
  postedAt: string | null;
  followers: number | null;
  displayName: string | null;
};

const IG_ACTOR = process.env.APIFY_IG_ACTOR || "apify~instagram-reel-scraper";
const TT_ACTOR = process.env.APIFY_TIKTOK_ACTOR || "clockworks~tiktok-scraper";
const IG_HASHTAG_ACTOR = process.env.APIFY_IG_HASHTAG_ACTOR || "apify~instagram-hashtag-scraper";

async function runActor<T>(actor: string, input: unknown): Promise<T[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("Falta APIFY_TOKEN en el .env");
  const res = await fetch(
    `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}&timeout=280`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
  );
  if (!res.ok) throw new Error(`Apify ${actor}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T[];
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const clean = (h: string) => h.trim().replace(/^@/, "").replace(/\/$/, "").split("/").pop()!;

type IgItem = Record<string, unknown> & {
  id?: string; shortCode?: string; url?: string; videoUrl?: string; displayUrl?: string; caption?: string;
  videoPlayCount?: number; videoViewCount?: number; playsCount?: number; likesCount?: number; commentsCount?: number;
  videoDuration?: number; timestamp?: string; ownerUsername?: string; ownerFullName?: string;
};

export async function scrapeInstagram(handles: string[], perAccount = 30): Promise<ScrapedPost[]> {
  if (!handles.length) return [];
  const items = await runActor<IgItem>(IG_ACTOR, {
    username: handles.map(clean),
    resultsLimit: perAccount,
  });
  return mapIg(items);
}

/** Reels que más pegan con ciertos hashtags (para descubrir competencia). */
export async function scrapeInstagramHashtags(hashtags: string[], perTag = 30): Promise<ScrapedPost[]> {
  if (!hashtags.length) return [];
  const items = await runActor<IgItem>(IG_HASHTAG_ACTOR, {
    hashtags: hashtags.map((h) => h.replace(/^#/, "").replace(/\s+/g, "")),
    resultsType: "reels",
    resultsLimit: perTag,
  });
  return mapIg(items);
}

function mapIg(items: IgItem[]): ScrapedPost[] {
  return items
    .filter((i) => i.id || i.shortCode)
    .map((i) => ({
      platform: "instagram" as const,
      handle: String(i.ownerUsername ?? "").toLowerCase(),
      externalId: String(i.shortCode ?? i.id),
      url: i.url ?? (i.shortCode ? `https://www.instagram.com/reel/${i.shortCode}/` : null),
      videoUrl: i.videoUrl ?? null,
      thumbnailUrl: i.displayUrl ?? null,
      caption: i.caption ?? null,
      views: num(i.videoPlayCount) ?? num(i.playsCount) ?? num(i.videoViewCount),
      likes: num(i.likesCount),
      comments: num(i.commentsCount),
      duration: num(i.videoDuration),
      postedAt: i.timestamp ?? null,
      followers: null,
      displayName: i.ownerFullName ?? null,
    }));
}

type TtItem = Record<string, unknown> & {
  id?: string; webVideoUrl?: string; text?: string; playCount?: number; diggCount?: number; commentCount?: number;
  createTimeISO?: string; videoMeta?: { duration?: number; coverUrl?: string; downloadAddr?: string };
  authorMeta?: { name?: string; nickName?: string; fans?: number };
  mediaUrls?: string[];
};

export async function scrapeTiktok(handles: string[], perAccount = 30): Promise<ScrapedPost[]> {
  if (!handles.length) return [];
  const items = await runActor<TtItem>(TT_ACTOR, {
    profiles: handles.map(clean),
    resultsPerPage: perAccount,
    shouldDownloadVideos: false,
  });
  return mapTt(items);
}

export async function scrapeTiktokHashtags(hashtags: string[], perTag = 20): Promise<ScrapedPost[]> {
  if (!hashtags.length) return [];
  const items = await runActor<TtItem>(TT_ACTOR, {
    hashtags: hashtags.map((h) => h.replace(/^#/, "").replace(/\s+/g, "")),
    resultsPerPage: perTag,
    shouldDownloadVideos: false,
  });
  return mapTt(items);
}

function mapTt(items: TtItem[]): ScrapedPost[] {
  return items
    .filter((i) => i.id)
    .map((i) => ({
      platform: "tiktok" as const,
      handle: String(i.authorMeta?.name ?? "").toLowerCase(),
      externalId: String(i.id),
      url: i.webVideoUrl ?? null,
      videoUrl: i.mediaUrls?.[0] ?? i.videoMeta?.downloadAddr ?? null,
      thumbnailUrl: i.videoMeta?.coverUrl ?? null,
      caption: i.text ?? null,
      views: num(i.playCount),
      likes: num(i.diggCount),
      comments: num(i.commentCount),
      duration: num(i.videoMeta?.duration),
      postedAt: i.createTimeISO ?? null,
      followers: num(i.authorMeta?.fans),
      displayName: i.authorMeta?.nickName ?? null,
    }));
}

export const median = (xs: number[]) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** outlier = vistas / mediana de la cuenta. 3x o más = vale la pena estudiarlo. */
export function withOutlierScores<T extends { views: number | null }>(posts: T[]) {
  const med = median(posts.map((p) => p.views ?? 0).filter((v) => v > 0));
  return {
    median: med,
    posts: posts.map((p) => ({ ...p, outlierScore: med > 0 && p.views ? +(p.views / med).toFixed(2) : null })),
  };
}

// ───────────────────────────── Google Maps ─────────────────────────────

const GMAPS_ACTOR = process.env.APIFY_GMAPS_ACTOR || "compass~crawler-google-places";

export type GooglePlace = {
  title: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewsCount: number | null;
  hours: string[];
  url: string | null;
  reviews: { stars: number | null; text: string; date: string | null }[];
};

type GmItem = Record<string, unknown> & {
  title?: string; categoryName?: string; address?: string; phone?: string; website?: string; totalScore?: number;
  reviewsCount?: number; url?: string; openingHours?: { day?: string; hours?: string }[];
  reviews?: { text?: string | null; stars?: number; publishedAtDate?: string }[];
};

function mapPlace(i: GmItem): GooglePlace {
  return {
    title: String(i.title ?? ""),
    category: i.categoryName ?? null,
    address: i.address ?? null,
    phone: i.phone ?? null,
    website: i.website ?? null,
    rating: num(i.totalScore),
    reviewsCount: num(i.reviewsCount),
    hours: (i.openingHours ?? []).map((h) => `${h.day ?? ""}: ${h.hours ?? ""}`.trim()),
    url: i.url ?? null,
    reviews: (i.reviews ?? [])
      .filter((r) => r.text)
      .map((r) => ({ stars: num(r.stars), text: String(r.text).slice(0, 400), date: r.publishedAtDate ?? null })),
  };
}

/** Perfil de Google del negocio: por link de Google Maps o buscando nombre + ciudad. */
export async function scrapeGooglePlace(opts: { url?: string | null; query?: string; location?: string | null }, maxReviews = 15) {
  const input: Record<string, unknown> = { maxReviews, maxImages: 0, language: "es", scrapeReviewsPersonalData: false };
  if (opts.url) input.startUrls = [{ url: opts.url }];
  else {
    input.searchStringsArray = [opts.query];
    if (opts.location) input.locationQuery = opts.location;
    input.maxCrawledPlacesPerSearch = 1;
  }
  const items = await runActor<GmItem>(GMAPS_ACTOR, input);
  return items[0] ? mapPlace(items[0]) : null;
}

/** Los negocios del mismo giro en la ciudad, con calificación y reseñas (mercado local). */
export async function scrapeGoogleLocalMarket(search: string, location: string, max = 15) {
  const items = await runActor<GmItem>(GMAPS_ACTOR, {
    searchStringsArray: [search],
    locationQuery: location,
    maxCrawledPlacesPerSearch: max,
    maxReviews: 0,
    maxImages: 0,
    language: "es",
  });
  return items.map(mapPlace).map(({ reviews, ...p }) => (void reviews, p));
}
