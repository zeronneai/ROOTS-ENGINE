import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadEvents } from "./web";
import { loadPublicSocial, type PublicSocial } from "./social-snapshots";
import { summarize, type WebSummary } from "@/lib/web-stats";
import {
  adAccounts,
  adConnections,
  googleAdsSummary,
  metaAdsSummary,
  socialDashboard,
  type AdsPlatform,
  type AdsSummary,
  type SocialDashboard,
} from "@/lib/metrics/zernio-metrics";

export type MetricsClient = { id: string; name: string; city: string | null; zernio_profile_id: string | null; metrics_enabled: boolean; ad_accounts: Record<string, string> | null };

const day = (d: Date) => d.toISOString().slice(0, 10);

export function rangeOf(days: number) {
  const to = new Date();
  const from = new Date(Date.now() - (days - 1) * 864e5);
  return { days, from: day(from), to: day(to) };
}

// qué clics del sitio cuentan como "contacto" (alguien que quiere comprar o agendar)
const CONTACT = /^(Llamada|WhatsApp|Correo|Agendar)/;

export type WebBlock = {
  sites: { id: string; domain: string }[];
  current: WebSummary;
  previous: { visitors: number; sessions: number; pageviews: number; contacts: number };
  contacts: number;
  contactRate: number;
} | null;

async function webBlock(db: SupabaseClient, clientId: string, days: number): Promise<WebBlock> {
  const { data: sites } = await db.from("sites").select("id, domain").eq("client_id", clientId).order("created_at");
  if (!sites?.length) return null;
  const since = new Date(Date.now() - 2 * days * 864e5);
  const cut = Date.now() - days * 864e5;
  const all = (await Promise.all(sites.map((s) => loadEvents(db, s.id, since)))).flat();
  const cur = all.filter((e) => Date.parse(e.ts) >= cut);
  const prev = all.filter((e) => Date.parse(e.ts) < cut);
  const current = summarize(cur, days);
  const p = summarize(prev, days);
  const contactsOf = (s: WebSummary) => s.clicks.filter((c) => CONTACT.test(c.name)).reduce((a, c) => a + c.n, 0);
  const contacts = contactsOf(current);
  return {
    sites,
    current,
    previous: { visitors: p.visitors, sessions: p.sessions, pageviews: p.pageviews, contacts: contactsOf(p) },
    contacts,
    contactRate: current.sessions ? (contacts / current.sessions) * 100 : 0,
  };
}

export type AdsBlock = {
  connections: { id: string; platform: AdsPlatform; name: string; healthy: boolean }[];
  summaries: AdsSummary[];
  errors: string[];
  /** cuentas publicitarias para escoger, por conexión */
  choices: Record<string, { id: string; name: string }[]>;
};

async function adsBlock(client: MetricsClient, from: string, to: string): Promise<AdsBlock | null> {
  if (!client.zernio_profile_id) return null;
  const connections = await adConnections(client.zernio_profile_id);
  const out: AdsBlock = { connections: connections.map((c) => ({ id: c.id, platform: c.platform, name: c.name, healthy: c.healthy })), summaries: [], errors: [], choices: {} };
  await Promise.all(
    connections.map(async (c) => {
      try {
        if (c.platform === "tiktokads") {
          out.errors.push("TikTok Ads conectado: sus números se agregan pronto al panel.");
          return;
        }
        const list = await adAccounts(c.id);
        out.choices[c.id] = list.map((a) => ({ id: a.id, name: a.name }));
        const chosenId = client.ad_accounts?.[c.id];
        const usable = list.filter((a) => a.selectable);
        const chosen = usable.find((a) => a.id === chosenId) ?? (usable.length === 1 ? usable[0] : null);
        if (c.platform === "metaads") {
          if (!chosen) {
            out.errors.push(usable.length ? "Meta Ads: escoge cuál cuenta publicitaria es la de este cliente." : "Meta Ads: la conexión no ve ninguna cuenta publicitaria activa.");
            return;
          }
          out.summaries.push(await metaAdsSummary(c.id, chosen, from, to));
        } else if (c.platform === "googleads") {
          if (!chosen && usable.length > 1) {
            out.errors.push("Google Ads: escoge cuál cuenta es la de este cliente.");
            return;
          }
          out.summaries.push(await googleAdsSummary(c.id, chosen, from, to));
        }
      } catch (e) {
        out.errors.push(`${c.platform}: ${(e as Error).message}`);
      }
    }),
  );
  return out;
}

export type SocialBlock = { data: SocialDashboard | null; error: string | null } | null;

async function socialBlock(client: MetricsClient, from: string, to: string): Promise<SocialBlock> {
  if (!client.zernio_profile_id) return null;
  try {
    return { data: await socialDashboard(client.zernio_profile_id, from, to), error: null };
  } catch (e) {
    return { data: null, error: (e as Error).message };
  }
}

export type ClientMetrics = Awaited<ReturnType<typeof loadClientMetrics>>;

/** Todo lo medible de un cliente en un periodo: web (nuestro t.js), redes y anuncios (Zernio). */
export async function loadClientMetrics(db: SupabaseClient, client: MetricsClient, days: number) {
  const r = rangeOf(days);
  const [web, social, ads, publicSocial] = await Promise.all([
    webBlock(db, client.id, days).catch(() => null),
    socialBlock(client, r.from, r.to),
    adsBlock(client, r.from, r.to).catch((e) => ({ connections: [], summaries: [], errors: [(e as Error).message], choices: {} }) as AdsBlock),
    loadPublicSocial(db, client.id, r.from).catch(() => null),
  ]);
  const adsTotals = (ads?.summaries ?? []).reduce(
    (a, s) => ({ spend: a.spend + s.totals.spend, results: a.results + s.totals.results, clicks: a.clicks + s.totals.clicks, impressions: a.impressions + s.totals.impressions }),
    { spend: 0, results: 0, clicks: 0, impressions: 0 },
  );
  const publicFollowers = publicSocial?.accounts.length
    ? {
        current: publicSocial.accounts.reduce((a, x) => a + (x.latest.followers ?? 0), 0),
        gained: publicSocial.accounts.some((x) => x.gained != null) ? publicSocial.accounts.reduce((a, x) => a + (x.gained ?? 0), 0) : null,
      }
    : null;
  return { client, range: r, web, social, ads, adsTotals, publicSocial, publicFollowers, highlights: highlights(web, social, ads, publicSocial) };
}

export type Highlight = { tone: "good" | "bad" | "info"; text: string };

const pct = (cur: number, prev: number) => (prev ? Math.round(((cur - prev) / prev) * 100) : null);
const money = (x: number) => `$${x.toLocaleString("en-US", { maximumFractionDigits: x < 100 ? 2 : 0 })}`;

/** Lo que funciona y lo que no, en frases cortas, a partir de los números. */
function highlights(web: WebBlock, social: SocialBlock, ads: AdsBlock | null, pub: PublicSocial | null): Highlight[] {
  const out: Highlight[] = [];
  for (const a of pub?.accounts ?? []) {
    const name = a.platform === "instagram" ? "Instagram" : "TikTok";
    const st = a.latest.stats;
    if (a.gained != null && a.gained !== 0) out.push({ tone: a.gained > 0 ? "good" : "bad", text: `${name} @${a.handle}: ${a.gained > 0 ? "+" : ""}${a.gained} seguidores en el periodo.` });
    if (st.daysSinceLastPost != null && st.daysSinceLastPost > 7) out.push({ tone: "bad", text: `${name} @${a.handle}: lleva ${st.daysSinceLastPost} días sin publicar.` });
    else if (st.postsLast30Days) out.push({ tone: "info", text: `${name} @${a.handle}: ${st.postsLast30Days} publicaciones en los últimos 30 días${st.medianViews ? `, con ${st.medianViews.toLocaleString("en-US")} vistas medianas` : ""}.` });
    const best = [...(a.latest.recent ?? [])].sort((x, y) => (y.views ?? y.likes ?? 0) - (x.views ?? x.likes ?? 0))[0];
    if (best && st.medianViews && best.views && best.views >= st.medianViews * 2)
      out.push({ tone: "good", text: `${name}: el post del ${best.postedAt?.slice(0, 10)} sacó ${best.views.toLocaleString("en-US")} vistas, ${Math.round(best.views / st.medianViews)}x lo normal. Repetir ese formato.` });
  }
  if (web) {
    const c = web.current;
    const d = pct(c.visitors, web.previous.visitors);
    if (d != null && Math.abs(d) >= 15) out.push({ tone: d > 0 ? "good" : "bad", text: `Visitas al sitio ${d > 0 ? "subieron" : "bajaron"} ${Math.abs(d)}% contra el periodo anterior (${c.visitors} visitantes).` });
    const top = c.sources[0];
    if (top && c.sessions >= 10) out.push({ tone: "info", text: `La fuente que más trae gente al sitio es ${top.name} (${Math.round((top.n / c.sessions) * 100)}% de las sesiones).` });
    if (c.sessions >= 20 && web.contactRate < 1) out.push({ tone: "bad", text: `Casi nadie contacta desde el sitio: ${web.contacts} clics a llamar, WhatsApp o agendar en ${c.sessions} sesiones. Hay que revisar los botones y la oferta.` });
    else if (web.contacts > 0) out.push({ tone: "good", text: `${web.contacts} personas tocaron llamar, WhatsApp o agendar en el sitio (${web.contactRate.toFixed(1)}% de las sesiones).` });
    if (c.sessions >= 20 && c.bounceRate >= 70) out.push({ tone: "bad", text: `${c.bounceRate}% se va sin hacer nada en el sitio. La primera pantalla no los está enganchando.` });
  }
  if (social?.data) {
    const s = social.data;
    if (s.followers?.gained != null && s.followers.gained !== 0) out.push({ tone: s.followers.gained > 0 ? "good" : "bad", text: `Seguidores: ${s.followers.gained > 0 ? "+" : ""}${s.followers.gained} en el periodo (${(s.followers.current ?? 0).toLocaleString("en-US")} en total).` });
    const v = s.totals?.views ?? s.totals?.reach ?? 0;
    const pv = s.previousTotals?.views ?? s.previousTotals?.reach ?? 0;
    const d = pct(v, pv);
    if (d != null && Math.abs(d) >= 20) out.push({ tone: d > 0 ? "good" : "bad", text: `Alcance en redes ${d > 0 ? "subió" : "bajó"} ${Math.abs(d)}% contra el periodo anterior.` });
    const best = s.topPosts?.[0];
    if (best?.metrics) out.push({ tone: "info", text: `Mejor post: ${best.platform} del ${best.publishedAt?.slice(0, 10)} con ${(best.metrics.views ?? best.metrics.reach ?? 0).toLocaleString("en-US")} vistas y ${((best.metrics.likes ?? 0) + (best.metrics.comments ?? 0) + (best.metrics.shares ?? 0) + (best.metrics.saves ?? 0)).toLocaleString("en-US")} interacciones.` });
  }
  for (const s of ads?.summaries ?? []) {
    const name = s.platform === "metaads" ? "Meta" : "Google";
    const withRes = s.campaigns.filter((c) => c.spend > 0 && c.results > 0 && c.costPerResult != null);
    const best = [...withRes].sort((a, b) => a.costPerResult! - b.costPerResult!)[0];
    if (best && withRes.length > 1) out.push({ tone: "good", text: `${name}: la campaña que mejor rinde es "${best.name}" a ${money(best.costPerResult!)} por resultado.` });
    const avgCpr = s.totals.costPerResult ?? 0;
    for (const c of s.campaigns.filter((c) => c.spend >= Math.max(20, avgCpr * 2) && c.results === 0).slice(0, 2))
      out.push({ tone: "bad", text: `${name}: "${c.name}" gastó ${money(c.spend)} sin un solo resultado. Pausar o cambiar el anuncio.` });
    if (s.platform === "metaads" && s.totals.impressions > 2000 && s.totals.ctr < 0.8) out.push({ tone: "bad", text: `Meta: el CTR es ${s.totals.ctr.toFixed(2)}%, bajo. Los anuncios no están deteniendo el scroll: probar otros hooks o videos.` });
    if (s.totals.spend > 0 && s.totals.results === 0) out.push({ tone: "bad", text: `${name}: ${money(s.totals.spend)} gastados sin resultados medidos. Revisar que el píxel o la conversión estén bien puestos.` });
  }
  return out;
}

/** Los clientes del panel. */
export async function metricsClients(db: SupabaseClient) {
  const { data } = await db.from("clients").select("id, name, city, zernio_profile_id, metrics_enabled, ad_accounts").order("name");
  return (data ?? []) as MetricsClient[];
}
