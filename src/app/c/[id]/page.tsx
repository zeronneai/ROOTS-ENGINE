import Link from "next/link";
import { loadClient } from "@/server/load";
import { styleForClient } from "@/server/engine";
import { ApiButton } from "@/components/ApiButton";
import { PageTitle } from "@/components/Shell";
import { addBrandInputAction } from "@/app/actions";

export default async function ClientHome({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await loadClient(id);
  const { db, client, brand, isAgency, activeMood } = ctx;

  const [{ count: compCount }, { count: analyzed }, { data: plan }, { data: edits }] = await Promise.all([
    db.from("competitors").select("id", { count: "exact", head: true }).eq("client_id", id).eq("is_own_account", false),
    db.from("competitor_posts").select("id", { count: "exact", head: true }).eq("client_id", id).not("analysis", "is", null),
    db.from("content_plans").select("id, week_start, content_ideas(status)").eq("client_id", id).order("week_start", { ascending: false }).limit(1).maybeSingle(),
    db.from("edits").select("status").eq("client_id", id),
  ]);
  const style = styleForClient(ctx);
  const ideas = (plan?.content_ideas ?? []) as { status: string }[];
  const toRecord = ideas.filter((i) => ["idea", "approved"].includes(i.status)).length;
  const inReview = (edits ?? []).filter((e) => e.status === "review").length;
  const done = (edits ?? []).filter((e) => e.status === "done").length;
  const questions = brand.data.openQuestions ?? [];

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

      <ol className="card divide-y divide-line/60">
        {steps.map((s) => (
          <li key={s.n} className="flex flex-wrap items-center gap-4 p-4">
            <span className={`grid h-8 w-8 place-items-center rounded-full text-xs ${s.ok ? "bg-ok/15 text-ok" : "bg-line text-muted"}`}>
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

      {questions.length ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Preguntas rápidas para afinar tu contenido</h2>
          <p className="text-sm text-muted">Contesta las que puedas. Con eso el motor se ajusta solo.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {questions.map((q, i) => (
              <form key={i} action={addBrandInputAction.bind(null, id)} className="card space-y-2 p-4">
                <input type="hidden" name="title" value={q} />
                <input type="hidden" name="kind" value="note" />
                <div className="text-sm">{q}</div>
                <div className="flex gap-2">
                  <input name="content" className="input" placeholder="Tu respuesta" />
                  <button className="btn btn-ghost">Guardar</button>
                </div>
              </form>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
