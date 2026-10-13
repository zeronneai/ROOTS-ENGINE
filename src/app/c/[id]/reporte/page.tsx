import { loadClient } from "@/server/load";
import { Empty, PageTitle } from "@/components/Shell";
import { PrintButton } from "@/components/PrintButton";
import { ApiButton } from "@/components/ApiButton";
import type { Report } from "@/lib/ai/report";

export default async function ReportePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, client } = await loadClient(id);
  const { data: row } = await db.from("reports").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (!row)
    return (
      <>
        <PageTitle kicker="Reporte" title="Estrategia de contenido" />
        <Empty title="Todavía no hay reporte">Ve a Resumen y dale “Arrancar motor”.</Empty>
      </>
    );

  const r = row.data as Report;
  const { data: plan } = await db
    .from("content_plans")
    .select("week_start, content_ideas(title, format, hooks, shot_list, cta, publish_date, position)")
    .eq("client_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  type PlanIdea = { title: string; format: string; hooks: string[]; shot_list: string[]; cta: string; publish_date: string; position: number };
  const ideas = ((plan?.content_ideas ?? []) as PlanIdea[]).sort((a, b) => (a.publish_date ?? "").localeCompare(b.publish_date ?? "") || a.position - b.position);
  const date = new Date(row.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

  return (
    <article className="report space-y-8">
      <PageTitle kicker={`Reporte · ${date}`} title={client.name}>
        <span className="print:hidden">
          <ApiButton url={`/api/clients/${id}/engine/report`} label="Regenerar reporte" busyLabel="Escribiendo (1-2 min)..." variant="ghost" />
        </span>
        <PrintButton />
      </PageTitle>

      <section className="card glow p-6">
        <div className="label">Diagnóstico</div>
        <p className="mt-2 text-xl font-semibold leading-snug">{r.headline}</p>
      </section>

      <Section n="01" title="El mercado">
        <p className="text-muted">{r.market.summary}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <List title="Lo que está pegando" items={r.market.whatWorks} tone="ok" />
          <List title="Lo que ya cansa" items={r.market.saturated} tone="bad" />
          <List title="Huecos sin cubrir" items={r.market.gaps} tone="lav" />
        </div>
      </Section>

      <Section n="02" title="Competencia y referencias">
        <div className="grid gap-3 md:grid-cols-2">
          {r.competitors.map((c, i) => (
            <div key={i} className="rounded-xl border border-line p-4 text-sm">
              <div className="font-semibold">@{c.handle} <span className="chip ml-1">{c.platform}</span></div>
              <p className="mt-2"><span className="text-ok">Hace bien:</span> {c.whatTheyDoWell}</p>
              <p className="mt-1"><span className="text-bad">Su hueco:</span> {c.weakness}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section n="03" title="Cómo está la marca hoy">
        <p className="text-muted">{r.brandAudit.currentState}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <List title="Fortalezas" items={r.brandAudit.strengths} tone="ok" />
          <List title="Debilidades" items={r.brandAudit.weaknesses} tone="bad" />
        </div>
        <p className="mt-4 text-sm"><span className="label">Lo mejor que ya han publicado: </span>{r.brandAudit.bestOwnContent}</p>
      </Section>

      {r.offer ? (
        <Section n="04" title="La oferta irresistible">
          <div className="rounded-xl bg-purple/10 p-5">
            <div className="label">{r.offer.name}</div>
            <p className="mt-2 text-lg font-semibold leading-snug">“{r.offer.pitch}”</p>
          </div>
          <div className="mt-5 grid gap-4 text-sm md:grid-cols-2">
            <div><div className="label">Resultado soñado</div><p className="mt-1">{r.offer.dreamOutcome}</p></div>
            <div><div className="label">Qué se vende</div><p className="mt-1">{r.offer.coreOffer}</p></div>
            <div><div className="label">Más certeza de que funciona</div><p className="mt-1">{r.offer.valueLevers.likelihood}</p></div>
            <div><div className="label">Resultado más rápido</div><p className="mt-1">{r.offer.valueLevers.speed}</p></div>
            <div><div className="label">Menos esfuerzo para el cliente</div><p className="mt-1">{r.offer.valueLevers.effort}</p></div>
            <div><div className="label">Garantía</div><p className="mt-1">{r.offer.guarantee}</p></div>
            <div><div className="label">Urgencia / escasez</div><p className="mt-1">{r.offer.urgencyScarcity}</p></div>
            <div><div className="label">Cómo presentar el precio</div><p className="mt-1">{r.offer.priceAnchor}</p></div>
          </div>
          <div className="label mt-5">Bonos (cada uno mata una objeción)</div>
          <ul className="mt-2 space-y-2 text-sm">
            {r.offer.bonuses.map((b, i) => (
              <li key={i} className="rounded-lg border border-line px-3 py-2"><span className="font-semibold">{b.name}</span><span className="text-muted"> · {b.solves}</span></li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-warn">Cuidado: {r.offer.cautions}</p>
        </Section>
      ) : null}

      <Section n="05" title="Áreas de oportunidad">
        <div className="space-y-3">
          {r.opportunities.map((o, i) => (
            <div key={i} className="rounded-xl border border-line p-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{o.title}</span>
                <span className={`chip ${o.impact === "alto" ? "text-ok" : o.impact === "medio" ? "text-warn" : "text-muted"}`}>impacto {o.impact}</span>
              </div>
              <p className="mt-2 text-sm text-muted">{o.why}</p>
              <p className="mt-1 text-sm"><span className="text-lavender">Cómo:</span> {o.how}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section n="06" title="Estrategia">
        <p className="text-lg">{r.strategy.positioning}</p>
        <div className="mt-5 space-y-2">
          {r.strategy.pillars.map((p, i) => (
            <div key={i}>
              <div className="flex justify-between text-sm"><span className="font-semibold">{p.name}</span><span className="text-lavender">{Math.round(p.share)}%</span></div>
              <div className="mt-1 h-2 rounded-full bg-line"><div className="h-2 rounded-full bg-purple" style={{ width: `${Math.min(100, p.share)}%` }} /></div>
              <p className="mt-1 text-xs text-muted">{p.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 text-sm">
          <div><div className="label">Frecuencia</div><p className="mt-1">{r.strategy.cadence}</p></div>
          <div><div className="label">Tono</div><p className="mt-1">{r.strategy.toneGuide}</p></div>
        </div>
        <div className="label mt-5">Hooks para probar</div>
        <ol className="mt-2 grid gap-2 md:grid-cols-2">
          {r.strategy.hooksToTest.map((h, i) => <li key={i} className="rounded-lg border border-line px-3 py-2 text-sm">“{h}”</li>)}
        </ol>
      </Section>

      <Section n="07" title="Cómo grabar">
        <div className="grid gap-4 md:grid-cols-2">
          <List title="Setup" items={r.recordingGuide.setup} tone="lav" />
          <List title="Locaciones" items={r.recordingGuide.locations} tone="lav" />
          <List title="Tomas que hay que sacar" items={r.recordingGuide.shotTypes} tone="lav" />
          <div>
            <div className="label">A cuadro</div>
            <p className="mt-2 text-sm">{r.recordingGuide.onCamera}</p>
          </div>
          <List title="Sí" items={r.recordingGuide.dos} tone="ok" />
          <List title="No" items={r.recordingGuide.donts} tone="bad" />
        </div>
      </Section>

      <Section n="08" title="Qué medir">
        <div className="grid gap-3 md:grid-cols-3">
          {r.kpis.map((k, i) => (
            <div key={i} className="rounded-xl border border-line p-4 text-sm">
              <div className="font-semibold">{k.metric}</div>
              <div className="mt-1 text-lavender">{k.target}</div>
              <p className="mt-1 text-xs text-muted">{k.why}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section n="09" title="Próximos 30 días">
        <ol className="space-y-2">
          {r.next30Days.map((w, i) => (
            <li key={i} className="flex gap-3 text-sm"><span className="display text-lavender">Semana {w.week}</span><span>{w.focus}</span></li>
          ))}
        </ol>
      </Section>
      {ideas.length ? (
        <Section n="10" title={`Qué grabar: semana del ${plan?.week_start}`}>
          <div className="space-y-4">
            {ideas.map((i, k) => (
              <div key={k} className="break-inside-avoid rounded-xl border border-line p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{i.title}</span>
                  <span className="chip">{i.format}</span>
                </div>
                <p className="mt-2"><span className="text-lavender">Hook:</span> “{i.hooks?.[0]}”</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
                  {(i.shot_list ?? []).map((s, j) => <li key={j}>{s}</li>)}
                </ol>
                <p className="mt-2"><span className="text-lavender">CTA:</span> {i.cta}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">Guiones completos y los 3 hooks de cada idea en Plan semanal.</p>
        </Section>
      ) : null}

      {r.digitalPresence ? (
        <Section n="✦" title={`Bonus: dónde está fallando su presencia digital · ${Math.round(r.digitalPresence.score)}/100`}>
          <div className="space-y-3">
            {r.digitalPresence.issues.map((x, i) => (
              <div key={i} className="rounded-xl border border-line p-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="chip">{x.area}</span>
                  <span className={`chip ${x.priority === "alta" ? "text-bad" : x.priority === "media" ? "text-warn" : "text-muted"}`}>prioridad {x.priority}</span>
                </div>
                <p className="mt-2"><span className="text-bad">Falla:</span> {x.problem}</p>
                <p className="mt-1"><span className="text-ok">Arreglo:</span> {x.fix}</p>
              </div>
            ))}
          </div>
          {r.digitalPresence.notChecked.length ? (
            <p className="mt-4 text-xs text-muted">No revisado todavía: {r.digitalPresence.notChecked.join(", ")}.</p>
          ) : null}
        </Section>
      ) : null}
    </article>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-6 break-inside-avoid">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="font-mono text-xs text-purple">{n}</span>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone: "ok" | "bad" | "lav" }) {
  const dot = tone === "ok" ? "bg-ok" : tone === "bad" ? "bg-bad" : "bg-lavender";
  return (
    <div>
      <div className="label">{title}</div>
      <ul className="mt-2 space-y-1.5 text-sm">
        {items.map((x, i) => (
          <li key={i} className="flex gap-2"><span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />{x}</li>
        ))}
      </ul>
    </div>
  );
}
