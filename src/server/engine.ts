/**
 * Lógica del motor, compartida por las API routes y el worker.
 * Siempre recibe el cliente admin (service role): quien llama ya validó permisos.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrandBrain, ClientRow, PostAnalysis } from "@/lib/types";
import type { StyleOverrides } from "@/lib/styles/types";
import { resolveStyle } from "@/lib/styles/resolve";
import { synthesizeBrand } from "@/lib/ai/brand";
import { analyzePost } from "@/lib/ai/analyze";
import { planWeek } from "@/lib/ai/planner";
import { moodFromDescription } from "@/lib/ai/mood";
import { scrapeInstagram, scrapeTiktok, withOutlierScores, type ScrapedPost } from "@/lib/scrape/apify";

type DB = SupabaseClient;

export type MoodRow = {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  style_overrides: StyleOverrides;
  tone_notes: string | null;
  created_by_role: "agency" | "client";
  created_at: string;
};

export type BrandProfileRow = {
  client_id: string;
  data: Partial<BrandBrain>;
  style_overrides: StyleOverrides;
  active_mood_id: string | null;
  synthesized_at: string | null;
};

export async function getClientContext(db: DB, clientId: string) {
  const [{ data: client, error }, { data: profile }, { data: moods }] = await Promise.all([
    db.from("clients").select("*").eq("id", clientId).single(),
    db.from("brand_profiles").select("*").eq("client_id", clientId).maybeSingle(),
    db.from("moods").select("*").eq("client_id", clientId).order("created_at"),
  ]);
  if (error || !client) throw new Error(`Cliente no encontrado: ${clientId}`);
  const brand = (profile as BrandProfileRow | null) ?? {
    client_id: clientId,
    data: {},
    style_overrides: {},
    active_mood_id: null,
    synthesized_at: null,
  };
  const activeMood = (moods as MoodRow[] | null)?.find((m) => m.id === brand.active_mood_id) ?? null;
  return { client: client as ClientRow, brand, moods: (moods ?? []) as MoodRow[], activeMood };
}

export type ClientContext = Awaited<ReturnType<typeof getClientContext>>;

/** Estilo final del cliente: preset (nicho o elegido) → color de marca → overrides → mood → edición. */
export function styleForClient(ctx: ClientContext, opts?: { moodId?: string | null; edit?: StyleOverrides; presetId?: string | null }) {
  const mood = opts?.moodId ? ctx.moods.find((m) => m.id === opts.moodId) : ctx.activeMood;
  return resolveStyle({
    presetId: opts?.presetId ?? ctx.client.edit_style_id ?? ctx.brand.data.visual?.recommendedPresetId ?? null,
    niche: ctx.client.niche,
    brandAccent: ctx.brand.data.visual?.accentColor ?? null,
    layers: [ctx.brand.style_overrides, mood?.style_overrides, opts?.edit],
  });
}

// ───────────────────────────── Brand Brain ─────────────────────────────

export async function synthesizeBrandFor(db: DB, clientId: string) {
  const ctx = await getClientContext(db, clientId);
  const [{ data: inputs }, { data: own }] = await Promise.all([
    db.from("brand_inputs").select("*").eq("client_id", clientId).order("created_at"),
    db
      .from("competitor_posts")
      .select("caption, views, transcript, competitors!inner(is_own_account)")
      .eq("client_id", clientId)
      .eq("competitors.is_own_account", true)
      .order("posted_at", { ascending: false })
      .limit(15),
  ]);
  const moodName = (id: string | null) => ctx.moods.find((m) => m.id === id)?.name ?? null;

  const brain = await synthesizeBrand({
    client: ctx.client,
    current: ctx.brand.data,
    inputs: (inputs ?? []).map((i) => ({
      kind: i.kind,
      title: i.title,
      content: i.content,
      url: i.url,
      added_by_role: i.added_by_role,
      created_at: i.created_at,
      mood_name: moodName(i.mood_id),
    })),
    ownPosts: (own ?? []).map((p) => ({ caption: p.caption, views: p.views, transcript: p.transcript })),
  });

  await db.from("brand_profiles").upsert({
    client_id: clientId,
    data: brain,
    style_overrides: ctx.brand.style_overrides ?? {},
    active_mood_id: ctx.brand.active_mood_id,
    synthesized_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  await db.from("brand_inputs").update({ synthesized: true }).eq("client_id", clientId);
  if (!ctx.client.edit_style_id && brain.visual.recommendedPresetId) {
    await db.from("clients").update({ edit_style_id: brain.visual.recommendedPresetId }).eq("id", clientId);
  }
  return brain;
}

// ───────────────────────────── Moods ─────────────────────────────

export async function createMoodFromText(
  db: DB,
  clientId: string,
  description: string,
  role: "agency" | "client",
  references: string[] = [],
) {
  const ctx = await getClientContext(db, clientId);
  const current = styleForClient(ctx);
  const m = await moodFromDescription({ description, currentStyle: current, references });
  const { data, error } = await db
    .from("moods")
    .insert({
      client_id: clientId,
      name: m.name,
      description,
      style_overrides: m.overrides,
      tone_notes: m.toneNotes,
      created_by_role: role,
    })
    .select()
    .single();
  if (error) throw error;
  return data as MoodRow;
}

// ───────────────────────────── Competencia ─────────────────────────────

export async function scanCompetitors(db: DB, clientId: string, perAccount = 30) {
  const { data: comps } = await db.from("competitors").select("*").eq("client_id", clientId);
  if (!comps?.length) return { scanned: 0, posts: 0 };

  const ig = comps.filter((c) => c.platform === "instagram").map((c) => c.handle);
  const tt = comps.filter((c) => c.platform === "tiktok").map((c) => c.handle);
  const [igPosts, ttPosts] = await Promise.all([scrapeInstagram(ig, perAccount), scrapeTiktok(tt, perAccount)]);
  const all: ScrapedPost[] = [...igPosts, ...ttPosts];

  let saved = 0;
  for (const c of comps) {
    const mine = all.filter((p) => p.platform === c.platform && p.handle === c.handle.toLowerCase().replace(/^@/, ""));
    if (!mine.length) continue;
    const { median, posts } = withOutlierScores(mine);
    await db
      .from("competitors")
      .update({
        median_views: median,
        followers: mine.find((p) => p.followers)?.followers ?? c.followers,
        display_name: mine.find((p) => p.displayName)?.displayName ?? c.display_name,
        last_scanned_at: new Date().toISOString(),
      })
      .eq("id", c.id);
    const rows = posts.map((p) => ({
      competitor_id: c.id,
      client_id: clientId,
      platform: p.platform,
      external_id: p.externalId,
      url: p.url,
      video_url: p.videoUrl,
      thumbnail_url: p.thumbnailUrl,
      caption: p.caption,
      views: p.views,
      likes: p.likes,
      comments: p.comments,
      duration: p.duration,
      posted_at: p.postedAt,
      outlier_score: p.outlierScore,
    }));
    const { error } = await db.from("competitor_posts").upsert(rows, { onConflict: "competitor_id,external_id" });
    if (error) throw error;
    saved += rows.length;
  }
  return { scanned: comps.length, posts: saved };
}

export async function analyzeTopPosts(db: DB, clientId: string, limit = 8, minScore = 1.8) {
  const ctx = await getClientContext(db, clientId);
  const { data: posts } = await db
    .from("competitor_posts")
    .select("*, competitors!inner(handle, is_own_account)")
    .eq("client_id", clientId)
    .eq("competitors.is_own_account", false)
    .is("analysis", null)
    .gte("outlier_score", minScore)
    .order("outlier_score", { ascending: false })
    .limit(limit);

  let done = 0;
  for (const p of posts ?? []) {
    const analysis = await analyzePost(
      {
        id: p.id,
        handle: p.competitors.handle,
        platform: p.platform,
        caption: p.caption,
        transcript: p.transcript,
        views: p.views,
        likes: p.likes,
        comments: p.comments,
        duration: p.duration,
        outlier_score: p.outlier_score,
      },
      ctx.brand.data,
    );
    await db.from("competitor_posts").update({ analysis, analyzed_at: new Date().toISOString() }).eq("id", p.id);
    done++;
  }
  return { analyzed: done };
}

// ───────────────────────────── Plan semanal ─────────────────────────────

export function nextMonday(from = new Date()) {
  const d = new Date(from);
  const day = d.getDay(); // 0 dom
  const diff = day === 1 ? 0 : (8 - day) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export async function generatePlan(
  db: DB,
  clientId: string,
  opts: { count?: number; weekStart?: string; extra?: string | null } = {},
) {
  const ctx = await getClientContext(db, clientId);
  const weekStart = opts.weekStart ?? nextMonday();
  const count = opts.count ?? (ctx.client.plan_tier === "plan" ? 4 : 5);

  const [{ data: winners }, { data: recent }] = await Promise.all([
    db
      .from("competitor_posts")
      .select("id, views, outlier_score, caption, analysis, competitors!inner(handle, is_own_account)")
      .eq("client_id", clientId)
      .eq("competitors.is_own_account", false)
      .not("analysis", "is", null)
      .order("outlier_score", { ascending: false })
      .limit(12),
    db.from("content_ideas").select("title").eq("client_id", clientId).order("created_at", { ascending: false }).limit(30),
  ]);

  const plan = await planWeek({
    brand: ctx.brand.data,
    winners: (winners ?? []).map((w) => ({
      id: w.id,
      handle: (w.competitors as unknown as { handle: string }).handle,
      views: w.views,
      outlier_score: w.outlier_score,
      caption: w.caption,
      analysis: w.analysis as PostAnalysis | null,
    })),
    recentTitles: (recent ?? []).map((r) => r.title),
    count,
    weekStart,
    moodNotes: ctx.activeMood ? `${ctx.activeMood.name}: ${ctx.activeMood.tone_notes ?? ctx.activeMood.description ?? ""}` : null,
    extraInstructions: opts.extra ?? null,
  });

  const { data: planRow, error } = await db
    .from("content_plans")
    .insert({ client_id: clientId, week_start: weekStart, summary: plan.summary })
    .select()
    .single();
  if (error) throw error;

  const validIds = new Set((winners ?? []).map((w) => w.id));
  const ideas = plan.ideas.map((idea, i) => {
    const d = new Date(`${weekStart}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + Math.max(0, Math.min(6, Math.round(idea.dayOffset))));
    return {
      plan_id: planRow.id,
      client_id: clientId,
      position: i,
      title: idea.title,
      format: idea.format,
      hooks: idea.hooks,
      script: idea.script,
      shot_list: idea.shotList,
      cta: idea.cta,
      caption: idea.caption,
      hashtags: idea.hashtags,
      score: Math.round(idea.score),
      reasoning: idea.reasoning,
      based_on: idea.basedOnPostIds.filter((id) => validIds.has(id)),
      publish_date: d.toISOString().slice(0, 10),
    };
  });
  const { error: e2 } = await db.from("content_ideas").insert(ideas);
  if (e2) throw e2;
  return planRow.id as string;
}
