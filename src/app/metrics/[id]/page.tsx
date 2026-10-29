export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAgency } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadClientMetrics, metricsClients } from "@/server/metrics";
import { ADS_PLATFORMS, type AdsPlatform } from "@/lib/metrics/zernio-metrics";
import { PageTitle, TopBar } from "@/components/Shell";
import { BarList, Kpi, TrendChart } from "@/components/metrics/Charts";
import { fmtMoney, fmtNum, fmtPct, parseDays, RANGES } from "@/components/metrics/fmt";
import { chooseAdAccountAction, connectAdsAction, setMetricsEnabledAction } from "@/app/metrics-actions";
import { SubmitButton } from "@/components/SubmitButton";

const PLATFORM: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", youtube: "YouTube", threads: "Threads", googlebusiness: "Google" };
const fmtSec = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);

export default async function ClientMetricsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ dias?: string; anuncios?: string }> }) {
  await requireAgency();
  const { id } = await params;
  const sp = await searchParams;
  const days = parseDays(sp.dias);
  const db = supabaseAdmin();
  const client = (await metricsClients(db)).find((c) => c.id === id);
  if (!client) notFound();
  const m = await loadClientMetrics(db, client, days);
  const w = m.web;
  const s = m.social?.data;
  const ads = m.ads;
  const connected = new Set((ads?.connections ?? []).map((c) => c.platform));

  return (
    <>
      <TopBar right={<Link href={`/metrics?dias=${days}`} className="text-muted hover:text-ink">← Métricas</Link>} />
      <main className="mx-auto max-w-7xl px-5 py-10">
        <PageTitle kicker={`Métricas · ${m.range.from} a ${m.range.to}`} title={client.name}>
          {RANGES.map((r) => (
            <Link key={r} href={`/metrics/${id}?dias=${r}`} className={`btn ${r === days ? "btn-primary" : "btn-ghost"} !py-1.5 text-xs`}>
              {r} días
            </Link>
          ))}
        </PageTitle>

        {sp.anuncios === "conectado" ? <p className="mb-4 rounded-xl bg-ok/10 p-3 text-sm text-ok">Listo, la cuenta de anuncios quedó conectada. Los números pueden tardar unos minutos en aparecer.</p> : null}
        {sp.anuncios === "ya" ? <p className="mb-4 rounded-xl bg-sun/40 p-3 text-sm">Esa cuenta de anuncios ya estaba conectada.</p> : null}

        {/* Qué funciona y qué no */}
        <section className="card mb-6 p-5" style={{ background: "linear-gradient(110deg, #fffded 0%, #ffffff 60%)" }}>
          <h2 className="font-semibold">Qué funciona y qué no</h2>
          {m.highlights.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {m.highlights.map((h, i) => (
                <li key={i} className="flex gap-2">
                  <span className={h.tone === "good" ? "text-ok" : h.tone === "bad" ? "text-bad" : "text-purple"}>{h.tone === "good" ? "▲" : h.tone === "bad" ? "▼" : "●"}</span>
                  {h.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">Todavía no hay suficientes datos para sacar conclusiones en este periodo.</p>
          )}
        </section>

        {/* KPIs */}
        <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Visitantes del sitio" value={w ? fmtNum(w.current.visitors) : "–"} prev={w ? { cur: w.current.visitors, prev: w.previous.visitors } : null} sub={w ? `${fmtNum(w.current.sessions)} sesiones` : "Sin sitio con t.js"} />
          <Kpi label="Contactos desde el sitio" value={w ? fmtNum(w.contacts) : "–"} prev={w ? { cur: w.contacts, prev: w.previous.contacts } : null} sub={w ? `${fmtPct(w.contactRate)} de las sesiones` : undefined} />
          <Kpi label="Inversión en anuncios" value={ads?.summaries.length ? fmtMoney(m.adsTotals.spend) : "–"} sub={m.adsTotals.results ? `${fmtNum(m.adsTotals.results)} resultados · ${fmtMoney(m.adsTotals.spend / m.adsTotals.results)} c/u` : undefined} />
          <Kpi
            label="Seguidores"
            value={s?.followers?.current != null ? fmtNum(s.followers.current) : "–"}
            sub={s?.followers?.gained != null ? `${s.followers.gained > 0 ? "+" : ""}${fmtNum(s.followers.gained)} en el periodo` : undefined}
          />
        </section>

        {/* Sitio web */}
        <Section title="Sitio web" right={w ? <Link href={`/c/${id}/web?dias=${days === 90 ? 90 : days}`} className="text-sm text-purple hover:underline">Ver analítica completa →</Link> : null}>
          {!w ? (
            <p className="text-sm text-muted">Este cliente no tiene sitio con el código de Roots Engine. Agrégalo en su portal, pestaña Web.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <Small label="Páginas vistas" value={fmtNum(w.current.pageviews)} />
                <Small label="Tiempo promedio" value={fmtSec(w.current.avgSessionSeconds)} />
                <Small label="Páginas por visita" value={String(w.current.pagesPerSession)} />
                <Small label="Se van sin hacer nada" value={`${w.current.bounceRate}%`} />
              </div>
              <div className="mt-5">
                <TrendChart
                  days={w.current.series.map((x) => x.day)}
                  series={[
                    { name: "Visitantes", color: "#4f4789", values: w.current.series.map((x) => x.visitors) },
                    { name: "Páginas vistas", color: "#ffb17a", values: w.current.series.map((x) => x.views) },
                  ]}
                />
              </div>
              <div className="mt-6 grid gap-6 lg:grid-cols-3">
                <div>
                  <h3 className="label mb-2">De dónde llegan</h3>
                  <BarList items={w.current.sources} />
                </div>
                <div>
                  <h3 className="label mb-2">Qué tocan (contactos y botones)</h3>
                  <BarList items={w.current.clicks} color="#15803d" />
                </div>
                <div>
                  <h3 className="label mb-2">Dispositivo</h3>
                  <BarList items={w.current.devices} color="#ffb17a" />
                </div>
              </div>
              <div className="mt-6 overflow-x-auto">
                <h3 className="label mb-2">Páginas más vistas</h3>
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted">
                    <tr><th className="py-1 pr-3">Página</th><th className="py-1 pr-3 text-right">Vistas</th><th className="py-1 pr-3 text-right">Tiempo</th><th className="py-1 pr-3 text-right">Bajan hasta</th><th className="py-1 text-right">Se van de aquí</th></tr>
                  </thead>
                  <tbody>
                    {w.current.pages.slice(0, 10).map((p) => (
                      <tr key={p.path} className="border-t border-line">
                        <td className="max-w-xs truncate py-1.5 pr-3" title={p.title ?? p.path}>{p.path}</td>
                        <td className="py-1.5 pr-3 text-right font-mono">{fmtNum(p.views)}</td>
                        <td className="py-1.5 pr-3 text-right">{fmtSec(p.avgSeconds)}</td>
                        <td className="py-1.5 pr-3 text-right">{p.avgScroll}%</td>
                        <td className="py-1.5 text-right">{p.exitRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Section>

        {/* Redes */}
        <Section title="Redes sociales" right={<span className="text-xs text-muted">{s?.dataAsOf ? `Datos de Zernio al ${s.dataAsOf.slice(0, 10)}` : ""}</span>}>
          {!client.zernio_profile_id ? (
            <p className="text-sm text-muted">Este cliente no tiene redes conectadas. Conéctalas en su portal, pestaña Publicar.</p>
          ) : m.social?.error ? (
            <p className="text-sm text-bad">No se pudieron leer las métricas de redes: {m.social.error}</p>
          ) : s ? (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <Small label="Vistas" value={fmtNum(s.totals.views)} prev={[s.totals.views, s.previousTotals?.views]} />
                <Small label="Alcance" value={fmtNum(s.totals.reach)} prev={[s.totals.reach, s.previousTotals?.reach]} />
                <Small label="Interacciones" value={fmtNum((s.totals.likes ?? 0) + (s.totals.comments ?? 0) + (s.totals.shares ?? 0) + (s.totals.saves ?? 0))} />
                <Small label="Engagement" value={fmtPct(s.totals.engagementRate)} />
              </div>
              <div className="mt-5">
                <TrendChart
                  days={s.daily.map((d) => d.date ?? "")}
                  dualAxis
                  series={[
                    { name: "Vistas", color: "#4f4789", values: s.daily.map((d) => d.views ?? d.impressions ?? 0) },
                    { name: "Interacciones", color: "#15803d", values: s.daily.map((d) => d.engagement ?? 0) },
                  ]}
                />
              </div>
              <div className="mt-6 grid gap-6 lg:grid-cols-3">
                <div>
                  <h3 className="label mb-2">Seguidores por cuenta</h3>
                  <BarList
                    items={(s.followers.byAccount ?? []).map((a) => ({
                      name: PLATFORM[a.platform ?? ""] ?? a.platform ?? "Cuenta",
                      n: a.current ?? 0,
                      sub: a.gained ? `${a.gained > 0 ? "+" : ""}${a.gained}` : undefined,
                    }))}
                  />
                </div>
                <div className="lg:col-span-2 overflow-x-auto">
                  <h3 className="label mb-2">Mejores publicaciones del periodo</h3>
                  {s.topPosts.length ? (
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-muted">
                        <tr><th className="py-1 pr-3">Red</th><th className="py-1 pr-3">Fecha</th><th className="py-1 pr-3 text-right">Vistas</th><th className="py-1 pr-3 text-right">Likes</th><th className="py-1 pr-3 text-right">Coment.</th><th className="py-1 pr-3 text-right">Compart.</th><th className="py-1 text-right">Engagement</th></tr>
                      </thead>
                      <tbody>
                        {s.topPosts.map((p, i) => (
                          <tr key={`${p.postId}-${i}`} className="border-t border-line">
                            <td className="py-1.5 pr-3">{PLATFORM[p.platform ?? ""] ?? p.platform}</td>
                            <td className="py-1.5 pr-3">{p.publishedAt?.slice(0, 10)}</td>
                            <td className="py-1.5 pr-3 text-right font-mono">{fmtNum(p.metrics?.views ?? p.metrics?.reach)}</td>
                            <td className="py-1.5 pr-3 text-right">{fmtNum(p.metrics?.likes)}</td>
                            <td className="py-1.5 pr-3 text-right">{fmtNum(p.metrics?.comments)}</td>
                            <td className="py-1.5 pr-3 text-right">{fmtNum(p.metrics?.shares)}</td>
                            <td className="py-1.5 text-right">{fmtPct(p.metrics?.engagementRate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-muted">No hubo publicaciones en este periodo.</p>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </Section>

        {/* Anuncios */}
        <Section title="Anuncios pagados">
          <div className="mb-4 flex flex-wrap gap-2">
            {(Object.keys(ADS_PLATFORMS) as AdsPlatform[]).map((p) => (
              <form key={p} action={connectAdsAction.bind(null, id, p)}>
                <SubmitButton className={`btn ${connected.has(p) ? "btn-ghost" : "btn-primary"} !py-1.5 text-xs`}>
                  {connected.has(p) ? `✓ ${ADS_PLATFORMS[p].label}` : `Conectar ${ADS_PLATFORMS[p].label}`}
                </SubmitButton>
              </form>
            ))}
          </div>
          {!connected.size ? (
            <p className="text-sm text-muted">
              Conecta la cuenta de anuncios con un usuario que tenga acceso a ella (por ejemplo, el de la agencia en el Business Manager del cliente). Se abre el login de Meta o Google y regresa aquí.
            </p>
          ) : null}

          {(ads?.errors ?? []).map((e, i) => (
            <p key={i} className="mb-2 rounded-xl bg-sun/30 p-3 text-sm">{e}</p>
          ))}

          {(ads?.connections ?? []).map((c) =>
            (ads?.choices[c.id]?.length ?? 0) > 1 ? (
              <form key={c.id} action={chooseAdAccountAction.bind(null, id, c.id)} className="mb-4 flex flex-wrap items-end gap-2">
                <label className="min-w-64">
                  <span className="label">Cuenta publicitaria de {ADS_PLATFORMS[c.platform].label}</span>
                  <select name="ad_account" defaultValue={client.ad_accounts?.[c.id] ?? ""} className="input mt-1.5">
                    <option value="">Escoge...</option>
                    {ads!.choices[c.id].map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                    ))}
                  </select>
                </label>
                <SubmitButton className="btn btn-ghost">Guardar</SubmitButton>
              </form>
            ) : null,
          )}

          {(ads?.summaries ?? []).map((a) => {
            const cur = a.account.currency ?? "USD";
            return (
              <div key={`${a.platform}-${a.account.id}`} className="mt-4 rounded-2xl border border-line p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{ADS_PLATFORMS[a.platform].label} · {a.account.name}</h3>
                  {a.resultTypes.length ? <span className="text-xs text-muted">Resultados: {a.resultTypes.map((r) => `${r.label} ${fmtNum(r.n)}`).join(" · ")}</span> : null}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <Small label="Inversión" value={fmtMoney(a.totals.spend, cur)} />
                  <Small label="Resultados" value={fmtNum(a.totals.results)} />
                  <Small label="Costo por resultado" value={a.totals.costPerResult != null ? fmtMoney(a.totals.costPerResult, cur) : "–"} />
                  <Small label="Clics" value={fmtNum(a.totals.clicks)} />
                  <Small label="CTR" value={fmtPct(a.totals.ctr, 2)} />
                  <Small label="CPC" value={fmtMoney(a.totals.cpc, cur)} />
                </div>
                <div className="mt-5">
                  <TrendChart
                    days={a.daily.map((d) => d.date)}
                    dualAxis
                    series={[
                      { name: "Inversión", color: "#ffb17a", kind: "bar", values: a.daily.map((d) => d.spend), format: (x) => fmtMoney(x, cur) },
                      { name: "Resultados", color: "#4f4789", values: a.daily.map((d) => d.results) },
                    ]}
                  />
                </div>
                <div className="mt-5 overflow-x-auto">
                  <h4 className="label mb-2">Campañas</h4>
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted">
                      <tr><th className="py-1 pr-3">Campaña</th><th className="py-1 pr-3 text-right">Inversión</th><th className="py-1 pr-3 text-right">Resultados</th><th className="py-1 pr-3 text-right">Costo/resultado</th><th className="py-1 pr-3 text-right">Clics</th><th className="py-1 pr-3 text-right">CTR</th><th className="py-1 text-right">CPC</th></tr>
                    </thead>
                    <tbody>
                      {a.campaigns.map((c) => (
                        <tr key={c.id} className="border-t border-line">
                          <td className="max-w-xs truncate py-1.5 pr-3" title={c.name}>{c.name}</td>
                          <td className="py-1.5 pr-3 text-right font-mono">{fmtMoney(c.spend, cur)}</td>
                          <td className={`py-1.5 pr-3 text-right ${c.spend > 0 && !c.results ? "text-bad" : ""}`}>{fmtNum(c.results)}</td>
                          <td className="py-1.5 pr-3 text-right">{c.costPerResult != null ? fmtMoney(c.costPerResult, cur) : "–"}</td>
                          <td className="py-1.5 pr-3 text-right">{fmtNum(c.clicks)}</td>
                          <td className="py-1.5 pr-3 text-right">{fmtPct(c.ctr, 2)}</td>
                          <td className="py-1.5 text-right">{fmtMoney(c.cpc, cur)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </Section>

        <form action={setMetricsEnabledAction.bind(null, id, false)} className="mt-10 text-right">
          <button className="text-xs text-muted hover:text-bad hover:underline">Quitar a {client.name} del panel</button>
        </form>
      </main>
    </>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card mb-6 p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Small({ label, value, prev }: { label: string; value: string; prev?: [number | undefined, number | undefined] }) {
  const d = prev && prev[0] != null && prev[1] ? Math.round(((prev[0] - prev[1]) / prev[1]) * 100) : null;
  return (
    <div className="rounded-xl bg-[#faf9fc] p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-lg font-semibold">
        {value}
        {d ? <span className={`ml-1 text-[11px] ${d > 0 ? "text-ok" : "text-bad"}`}>{d > 0 ? "▲" : "▼"}{Math.abs(d)}%</span> : null}
      </div>
    </div>
  );
}
