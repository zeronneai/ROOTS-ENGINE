export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireAgency } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadClientMetrics, metricsClients } from "@/server/metrics";
import { PageTitle, TopBar } from "@/components/Shell";
import { Sparkline } from "@/components/metrics/Charts";
import { fmtMoney, fmtNum, parseDays, RANGES } from "@/components/metrics/fmt";
import { addToMetricsAction } from "@/app/metrics-actions";
import { SubmitButton } from "@/components/SubmitButton";

const delta = (cur: number, prev: number) => (prev ? Math.round(((cur - prev) / prev) * 100) : null);

function Delta({ cur, prev, invert = false }: { cur: number; prev: number; invert?: boolean }) {
  const d = delta(cur, prev);
  if (d == null || d === 0) return null;
  const good = invert ? d < 0 : d > 0;
  return <span className={`ml-1 text-[11px] font-semibold ${good ? "text-ok" : "text-bad"}`}>{d > 0 ? "▲" : "▼"}{Math.abs(d)}%</span>;
}

export default async function MetricsHome({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  await requireAgency();
  const days = parseDays((await searchParams).dias);
  const db = supabaseAdmin();
  const all = await metricsClients(db);
  const enabled = all.filter((c) => c.metrics_enabled);
  const rows = await Promise.all(enabled.map((c) => loadClientMetrics(db, c, days)));
  const total = rows.reduce(
    (a, r) => ({
      visitors: a.visitors + (r.web?.current.visitors ?? 0),
      contacts: a.contacts + (r.web?.contacts ?? 0),
      spend: a.spend + r.adsTotals.spend,
      results: a.results + r.adsTotals.results,
      followers: a.followers + (r.social?.data?.followers?.gained ?? 0),
    }),
    { visitors: 0, contacts: 0, spend: 0, results: 0, followers: 0 },
  );

  return (
    <>
      <TopBar right={<Link href="/agency" className="text-muted hover:text-ink">← Clientes</Link>} />
      <main className="mx-auto max-w-7xl px-5 py-10">
        <PageTitle kicker="Agencia" title="Métricas">
          {RANGES.map((r) => (
            <Link key={r} href={`/metrics?dias=${r}`} className={`btn ${r === days ? "btn-primary" : "btn-ghost"} !py-1.5 text-xs`}>
              {r} días
            </Link>
          ))}
        </PageTitle>

        <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Total label="Visitantes a los sitios" value={fmtNum(total.visitors)} />
          <Total label="Contactos desde los sitios" value={fmtNum(total.contacts)} sub="Llamar, WhatsApp, correo, agendar" />
          <Total label="Inversión en anuncios" value={fmtMoney(total.spend)} />
          <Total label="Resultados de anuncios" value={fmtNum(total.results)} sub={total.results ? `${fmtMoney(total.spend / total.results)} por resultado` : undefined} />
          <Total label="Seguidores ganados" value={`${total.followers > 0 ? "+" : ""}${fmtNum(total.followers)}`} />
        </section>

        {!rows.length ? (
          <div className="card p-8 text-center text-muted">Todavía no hay clientes en el panel. Agrégalos abajo.</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((r) => {
              const w = r.web;
              const s = r.social?.data;
              const ads = r.adsTotals;
              const alerts = r.highlights.filter((h) => h.tone === "bad").length;
              return (
                <Link key={r.client.id} href={`/metrics/${r.client.id}?dias=${days}`} className="card block p-5 transition hover:border-purple/70">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold">{r.client.name}</div>
                      <div className="text-xs text-muted">{r.client.city ?? ""}</div>
                    </div>
                    {alerts ? <span className="chip !bg-bad/10 !text-bad">{alerts} alerta{alerts === 1 ? "" : "s"}</span> : <span className="chip !bg-ok/10 !text-ok">Sin alertas</span>}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Mini label="Visitantes" value={w ? fmtNum(w.current.visitors) : "Sin sitio"}>{w ? <Delta cur={w.current.visitors} prev={w.previous.visitors} /> : null}</Mini>
                    <Mini label="Contactos web" value={w ? fmtNum(w.contacts) : "–"}>{w ? <Delta cur={w.contacts} prev={w.previous.contacts} /> : null}</Mini>
                    <Mini label="Anuncios" value={r.ads?.summaries.length ? fmtMoney(ads.spend) : r.ads?.connections.length ? "Revisar" : "Sin conectar"} sub={ads.results ? `${fmtNum(ads.results)} resultados · ${fmtMoney(ads.spend / ads.results)} c/u` : undefined} />
                    <Mini
                      label="Seguidores"
                      value={s?.followers?.current != null ? fmtNum(s.followers.current) : r.client.zernio_profile_id ? "–" : "Sin redes"}
                      sub={s?.followers?.gained ? `${s.followers.gained > 0 ? "+" : ""}${fmtNum(s.followers.gained)} en ${days} días` : undefined}
                    />
                  </div>
                  {w ? (
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-xs text-muted">
                      <span>Visitas por día</span>
                      <Sparkline values={w.current.series.map((x) => x.visitors)} />
                    </div>
                  ) : null}
                </Link>
              );
            })}
          </div>
        )}

        {all.some((c) => !c.metrics_enabled) ? (
          <form action={addToMetricsAction} className="card mt-8 flex flex-wrap items-end gap-3 p-5">
            <label className="min-w-64 flex-1">
              <span className="label">Agregar un cliente al panel</span>
              <select name="client_id" className="input mt-1.5" defaultValue="">
                <option value="" disabled>Escoge un cliente...</option>
                {all.filter((c) => !c.metrics_enabled).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <SubmitButton className="btn btn-primary">Agregar</SubmitButton>
          </form>
        ) : null}
      </main>
    </>
  );
}

function Total({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {sub ? <div className="text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

function Mini({ label, value, sub, children }: { label: string; value: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 font-semibold">
        {value}
        {children}
      </div>
      {sub ? <div className="text-[11px] text-muted">{sub}</div> : null}
    </div>
  );
}
