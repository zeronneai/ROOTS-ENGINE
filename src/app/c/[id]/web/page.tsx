import Link from "next/link";
import { headers } from "next/headers";
import { loadClient } from "@/server/load";
import { PageTitle } from "@/components/Shell";
import { SubmitButton } from "@/components/SubmitButton";
import { ApiButton } from "@/components/ApiButton";
import { CopyText } from "@/components/rebrand/CopyText";
import { LiveRefresh } from "@/components/rebrand/LiveRefresh";
import { addSiteAction, deleteSiteAction } from "@/app/web-actions";
import { siteStats } from "@/server/web";
import { fmtDateTime } from "@/lib/time";
import type { WebAnalysis } from "@/lib/ai/web";

const RANGES = [
  { d: 1, l: "Hoy (24 h)" },
  { d: 7, l: "7 días" },
  { d: 30, l: "30 días" },
  { d: 90, l: "90 días" },
];

const fmtSec = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);

function Bars({ items, total }: { items: { name: string; n: number }[]; total: number }) {
  if (!items.length) return <p className="text-sm text-muted">Sin datos todavía.</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((x) => (
        <li key={x.name} className="relative overflow-hidden rounded-lg px-3 py-1.5 text-sm">
          <div className="absolute inset-y-0 left-0 bg-sun/50" style={{ width: `${Math.max(3, (x.n / Math.max(1, total)) * 100)}%` }} />
          <div className="relative flex justify-between gap-3"><span className="truncate">{x.name}</span><span className="font-mono">{x.n}</span></div>
        </li>
      ))}
    </ul>
  );
}

export default async function WebPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ site?: string; dias?: string }> }) {
  const { id } = await params;
  const { site: siteParam, dias } = await searchParams;
  const { db, client, isAgency } = await loadClient(id);
  const { data: sites } = await db.from("sites").select("*").eq("client_id", id).order("created_at");
  const site = (sites ?? []).find((s) => s.id === siteParam) ?? sites?.[0] ?? null;
  const days = RANGES.some((r) => String(r.d) === dias) ? Number(dias) : 7;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const data = site ? await siteStats(db, site.id, days) : null;
  const s = data?.stats;
  const analysis = (site?.analysis ?? null) as WebAnalysis | null;
  const snippet = site ? `<script defer src="${origin}/t.js" data-site="${site.key}"></script>` : "";
  const maxDay = Math.max(1, ...(s?.series ?? []).map((x) => x.views));

  return (
    <>
      <LiveRefresh every={20000} />
      <PageTitle kicker={`✦ Sitio web · ${client.name}`} title="Analítica web" />

      {(sites ?? []).length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {sites!.map((x) => (
            <Link key={x.id} href={`/c/${id}/web?site=${x.id}&dias=${days}`} className={`chip ${x.id === site?.id ? "!bg-sun/60 font-semibold" : ""}`}>{x.domain}</Link>
          ))}
        </div>
      ) : null}

      {!site ? (
        <div className="card max-w-xl space-y-3 p-6">
          <div className="font-semibold">Agrega el sitio del cliente</div>
          <p className="text-sm text-muted">Te damos un código de una línea para pegar en su página y aquí ves las visitas reales, de dónde llegan, dónde se quedan y dónde se van.</p>
          {isAgency ? (
            <form action={addSiteAction.bind(null, id)} className="flex gap-2">
              <input name="domain" className="input" placeholder="tippincowgirl.com" required />
              <SubmitButton className="btn btn-primary">Agregar</SubmitButton>
            </form>
          ) : null}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold">{site.domain}</span>
            {RANGES.map((r) => (
              <Link key={r.d} href={`/c/${id}/web?site=${site.id}&dias=${r.d}`} className={`chip ${r.d === days ? "!bg-sun/60 font-semibold" : ""}`}>{r.l}</Link>
            ))}
            <span className="ml-auto flex items-center gap-2 rounded-full bg-ok/10 px-3 py-1 text-sm text-ok">
              <span className="h-2 w-2 animate-pulse rounded-full bg-ok" /> {data!.live.active} ahorita
            </span>
          </div>

          {s!.pageviews === 0 ? (
            <div className="card space-y-3 p-6">
              <div className="font-semibold">Todavía no llegan visitas</div>
              <p className="text-sm text-muted">
                Pega este código en el sitio, dentro de &lt;head&gt; (en Next.js, en <code>app/layout.tsx</code>; en Wix o Shopify, en &quot;código personalizado&quot;).
                Las visitas aparecen aquí en segundos.
              </p>
              <pre className="overflow-x-auto rounded-lg bg-ink p-3 text-xs text-paper">{snippet}</pre>
              <CopyText text={snippet} label="Copiar código" />
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              ["Visitantes", s!.visitors],
              ["Visitas", s!.sessions],
              ["Páginas vistas", s!.pageviews],
              ["Tiempo promedio", fmtSec(s!.avgSessionSeconds)],
              ["Páginas por visita", s!.pagesPerSession],
              ["Rebote", `${s!.bounceRate}%`],
            ].map(([l, v]) => (
              <div key={String(l)} className="card p-4">
                <div className="label">{l}</div>
                <div className="mt-1 text-2xl font-semibold">{v}</div>
              </div>
            ))}
          </div>

          {days > 1 ? (
            <div className="card p-5">
              <div className="label mb-3">Páginas vistas por día</div>
              <div className="flex h-32 items-end gap-1">
                {s!.series.map((d) => (
                  <div key={d.day} className="flex-1 rounded-t bg-purple/70" style={{ height: `${(d.views / maxDay) * 100}%`, minHeight: d.views ? 3 : 0 }} title={`${d.day}: ${d.views} vistas, ${d.visitors} visitantes`} />
                ))}
              </div>
            </div>
          ) : null}

          {data!.live.active ? (
            <div className="card p-5">
              <div className="label mb-2">Viendo ahorita</div>
              <Bars items={data!.live.pages} total={data!.live.active} />
            </div>
          ) : null}

          <div className="card overflow-x-auto p-5">
            <div className="label mb-3">Páginas: dónde se quedan y dónde se van</div>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr><th className="py-2 pr-3">Página</th><th className="py-2 pr-3">Vistas</th><th className="py-2 pr-3">Tiempo</th><th className="py-2 pr-3">Bajan</th><th className="py-2 pr-3">Entran aquí</th><th className="py-2">Se van aquí</th></tr>
              </thead>
              <tbody>
                {s!.pages.map((p) => (
                  <tr key={p.path} className="border-t border-line">
                    <td className="max-w-[280px] truncate py-2 pr-3" title={p.title ?? p.path}>{p.path}</td>
                    <td className="py-2 pr-3 font-mono">{p.views}</td>
                    <td className="py-2 pr-3 font-mono">{fmtSec(p.avgSeconds)}</td>
                    <td className="py-2 pr-3 font-mono">{p.avgScroll}%</td>
                    <td className="py-2 pr-3 font-mono">{p.entries}</td>
                    <td className={`py-2 font-mono ${p.exitRate >= 70 ? "text-bad" : ""}`}>{p.exitRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted">“Bajan” = qué tanto de la página ven en promedio. “Se van aquí” = de las vistas a esa página, cuántas fueron la última de la visita.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="card p-5"><div className="label mb-3">De dónde llegan</div><Bars items={s!.sources} total={s!.sessions} /></div>
            <div className="card p-5"><div className="label mb-3">Clics importantes</div><Bars items={s!.clicks} total={Math.max(1, ...s!.clicks.map((c) => c.n))} /></div>
            <div className="card p-5"><div className="label mb-3">Dispositivo</div><Bars items={s!.devices} total={s!.sessions} /></div>
            <div className="card p-5"><div className="label mb-3">Ciudad</div><Bars items={s!.cities} total={s!.pageviews} /></div>
          </div>

          <div className="card space-y-4 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="font-semibold">Análisis con IA (últimos 30 días)</div>
              {site.analyzed_at ? <span className="text-xs text-muted">Actualizado {fmtDateTime(site.analyzed_at)}</span> : null}
              <span className="ml-auto"><ApiButton url={`/api/clients/${id}/web/${site.id}/analyze`} label={analysis ? "Actualizar análisis" : "Analizar"} busyLabel="Analizando..." /></span>
            </div>
            {analysis ? (
              <div className="space-y-4 text-sm">
                <p className="text-lg font-semibold">{analysis.headline}</p>
                <p><span className="label">Dónde se van: </span>{analysis.whereTheyLeave}</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="label text-ok">Lo que funciona</div>
                    <ul className="mt-1 list-disc space-y-1 pl-4">{analysis.whatWorks.map((x, k) => <li key={k}>{x}</li>)}</ul>
                  </div>
                  <div>
                    <div className="label">Para probar este mes</div>
                    <ul className="mt-1 list-disc space-y-1 pl-4">{analysis.experiments.map((x, k) => <li key={k}>{x}</li>)}</ul>
                  </div>
                </div>
                <div className="space-y-2">
                  {analysis.problems.map((p, k) => (
                    <div key={k} className="rounded-xl border border-line p-3">
                      <div className="flex items-center gap-2"><span className="chip">{p.page}</span><span className={`chip ${p.priority === "alta" ? "text-bad" : ""}`}>{p.priority}</span></div>
                      <p className="mt-1"><span className="font-semibold text-bad">Problema:</span> {p.issue}</p>
                      <p className="mt-1"><span className="font-semibold text-ok">Arreglo:</span> {p.fix}</p>
                    </div>
                  ))}
                </div>
                <p><span className="label">Redes y sitio: </span>{analysis.contentLinks}</p>
              </div>
            ) : (
              <p className="text-sm text-muted">Cuando quieras, la IA lee los números y te dice dónde se queda la gente, dónde se va y qué arreglar. Solo corre cuando le picas.</p>
            )}
          </div>

          {isAgency ? (
            <details className="card p-5 text-sm">
              <summary className="cursor-pointer font-semibold">Código del sitio y opciones</summary>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-ink p-3 text-xs text-paper">{snippet}</pre>
              <div className="mt-2 flex flex-wrap gap-3">
                <CopyText text={snippet} label="Copiar código" />
                <form action={deleteSiteAction.bind(null, id, site.id)}><SubmitButton className="btn btn-ghost text-bad">Quitar sitio</SubmitButton></form>
              </div>
              {site.read_token ? (
                <div className="mt-4 rounded-lg border border-line p-3">
                  <p className="font-semibold">Token de lectura</p>
                  <p className="mt-1 text-xs text-muted">Para que el panel propio del cliente muestre estas visitas (GET /api/sites/stats con Authorization: Bearer). Solo lee, va en el servidor del cliente, nunca en el navegador.</p>
                  <div className="mt-2"><CopyText text={site.read_token} label="Copiar token" /></div>
                </div>
              ) : null}
              <p className="mt-3 text-xs text-muted">Para medir un botón específico, agrégale data-track=&quot;Nombre&quot;. Las llamadas, WhatsApp, correo y botones de agendar se miden solos.</p>
              <form action={addSiteAction.bind(null, id)} className="mt-4 flex gap-2">
                <input name="domain" className="input" placeholder="Otro dominio del cliente" required />
                <SubmitButton className="btn btn-ghost">Agregar otro sitio</SubmitButton>
              </form>
            </details>
          ) : null}
        </div>
      )}
    </>
  );
}
