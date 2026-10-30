import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { scrapeInstagramProfiles, scrapeTiktokProfile, type SocialProfile } from "@/lib/scrape/apify";
import { runWithClient } from "@/lib/usage";
import { handleOf } from "./audit/site-check";
import { withStats } from "./audits";

/**
 * Redes públicas de los clientes del panel, sin que conecten nada: una foto al día de su
 * Instagram y TikTok con Apify (seguidores, publicaciones y los números de sus últimos posts).
 * Cuesta centavos por cliente al día.
 */

type Target = { id: string; instagram: string | null; tiktok: string | null };

export type Snapshot = {
  client_id: string;
  platform: "instagram" | "tiktok";
  handle: string;
  day: string;
  followers: number | null;
  following: number | null;
  posts: number | null;
  stats: { postsLast30Days: number; daysSinceLastPost: number | null; medianViews: number | null; avgLikes: number | null; avgComments: number | null; engagementPct: number | null };
  recent: SocialProfile["recent"];
  profile: { name: string | null; bio: string | null; link: string | null; highlights: number | null; verified: boolean | null };
};

const today = () => new Date().toISOString().slice(0, 10);

function toRow(clientId: string, p: SocialProfile): Snapshot {
  const s = withStats(p);
  return {
    client_id: clientId,
    platform: p.platform,
    handle: p.handle,
    day: today(),
    followers: p.followers,
    following: p.following,
    posts: p.posts,
    stats: s.stats,
    recent: p.recent.slice(0, 12),
    profile: { name: p.name, bio: p.bio, link: p.link, highlights: p.highlights, verified: p.verified },
  };
}

/** Toma la foto de hoy de varios clientes (Instagram en una sola llamada, TikTok uno por uno). */
export async function snapshotClients(db: SupabaseClient, clients: Target[]) {
  const ig = clients.map((c) => ({ id: c.id, handle: handleOf(c.instagram, "instagram") })).filter((c): c is { id: string; handle: string } => !!c.handle);
  const tt = clients.map((c) => ({ id: c.id, handle: handleOf(c.tiktok, "tiktok") })).filter((c): c is { id: string; handle: string } => !!c.handle);
  const rows: Snapshot[] = [];
  const errors: string[] = [];

  await runWithClient(null, async () => {
    if (ig.length) {
      try {
        const profiles = await scrapeInstagramProfiles(ig.map((c) => c.handle));
        const byHandle = new Map(profiles.map((p) => [p.handle, p]));
        for (const c of ig) {
          const p = byHandle.get(c.handle);
          if (p) rows.push(toRow(c.id, p));
          else errors.push(`Instagram @${c.handle}: no se encontró (¿cuenta privada o mal escrita?)`);
        }
      } catch (e) {
        errors.push(`Instagram: ${(e as Error).message}`);
      }
    }
    await Promise.all(
      tt.map(async (c) => {
        try {
          const p = await scrapeTiktokProfile(c.handle, 15);
          if (p) rows.push(toRow(c.id, p));
          else errors.push(`TikTok @${c.handle}: no se encontró`);
        } catch (e) {
          errors.push(`TikTok @${c.handle}: ${(e as Error).message}`);
        }
      }),
    );
  });

  if (rows.length) {
    const { error } = await db.from("social_snapshots").upsert(rows, { onConflict: "client_id,platform,day" });
    if (error) errors.push(error.message);
  }
  return { saved: rows.length, errors };
}

/** Clientes del panel a los que les toca foto hoy (los que no tienen la de hoy). */
export async function snapshotDue(db: SupabaseClient) {
  const { data: clients } = await db.from("clients").select("id, instagram, tiktok").eq("metrics_enabled", true);
  const { data: done } = await db.from("social_snapshots").select("client_id").eq("day", today());
  const have = new Set((done ?? []).map((d) => d.client_id));
  const due = ((clients ?? []) as Target[]).filter((c) => !have.has(c.id) && (c.instagram || c.tiktok));
  return snapshotClients(db, due);
}

export type PublicSocial = {
  accounts: {
    platform: "instagram" | "tiktok";
    handle: string;
    latest: Snapshot;
    /** seguidores por día dentro del periodo */
    series: { day: string; followers: number | null }[];
    gained: number | null;
  }[];
};

/** Lo público de un cliente en el periodo: la foto más reciente por red y cómo cambiaron los seguidores. */
export async function loadPublicSocial(db: SupabaseClient, clientId: string, from: string): Promise<PublicSocial> {
  const { data } = await db
    .from("social_snapshots")
    .select("client_id, platform, handle, day, followers, following, posts, stats, recent, profile")
    .eq("client_id", clientId)
    .gte("day", new Date(Date.parse(from) - 864e5).toISOString().slice(0, 10))
    .order("day");
  const rows = (data ?? []) as Snapshot[];
  const latestAny = rows.length
    ? rows
    : (((await db.from("social_snapshots").select("client_id, platform, handle, day, followers, following, posts, stats, recent, profile").eq("client_id", clientId).order("day", { ascending: false }).limit(2)).data ?? []) as Snapshot[]);
  const platforms = [...new Set(latestAny.map((r) => r.platform))];
  return {
    accounts: platforms.map((pl) => {
      const mine = latestAny.filter((r) => r.platform === pl).sort((a, b) => a.day.localeCompare(b.day));
      const first = mine.find((r) => r.followers != null);
      const last = [...mine].reverse().find((r) => r.followers != null) ?? mine[mine.length - 1];
      return {
        platform: pl,
        handle: last.handle,
        latest: last,
        series: mine.map((r) => ({ day: r.day, followers: r.followers })),
        gained: first && last && first !== last && first.followers != null && last.followers != null ? last.followers - first.followers : null,
      };
    }),
  };
}
