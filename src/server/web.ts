import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { summarize, realtime, type WebEvent } from "@/lib/web-stats";
import { analyzeWeb } from "@/lib/ai/web";
import { getClientContext } from "./engine";

const COLS = "ts, type, visitor, session, path, title, ref_domain, utm_source, utm_medium, device, browser, country, city, duration_ms, scroll, label";

/** Eventos de un sitio desde una fecha (en páginas de 1000, máx 50 mil). */
export async function loadEvents(db: SupabaseClient, siteId: string, since: Date) {
  // Supabase entrega como máximo "Max rows" filas por llamada (puede ser menos de 1000):
  // se sigue pidiendo hasta que ya no regrese nada, avanzando lo que sí regresó.
  const out: WebEvent[] = [];
  for (let from = 0; from < 50_000; ) {
    const { data, error } = await db.from("web_events").select(COLS).eq("site_id", siteId).gte("ts", since.toISOString()).order("ts", { ascending: false }).range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...(data as WebEvent[]));
    from += data.length;
  }
  return out;
}

export async function siteStats(db: SupabaseClient, siteId: string, days: number) {
  const events = await loadEvents(db, siteId, new Date(Date.now() - days * 864e5));
  const recent = days === 1 ? events : await loadEvents(db, siteId, new Date(Date.now() - 5 * 60_000));
  return { stats: summarize(events, days), live: realtime(recent) };
}

export async function analyzeSite(db: SupabaseClient, clientId: string, siteId: string) {
  const { data: site } = await db.from("sites").select("*").eq("id", siteId).eq("client_id", clientId).single();
  if (!site) throw new Error("No encontré el sitio");
  const ctx = await getClientContext(db, clientId);
  const { stats } = await siteStats(db, siteId, 30);
  if (stats.sessions < 5) throw new Error("Todavía hay muy pocas visitas para analizar (menos de 5 en 30 días)");
  const analysis = await analyzeWeb({ brand: ctx.brand.data, client: { name: ctx.client.name, niche: ctx.client.niche }, domain: site.domain, days: 30, stats });
  await db.from("sites").update({ analysis, analyzed_at: new Date().toISOString() }).eq("id", siteId);
  return analysis;
}
