import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrandBrain } from "@/lib/types";

/**
 * Lo más útil de la investigación de un cliente, en corto, para escribir flyers que vendan:
 * la oferta y estrategia del último reporte, el dolor de su cliente y lo que le funciona a la competencia.
 */
export async function loadResearch(db: SupabaseClient, clientId: string, brand: Partial<BrandBrain>) {
  const [{ data: report }, { data: winners }] = await Promise.all([
    db.from("reports").select("data, created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db
      .from("competitor_posts")
      .select("caption, views, outlier_score, analysis, competitors!inner(handle, is_own_account)")
      .eq("client_id", clientId)
      .eq("competitors.is_own_account", false)
      .not("analysis", "is", null)
      .order("outlier_score", { ascending: false })
      .limit(6),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = (report?.data ?? null) as any;
  return {
    offer: r?.offer
      ? {
          name: r.offer.name,
          pitch: r.offer.pitch,
          core: r.offer.coreOffer,
          bonuses: (r.offer.bonuses ?? []).map((b: { name: string }) => b.name).slice(0, 4),
          guarantee: r.offer.guarantee,
          cautions: r.offer.cautions,
        }
      : null,
    positioning: r?.strategy?.positioning ?? null,
    marketGaps: (r?.market?.gaps ?? []).slice(0, 4),
    saturated: (r?.market?.saturated ?? []).slice(0, 4),
    hooksToTest: (r?.strategy?.hooksToTest ?? []).slice(0, 6),
    audience: { who: brand.audience?.who, pains: brand.audience?.pains?.slice(0, 4), desires: brand.audience?.desires?.slice(0, 4) },
    competitorWinners: (winners ?? []).map((w) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = (w.analysis ?? {}) as any;
      return {
        handle: (w.competitors as unknown as { handle: string }).handle,
        views: w.views,
        hook: a.hook,
        hookType: a.hookType,
        why: (a.whyItWorked ?? []).slice(0, 2),
      };
    }),
  };
}

export type Research = Awaited<ReturnType<typeof loadResearch>>;
