import Link from "next/link";
import { loadClient, loadPendings } from "@/server/load";
import { styleForClient } from "@/server/engine";
import { ApiButton } from "@/components/ApiButton";
import { PageTitle } from "@/components/Shell";
import { addBrandInputAction } from "@/app/actions";
import { EngineRunner } from "@/components/EngineRunner";
import { CopyLink } from "@/components/CopyLink";
import { SubmitButton } from "@/components/SubmitButton";

export default async function ClientHome({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ gracias?: string }> }) {
  const { id } = await params;
  const { gracias } = await searchParams;
  const ctx = await loadClient(id);
  const pend = await loadPendings(id);
  const { db, client, brand, isAgency, activeMood } = ctx;

  const [{ count: compCount }, { count: analyzed }, { data: plan }, { data: edits }, { count: reportCount }] = await Promise.all([
    db.from("competitors").select("id", { count: "exact", head: true }).eq("client_id", id).eq("is_own_account", false),
    db.from("competitor_posts").select("id", { count: "exact", head: true }).eq("client_id", id).not("analysis", "is", null),
    db.from("content_plans").select("id, week_start, content_ideas(status)").eq("client_id", id).order("week_start", { ascending: false }).limit(1).maybeSingle(),
    db.from("edits").select("status").eq("client_id", id),
    db.from("reports").select("id", { count: "exact", head: true }).eq("client_id", id),
  ]);
  const style = styleForClient(ctx);
  const ideas = (plan?.content_ideas ?? []) as { status: string }[];
  const toRecord = ideas.filter((i) => ["idea", "approved"].includes(i.status)).length;
  const inReview = (edits ?? []).filter((e) => e.status === "review").length;
  const done = (edits ?? []).filter((e) => e.status === "done").length;
  // las preguntas ya contestadas desaparecen
  const { data: answered } = await db.from("brand_inputs").select("title, synthesized").eq("client_id", id).not("title", "is", null);
  const answeredTitles = new Set((answered ?? []).map((a) => a.title));
  const questions = (brand.data.openQuestions ?? []).filter((q) => !answeredTitles.has(q));
  const pendingAnswers = (answered ?? []).filter((a) => !a.synthesized).length;

  const steps = [
    {
      n: "01",
      t: "Brand Brain",
      ok: !!brand.synthesized_at,
      d: brand.synthesized_at ? brand.data.oneLiner ?? "Listo" : "Todavía no se arma el perfil de la marca.",
      href: `/c/${id}/marca`,
      action: <ApiButton url={`/api/clients/${id}/synthesize`} label={brand.synthesized_at ? "Re-sintetizar" : "Armar con IA"} busyLabel="Pensando..." variant="ghost" />,
    },
    {
      n: "02",
      t: "Competencia",
      ok: (analyzed ?? 0) > 0,
      d: `${compCount ?? 0} cuentas vigiladas · ${analyzed ?? 0} videos ganadores analizados`,
      href: `/c/${id}/competencia`,
      action: !isAgency ? null : compCount ? (
        <ApiButton url={`/api/clients/${id}/scan`} label="Escanear" busyLabel="Escaneando..." variant="ghost" />
      ) : (
        <ApiButton url={`/api/clients/${id}/discover`} label="Buscar con IA" busyLabel="Investigando..." variant="ghost" />
      ),
    },
    {
      n: "03",
      t: "Plan semanal",
      ok: !!plan,
      d: plan ? `Semana del ${plan.week_start} · ${toRecord} por grabar` : "Sin plan todavía.",
      href: `/c/${id}/plan`,
      action: isAgency ? <ApiButton url={`/api/clients/${id}/plan`} label="Generar plan" busyLabel="Planeando..." variant="ghost" /> : null,
    },
    {
      n: "04",
      t: "Videos",
      ok: done > 0,
      d: `${inReview} por revisar · ${done} listos`,
      href: `/c/${id}/videos`,
      action: null,
    },
    {
      n: "05",
      t: "Estilo de edición",
      ok: true,
      d: `${style.name}${activeMood ? ` · mood ${activeMood.name}` : ""}`,
      href: `/c/${id}/estilo`,
      action: null,
    },
  ];

  return (
    <>
      <PageTitle kicker="Content Engine" title={isAgency ? client.name : `Hola, ${client.name}`} />

      {gracias ? (
        <div className="mb-6 rounded-2xl bg-sun/60 px-5 py-4 text-sm">
          <b>¡Gracias!</b> Ya tenemos tu información. {isAgency ? "" : (reportCount ?? 0) > 0 ? "La vamos a tomar en cuenta en tu próximo análisis." : "Ahora arranca tu análisis abajo."}
        </div>
      ) : null}

      {!isAgency && (reportCount ?? 0) === 0 ? (
        <section className="card mb-6 p-6" style={{ background: "linear-gradient(120deg, #fffded, #fff 65%)" }}>
          <div className="display text-[11px] text-purple">Bienvenido</div>
          <h2 className="mt-1 text-2xl font-bold">Tu motor de contenido</h2>
          <p className="mt-1 text-sm text-muted">Tres pasos y tienes tu estrategia y tus videos de la semana.</p>
          <ol className="mt-5 space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <span className={`grid h-7 w-7 place-items-center rounded-full text-xs ${pend.list.some((p) => p.key === "intake") ? "bg-sun" : "bg-ok/15 text-ok"}`}>{pend.list.some((p) => p.key === "intake") ? "1" : "✓"}</span>
              <span className="flex-1">Cuéntanos de tu negocio</span>
              {pend.list.some((p) => p.key === "intake") ? <Link href={`/intake/${client.intake_token}?back=/c/${id}`} className="btn btn-primary">Llenar (5 min)</Link> : null}
            </li>
            <li className="flex items-center gap-3"><span className="grid h-7 w-7 place-items-center rounded-full bg-line text-xs">2</span><span className="flex-1">Arranca tu análisis (aquí abajo)</span></li>
            <li className="flex items-center gap-3"><span className="grid h-7 w-7 place-items-center rounded-full bg-line text-xs">3</span><span className="flex-1">Lee tu reporte y graba tus videos</span></li>
          </ol>
        </section>
      ) : null}

      {pend.list.length ? (
        <section className="card mb-6 p-5">
          <div className="flex items-center gap-2">
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-peach px-1.5 text-xs font-bold">{pend.list.length}</span>
            <h2 className="font-semibold">{isAgency ? "Pendientes del cliente" : "Te falta"}</h2>
          </div>
          <ul className="mt-3 space-y-2">
            {pend.list.map((p) => (
              <li key={p.key}>
                <Link href={p.href} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-sm transition hover:border-purple hover:bg-cream">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${p.tone === "todo" ? "bg-peach" : "bg-sun"}`} />
                  <span className="flex-1">{p.text}</span>
                  <span className="text-xs text-muted">{p.tone === "tip" ? "sugerencia" : "→"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(reportCount ?? 0) > 0 ? (
        <Link href={`/c/${id}/reporte`} className="card glow mb-6 flex items-center justify-between gap-4 p-5 transition hover:border-purple">
          <div>
            <div className="display text-xs text-lavender">Listo</div>
            <div className="mt-1 text-lg font-semibold">Reporte de estrategia</div>
            <p className="text-sm text-muted">Mercado, oferta irresistible, oportunidades, estrategia, cómo grabar y presencia digital.</p>
          </div>
          <span className="btn btn-primary">Ver reporte →</span>
        </Link>
      ) : null}

      {isAgency ? (
        <EngineRunner clientId={id} hasReport={(reportCount ?? 0) > 0} />
      ) : (reportCount ?? 0) === 0 ? (
        <EngineRunner clientId={id} hasReport={false} forClient />
      ) : null}

      {isAgency ? (
        <details className="group">
          <summary className="mb-3 cursor-pointer list-none text-sm text-muted hover:text-ink">
            <span className="group-open:hidden">▸</span><span className="hidden group-open:inline">▾</span> Estado de cada paso (y correrlos por separado)
          </summary>
      <ol className="card divide-y divide-line/60">
        {steps.map((s) => (
          <li key={s.n} className="flex flex-wrap items-center gap-4 p-4">
            <span className={`grid h-8 w-8 place-items-center rounded-full text-xs ${s.ok ? "bg-ok/15 text-ok" : "bg-sun text-ink"}`}>
              {s.ok ? "✓" : s.n}
            </span>
            <Link href={s.href} className="min-w-0 flex-1">
              <div className="font-semibold">{s.t}</div>
              <div className="truncate text-sm text-muted">{s.d}</div>
            </Link>
            {s.action}
          </li>
        ))}
      </ol>
        </details>
      ) : (
      <ol className="card divide-y divide-line/60">
        {steps.map((s) => (
          <li key={s.n} className="flex flex-wrap items-center gap-4 p-4">
            <span className={`grid h-8 w-8 place-items-center rounded-full text-xs ${s.ok ? "bg-ok/15 text-ok" : "bg-sun text-ink"}`}>
              {s.ok ? "✓" : s.n}
            </span>
            <Link href={s.href} className="min-w-0 flex-1">
              <div className="font-semibold">{s.t}</div>
              <div className="truncate text-sm text-muted">{s.d}</div>
            </Link>
            {s.action}
          </li>
        ))}
      </ol>
      )}

      {pendingAnswers > 0 ? (
        <div className="card mt-10 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm">
            Hay <b>{pendingAnswers}</b> respuesta{pendingAnswers > 1 ? "s" : ""} nueva{pendingAnswers > 1 ? "s" : ""} que el motor todavía no toma en cuenta.
          </p>
          <ApiButton url={`/api/clients/${id}/synthesize`} label="Actualizar Brand Brain" busyLabel="Pensando..." />
        </div>
      ) : null}

      {questions.length ? (
        <section id="preguntas" className="mt-10 scroll-mt-24">
          <h2 className="text-lg font-semibold">Preguntas rápidas para afinar tu contenido</h2>
          <p className="text-sm text-muted">Contesta las que puedas. Al guardar, la pregunta desaparece.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {questions.map((q, i) => (
              <form key={i} action={addBrandInputAction.bind(null, id)} className="card space-y-2 p-4">
                <input type="hidden" name="title" value={q} />
                <input type="hidden" name="kind" value="note" />
                <div className="text-sm">{q}</div>
                <div className="flex gap-2">
                  <input name="content" className="input" placeholder="Tu respuesta" />
                  <SubmitButton className="btn btn-ghost">Guardar</SubmitButton>
                </div>
              </form>
            ))}
          </div>
        </section>
      ) : null}
      {isAgency ? (
        <section className="card mt-10 p-5">
          <div className="font-semibold">Formulario para el cliente (opcional)</div>
          <p className="mt-1 text-sm text-muted">
            Mándale este link por WhatsApp. No necesita cuenta: llena sus datos y su tono, y todo cae a su Brand Brain.
          </p>
          <CopyLink path={`/intake/${client.intake_token ?? ""}`} />
        </section>
      ) : null}
    </>
  );
}
