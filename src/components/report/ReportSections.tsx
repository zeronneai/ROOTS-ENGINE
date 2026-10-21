import type { Report } from "@/lib/ai/report";
import type { PlanIdea } from "@/server/report-data";
import { dayName } from "@/server/report-data";

/* ───────────────────────── Parte 1: Análisis ───────────────────────── */

export function AnalysisPart({ r }: { r: Report }) {
  return (
    <div className="space-y-6">
      <section className="card glow p-6">
        <div className="label">Diagnóstico</div>
        <p className="mt-2 text-xl font-semibold leading-snug">{r.headline}</p>
      </section>

      <Section n="01" title="El mercado">
        <p className="text-muted">{r.market.summary}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <List title="Lo que está pegando" items={r.market.whatWorks} tone="ok" />
          <List title="Lo que ya cansa" items={r.market.saturated} tone="bad" />
          <List title="Huecos sin cubrir" items={r.market.gaps} tone="acc" />
        </div>
      </Section>

      <Section n="02" title="Competencia y referencias">
        <div className="grid gap-3 md:grid-cols-2">
          {r.competitors.map((c, i) => (
            <div key={i} className="break-inside-avoid rounded-xl border border-line p-4 text-sm">
              <div className="font-semibold">@{c.handle} <span className="chip ml-1">{c.platform}</span></div>
              <p className="mt-2"><span className="font-semibold text-ok">Hace bien:</span> {c.whatTheyDoWell}</p>
              <p className="mt-1"><span className="font-semibold text-bad">Su hueco:</span> {c.weakness}</p>
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

      {r.digitalPresence ? (
        <Section n="04" title={`Dónde está fallando su presencia digital · ${Math.round(r.digitalPresence.score)}/100`}>
          <div className="space-y-3">
            {r.digitalPresence.issues.map((x, i) => (
              <div key={i} className="break-inside-avoid rounded-xl border border-line p-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="chip">{x.area}</span>
                  <Priority p={x.priority} />
                </div>
                <p className="mt-2"><span className="font-semibold text-bad">Falla:</span> {x.problem}</p>
                <p className="mt-1"><span className="font-semibold text-ok">Arreglo:</span> {x.fix}</p>
              </div>
            ))}
          </div>
          {r.digitalPresence.notChecked.length ? (
            <p className="mt-4 text-xs text-muted">No revisado todavía: {r.digitalPresence.notChecked.join(", ")}.</p>
          ) : null}
        </Section>
      ) : null}

      {r.business ? (
        <Section n="✦" title={`Lo que dicen sus clientes · experiencia ${Math.round(r.business.score)}/100`}>
          <p className="text-muted">{r.business.summary}</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <div className="label text-ok">Lo que aman</div>
              <ul className="mt-2 space-y-2 text-sm">
                {r.business.loves.map((x, i) => (
                  <li key={i} className="break-inside-avoid rounded-xl border border-line p-3">
                    <div className="font-semibold">{x.theme} <span className="text-xs text-muted">· {x.mentions} reseñas</span></div>
                    <p className="mt-1 italic text-muted">“{x.quote}”</p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="label text-bad">Lo que les duele</div>
              {r.business.complaints.length ? (
                <ul className="mt-2 space-y-2 text-sm">
                  {r.business.complaints.map((x, i) => (
                    <li key={i} className="break-inside-avoid rounded-xl border border-line p-3">
                      <div className="flex flex-wrap items-center gap-2 font-semibold">{x.theme} <Priority p={x.severity} /> <span className="text-xs font-normal text-muted">{x.mentions} reseñas</span></div>
                      <p className="mt-1 italic text-muted">“{x.quote}”</p>
                      <p className="mt-1"><span className="font-semibold text-ok">Qué cambiar:</span> {x.fix}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted">No hay quejas en las reseñas revisadas.</p>
              )}
            </div>
          </div>
          <p className="mt-4 text-sm"><span className="label">Contra la competencia: </span>{r.business.vsCompetitors}</p>
          <p className="mt-3 text-sm"><span className="label">Cómo contestar reseñas malas: </span>{r.business.replyPlaybook}</p>
          <div className="mt-4"><List title="Contenido que sale de las reseñas" items={r.business.contentFromReviews} tone="acc" /></div>
        </Section>
      ) : null}

      {r.offer ? (
        <Section n="05" title="La oferta irresistible">
          <div className="rounded-xl bg-sun/40 p-5">
            <div className="label text-ink">{r.offer.name}</div>
            <p className="mt-2 text-lg font-semibold leading-snug">“{r.offer.pitch}”</p>
          </div>
          <div className="mt-5 grid gap-4 text-sm md:grid-cols-2">
            <Kv k="Resultado soñado" v={r.offer.dreamOutcome} />
            <Kv k="Qué se vende" v={r.offer.coreOffer} />
            <Kv k="Más certeza de que funciona" v={r.offer.valueLevers.likelihood} />
            <Kv k="Resultado más rápido" v={r.offer.valueLevers.speed} />
            <Kv k="Menos esfuerzo para el cliente" v={r.offer.valueLevers.effort} />
            <Kv k="Garantía" v={r.offer.guarantee} />
            <Kv k="Urgencia / escasez" v={r.offer.urgencyScarcity} />
            <Kv k="Cómo presentar el precio" v={r.offer.priceAnchor} />
          </div>
          <div className="label mt-5">Bonos (cada uno mata una objeción)</div>
          <ul className="mt-2 space-y-2 text-sm">
            {r.offer.bonuses.map((b, i) => (
              <li key={i} className="rounded-lg border border-line px-3 py-2"><span className="font-semibold">{b.name}</span><span className="text-muted"> · {b.solves}</span></li>
            ))}
          </ul>
          <p className="mt-4 rounded-lg bg-peach/25 px-3 py-2 text-xs">Cuidado: {r.offer.cautions}</p>
        </Section>
      ) : null}

      <Section n="06" title="Áreas de oportunidad">
        <div className="space-y-3">
          {r.opportunities.map((o, i) => (
            <div key={i} className="break-inside-avoid rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{o.title}</span>
                <span className={`chip ${o.impact === "alto" ? "bg-sun" : ""}`}>impacto {o.impact}</span>
              </div>
              <p className="mt-2 text-sm text-muted">{o.why}</p>
              <p className="mt-1 text-sm"><span className="font-semibold text-purple">Cómo:</span> {o.how}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

/* ───────────────────────── Parte 2: Contenido ───────────────────────── */

export function ContentPart({ r, ideas, weekStart, fullScripts = true }: { r: Report; ideas: PlanIdea[]; weekStart: string | null; fullScripts?: boolean }) {
  return (
    <div className="space-y-6">
      <Section n="01" title="Estrategia de contenido">
        <p className="text-lg">{r.strategy.positioning}</p>
        <div className="mt-5 space-y-3">
          {r.strategy.pillars.map((p, i) => (
            <div key={i}>
              <div className="flex justify-between text-sm"><span className="font-semibold">{p.name}</span><span className="text-purple">{Math.round(p.share)}%</span></div>
              <div className="mt-1 h-2 rounded-full bg-line"><div className="h-2 rounded-full bg-purple" style={{ width: `${Math.min(100, p.share)}%` }} /></div>
              <p className="mt-1 text-xs text-muted">{p.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-4 text-sm md:grid-cols-2">
          <Kv k="Frecuencia" v={r.strategy.cadence} />
          <Kv k="Tono" v={r.strategy.toneGuide} />
        </div>
        <div className="label mt-5">Hooks para probar</div>
        <ol className="mt-2 grid gap-2 md:grid-cols-2">
          {r.strategy.hooksToTest.map((h, i) => <li key={i} className="rounded-lg border border-line bg-cream px-3 py-2 text-sm">“{h}”</li>)}
        </ol>
      </Section>

      <Section n="02" title="Cómo grabar">
        <div className="grid gap-5 md:grid-cols-2">
          <List title="Setup" items={r.recordingGuide.setup} tone="acc" />
          <List title="Locaciones" items={r.recordingGuide.locations} tone="acc" />
          <List title="Tomas que hay que sacar" items={r.recordingGuide.shotTypes} tone="acc" />
          <Kv k="A cuadro" v={r.recordingGuide.onCamera} />
          <List title="Sí" items={r.recordingGuide.dos} tone="ok" />
          <List title="No" items={r.recordingGuide.donts} tone="bad" />
        </div>
      </Section>

      {ideas.length ? (
        <Section n="03" title={`Qué grabar · semana del ${weekStart}`}>
          <div className="space-y-4">
            {ideas.map((i, k) => (
              <div key={k} className="break-inside-avoid rounded-xl border border-line p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="display text-[10px] text-purple">{dayName(i.publish_date)}</span>
                  <span className="chip">{i.format}</span>
                </div>
                <div className="mt-1 text-base font-semibold">{i.title}</div>
                <div className="label mt-3">Hooks</div>
                <ol className="mt-1 space-y-1">{i.hooks.map((h, j) => <li key={j}>“{h}”</li>)}</ol>
                {fullScripts ? (
                  <>
                    <div className="label mt-3">Guion</div>
                    <ul className="mt-1 space-y-1">{(i.script ?? []).map((s, j) => <li key={j}><span className="text-purple">{s.beat}:</span> {s.line}</li>)}</ul>
                  </>
                ) : null}
                <div className="label mt-3">Tomas</div>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted">{(i.shot_list ?? []).map((s, j) => <li key={j}>{s}</li>)}</ol>
                <p className="mt-3"><span className="font-semibold text-purple">CTA:</span> {i.cta}</p>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section n="04" title="Qué medir">
        <div className="grid gap-3 md:grid-cols-3">
          {r.kpis.map((k, i) => (
            <div key={i} className="rounded-xl border border-line p-4 text-sm">
              <div className="font-semibold">{k.metric}</div>
              <div className="mt-1 text-purple">{k.target}</div>
              <p className="mt-1 text-xs text-muted">{k.why}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section n="05" title="Próximos 30 días">
        <ol className="space-y-2">
          {r.next30Days.map((w, i) => (
            <li key={i} className="flex gap-3 text-sm"><span className="display shrink-0 text-purple">Semana {w.week}</span><span>{w.focus}</span></li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

/* ───────────────────────── piezas ───────────────────────── */

export function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-6">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="font-mono text-xs text-purple">{n}</span>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function List({ title, items, tone }: { title: string; items: string[]; tone: "ok" | "bad" | "acc" }) {
  const dot = tone === "ok" ? "bg-ok" : tone === "bad" ? "bg-bad" : "bg-peach";
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

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="label">{k}</div>
      <p className="mt-1 text-sm">{v}</p>
    </div>
  );
}

function Priority({ p }: { p: string }) {
  return <span className={`chip ${p === "alta" ? "bg-peach/40" : p === "media" ? "bg-sun/50" : ""}`}>prioridad {p}</span>;
}
