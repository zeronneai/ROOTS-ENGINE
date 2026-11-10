import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadClientMetrics, metricsClients, type ClientMetrics } from "./metrics";
import { writeMetricsReport, type MetricsReport } from "@/lib/ai/metrics-report";

/** Los números del periodo, compactos: lo que lee la IA y lo que pinta el PDF. */
export function factsOf(m: ClientMetrics) {
  const w = m.web;
  const s = m.social?.data ?? null;
  return {
    client: { name: m.client.name, city: m.client.city },
    range: m.range,
    kpis: {
      visitors: w?.current.visitors ?? null,
      visitorsPrev: w?.previous.visitors ?? null,
      contacts: w?.contacts ?? null,
      contactsPrev: w?.previous.contacts ?? null,
      contactRate: w ? +w.contactRate.toFixed(2) : null,
      adSpend: m.ads?.summaries.length ? m.adsTotals.spend : null,
      adResults: m.ads?.summaries.length ? m.adsTotals.results : null,
      adClicks: m.ads?.summaries.length ? m.adsTotals.clicks : null,
      adImpressions: m.ads?.summaries.length ? m.adsTotals.impressions : null,
      followers: s?.followers?.current ?? m.publicFollowers?.current ?? null,
      followersGained: s?.followers?.gained ?? m.publicFollowers?.gained ?? null,
    },
    web: w
      ? {
          domains: w.sites.map((x) => x.domain),
          visitors: w.current.visitors,
          sessions: w.current.sessions,
          pageviews: w.current.pageviews,
          previous: w.previous,
          avgSessionSeconds: w.current.avgSessionSeconds,
          pagesPerSession: w.current.pagesPerSession,
          bounceRate: w.current.bounceRate,
          contacts: w.contacts,
          contactRate: +w.contactRate.toFixed(2),
          sources: w.current.sources,
          clicks: w.current.clicks,
          devices: w.current.devices,
          cities: w.current.cities,
          pages: w.current.pages.slice(0, 10).map((p) => ({ path: p.path, views: p.views, avgSeconds: p.avgSeconds, avgScroll: p.avgScroll, exitRate: p.exitRate })),
        }
      : null,
    social: s
      ? {
          totals: s.totals,
          previousTotals: s.previousTotals ?? null,
          followers: s.followers,
          topPosts: (s.topPosts ?? []).slice(0, 8),
          dataAsOf: s.dataAsOf,
        }
      : null,
    socialError: m.social?.error ?? null,
    ads: m.ads
      ? {
          summaries: m.ads.summaries.map((x) => ({
            platform: x.platform === "metaads" ? "Meta" : "Google",
            account: x.account.name,
            currency: x.account.currency,
            totals: x.totals,
            resultTypes: x.resultTypes,
            campaigns: [...x.campaigns].sort((a, b) => b.spend - a.spend).slice(0, 30),
          })),
          notes: m.ads.errors,
        }
      : null,
    publicSocial: (m.publicSocial?.accounts ?? []).map((a) => ({
      platform: a.platform,
      handle: a.handle,
      followers: a.latest.followers,
      gained: a.gained,
      posts: a.latest.posts,
      stats: a.latest.stats,
      profile: a.latest.profile,
      snapshotDay: a.latest.day,
      recent: [...(a.latest.recent ?? [])]
        .sort((x, y) => (y.postedAt ?? "").localeCompare(x.postedAt ?? ""))
        .slice(0, 12)
        .map((p) => ({ postedAt: p.postedAt?.slice(0, 10) ?? null, type: p.type, caption: p.caption?.slice(0, 180) ?? null, views: p.views, likes: p.likes, comments: p.comments, url: p.url })),
    })),
    business: m.business?.data ?? null,
    highlights: m.highlights,
  };
}

export type ReportFacts = ReturnType<typeof factsOf>;

/** Junta los números, le pide el reporte a la IA y lo guarda. Regresa el id del reporte. */
export async function generateMetricsReport(db: SupabaseClient, clientId: string, days: number, userId: string | null) {
  const client = (await metricsClients(db)).find((c) => c.id === clientId);
  if (!client) throw new Error("Cliente no encontrado");
  const m = await loadClientMetrics(db, client, days);
  const facts = factsOf(m);
  const hasData = facts.web || facts.social || facts.ads?.summaries.length || facts.publicSocial.length || facts.business;
  if (!hasData) throw new Error("Este cliente todavía no tiene datos en el panel para armar un reporte.");
  const report = await writeMetricsReport(facts);
  const { data, error } = await db
    .from("metrics_reports")
    .insert({ client_id: clientId, created_by: userId, days, range_from: m.range.from, range_to: m.range.to, facts, report })
    .select("id")
    .single();
  if (error) throw new Error(/metrics_reports/.test(error.message) ? "Falta correr la migración 0031_metrics_reports.sql en Supabase." : error.message);
  return data.id as string;
}

export type SavedMetricsReport = {
  id: string;
  client_id: string;
  created_at: string;
  days: number;
  range_from: string;
  range_to: string;
  facts: ReportFacts;
  report: MetricsReport;
};

export async function latestMetricsReport(db: SupabaseClient, clientId: string) {
  const { data } = await db.from("metrics_reports").select("id, created_at, days").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data as { id: string; created_at: string; days: number } | null;
}

export async function loadMetricsReport(db: SupabaseClient, id: string) {
  const { data } = await db.from("metrics_reports").select("*").eq("id", id).maybeSingle();
  return data as SavedMetricsReport | null;
}
