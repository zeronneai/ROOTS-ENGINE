import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { median, scrapeGoogleLocalMarket, scrapeGooglePlace, scrapeInstagramProfiles, scrapeTiktokProfile, type GooglePlace, type SocialProfile } from "@/lib/scrape/apify";
import { writeAudit, type AuditReport } from "@/lib/ai/audit";
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
  google?: {
    place: GooglePlace | null;
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
  social?: {
    own: (ProfileStats | { platform: string; handle: string; notFound: true })[];
    facebook: string | null;
    competitors: (ProfileStats & { business: string })[];
  };
};

type ProfileStats = SocialProfile & {
  stats: {
    postsLast30Days: number;
    daysSinceLastPost: number | null;
    medianViews: number | null;
    avgLikes: number | null;
    avgComments: number | null;
    engagementPct: number | null;
  };
};

function withStats(p: SocialProfile): ProfileStats {
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

async function stepGoogle(a: AuditRow): Promise<Research["google"]> {
  const location = a.city || "El Paso, TX";
  const findPlace = () => scrapeGooglePlace({ url: a.google_maps_url, query: a.business_name, location }, 40).catch((e) => (console.error(e), null));
  const findMarket = (cat: string) => scrapeGoogleLocalMarket(cat, location, 12).catch((e) => (console.error(e), [] as Market[]));

  let place: GooglePlace | null;
  let market: Market[];
  if (a.category) [place, market] = await Promise.all([findPlace(), findMarket(a.category)]);
  else {
    place = await findPlace();
    market = place?.category ? await findMarket(place.category) : [];
  }
  const ownHost = hostOf(place?.website ?? a.website);
  const localMarket = market.filter((m) => m.title !== place?.title && (!ownHost || hostOf(m.website) !== ownHost));
  return { place, category: a.category || place?.category || null, localMarket, competitorReviews: [] };
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
  const ownUrl = a.website || r.google?.place?.website || null;
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

  const [igProfiles, ttProfile] = await Promise.all([
    scrapeInstagramProfiles([...(ig ? [ig] : []), ...compIg.map((c) => c.handle)]).catch((e) => (console.error(e), [] as SocialProfile[])),
    tt ? scrapeTiktokProfile(tt).catch((e) => (console.error(e), null)) : Promise.resolve(null),
  ]);
  const byHandle = new Map(igProfiles.map((p) => [p.handle, p]));
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
      if (a.business_name.startsWith("@")) {
        // solo nos dieron su cuenta: el nombre real y su sitio salen de su perfil de Instagram
        const [p] = await scrapeInstagramProfiles([a.business_name]).catch(() => [] as SocialProfile[]);
        if (p?.name) {
          a.business_name = p.name;
          if (!a.website && p.link) a.website = p.link;
          if (!a.instagram) a.instagram = p.handle;
          await save(db, id, { business_name: a.business_name, website: a.website, instagram: a.instagram });
        }
      }
      research.google = await stepGoogle(a);
      note = research.google?.place
        ? `${research.google.place.title}: ${research.google.place.rating ?? "sin"} ★ (${research.google.place.reviewsCount ?? 0} reseñas), ${research.google.localMarket.length} negocios en su zona`
        : `No lo encontré en Google. ${research.google?.localMarket.length ?? 0} negocios en su zona`;
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
      const report = await writeAudit(
        {
          business: {
            name: a.business_name,
            intro: a.intro,
            category: research.google?.category ?? a.category,
            city: a.city,
            website: a.website ?? research.google?.place?.website ?? null,
            instagram: a.instagram,
            tiktok: a.tiktok,
            facebook: a.facebook ?? research.social?.facebook ?? null,
          },
          teamNotes: a.team_notes,
          research: compactForWriting(research),
        },
        a.language,
      );
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

/** Lo que Claude necesita leer, sin lo que solo infla el texto. */
function compactForWriting(r: Research) {
  return {
    google: r.google
      ? {
          ...r.google,
          localMarket: r.google.localMarket.slice(0, 10).map((m) => ({ title: m.title, category: m.category, rating: m.rating, reviewsCount: m.reviewsCount, website: m.website })),
        }
      : "not researched",
    web: r.web ?? "not researched",
    social: r.social ?? "not researched",
  };
}

export type AuditListItem = Pick<AuditRow, "id" | "created_at" | "business_name" | "city" | "status" | "step" | "language" | "share_token"> & { score: number | null };
