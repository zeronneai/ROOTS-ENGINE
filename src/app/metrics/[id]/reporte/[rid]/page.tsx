import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAgency } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadMetricsReport } from "@/server/metrics-report";
import { PrintButton } from "@/components/PrintButton";
import { AutoPrint } from "@/components/AutoPrint";
import { Logo } from "@/components/Logo";
import { BarList } from "@/components/metrics/Charts";
import { fmtMoney, fmtNum, fmtPct } from "@/components/metrics/fmt";
import { fmtDate } from "@/lib/time";

export const dynamic = "force-dynamic";

const DECISION: Record<string, { label: string; cls: string }> = {
  escalar: { label: "Escalar", cls: "bg-ok/15 text-ok" },
  mantener: { label: "Mantener", cls: "bg-purple/10 text-purple" },
  ajustar: { label: "Ajustar", cls: "bg-sun/60 text-ink" },
  pausar: { label: "Pausar", cls: "bg-bad/10 text-bad" },
};

const change = (cur: number | null | undefined, prev: number | null | undefined) =>
  cur != null && prev ? Math.round(((cur - prev) / prev) * 100) : null;

/** Reporte completo de métricas, limpio para leer o guardar como PDF. */
export default async function MetricsReportPage({ params, searchParams }: { params: Promise<{ id: string; rid: string }>; searchParams: Promise<{ pdf?: string }> }) {
  await requireAgency();
  const { id, rid } = await params;
  const { pdf } = await searchParams;
  const saved = await loadMetricsReport(supabaseAdmin(), rid);
  if (!saved || saved.client_id !== id) notFound();
  const { facts: f, report: r } = saved;
  const k = f.kpis;
  const currency = f.ads?.summaries[0]?.currency || "USD";
  const campaigns = (f.ads?.summaries ?? []).flatMap((s) => s.campaigns.map((c) => ({ ...c, platform: s.platform })));

  return (
    <main className="doc mx-auto max-w-4xl px-6 py-8">
      {pdf ? <AutoPrint /> : null}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href={`/metrics/${id}?dias=${saved.days}`} className="text-sm text-muted hover:text-ink">← Métricas</Link>
        <PrintButton label="Descargar PDF" />
      </div>
      <p className="mb-6 rounded-xl bg-sun/40 p-3 text-xs print:hidden">Al darle Descargar PDF, en el cuadro de imprimir elige “Guardar como PDF”.</p>

      {/* Portada */}
      <section className="audit-cover mb-10 rounded-3xl p-8 text-white sm:p-10">
        <div className="opacity-90"><Logo /></div>
        <p className="display mt-10 text-xs text-sun">Reporte de redes, anuncios y web</p>
        <h1 className="mt-2 text-4xl font-bold leading-tight">{f.client.name}</h1>
        <p className="mt-1 text-white/80">
          {f.client.city ? `${f.client.city} · ` : ""}Del {fmtDate(`${saved.range_from}T12:00:00`, { day: "numeric", month: "long" })} al {fmtDate(`${saved.range_to}T12:00:00`, { day: "numeric", month: "long", year: "numeric" })} ({saved.days} días)
        </p>
        <div className="mt-8 flex flex-wrap items-end gap-6">
          <div>
            <div className="text-6xl font-bold leading-none">{r.score}</div>
            <div className="mt-1 text-xs uppercase tracking-wide text-white/70">Salud del marketing / 100</div>
          </div>
          <p className="max-w-xl flex-1 text-xl font-semibold leading-snug">{r.headline}</p>
        </div>
      </section>

      <p className="mb-8 text-lg leading-relaxed">{r.summary}</p>

      {/* KPIs */}
      <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4 break-inside-avoid">
        <Stat label="Inversión en anuncios" value={k.adSpend != null ? fmtMoney(k.adSpend, currency) : "–"} sub={k.adResults ? `${fmtNum(k.adResults)} resultados` : undefined} />
        <Stat label="Costo por resultado" value={k.adSpend && k.adResults ? fmtMoney(k.adSpend / k.adResults, currency) : "–"} sub={k.adClicks ? `${fmtNum(k.adClicks)} clics` : undefined} />
        <Stat label="Seguidores" value={fmtNum(k.followers)} sub={k.followersGained ? `${k.followersGained > 0 ? "+" : ""}${fmtNum(k.followersGained)} en el periodo` : undefined} />
        <Stat label="Visitantes del sitio" value={fmtNum(k.visitors)} delta={change(k.visitors, k.visitorsPrev)} sub={k.contacts != null ? `${fmtNum(k.contacts)} contactos` : undefined} />
      </section>

      {/* Canales */}
      {r.sections.map((s, i) => (
        <section key={i} className="mb-8 break-inside-avoid rounded-2xl border border-line p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl font-bold">{s.title}</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.tone === "good" ? "bg-ok/15 text-ok" : s.tone === "bad" ? "bg-bad/10 text-bad" : "bg-purple/10 text-purple"}`}>
              {s.tone === "good" ? "Va bien" : s.tone === "bad" ? "Necesita atención" : "Estable"}
            </span>
          </div>
          <p className="mt-2 text-muted">{s.verdict}</p>
          {s.keyNumbers.length ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {s.keyNumbers.map((n, j) => (
                <div key={j} className="rounded-xl bg-[#faf9fc] p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted">{n.label}</div>
                  <div className="mt-0.5 text-lg font-semibold">{n.value}</div>
                  {n.note ? <div className="text-xs text-muted">{n.note}</div> : null}
                </div>
              ))}
            </div>
          ) : null}
          {s.key === "web" && f.web ? (
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <div><h3 className="label mb-2">De dónde llegan</h3><BarList items={f.web.sources.slice(0, 6)} /></div>
              <div><h3 className="label mb-2">Qué tocan</h3><BarList items={f.web.clicks.slice(0, 6)} color="#15803d" /></div>
            </div>
          ) : null}
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {s.working.length ? (
              <div>
                <h3 className="label mb-2 text-ok">Lo que funciona</h3>
                <ul className="space-y-1.5 text-sm">{s.working.map((x, j) => <li key={j} className="flex gap-2"><span className="text-ok">▲</span>{x}</li>)}</ul>
              </div>
            ) : null}
            {s.problems.length ? (
              <div>
                <h3 className="label mb-2 text-bad">Lo que hay que arreglar</h3>
                <ul className="space-y-3 text-sm">
                  {s.problems.map((p, j) => (
                    <li key={j}>
                      <div className="font-medium">{p.problem}</div>
                      <div className="text-xs text-muted">{p.evidence}</div>
                      <div className="mt-0.5"><span className="font-medium text-purple">Qué hacer:</span> {p.fix}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      ))}

      {/* Campañas */}
      {r.campaigns.length ? (
        <section className="mb-8 rounded-2xl border border-line p-6">
          <h2 className="text-2xl font-bold">Campaña por campaña</h2>
          <p className="mt-1 text-sm text-muted">Resultados como los reporta la plataforma (leads, mensajes o compras), no clientes cerrados.</p>
          <div className="mt-4 space-y-3">
            {r.campaigns.map((c, i) => {
              const n = campaigns.find((x) => x.name === c.name);
              const d = DECISION[c.decision];
              return (
                <div key={i} className="break-inside-avoid rounded-xl bg-[#faf9fc] p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="font-semibold">{c.name} <span className="text-xs font-normal text-muted">· {c.platform}</span></div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${d.cls}`}>{d.label}</span>
                  </div>
                  {n ? (
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
                      <span>Gasto {fmtMoney(n.spend, currency)}</span>
                      <span>{fmtNum(n.results)} resultados</span>
                      <span>{n.costPerResult != null ? `${fmtMoney(n.costPerResult, currency)} c/u` : "sin costo por resultado"}</span>
                      <span>CTR {fmtPct(n.ctr, 2)}</span>
                      <span>{fmtNum(n.impressions)} impresiones</span>
                    </div>
                  ) : null}
                  <p className="mt-2 text-sm">{c.why}</p>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Contenido */}
      <section className="mb-8 break-inside-avoid rounded-2xl border border-line p-6">
        <h2 className="text-2xl font-bold">Contenido</h2>
        <p className="mt-2 text-sm">{r.content.cadence}</p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <h3 className="label mb-2 text-ok">Repetir</h3>
            <ul className="space-y-1.5 text-sm">{r.content.repeat.map((x, j) => <li key={j} className="flex gap-2"><span className="text-ok">▲</span>{x}</li>)}</ul>
          </div>
          <div>
            <h3 className="label mb-2 text-bad">Dejar de hacer o cambiar</h3>
            <ul className="space-y-1.5 text-sm">{r.content.stop.map((x, j) => <li key={j} className="flex gap-2"><span className="text-bad">▼</span>{x}</li>)}</ul>
          </div>
        </div>
        {f.publicSocial.map((a) =>
          a.recent.length ? (
            <div key={a.platform} className="mt-6 overflow-x-auto">
              <h3 className="label mb-2">{a.platform === "instagram" ? "Instagram" : "TikTok"} @{a.handle}: últimas publicaciones</h3>
              <table className="w-full text-xs">
                <thead className="text-left text-muted"><tr><th className="py-1 pr-2">Fecha</th><th className="py-1 pr-2">Texto</th><th className="py-1 pr-2 text-right">Vistas</th><th className="py-1 pr-2 text-right">Likes</th><th className="py-1 text-right">Coment.</th></tr></thead>
                <tbody>
                  {a.recent.map((p, j) => (
                    <tr key={j} className="border-t border-line">
                      <td className="whitespace-nowrap py-1 pr-2">{p.postedAt}</td>
                      <td className="max-w-xs truncate py-1 pr-2">{p.caption?.slice(0, 70) || "(sin texto)"}</td>
                      <td className="py-1 pr-2 text-right font-mono">{fmtNum(p.views)}</td>
                      <td className="py-1 pr-2 text-right">{fmtNum(p.likes)}</td>
                      <td className="py-1 text-right">{fmtNum(p.comments)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null,
        )}
      </section>

      {/* Embudo */}
      <section className="mb-8 break-inside-avoid rounded-2xl bg-[#faf9fc] p-6">
        <h2 className="text-2xl font-bold">Cómo se conecta todo</h2>
        <p className="mt-2">{r.funnel}</p>
      </section>

      {/* Siguientes pasos */}
      <section className="page-break mb-8">
        <h2 className="text-2xl font-bold">Siguientes pasos</h2>
        <ol className="mt-4 space-y-4">
          {r.nextSteps.map((s, i) => (
            <li key={i} className="break-inside-avoid flex gap-4 rounded-2xl border border-line p-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple text-sm font-bold text-white">{i + 1}</span>
              <div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="font-semibold">{s.title}</h3>
                  <span className="text-xs text-muted">{s.when}</span>
                </div>
                <p className="mt-1 text-sm">{s.how}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {r.notMeasured.length ? (
        <section className="mb-8 break-inside-avoid">
          <h2 className="label mb-2">Lo que no se pudo medir todavía</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">{r.notMeasured.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </section>
      ) : null}

      <footer className="mt-12 border-t border-line pt-6 text-center text-xs text-muted">
        Hecho por Purple Roots Agency · Roots Engine · {fmtDate(saved.created_at, { day: "numeric", month: "long", year: "numeric" })}
      </footer>
    </main>
  );
}

function Stat({ label, value, sub, delta }: { label: string; value: string; sub?: string; delta?: number | null }) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold">
        {value}
        {delta ? <span className={`ml-1 text-xs ${delta > 0 ? "text-ok" : "text-bad"}`}>{delta > 0 ? "▲" : "▼"}{Math.abs(delta)}%</span> : null}
      </div>
      {sub ? <div className="text-xs text-muted">{sub}</div> : null}
    </div>
  );
}
