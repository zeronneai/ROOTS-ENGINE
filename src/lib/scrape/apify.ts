import { PRICES, recordUsage } from "../usage";
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
  const items = (await res.json()) as T[];
  const NAMES: Record<string, string> = {
    "apify~instagram-reel-scraper": "Instagram: videos",
    "apify~instagram-hashtag-scraper": "Instagram: hashtags",
    "clockworks~tiktok-scraper": "TikTok",
    "compass~crawler-google-places": "Google Maps",
    "apify~instagram-profile-scraper": "Instagram: perfiles",
  };
  void recordUsage({
    kind: "apify",
    detail: NAMES[actor] ?? actor,
    costUsd: items.length * (PRICES.apify[actor] ?? 0.0025),
    units: { actor, results: items.length },
  });
  return items;
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
export async function scrapeGooglePlace(opts: { url?: string | null; query?: string; location?: string | null }, maxReviews = 60) {
  const input: Record<string, unknown> = { maxReviews, reviewsSort: "newest", maxImages: 0, language: "es", scrapeReviewsPersonalData: false };
  if (opts.url) input.startUrls = [{ url: opts.url }];
  else {
    input.searchStringsArray = [opts.query];
    if (opts.location) input.locationQuery = opts.location;
    input.maxCrawledPlacesPerSearch = 1;
  }
  const items = await runActor<GmItem>(GMAPS_ACTOR, input);
  return items[0] ? mapPlace(items[0]) : null;
}

/** Hasta `n` resultados de Google para un nombre + ciudad, para escoger el que sí es el negocio. */
export async function searchGooglePlaces(query: string, location: string | null, n = 3, maxReviews = 40) {
  const input: Record<string, unknown> = {
    searchStringsArray: [query],
    maxCrawledPlacesPerSearch: n,
    maxReviews,
    reviewsSort: "newest",
    maxImages: 0,
    language: "es",
    scrapeReviewsPersonalData: false,
  };
  if (location) input.locationQuery = location;
  const items = await runActor<GmItem>(GMAPS_ACTOR, input);
  return items.map(mapPlace);
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

// ───────────────────────────── Perfiles (auditorías) ─────────────────────────────

const IG_PROFILE_ACTOR = process.env.APIFY_IG_PROFILE_ACTOR || "apify~instagram-profile-scraper";

export type SocialProfile = {
  platform: "instagram" | "tiktok";
  handle: string;
  name: string | null;
  bio: string | null;
  link: string | null;
  followers: number | null;
  following: number | null;
  posts: number | null;
  highlights: number | null;
  isBusiness: boolean | null;
  category: string | null;
  verified: boolean | null;
  hasProfilePic: boolean | null;
  recent: {
    type: string | null;
    caption: string | null;
    views: number | null;
    likes: number | null;
    comments: number | null;
    postedAt: string | null;
    url: string | null;
  }[];
};

type IgProfileItem = Record<string, unknown> & {
  username?: string; fullName?: string; biography?: string; externalUrl?: string; followersCount?: number; followsCount?: number;
  postsCount?: number; highlightReelCount?: number; isBusinessAccount?: boolean; businessCategoryName?: string; verified?: boolean;
  profilePicUrl?: string; profilePicUrlHD?: string;
  latestPosts?: { type?: string; caption?: string; likesCount?: number; commentsCount?: number; videoViewCount?: number; videoPlayCount?: number; timestamp?: string; url?: string }[];
};

/** Perfil completo de Instagram: bio, link, seguidores, destacadas y sus últimas 12 publicaciones (de todo tipo). */
export async function scrapeInstagramProfiles(handles: string[]): Promise<SocialProfile[]> {
  const list = [...new Set(handles.map(clean).filter(Boolean))];
  if (!list.length) return [];
  const items = await runActor<IgProfileItem>(IG_PROFILE_ACTOR, { usernames: list });
  return items
    .filter((i) => i.username)
    .map((i) => ({
      platform: "instagram" as const,
      handle: String(i.username).toLowerCase(),
      name: i.fullName ?? null,
      bio: i.biography ?? null,
      link: i.externalUrl ?? null,
      followers: num(i.followersCount),
      following: num(i.followsCount),
      posts: num(i.postsCount),
      highlights: num(i.highlightReelCount),
      isBusiness: typeof i.isBusinessAccount === "boolean" ? i.isBusinessAccount : null,
      category: i.businessCategoryName ?? null,
      verified: typeof i.verified === "boolean" ? i.verified : null,
      hasProfilePic: i.profilePicUrl ? true : null,
      recent: (i.latestPosts ?? []).slice(0, 12).map((p) => ({
        type: p.type ?? null,
        caption: p.caption ? String(p.caption).slice(0, 300) : null,
        views: num(p.videoPlayCount) ?? num(p.videoViewCount),
        likes: num(p.likesCount),
        comments: num(p.commentsCount),
        postedAt: p.timestamp ?? null,
        url: p.url ?? null,
      })),
    }));
}

type TtProfileItem = TtItem & {
  authorMeta?: TtItem["authorMeta"] & { signature?: string; following?: number; heart?: number; video?: number; verified?: boolean; bioLink?: { link?: string } | string | null; avatar?: string };
};

/** Perfil de TikTok con sus últimos videos (bio, seguidores, likes totales). */
export async function scrapeTiktokProfile(handle: string, perAccount = 15): Promise<SocialProfile | null> {
  const h = clean(handle);
  if (!h) return null;
  const items = await runActor<TtProfileItem>(TT_ACTOR, { profiles: [h], resultsPerPage: perAccount, shouldDownloadVideos: false });
  const first = items.find((i) => i.authorMeta);
  if (!first) return null;
  const a = first.authorMeta!;
  const link = typeof a.bioLink === "string" ? a.bioLink : (a.bioLink?.link ?? null);
  return {
    platform: "tiktok",
    handle: String(a.name ?? h).toLowerCase(),
    name: a.nickName ?? null,
    bio: a.signature ?? null,
    link,
    followers: num(a.fans),
    following: num(a.following),
    posts: num(a.video),
    highlights: null,
    isBusiness: null,
    category: null,
    verified: typeof a.verified === "boolean" ? a.verified : null,
    hasProfilePic: a.avatar ? true : null,
    recent: mapTt(items).map((p) => ({
      type: "video",
      caption: p.caption ? p.caption.slice(0, 300) : null,
      views: p.views,
      likes: p.likes,
      comments: p.comments,
      postedAt: p.postedAt,
      url: p.url,
    })),
  };
}
