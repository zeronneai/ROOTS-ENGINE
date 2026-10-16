import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getClientContext } from "./engine";
import { loadResearch } from "./research";
import { planCampaign, TONES, type CampaignBrief, type Tone } from "@/lib/ai/campaign";
import { upcomingDates } from "@/lib/special-dates";
import type { PostAnalysis } from "@/lib/types";

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Limpia lo que llega del formulario. */
export function cleanBrief(body: Record<string, unknown>): CampaignBrief {
  const name = str(body.name, 80);
  if (!name) throw new Error("Ponle nombre a la campaña");
  const events = (Array.isArray(body.events) ? body.events : [])
    .map((e) => (typeof e === "object" && e ? (e as Record<string, unknown>) : {}))
    .map((e) => ({ date: isDate(e.date) ? e.date : "", name: str(e.name, 80) ?? "", details: str(e.details, 400) }))
    .filter((e) => e.name && e.date)
    .slice(0, 12)
    .sort((a, b) => a.date.localeCompare(b.date));
  let dateFrom = isDate(body.dateFrom) ? body.dateFrom : null;
  let dateTo = isDate(body.dateTo) ? body.dateTo : null;
  if (!dateFrom) dateFrom = new Date().toISOString().slice(0, 10);
  if (!dateTo) dateTo = events.at(-1)?.date ?? dateFrom;
  if (dateTo < dateFrom) [dateFrom, dateTo] = [dateTo, dateFrom];
  const days = (Date.parse(dateTo) - Date.parse(dateFrom)) / 864e5;
  if (days > 92) throw new Error("La campaña puede durar máximo 3 meses");
  const rawList = str(body.rawList, 8000);
  if (!events.length && !rawList && !str(body.goal, 10) && !str(body.notes, 10)) throw new Error("Pega la lista de eventos o cuéntanos de qué se trata");
  const tones = (Array.isArray(body.tones) ? body.tones : []).filter((t): t is Tone => typeof t === "string" && t in TONES);
  return {
    name,
    goal: str(body.goal, 400),
    dateFrom,
    dateTo,
    events,
    tones: tones.length ? tones : ["comedia", "viral", "creativo"],
    count: Math.max(2, Math.min(20, Math.round(Number(body.count) || 6))),
    notes: str(body.notes, 1500),
    canRecord: str(body.canRecord, 400),
    rawList,
  };
}

export async function generateCampaign(db: SupabaseClient, clientId: string, brief: CampaignBrief) {
  const ctx = await getClientContext(db, clientId);
  const [{ data: winners }, { data: recent }, research] = await Promise.all([
    db
      .from("competitor_posts")
      .select("id, views, outlier_score, caption, analysis, competitors!inner(handle, is_own_account)")
      .eq("client_id", clientId)
      .eq("competitors.is_own_account", false)
      .not("analysis", "is", null)
      .order("outlier_score", { ascending: false })
      .limit(10),
    db.from("content_ideas").select("title").eq("client_id", clientId).order("created_at", { ascending: false }).limit(30),
    loadResearch(db, clientId, ctx.brand.data),
  ]);
  const from = new Date(`${brief.dateFrom}T12:00:00Z`);
  const span = Math.ceil((Date.parse(brief.dateTo) - Date.parse(brief.dateFrom)) / 864e5) + 1;
  const specialDates = upcomingDates(from, span).filter((d) => d.date >= brief.dateFrom && d.date <= brief.dateTo).map((d) => ({ date: d.date, name: d.name }));

  const out = await planCampaign({
    brand: ctx.brand.data,
    client: { name: ctx.client.name, city: ctx.client.city, niche: ctx.client.niche },
    brief,
    research,
    winners: (winners ?? []).map((w) => ({
      id: w.id,
      handle: (w.competitors as unknown as { handle: string }).handle,
      views: w.views,
      outlier_score: w.outlier_score,
      caption: w.caption,
      analysis: w.analysis as PostAnalysis | null,
    })),
    specialDates,
    recentTitles: (recent ?? []).map((r) => r.title),
    today: new Date().toISOString().slice(0, 10),
  });

  const { data: plan, error } = await db
    .from("content_plans")
    .insert({
      client_id: clientId,
      kind: "campaign",
      title: brief.name,
      week_start: brief.dateFrom,
      date_to: brief.dateTo,
      summary: out.summary,
      brief,
      strategy: out.analysis,
    })
    .select("id")
    .single();
  if (error) throw error;

  const clampDate = (d: string) => (isDate(d) ? (d < brief.dateFrom ? brief.dateFrom : d > brief.dateTo ? brief.dateTo : d) : brief.dateFrom);
  const ideas = out.ideas.map((i, k) => ({
    plan_id: plan.id,
    client_id: clientId,
    position: k,
    title: i.title,
    format: i.format,
    hooks: i.hooks,
    script: i.script,
    // en la lista de tomas va primero lo que hay que conseguir
    shot_list: [...(i.props.length ? [`Necesitas: ${i.props.join(", ")}`] : []), ...i.shotList],
    cta: i.cta,
    caption: i.caption,
    hashtags: i.hashtags,
    score: Math.round(Math.max(0, Math.min(100, i.viralScore))),
    reasoning: `${i.concept}\n\n${i.reasoning}`,
    based_on: [],
    publish_date: clampDate(i.date),
    tone: i.tone in TONES ? i.tone : null,
    event: i.event,
  }));
  const { error: e2 } = await db.from("content_ideas").insert(ideas);
  if (e2) throw e2;
  return plan.id as string;
}
