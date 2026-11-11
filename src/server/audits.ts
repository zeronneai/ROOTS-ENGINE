import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { googleSearch, median, scrapeGoogleLocalMarket, scrapeGooglePlace, scrapeInstagramProfiles, searchGooglePlaces, scrapeTiktokProfile, type GooglePlace, type SocialProfile } from "@/lib/scrape/apify";
import { writeClosing, writeDiagnosis, type AuditDraft, type AuditInput, type AuditReport } from "@/lib/ai/audit";
import { checkSite, handleOf, type SiteCheck } from "./audit/site-check";
import type { AuditStepId } from "@/lib/audit-steps";

export type AuditRow = {
  id: string;
  created_at: string;
  updated_at: string;
  business_name: string;
  intro: string | null;
  category: string | null;
  city: string;
  website: string | null;
  google_maps_url: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  team_notes: string | null;
  language: "en" | "es";
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: "new" | "running" | "done" | "error";
  step: string | null;
  error: string | null;
  research: Research;
  report: AuditReport | null;
  report_at: string | null;
  share_token: string;
};

type Market = Omit<GooglePlace, "reviews">;

export type Research = {
  /** lo que encontramos solos (búsqueda en Google, bio de Instagram, perfil de Google Maps) */
  discovery?: { found: { field: "website" | "instagram" | "tiktok" | "facebook"; value: string; source: string }[]; searchedWeb: boolean };
  google?: {
    place: GooglePlace | null;
    /** qué tan seguros estamos de que ese perfil de Google es el del negocio */
    match?: "link" | "sure" | "likely" | "unsure" | "none";
    /** otros resultados que salieron con su nombre, por si el bueno era otro */
    alternatives?: { title: string; address: string | null; category: string | null; rating: number | null; reviewsCount: number | null; url: string | null }[];
    category: string | null;
    localMarket: Market[];
    competitorReviews: { name: string; rating: number | null; reviewsCount: number | null; reviews: GooglePlace["reviews"] }[];
  };
  web?: {
    own: SiteCheck | null;
    competitors: (Pick<SiteCheck, "url" | "ok" | "title" | "h1" | "ctaTexts" | "bookingTools" | "whatsapp" | "forms" | "responseMs" | "mobileViewport" | "tracking" | "socials"> & {
      name: string;
      text: string | null;
    })[];
  };
  /** el diagnóstico escrito, esperando el cierre */
  draft?: AuditDraft;
  social?: {
    own: (ProfileStats | { platform: string; handle: string; notFound: true })[];
    facebook: string | null;
    competitors: (ProfileStats & { business: string })[];
  };
};

export type ProfileStats = SocialProfile & {
  stats: {
    postsLast30Days: number;
    daysSinceLastPost: number | null;
    medianViews: number | null;
    avgLikes: number | null;
    avgComments: number | null;
    engagementPct: number | null;
  };
};

export function withStats(p: SocialProfile): ProfileStats {
  const now = Date.now();
  const dates = p.recent.map((r) => (r.postedAt ? new Date(r.postedAt).getTime() : 0)).filter(Boolean);
  const views = p.recent.map((r) => r.views).filter((v): v is number => v != null);
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x != null);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  const likes = avg(p.recent.map((r) => r.likes));
  const comments = avg(p.recent.map((r) => r.comments));
  return {
    ...p,
    stats: {
      postsLast30Days: dates.filter((d) => now - d < 30 * 864e5).length,
      daysSinceLastPost: dates.length ? Math.round((now - Math.max(...dates)) / 864e5) : null,
      medianViews: views.length ? median(views) : null,
      avgLikes: likes,
      avgComments: comments,
      engagementPct: p.followers && likes != null ? +((((likes ?? 0) + (comments ?? 0)) / p.followers) * 100).toFixed(2) : null,
    },
  };
}

const hostOf = (u: string | null | undefined) => {
  if (!u) return null;
  try {
    return new URL(u.startsWith("http") ? u : `https://${u}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

/** Competidores locales más fuertes (por reseñas), sin el propio negocio. */
function topCompetitors(r: Research, n: number) {
  return [...(r.google?.localMarket ?? [])].sort((a, b) => (b.reviewsCount ?? 0) - (a.reviewsCount ?? 0)).slice(0, n);
}

export async function loadAudit(db: SupabaseClient, id: string) {
  const { data } = await db.from("audits").select("*").eq("id", id).maybeSingle();
  return (data as AuditRow | null) ?? null;
}

async function save(db: SupabaseClient, id: string, patch: Partial<AuditRow>) {
  const { error } = await db.from("audits").update(patch).eq("id", id);
  if (error) throw error;
}

const LINK_PAGES = /linktr\.ee|linkin\.bio|beacons\.ai|lnk\.bio|campsite\.bio|bio\.site|taplink|stan\.store|hoo\.be|komi\.io|carrd\.co|solo\.to/i;
const NOT_A_SITE = /instagram\.com|tiktok\.com|facebook\.com|fb\.com|youtube\.com|youtu\.be|wa\.me|whatsapp|twitter\.com|x\.com|threads\.net|pinterest|spotify|apple\.com|google\.com|goo\.gl|maps\.app|linkedin|snapchat|cash\.app|venmo|paypal/i;

/**
 * El link de la bio de Instagram como sitio web. Si es un Linktree (o parecido), entra y busca
 * el primer link que sí sea un sitio (no otra red social). Si no hay, regresa null.
 */
async function realSite(link: string): Promise<string | null> {
  const url = /^https?:\/\//i.test(link) ? link : `https://${link}`;
  if (NOT_A_SITE.test(url)) return null;
  if (!LINK_PAGES.test(url)) return url;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { "User-Agent": "Mozilla/5.0 (compatible; RootsEngineAudit/1.0)" } });
    const html = await res.text();
    const links = [...html.matchAll(/https?:\/\/[^"'\s<>\\]+/g)].map((m) => m[0].replace(/&amp;/g, "&"));
    const site = links.find((l) => !LINK_PAGES.test(l) && !NOT_A_SITE.test(l) && !/\.(png|jpe?g|webp|svg|gif|css|js|woff2?)(\?|$)/i.test(l) && !/cdn|static|assets|schema\.org|w3\.org|cloudflare|googleapis|gstatic|sentry|linktr/i.test(l));
    return site ?? null;
  } catch {
    return null;
  }
}

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !["the", "el", "la", "los", "las", "de", "y", "and", "llc", "inc", "co"].includes(w));

/** 0 a 1: cuánto se parece el nombre en Google al nombre del negocio. */
function nameScore(a: string, b: string) {
  const A = new Set(words(a));
  const B = words(b);
  if (!A.size || !B.length) return 0;
  const hits = B.filter((w) => A.has(w) || [...A].some((x) => x.startsWith(w) || w.startsWith(x))).length;
  return hits / Math.max(A.size, B.length);
}

/** Últimos 10 dígitos de un teléfono, para comparar sin formato. */
const digits = (v: string | null | undefined) => {
  const d = (v ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
};

/** ¿Un @ o un dominio pegado (marioyaguelaw) trae alguna palabra fuerte del nombre del negocio? */
function compactMatch(name: string, handleOrHost: string) {
  const h = handleOrHost.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const strong = words(name).filter((w) => w.length >= 4 && !["law", "firm", "office", "shop", "studio", "spa", "bar", "grill", "cafe", "store", "center", "group", "services"].includes(w));
  return !!h && strong.some((w) => h.includes(w));
}

const DIRECTORIES =
  /yelp\.|yellowpages|bbb\.org|mapquest|tripadvisor|foursquare|manta\.com|chamberofcommerce|nextdoor|angi\.com|thumbtack|avvo|justia|findlaw|lawyers\.com|martindale|superpages|birdeye|zocdoc|healthgrades|groupon|doordash|ubereats|grubhub|opentable|wikipedia|indeed|glassdoor|linkedin|bing\.com|google\.|waze|instagram|tiktok|facebook|fb\.com|youtube|twitter|x\.com|threads|pinterest|reddit|booksy|vagaro|fresha|styleseat|dexknows|cylex|hotfrog|brownbook|bizapedia|opencorporates|loc8nearme|n49|merchantcircle|elpasotimes|kfoxtv|ktsm|kvia/i;

const handleFrom = (url: string, re: RegExp) => {
  const h = url.match(re)?.[1]?.toLowerCase();
  return h && !["p", "reel", "reels", "explore", "stories", "tv", "share", "sharer.php", "pages", "groups", "events", "watch", "hashtag", "discover", "tag", "music", "video", "people", "public", "login", "photo.php", "profile.php"].includes(h) ? h : null;
};

/**
 * Busca al negocio en Google (como lo haría un cliente) para encontrar su sitio y sus redes
 * cuando no nos las dieron. Solo regresa candidatos cuyo @ o dominio se parece al nombre.
 */
async function discover(a: AuditRow) {
  const name = a.business_name.replace(/^@/, "");
  const city = (a.city || "El Paso, TX").split(",")[0];
  const results = await googleSearch([`"${name}" ${city}`, `${name} ${city} instagram`, `${name} ${city} tiktok facebook`]);
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))];
  const ig = uniq(results.map((r) => handleFrom(r.url, /instagram\.com\/([A-Za-z0-9._]+)/i)));
  const tt = uniq(results.map((r) => handleFrom(r.url, /tiktok\.com\/@([A-Za-z0-9._]+)/i)));
  const fb = uniq(results.map((r) => handleFrom(r.url, /facebook\.com\/([A-Za-z0-9.\-]+)/i)));
  const site = results.find((r) => {
    const host = hostOf(r.url);
    if (!host || DIRECTORIES.test(host)) return false;
    return compactMatch(name, host.split(".").slice(0, -1).join("")) || nameScore(name, r.title.split(/[|\-:]/)[0] ?? "") >= 0.75;
  });
  return {
    website: site ? `https://${hostOf(site.url)}` : null,
    instagram: ig.filter((h) => compactMatch(name, h)).concat(ig.filter((h) => !compactMatch(name, h))).slice(0, 3),
    tiktok: tt.filter((h) => compactMatch(name, h)).slice(0, 1),
    facebook: fb.filter((h) => compactMatch(name, h)).slice(0, 1),
  };
}

async function stepGoogle(a: AuditRow): Promise<Research["google"]> {
  const location = a.city || "El Paso, TX";
  const ownHost = hostOf(a.website);
  const findPlace = async (): Promise<Pick<NonNullable<Research["google"]>, "place" | "match" | "alternatives">> => {
    if (a.google_maps_url) {
      const place = await scrapeGooglePlace({ url: a.google_maps_url, contacts: true }, 40).catch((e) => (console.error(e), null));
      return { place, match: place ? "link" : "none", alternatives: [] };
    }
    const found = await searchGooglePlaces(a.business_name, location, 3, 40, true).catch((e) => (console.error(e), [] as GooglePlace[]));
    if (!found.length) return { place: null, match: "none", alternatives: [] };
    const ownPhone = digits(a.contact_phone);
    const ownIg = handleOf(a.instagram, "instagram");
    // además del nombre, cualquier dato que coincida confirma que es el suyo: su sitio, su teléfono o su Instagram
    const scored = found
      .map((p) => ({
        p,
        score:
          Math.max(nameScore(a.business_name, p.title), compactMatch(a.business_name, p.title) ? 0.6 : 0) +
          (ownHost && hostOf(p.website) === ownHost ? 1 : 0) +
          (ownPhone && digits(p.phone) === ownPhone ? 1 : 0) +
          (ownIg && p.socials.instagram.some((u) => handleOf(u, "instagram") === ownIg) ? 1 : 0),
      }))
      .sort((x, y) => y.score - x.score);
    const best = scored[0];
    const match = best.score >= 1 ? "sure" : best.score >= 0.6 ? "likely" : "unsure";
    const alt = (p: GooglePlace) => ({ title: p.title, address: p.address, category: p.category, rating: p.rating, reviewsCount: p.reviewsCount, url: p.url });
    return { place: best.p, match, alternatives: scored.slice(1).map((x) => alt(x.p)) };
  };
  const findMarket = (cat: string) => scrapeGoogleLocalMarket(cat, location, 12).catch((e) => (console.error(e), [] as Market[]));

  let found: Awaited<ReturnType<typeof findPlace>>;
  let market: Market[];
  if (a.category) [found, market] = await Promise.all([findPlace(), findMarket(a.category)]);
  else {
    found = await findPlace();
    market = found.place?.category ? await findMarket(found.place.category) : [];
  }
  const place = found.place;
  const host = hostOf(place?.website ?? a.website);
  const localMarket = market.filter((m) => m.title !== place?.title && (!host || hostOf(m.website) !== host));
  return { place, match: found.match, alternatives: found.alternatives, category: a.category || place?.category || null, localMarket, competitorReviews: [] };
}

/** Reseñas de los 3 competidores locales con más reseñas (paso aparte para no pasar el límite de tiempo). */
async function stepReviews(r: Research): Promise<NonNullable<Research["google"]>["competitorReviews"]> {
  const top = (r.google?.localMarket ?? []).filter((m) => m.url).sort((x, y) => (y.reviewsCount ?? 0) - (x.reviewsCount ?? 0)).slice(0, 3);
  return (
    await Promise.all(
      top.map((m) =>
        scrapeGooglePlace({ url: m.url }, 15)
          .then((p) => (p ? { name: p.title, rating: p.rating, reviewsCount: p.reviewsCount, reviews: p.reviews.slice(0, 15) } : null))
          .catch((e) => (console.error(e), null)),
      ),
    )
  ).filter((x): x is NonNullable<typeof x> => !!x);
}

async function stepWeb(a: AuditRow, r: Research): Promise<Research["web"]> {
  const ownUrl = a.website || (r.google?.match !== "unsure" ? r.google?.place?.website : null) || null;
  const comps = topCompetitors(r, 4).filter((m) => m.website);
  const [own, ...others] = await Promise.all([ownUrl ? checkSite(ownUrl) : Promise.resolve(null), ...comps.map((m) => checkSite(m.website!))]);
  return {
    own,
    competitors: others.map((s, i) => ({
      name: comps[i].title,
      url: s.url,
      ok: s.ok,
      title: s.title,
      h1: s.h1,
      ctaTexts: s.ctaTexts.slice(0, 6),
      bookingTools: s.bookingTools,
      whatsapp: s.whatsapp,
      forms: s.forms,
      responseMs: s.responseMs,
      mobileViewport: s.mobileViewport,
      tracking: s.tracking,
      socials: s.socials,
      text: s.text ? s.text.slice(0, 700) : null,
    })),
  };
}

async function stepSocial(a: AuditRow, r: Research): Promise<Research["social"]> {
  const site = r.web?.own?.socials;
  const ig = handleOf(a.instagram, "instagram") ?? site?.instagram[0] ?? null;
  const tt = handleOf(a.tiktok, "tiktok") ?? site?.tiktok[0] ?? null;
  const fb = a.facebook || (site?.facebook[0] ? `facebook.com/${site.facebook[0]}` : null);

  // redes de la competencia: las que enlazan en su sitio
  const compIg = (r.web?.competitors ?? [])
    .map((c) => ({ business: c.name, handle: c.socials.instagram[0] }))
    .filter((c): c is { business: string; handle: string } => !!c.handle && c.handle !== ig)
    .slice(0, 4);

  const [igProfiles, ttFirst] = await Promise.all([
    scrapeInstagramProfiles([...(ig ? [ig] : []), ...compIg.map((c) => c.handle)]).catch((e) => (console.error(e), [] as SocialProfile[])),
    tt ? scrapeTiktokProfile(tt).catch((e) => (console.error(e), null)) : Promise.resolve(null),
  ]);
  const byHandle = new Map(igProfiles.map((p) => [p.handle, p]));
  // Apify a veces falla a la primera: un segundo intento antes de decir que no se pudo leer
  if (ig && !byHandle.get(ig)) {
    const [again] = await scrapeInstagramProfiles([ig]).catch(() => [] as SocialProfile[]);
    if (again) byHandle.set(ig, again);
  }
  const ttProfile = ttFirst ?? (tt ? await scrapeTiktokProfile(tt).catch(() => null) : null);
  const own: NonNullable<Research["social"]>["own"] = [];
  if (ig) own.push(byHandle.get(ig) ? withStats(byHandle.get(ig)!) : { platform: "instagram", handle: ig, notFound: true });
  if (tt) own.push(ttProfile ? withStats(ttProfile) : { platform: "tiktok", handle: tt, notFound: true });
  const competitors = compIg
    .map((c) => (byHandle.get(c.handle) ? { ...withStats(byHandle.get(c.handle)!), business: c.business } : null))
    .filter((x): x is NonNullable<typeof x> => !!x)
    .map((p) => ({ ...p, recent: p.recent.slice(0, 6) }));
  return { own, facebook: fb, competitors };
}

/** Corre un paso y guarda lo que encontró. */
export async function runAuditStep(db: SupabaseClient, id: string, step: AuditStepId) {
  const a = await loadAudit(db, id);
  if (!a) throw new Error("No encontré la auditoría");
  await save(db, id, { status: "running", step, error: null });
  try {
    const research: Research = { ...(a.research ?? {}) };
    let note: string | null = null;
    if (step === "google") {
      const found: NonNullable<Research["discovery"]>["found"] = [];
      // 1) su Instagram (si nos lo dieron) y una búsqueda en Google, al mismo tiempo
      const igGiven = a.business_name.startsWith("@") ? a.business_name : handleOf(a.instagram, "instagram");
      const needsSearch = !a.website || !a.instagram || !a.tiktok || !a.facebook;
      const [igProfile, disc] = await Promise.all([
        igGiven ? scrapeInstagramProfiles([igGiven]).then((x) => x[0] ?? null).catch(() => null) : Promise.resolve(null),
        needsSearch ? discover(a).catch((e) => (console.error(e), null)) : Promise.resolve(null),
      ]);
      if (igProfile) {
        if (a.business_name.startsWith("@") && igProfile.name) a.business_name = igProfile.name;
        if (!a.instagram) a.instagram = igProfile.handle;
        if (!a.website && igProfile.link) {
          a.website = await realSite(igProfile.link);
          if (a.website) found.push({ field: "website", value: a.website, source: "bio de Instagram" });
        }
      }
      // 2) su Instagram desde Google, confirmado: el nombre o el @ se parecen, o su link lleva a su sitio
      if (!a.instagram && disc?.instagram.length) {
        const profiles = await scrapeInstagramProfiles(disc.instagram).catch(() => [] as SocialProfile[]);
        const site = hostOf(a.website ?? disc.website);
        const best = profiles
          .map((p) => ({ p, s: (compactMatch(a.business_name, p.handle) ? 0.6 : 0) + nameScore(a.business_name, p.name ?? "") + (site && hostOf(p.link) === site ? 1 : 0) }))
          .sort((x, y) => y.s - x.s)[0];
        if (best && best.s >= 0.6) {
          a.instagram = best.p.handle;
          found.push({ field: "instagram", value: best.p.handle, source: "búsqueda en Google" });
          if (!a.website && best.p.link) {
            a.website = await realSite(best.p.link);
            if (a.website) found.push({ field: "website", value: a.website, source: "bio de Instagram" });
          }
        }
      }
      if (!a.website && disc?.website) {
        a.website = disc.website;
        found.push({ field: "website", value: a.website, source: "búsqueda en Google" });
      }
      if (!a.tiktok && disc?.tiktok[0]) {
        a.tiktok = disc.tiktok[0];
        found.push({ field: "tiktok", value: a.tiktok, source: "búsqueda en Google" });
      }
      if (!a.facebook && disc?.facebook[0]) {
        a.facebook = `facebook.com/${disc.facebook[0]}`;
        found.push({ field: "facebook", value: a.facebook, source: "búsqueda en Google" });
      }

      // 3) su perfil de Google Maps (con más pistas para confirmar que es el suyo)
      research.google = await stepGoogle(a);
      const g = research.google;
      // si Google Maps confirma su perfil, también trae sus redes
      if (g?.place && g.match !== "unsure") {
        if (!a.website && g.place.website) {
          a.website = g.place.website;
          found.push({ field: "website", value: a.website, source: "perfil de Google" });
        }
        const pIg = g.place.socials.instagram.map((u) => handleOf(u, "instagram")).find(Boolean);
        if (!a.instagram && pIg) {
          a.instagram = pIg;
          found.push({ field: "instagram", value: pIg, source: "perfil de Google" });
        }
        const pTt = g.place.socials.tiktok.map((u) => handleOf(u, "tiktok")).find(Boolean);
        if (!a.tiktok && pTt) {
          a.tiktok = pTt;
          found.push({ field: "tiktok", value: pTt, source: "perfil de Google" });
        }
        if (!a.facebook && g.place.socials.facebook[0]) {
          a.facebook = g.place.socials.facebook[0];
          found.push({ field: "facebook", value: a.facebook, source: "perfil de Google" });
        }
      }
      research.discovery = { found, searchedWeb: !!disc };
      await save(db, id, { business_name: a.business_name, website: a.website, instagram: a.instagram, tiktok: a.tiktok, facebook: a.facebook });
      note = research.google?.place
        ? `${research.google.place.title}${research.google.match === "unsure" ? " (no es seguro que sea el suyo)" : ""}: ${research.google.place.rating ?? "sin"} ★ (${research.google.place.reviewsCount ?? 0} reseñas), ${research.google.localMarket.length} negocios en su zona`
        : `No lo encontré en Google. ${research.google?.localMarket.length ?? 0} negocios en su zona`;
      if (found.length) note += `. Encontré solo: ${found.map((f) => `${f.field} (${f.source})`).join(", ")}`;
    } else if (step === "reviews") {
      if (!research.google) throw new Error("Primero corre el paso de Google");
      research.google = { ...research.google, competitorReviews: await stepReviews(research) };
      note = research.google.competitorReviews.length
        ? `Reseñas de ${research.google.competitorReviews.map((c) => c.name).join(", ")}`
        : "No hubo competidores con reseñas para leer";
    } else if (step === "web") {
      research.web = await stepWeb(a, research);
      const own = research.web?.own;
      note = own ? (own.ok ? `Su sitio cargó en ${((own.responseMs ?? 0) / 1000).toFixed(1)} s` : `Su sitio: ${own.error}`) : "No tiene sitio web";
      note += `. ${research.web?.competitors.length ?? 0} sitios de la competencia`;
    } else if (step === "social") {
      research.social = await stepSocial(a, research);
      const found = research.social?.own.filter((p) => !("notFound" in p)).length ?? 0;
      note = `${found} red${found === 1 ? "" : "es"} propia${found === 1 ? "" : "s"}, ${research.social?.competitors.length ?? 0} de la competencia`;
    } else if (step === "write") {
      research.draft = await writeDiagnosis(writingInput(a, research), a.language);
      note = `Diagnóstico listo: ${research.draft.score}/100`;
    } else if (step === "finish") {
      if (!research.draft) throw new Error("Primero corre el paso de escribir el diagnóstico");
      const report = await writeClosing(writingInput(a, research), a.language, research.draft);
      delete research.draft;
      await save(db, id, { research, report, report_at: new Date().toISOString(), status: "done", step });
      return { note: `Calificación: ${report.score}/100` };
    }
    await save(db, id, { research, status: "new", step });
    return { note };
  } catch (e) {
    await save(db, id, { status: "error", error: (e as Error).message ?? String(e) }).catch(() => undefined);
    throw e;
  }
}

function writingInput(a: AuditRow, research: Research): AuditInput {
  return {
    business: {
      name: a.business_name,
      intro: a.intro,
      category: research.google?.category ?? a.category,
      city: a.city,
      website: a.website ?? (research.google?.match !== "unsure" ? research.google?.place?.website : null) ?? null,
      instagram: a.instagram,
      tiktok: a.tiktok,
      facebook: a.facebook ?? research.social?.facebook ?? null,
    },
    teamNotes: a.team_notes,
    research: compactForWriting(a, research),
  };
}

/**
 * Los hechos fijos de la auditoría, ya verificados. La IA los recibe primero y no los puede contradecir
 * (antes decía "no tiene Google" y luego citaba sus reseñas, o "no tiene sitio" cuando sí tenía).
 */
function factsFor(a: AuditRow, r: Research) {
  const g = r.google;
  const confirmed = !!g?.place && g.match !== "unsure";
  const own = r.web?.own;
  const socialOwn = r.social?.own ?? [];
  const sp = (platform: string) => socialOwn.find((p) => p.platform === platform);
  const social = (platform: "instagram" | "tiktok", given: string | null) => {
    const p = sp(platform);
    if (p && !("notFound" in p)) return `FOUND: @${p.handle}, ${p.followers ?? "?"} followers, ${p.stats.postsLast30Days} posts in the last 30 days`;
    if (p || given) return `EXISTS (@${p?.handle ?? given}) but we could not load its data. Do NOT say they lack it; judge it as not reviewed`;
    return "NOT FOUND (not given, not on their website, Google profile or a Google search)";
  };
  return {
    googleBusinessProfile: confirmed
      ? `FOUND and confirmed: "${g!.place!.title}", ${g!.place!.rating ?? "no"} stars, ${g!.place!.reviewsCount ?? 0} reviews. They DO have a Google Business Profile.`
      : g?.place
        ? `NOT CONFIRMED: the closest result was "${g.place.title}" (${g.place.address ?? "no address"}), but we could not confirm it is theirs. Do not quote its reviews or rating as theirs. Say we could not confirm their listing.`
        : "NOT FOUND when searching their name in their city.",
    website: own
      ? own.ok
        ? `FOUND: ${own.finalUrl ?? own.url}, it loads${own.rendered ? " (read with a browser)" : ""}.`
        : `FOUND: ${own.url}, but it did not load for us (${own.error}). Say it may be down or slow, never that they have no website.`
      : "NOT FOUND (not given, not on Google, not in their Instagram bio, not in a Google search).",
    instagram: social("instagram", handleOf(a.instagram, "instagram")),
    tiktok: social("tiktok", handleOf(a.tiktok, "tiktok")),
    facebook: a.facebook || r.social?.facebook ? `FOUND: ${a.facebook || r.social?.facebook}` : "NOT FOUND",
    discoveredByUs: r.discovery?.found ?? [],
  };
}

/** Lo que Claude necesita leer, sin lo que solo infla el texto. */
function compactForWriting(a: AuditRow, r: Research) {
  const unsure = r.google?.match === "unsure";
  return {
    FACTS: factsFor(a, r),
    google: r.google
      ? {
          ...r.google,
          // si no estamos seguros de que el perfil sea suyo, no le pasamos sus reseñas (las citaba como suyas)
          place: unsure ? null : r.google.place,
          possibleMatch: unsure && r.google.place ? { title: r.google.place.title, address: r.google.place.address, rating: r.google.place.rating, reviewsCount: r.google.place.reviewsCount } : undefined,
          matchNote:
            r.google.match === "unsure"
              ? "WARNING: we searched Google by name and are NOT sure this profile is theirs (the name does not match well). Do not judge their Google presence as if it were confirmed; say we could not confirm their Google listing and recommend they claim/verify it."
              : r.google.match === "none"
                ? "We could not find them on Google by name."
                : "Confirmed match.",
          localMarket: r.google.localMarket.slice(0, 10).map((m) => ({ title: m.title, category: m.category, rating: m.rating, reviewsCount: m.reviewsCount, website: m.website })),
        }
      : "not researched",
    web: r.web
      ? {
          ...r.web,
          own:
            r.web.own ??
            "NO WEBSITE FOUND: none was given to us, none is on their Google profile and none is in their Instagram bio. Do NOT state as a fact that they have no website; say we could not find one from where customers look (Google, Instagram bio) and that this itself loses customers.",
        }
      : "not researched",
    social: r.social ?? "not researched",
  };
}

export type AuditListItem = Pick<AuditRow, "id" | "created_at" | "business_name" | "city" | "status" | "step" | "language" | "share_token"> & { score: number | null };

// ───────────────────────────── Links del reporte ─────────────────────────────

export type AuditLink = { kind: "website" | "google" | "instagram" | "tiktok" | "facebook"; label: string; url: string };
export type CompetitorLinks = Record<string, { google?: string; website?: string; instagram?: string }>;

const withHttp = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u.replace(/^\/+/, "")}`);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Las redes y páginas del negocio que revisamos (las que nos dieron y las que encontró el motor), como links. */
export function auditLinks(a: Pick<AuditRow, "website" | "google_maps_url" | "instagram" | "tiktok" | "facebook" | "research">): AuditLink[] {
  const r = a.research ?? {};
  const out: AuditLink[] = [];
  const site = a.website || r.web?.own?.finalUrl || r.google?.place?.website || null;
  if (site) out.push({ kind: "website", label: site.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, ""), url: withHttp(site) });
  const g = a.google_maps_url || r.google?.place?.url || null;
  if (g) out.push({ kind: "google", label: "Google", url: withHttp(g) });
  const ownSocial = (p: string) => r.social?.own.find((x) => x.platform === p && !("notFound" in x))?.handle;
  const ig = handleOf(a.instagram, "instagram") ?? ownSocial("instagram");
  if (ig) out.push({ kind: "instagram", label: `@${ig}`, url: `https://www.instagram.com/${ig}/` });
  const tt = handleOf(a.tiktok, "tiktok") ?? ownSocial("tiktok");
  if (tt) out.push({ kind: "tiktok", label: `@${tt}`, url: `https://www.tiktok.com/@${tt}` });
  const fb = a.facebook || r.social?.facebook || null;
  if (fb) {
    const h = handleOf(fb, "facebook");
    out.push({ kind: "facebook", label: "Facebook", url: /facebook\.com|fb\.com/i.test(fb) ? withHttp(fb) : `https://www.facebook.com/${h}` });
  }
  return out;
}

/** Links de cada competidor (Google, sitio, Instagram), por nombre normalizado. */
export function competitorLinks(r: Research | null | undefined): CompetitorLinks {
  const out: CompetitorLinks = {};
  for (const m of r?.google?.localMarket ?? []) out[norm(m.title)] = { google: m.url ?? undefined, website: m.website ? withHttp(m.website) : undefined };
  for (const c of r?.social?.competitors ?? []) {
    const k = norm(c.business);
    out[k] = { ...(out[k] ?? {}), instagram: `https://www.instagram.com/${c.handle}/` };
  }
  return out;
}
