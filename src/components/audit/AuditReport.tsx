/* eslint-disable @next/next/no-img-element */
import type { AuditReport as Report, AuditAreaKey } from "@/lib/ai/audit";

/**
 * La auditoría como la ve el prospecto (y nosotros en el portal). Sin hooks: sirve en
 * la página pública y en la de la agencia, y se imprime limpia a PDF.
 */

const T = {
  en: {
    kicker: "The Purple Roots Business Audit",
    prepared: "Prepared for",
    score: "Audit score",
    areas: { social: "Social media", website: "Website", google: "Google & reviews", offer: "Your offer", followUp: "Lead follow-up" } as Record<AuditAreaKey, string>,
    leave: "What is working. Leave it alone.",
    lost: "Where customers are being lost",
    deep: "The full breakdown",
    working: "Working",
    problem: "What we found",
    evidence: "What we saw",
    fix: "The fix",
    priority: { high: "High priority", medium: "Medium", low: "Low" },
    first: "First impression",
    bio: "Bio",
    photo: "Photo & name",
    highlights: "Highlights",
    link: "Link in bio",
    stop: "What stops the scroll",
    lose: "What loses people",
    cadence: "Posting",
    consistency: "Brand consistency",
    standing: "Where you stand",
    loves: "What customers love",
    complaints: "What hurts you",
    gaps: "Profile gaps",
    competitors: "Your local competition",
    better: "Doing better",
    win: "Where you win",
    reviews: "reviews",
    followers: "followers",
    moves: "Your 3 priority moves",
    movesSub: "The first moves we would make, in the order we would make them.",
    quick: "Quick wins for this week",
    notChecked: "What we could not check",
    cta: "Want help putting this into action?",
    ctaBtn: "Message us on WhatsApp",
    ctaIg: "Instagram",
    footer: "A real review by real people at Purple Roots Agency · El Paso, TX",
    wa: "Hi! I just read my Purple Roots audit and I want to talk about it.",
  },
  es: {
    kicker: "Auditoría de Negocio Purple Roots",
    prepared: "Preparada para",
    score: "Calificación",
    areas: { social: "Redes sociales", website: "Sitio web", google: "Google y reseñas", offer: "Tu oferta", followUp: "Seguimiento a clientes" } as Record<AuditAreaKey, string>,
    leave: "Lo que funciona. No lo toques.",
    lost: "Dónde se te van los clientes",
    deep: "El análisis completo",
    working: "Funciona",
    problem: "Lo que encontramos",
    evidence: "Lo que vimos",
    fix: "Cómo arreglarlo",
    priority: { high: "Prioridad alta", medium: "Media", low: "Baja" },
    first: "Primera impresión",
    bio: "Bio",
    photo: "Foto y nombre",
    highlights: "Destacadas",
    link: "Link en la bio",
    stop: "Lo que detiene el scroll",
    lose: "Lo que hace que se vayan",
    cadence: "Frecuencia",
    consistency: "Consistencia de marca",
    standing: "Cómo estás",
    loves: "Lo que aman tus clientes",
    complaints: "Lo que te pega",
    gaps: "Lo que le falta a tu perfil",
    competitors: "Tu competencia local",
    better: "Lo hacen mejor",
    win: "Donde tú ganas",
    reviews: "reseñas",
    followers: "seguidores",
    moves: "Tus 3 movimientos prioritarios",
    movesSub: "Lo primero que haríamos, en el orden en que lo haríamos.",
    quick: "Arreglos rápidos para esta semana",
    notChecked: "Lo que no pudimos revisar",
    cta: "¿Quieres ayuda para ponerlo en acción?",
    ctaBtn: "Escríbenos por WhatsApp",
    ctaIg: "Instagram",
    footer: "Una revisión real, hecha por personas reales en Purple Roots Agency · El Paso, TX",
    wa: "¡Hola! Acabo de leer mi auditoría de Purple Roots y quiero platicar.",
  },
};

const WA = "19152343655";

const tone = (s: number) => (s >= 75 ? "#15803d" : s >= 50 ? "#c2410c" : "#b91c1c");
const fmt = (n: number | null | undefined) => (n == null ? null : n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}K` : n.toLocaleString("en-US"));

export function AuditReport({ r, business, city, date, lang }: { r: Report; business: string; city: string; date: string; lang: "en" | "es" }) {
  const t = T[lang];
  const areas = r.areas;
  const area = (k: AuditAreaKey) => areas.find((a) => a.key === k);
  return (
    <article className="audit">
      {/* Portada */}
      <div className="audit-cover relative overflow-hidden rounded-[28px] p-7 text-white sm:p-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/brand/pr-icon-purple.png" alt="" className="h-9 w-auto rounded-md bg-white p-1" />
            <span className="display text-[11px] tracking-[0.22em] text-white/80">{t.kicker}</span>
          </div>
          <span className="text-xs text-white/70">{date}</span>
        </div>
        <div className="mt-10 grid items-end gap-8 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-sm text-white/70">{t.prepared}</p>
            <h1 className="mt-1 text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">{business}</h1>
            <p className="mt-2 text-white/70">{city}</p>
            <p className="mt-8 max-w-2xl text-xl font-semibold leading-snug text-[#fce762] sm:text-2xl">{r.headline}</p>
            <p className="mt-3 max-w-2xl text-white/85">{r.summary}</p>
          </div>
          <ScoreRing score={r.score} label={t.score} />
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-5">
          {areas.map((a) => (
            <div key={a.key} className="rounded-2xl bg-white/10 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-white/75">{t.areas[a.key]}</span>
                <span className="text-lg font-bold">{a.score}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full" style={{ width: `${a.score}%`, background: a.score >= 75 ? "#86efac" : a.score >= 50 ? "#fce762" : "#ffb17a" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lo que funciona */}
      {r.leaveAlone.length ? (
        <Block title={t.leave} n="01">
          <ul className="grid gap-3 sm:grid-cols-2">
            {r.leaveAlone.map((x, i) => (
              <li key={i} className="flex gap-3 rounded-2xl border border-line bg-white p-4 text-[15px] break-inside-avoid">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ok/15 text-xs text-ok">✓</span>
                {x}
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {/* Dónde se pierden */}
      <Block title={t.lost} n="02">
        <ol className="relative space-y-4 border-l-2 border-dashed border-line pl-6">
          {r.customersLost.map((x, i) => (
            <li key={i} className="relative break-inside-avoid">
              <span className="absolute -left-[33px] top-1 grid h-4 w-4 place-items-center rounded-full border-2 border-white bg-[#ffb17a]" />
              <div className="text-sm font-semibold uppercase tracking-wide text-purple">{x.moment}</div>
              <p className="mt-1 text-[15px]">{x.whatHappens}</p>
              <p className="mt-1 text-sm text-bad">{x.cost}</p>
            </li>
          ))}
        </ol>
      </Block>

      {/* Movimientos */}
      <Block title={t.moves} n="03" sub={t.movesSub}>
        <div className="grid gap-4 md:grid-cols-3">
          {r.firstMoves.slice(0, 3).map((m, i) => (
            <div key={i} className="relative overflow-hidden rounded-3xl border border-line bg-white p-5 break-inside-avoid">
              <div className="text-5xl font-extrabold leading-none text-[#fce762]" style={{ WebkitTextStroke: "1.5px #4f4789" }}>{i + 1}</div>
              <div className="mt-3 text-lg font-bold leading-snug">{m.title}</div>
              <span className="chip mt-2">{m.timeframe}</span>
              <p className="mt-3 text-sm text-muted">{m.why}</p>
              <p className="mt-3 text-sm">{m.how}</p>
            </div>
          ))}
        </div>
      </Block>

      {/* Desglose por área */}
      <Block title={t.deep} n="04">
        <div className="space-y-6">
          {(["social", "website", "google", "offer", "followUp"] as const).map((k) => {
            const a = area(k);
            if (!a) return null;
            return (
              <section key={k} className="rounded-3xl border border-line bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-xl font-bold">{t.areas[k]}</h3>
                  <span className="rounded-full px-3 py-1 text-sm font-bold text-white" style={{ background: tone(a.score) }}>{a.score}/100</span>
                </div>
                <p className="mt-2 text-[15px] text-muted">{a.verdict}</p>

                {k === "social" ? <SocialDetail r={r} t={t} /> : null}
                {k === "google" ? <GoogleDetail r={r} t={t} /> : null}

                {a.working.length ? (
                  <div className="mt-4">
                    <div className="label text-ok">{t.working}</div>
                    <ul className="mt-2 space-y-1 text-sm">
                      {a.working.map((w, i) => (
                        <li key={i} className="flex gap-2"><span className="text-ok">✓</span>{w}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-4 space-y-3">
                  {a.problems.map((p, i) => (
                    <div key={i} className="rounded-2xl bg-[#faf9fc] p-4 text-sm break-inside-avoid">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{p.problem}</span>
                        <span className={`chip ${p.priority === "high" ? "!bg-bad/10 !text-bad" : ""}`}>{t.priority[p.priority]}</span>
                      </div>
                      <p className="mt-2 text-muted"><span className="font-semibold text-ink">{t.evidence}: </span>{p.evidence}</p>
                      <p className="mt-1"><span className="font-semibold text-ok">{t.fix}: </span>{p.fix}</p>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </Block>

      {/* Competencia */}
      {r.competitors.length ? (
        <Block title={t.competitors} n="05">
          <div className="grid gap-4 md:grid-cols-2">
            {r.competitors.map((c, i) => (
              <div key={i} className="rounded-3xl border border-line bg-white p-5 break-inside-avoid">
                <div className="text-lg font-bold">{c.name}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
                  {c.rating != null ? <span className="chip">★ {c.rating} · {fmt(c.reviews) ?? 0} {t.reviews}</span> : null}
                  {c.instagram ? <span className="chip">@{c.instagram}{c.followers != null ? ` · ${fmt(c.followers)} ${t.followers}` : ""}</span> : null}
                </div>
                <p className="mt-3 text-sm"><span className="font-semibold text-bad">{t.better}: </span>{c.doingBetter}</p>
                <p className="mt-1 text-sm"><span className="font-semibold text-ok">{t.win}: </span>{c.whereYouWin}</p>
              </div>
            ))}
          </div>
        </Block>
      ) : null}

      {/* Arreglos rápidos */}
      {r.quickWins.length ? (
        <Block title={t.quick} n="06">
          <ul className="space-y-2">
            {r.quickWins.map((q, i) => (
              <li key={i} className="flex gap-3 rounded-2xl border border-line bg-white p-4 text-[15px] break-inside-avoid">
                <span className="mt-0.5 h-5 w-5 shrink-0 rounded-md border-2 border-purple" />
                {q}
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {r.notChecked.length ? (
        <p className="mt-10 text-xs text-muted">
          <span className="font-semibold">{t.notChecked}: </span>
          {r.notChecked.join(" · ")}
        </p>
      ) : null}

      {/* Cierre */}
      <section className="audit-cover mt-12 rounded-[28px] p-7 text-white sm:p-10 break-inside-avoid">
        <p className="max-w-2xl text-lg leading-relaxed text-white/90">{r.closingNote}</p>
        <p className="mt-6 text-2xl font-bold">{t.cta}</p>
        <div className="mt-5 flex flex-wrap gap-3 print:hidden">
          <a href={`https://wa.me/${WA}?text=${encodeURIComponent(t.wa)}`} className="rounded-full bg-[#fce762] px-6 py-3 font-semibold text-[#211c35]" target="_blank" rel="noreferrer">
            {t.ctaBtn}
          </a>
          <a href="https://www.instagram.com/purpleroots.agency" className="rounded-full border border-white/40 px-6 py-3 font-semibold text-white" target="_blank" rel="noreferrer">
            {t.ctaIg}
          </a>
        </div>
        <p className="mt-6 hidden text-sm text-white/80 print:block">WhatsApp: +1 (915) 234-3655 · purpleroots.agency</p>
      </section>

      <p className="mt-8 text-center text-xs text-muted">{t.footer}</p>
    </article>
  );
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-40 w-40 place-items-center justify-self-start md:justify-self-end">
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="#fce762" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} />
      </svg>
      <div className="text-center">
        <div className="text-5xl font-extrabold leading-none">{score}</div>
        <div className="mt-1 text-xs text-white/70">/ 100</div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/70">{label}</div>
      </div>
    </div>
  );
}

function Block({ title, n, sub, children }: { title: string; n: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <div className="mb-5">
        <div className="display text-[11px] text-purple">{n}</div>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
        {sub ? <p className="mt-1 text-muted">{sub}</p> : null}
      </div>
      {children}
    </section>
  );
}

type Dict = (typeof T)["en"];

function SocialDetail({ r, t }: { r: Report; t: Dict }) {
  const s = r.social;
  const items: [string, string][] = [
    [t.bio, s.firstImpression.bio],
    [t.photo, s.firstImpression.photo],
    [t.highlights, s.firstImpression.highlights],
    [t.link, s.firstImpression.link],
  ];
  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl bg-[#fffded] p-4">
        <div className="label">{t.first}</div>
        <p className="mt-1 text-[15px] font-semibold">{s.firstImpression.verdict}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {items.map(([k, v]) => (
            <div key={k} className="text-sm"><span className="font-semibold">{k}: </span><span className="text-muted">{v}</span></div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <MiniList title={t.stop} items={s.contentAndHooks.stopTheScroll} color="text-ok" />
        <MiniList title={t.lose} items={s.contentAndHooks.losePeople} color="text-bad" />
      </div>
      <p className="text-sm"><span className="font-semibold">{t.cadence}: </span><span className="text-muted">{s.contentAndHooks.cadence}</span></p>
      <p className="text-sm"><span className="font-semibold">{t.consistency}: </span><span className="text-muted">{s.brandConsistency}</span></p>
    </div>
  );
}

function GoogleDetail({ r, t }: { r: Report; t: Dict }) {
  const g = r.google;
  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm"><span className="font-semibold">{t.standing}: </span><span className="text-muted">{g.standing}</span></p>
      <div className="grid gap-4 sm:grid-cols-2">
        {g.loves.length ? (
          <div>
            <div className="label text-ok">{t.loves}</div>
            <ul className="mt-2 space-y-2 text-sm">
              {g.loves.map((x, i) => (
                <li key={i} className="rounded-xl border border-line p-3 break-inside-avoid">
                  <div className="font-semibold">{x.theme}</div>
                  <p className="mt-1 italic text-muted">“{x.quote}”</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {g.complaints.length ? (
          <div>
            <div className="label text-bad">{t.complaints}</div>
            <ul className="mt-2 space-y-2 text-sm">
              {g.complaints.map((x, i) => (
                <li key={i} className="rounded-xl border border-line p-3 break-inside-avoid">
                  <div className="font-semibold">{x.theme}</div>
                  <p className="mt-1 italic text-muted">“{x.quote}”</p>
                  <p className="mt-1"><span className="font-semibold text-ok">{t.fix}: </span>{x.fix}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {g.profileGaps.length ? <MiniList title={t.gaps} items={g.profileGaps} color="text-warn" /> : null}
    </div>
  );
}

function MiniList({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (!items.length) return null;
  return (
    <div>
      <div className={`label ${color}`}>{title}</div>
      <ul className="mt-2 space-y-1.5 text-sm">
        {items.map((x, i) => (
          <li key={i} className="flex gap-2"><span className={color}>•</span>{x}</li>
        ))}
      </ul>
    </div>
  );
}
