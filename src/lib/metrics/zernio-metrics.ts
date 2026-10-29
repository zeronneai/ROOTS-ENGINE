import "server-only";
import { listAccounts, zernioGet } from "@/lib/zernio";

/**
 * Métricas que da Zernio: redes (Instagram, TikTok, Facebook, YouTube) y anuncios
 * (Meta, Google Ads). Todo con la misma ZERNIO_API_KEY que ya usamos para publicar.
 */

const qs = (o: Record<string, string | number | boolean | undefined | null>) =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, String(v)])).toString();

export type SocialTotals = { impressions?: number; reach?: number; likes?: number; comments?: number; shares?: number; saves?: number; clicks?: number; views?: number; engagementRate?: number };
export type SocialDashboard = {
  totals: SocialTotals;
  previousTotals?: SocialTotals;
  followers: { current?: number; gained?: number; byAccount?: { accountId?: string; platform?: string; current?: number; gained?: number }[] };
  previousFollowers?: { current?: number; gained?: number };
  daily: { date?: string; impressions?: number; reach?: number; engagement?: number; views?: number; followersGained?: number }[];
  topPosts: { postId?: string; platform?: string; publishedAt?: string; metrics?: SocialTotals }[];
  dataAsOf: string | null;
};

/** Todo lo de redes de un cliente en una llamada: totales, seguidores, serie diaria y mejores posts. */
export function socialDashboard(profileId: string, from: string, to: string) {
  return zernioGet<SocialDashboard>(`/analytics/dashboard?${qs({ profileId, fromDate: from, toDate: to, compare: "previous_period", topPosts: 8, recentPosts: 0, platform: "all" })}`);
}

export const ADS_PLATFORMS = {
  metaads: { label: "Meta Ads (Facebook e Instagram)", connect: "facebook" },
  googleads: { label: "Google Ads", connect: "googleads" },
  tiktokads: { label: "TikTok Ads", connect: "tiktok" },
} as const;
export type AdsPlatform = keyof typeof ADS_PLATFORMS;

/** Conexiones de anuncios del cliente en Zernio. */
export async function adConnections(profileId: string) {
  const accounts = await listAccounts(profileId);
  return accounts.filter((a) => a.platform in ADS_PLATFORMS) as (Awaited<ReturnType<typeof listAccounts>>[number] & { platform: AdsPlatform })[];
}

/** Link para conectar anuncios (lo abre alguien con acceso a la cuenta publicitaria). */
export async function adsConnectUrl(profileId: string, platform: AdsPlatform, redirectUrl: string, adAccountId?: string | null) {
  const out = await zernioGet<{ authUrl?: string; url?: string; alreadyConnected?: boolean }>(
    `/connect/${ADS_PLATFORMS[platform].connect}/ads?${qs({ profileId, redirect_url: redirectUrl, adAccountId: adAccountId || undefined })}`,
    0,
  );
  return { url: out.authUrl ?? out.url ?? null, alreadyConnected: !!out.alreadyConnected };
}

export type AdAccount = { id: string; name: string; currency: string | null; selectable: boolean; status: unknown };

/** Cuentas publicitarias que ve una conexión (act_123 en Meta, customer id en Google). */
export async function adAccounts(accountId: string): Promise<AdAccount[]> {
  const out = await zernioGet<{ accounts?: Record<string, unknown>[] }>(`/ads/accounts?${qs({ accountId, inScopeOnly: true })}`, 3600);
  return (out.accounts ?? []).map((a) => ({
    id: String(a.id ?? ""),
    name: String(a.name ?? a.id ?? ""),
    currency: (a.currency as string) ?? null,
    selectable: a.selectable !== false,
    status: a.accountStatus ?? a.status ?? null,
  }));
}

type Row = Record<string, unknown>;
const n = (v: unknown) => {
  const x = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(x) ? x : 0;
};

// lo que contamos como "resultado" de un anuncio de Meta (leads, mensajes, compras, registros)
const RESULT_ACTIONS = [
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "onsite_conversion.messaging_conversation_started_7d",
  "offsite_conversion.fb_pixel_purchase",
  "purchase",
  "offsite_conversion.fb_pixel_complete_registration",
  "complete_registration",
  "contact",
  "offsite_conversion.fb_pixel_contact",
  "schedule",
];
const RESULT_LABEL: Record<string, string> = {
  lead: "Leads",
  "onsite_conversion.lead_grouped": "Leads (formulario)",
  "offsite_conversion.fb_pixel_lead": "Leads (sitio)",
  "onsite_conversion.messaging_conversation_started_7d": "Mensajes",
  "offsite_conversion.fb_pixel_purchase": "Compras",
  purchase: "Compras",
  "offsite_conversion.fb_pixel_complete_registration": "Registros",
  complete_registration: "Registros",
  contact: "Contactos",
  "offsite_conversion.fb_pixel_contact": "Contactos (sitio)",
  schedule: "Citas",
};

/** Resultados de una fila de Meta: el tipo de resultado más importante que tenga y su conteo. */
function metaResults(row: Row) {
  const actions = (row.actions ?? []) as { action_type?: string; value?: string }[];
  const byType = new Map(actions.map((a) => [a.action_type ?? "", n(a.value)]));
  const breakdown = RESULT_ACTIONS.filter((t) => byType.get(t)).map((t) => ({ type: t, label: RESULT_LABEL[t] ?? t, n: byType.get(t)! }));
  // "lead" ya incluye a lead_grouped y fb_pixel_lead: no se suman dos veces
  const leads = byType.get("lead") ?? (byType.get("onsite_conversion.lead_grouped") ?? 0) + (byType.get("offsite_conversion.fb_pixel_lead") ?? 0);
  const messages = byType.get("onsite_conversion.messaging_conversation_started_7d") ?? 0;
  const purchases = byType.get("purchase") ?? byType.get("offsite_conversion.fb_pixel_purchase") ?? 0;
  const other = (byType.get("complete_registration") ?? byType.get("offsite_conversion.fb_pixel_complete_registration") ?? 0) + (byType.get("schedule") ?? 0);
  return { results: leads + messages + purchases + other, leads, messages, purchases, linkClicks: byType.get("link_click") ?? 0, breakdown };
}

export type AdsDay = { date: string; spend: number; impressions: number; clicks: number; results: number };
export type AdsCampaign = { id: string; name: string; objective: string | null; spend: number; impressions: number; reach: number; clicks: number; ctr: number; cpc: number; results: number; leads: number; messages: number; costPerResult: number | null };
export type AdsSummary = {
  platform: AdsPlatform;
  account: { id: string; name: string; currency: string | null };
  totals: { spend: number; impressions: number; reach: number; clicks: number; ctr: number; cpc: number; cpm: number; results: number; leads: number; messages: number; purchases: number; costPerResult: number | null };
  daily: AdsDay[];
  campaigns: AdsCampaign[];
  resultTypes: { label: string; n: number }[];
};

const META_FIELDS = "spend,impressions,reach,clicks,ctr,cpc,cpm,actions";

async function metaInsights(accountId: string, objectId: string, from: string, to: string, extra: Record<string, string>) {
  const out = await zernioGet<{ data?: Row[] }>(`/ads/insights?${qs({ accountId, objectId, fromDate: from, toDate: to, limit: 200, ...extra })}`);
  return out.data ?? [];
}

export async function metaAdsSummary(accountId: string, ad: AdAccount, from: string, to: string): Promise<AdsSummary> {
  const [total, daily, camps] = await Promise.all([
    metaInsights(accountId, ad.id, from, to, { level: "account", fields: META_FIELDS }),
    metaInsights(accountId, ad.id, from, to, { level: "account", fields: "spend,impressions,clicks,actions", timeIncrement: "1" }),
    metaInsights(accountId, ad.id, from, to, { level: "campaign", fields: `campaign_id,campaign_name,objective,${META_FIELDS}` }),
  ]);
  const t = total[0] ?? {};
  const tr = metaResults(t);
  const spend = n(t.spend);
  return {
    platform: "metaads",
    account: { id: ad.id, name: ad.name, currency: ad.currency },
    totals: {
      spend,
      impressions: n(t.impressions),
      reach: n(t.reach),
      clicks: n(t.clicks),
      ctr: n(t.ctr),
      cpc: n(t.cpc),
      cpm: n(t.cpm),
      results: tr.results,
      leads: tr.leads,
      messages: tr.messages,
      purchases: tr.purchases,
      costPerResult: tr.results ? spend / tr.results : null,
    },
    daily: daily
      .map((r) => ({ date: String(r.date_start ?? ""), spend: n(r.spend), impressions: n(r.impressions), clicks: n(r.clicks), results: metaResults(r).results }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    campaigns: camps
      .map((r) => {
        const x = metaResults(r);
        const sp = n(r.spend);
        return {
          id: String(r.campaign_id ?? ""),
          name: String(r.campaign_name ?? "Campaña"),
          objective: (r.objective as string) ?? null,
          spend: sp,
          impressions: n(r.impressions),
          reach: n(r.reach),
          clicks: n(r.clicks),
          ctr: n(r.ctr),
          cpc: n(r.cpc),
          results: x.results,
          leads: x.leads,
          messages: x.messages,
          costPerResult: x.results ? sp / x.results : null,
        };
      })
      .sort((a, b) => b.spend - a.spend),
    resultTypes: tr.breakdown.map((b) => ({ label: b.label, n: b.n })),
  };
}

export async function googleAdsSummary(accountId: string, ad: AdAccount | null, from: string, to: string): Promise<AdsSummary> {
  const gaql = async (query: string) => {
    const out = await zernioGet<{ data?: Row[] }>(`/ads/insights?${qs({ accountId, adAccountId: ad?.id, query })}`);
    return out.data ?? [];
  };
  const range = `segments.date BETWEEN '${from}' AND '${to}'`;
  const [days, camps] = await Promise.all([
    gaql(`SELECT segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions FROM customer WHERE ${range}`),
    gaql(`SELECT campaign.id, campaign.name, campaign.advertising_channel_type, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, metrics.conversions FROM campaign WHERE ${range} AND metrics.impressions > 0`),
  ]);
  const get = (r: Row, path: string) => path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Row)[k] : undefined), r);
  const daily = days
    .map((r) => ({ date: String(get(r, "segments.date") ?? ""), spend: n(get(r, "metrics.costMicros")) / 1e6, impressions: n(get(r, "metrics.impressions")), clicks: n(get(r, "metrics.clicks")), results: n(get(r, "metrics.conversions")) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const sum = (k: keyof AdsDay) => daily.reduce((a, d) => a + (d[k] as number), 0);
  const spend = sum("spend");
  const clicks = sum("clicks");
  const impressions = sum("impressions");
  const results = sum("results");
  return {
    platform: "googleads",
    account: { id: ad?.id ?? "", name: ad?.name ?? "Google Ads", currency: ad?.currency ?? null },
    totals: {
      spend,
      impressions,
      reach: 0,
      clicks,
      ctr: impressions ? (clicks / impressions) * 100 : 0,
      cpc: clicks ? spend / clicks : 0,
      cpm: impressions ? (spend / impressions) * 1000 : 0,
      results,
      leads: 0,
      messages: 0,
      purchases: 0,
      costPerResult: results ? spend / results : null,
    },
    daily,
    campaigns: camps
      .map((r) => {
        const sp = n(get(r, "metrics.costMicros")) / 1e6;
        const res = n(get(r, "metrics.conversions"));
        return {
          id: String(get(r, "campaign.id") ?? ""),
          name: String(get(r, "campaign.name") ?? "Campaña"),
          objective: (get(r, "campaign.advertisingChannelType") as string) ?? null,
          spend: sp,
          impressions: n(get(r, "metrics.impressions")),
          reach: 0,
          clicks: n(get(r, "metrics.clicks")),
          ctr: n(get(r, "metrics.ctr")) * 100,
          cpc: n(get(r, "metrics.averageCpc")) / 1e6,
          results: res,
          leads: 0,
          messages: 0,
          costPerResult: res ? sp / res : null,
        };
      })
      .sort((a, b) => b.spend - a.spend),
    resultTypes: results ? [{ label: "Conversiones", n: results }] : [],
  };
}
