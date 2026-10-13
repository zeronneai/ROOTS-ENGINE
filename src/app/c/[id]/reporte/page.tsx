import Link from "next/link";
import { loadClient } from "@/server/load";
import { loadReportData } from "@/server/report-data";
import { Empty, PageTitle } from "@/components/Shell";
import { ApiButton } from "@/components/ApiButton";

/** Vista previa corta del reporte. El detalle completo (y los PDFs) se abren aparte. */
export default async function ReportePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, client, isAgency } = await loadClient(id);
  const { report: r, date, ideas } = await loadReportData(db, id);

  if (!r)
    return (
      <>
        <PageTitle kicker="Reporte" title="Estrategia de contenido" />
        <Empty title="Todavía no hay reporte">Ve a Resumen y dale “Arrancar motor”.</Empty>
      </>
    );

  const doc = (parte: string) => `/doc/${id}?parte=${parte}`;

  return (
    <>
      <PageTitle kicker={`Reporte · ${date}`} title={client.name}>
        {isAgency ? (
          <ApiButton url={`/api/clients/${id}/engine/report`} label="Regenerar" busyLabel="Escribiendo (1-2 min)..." variant="ghost" />
        ) : null}
        <Link href={doc("completo")} target="_blank" className="btn btn-primary">Abrir reporte completo</Link>
      </PageTitle>

      <section className="card mb-8 p-6" style={{ background: "linear-gradient(120deg, #fffded, #fff 60%)" }}>
        <div className="label">Diagnóstico</div>
        <p className="mt-2 text-2xl font-semibold leading-snug">{r.headline}</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Parte 1 ── */}
        <section className="card relative flex flex-col overflow-hidden p-6 pt-7">
          <span className="absolute inset-x-0 top-0 h-1.5 bg-purple" />
          <div className="display text-[11px] text-purple">Parte 1</div>
          <h2 className="mt-1 text-2xl font-bold">Análisis</h2>
          <p className="text-sm text-muted">Mercado, competencia, marca, presencia digital y oferta.</p>

          <div className="mt-6 space-y-5 text-sm">
            {r.digitalPresence ? (
              <Score label="Presencia digital" value={Math.round(r.digitalPresence.score)} />
            ) : null}
            <Preview title="Lo que está pegando en su mercado" items={r.market.whatWorks.slice(0, 3)} />
            <Preview title="Oportunidades más grandes" items={r.opportunities.filter((o) => o.impact === "alto").concat(r.opportunities).slice(0, 3).map((o) => o.title)} />
            {r.offer ? (
              <div className="rounded-xl bg-sun/40 p-4">
                <div className="label text-ink">La oferta · {r.offer.name}</div>
                <p className="mt-1 font-medium">“{r.offer.pitch}”</p>
              </div>
            ) : null}
          </div>

          <div className="mt-auto pt-6">
            <p className="mb-3 text-xs text-muted">¿Quieres más detalle? Abre el análisis completo.</p>
            <Link href={doc("analisis")} target="_blank" className="btn btn-ghost">Abrir análisis →</Link>
          </div>
        </section>

        {/* ── Parte 2 ── */}
        <section className="card relative flex flex-col overflow-hidden p-6 pt-7">
          <span className="absolute inset-x-0 top-0 h-1.5 bg-peach" />
          <div className="display text-[11px] text-purple">Parte 2</div>
          <h2 className="mt-1 text-2xl font-bold">Contenido</h2>
          <p className="text-sm text-muted">Estrategia, cómo grabar y qué grabar esta semana.</p>

          <div className="mt-6 space-y-5 text-sm">
            <p className="font-medium">{r.strategy.positioning}</p>
            <div className="space-y-2">
              {r.strategy.pillars.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate">{p.name}</span>
                  <div className="h-2 flex-1 rounded-full bg-line"><div className="h-2 rounded-full bg-purple" style={{ width: `${Math.min(100, p.share)}%` }} /></div>
                  <span className="w-9 text-right text-xs text-muted">{Math.round(p.share)}%</span>
                </div>
              ))}
            </div>
            <Preview title="Hooks para probar" items={r.strategy.hooksToTest.slice(0, 3).map((h) => `“${h}”`)} />
            {ideas.length ? (
              <Preview title={`${ideas.length} videos para grabar esta semana`} items={ideas.slice(0, 5).map((i) => i.title)} />
            ) : null}
          </div>

          <div className="mt-auto pt-6">
            <p className="mb-3 text-xs text-muted">¿Quieres más detalle? Abre el plan de contenido completo.</p>
            <Link href={doc("contenido")} target="_blank" className="btn btn-ghost">Abrir contenido →</Link>
          </div>
        </section>
      </div>
    </>
  );
}

function Preview({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="label">{title}</div>
      <ul className="mt-2 space-y-1.5">
        {items.map((x, i) => (
          <li key={i} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-peach" />{x}</li>
        ))}
      </ul>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? "#15803d" : value >= 45 ? "#f59e0b" : "#dc2626";
  return (
    <div>
      <div className="flex justify-between"><span className="label">{label}</span><span className="font-bold" style={{ color }}>{value}/100</span></div>
      <div className="mt-1 h-2 rounded-full bg-line"><div className="h-2 rounded-full" style={{ width: `${value}%`, background: color }} /></div>
    </div>
  );
}
