import Link from "next/link";
import { loadClient } from "@/server/load";
import { Empty, PageTitle } from "@/components/Shell";
import { PlanGenerator } from "@/components/PlanGenerator";
import { setIdeaStatusAction } from "@/app/actions";

const STATUS: Record<string, { l: string; c: string }> = {
  idea: { l: "Idea", c: "" },
  approved: { l: "Aprobada", c: "text-lavender" },
  recorded: { l: "Grabada", c: "text-warn" },
  edited: { l: "Editada", c: "text-ok" },
  posted: { l: "Publicada", c: "text-ok" },
  skipped: { l: "Saltada", c: "text-muted" },
};

const dayName = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short" });

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, isAgency, client } = await loadClient(id);
  const { data: plans } = await db
    .from("content_plans")
    .select("*, content_ideas(*)")
    .eq("client_id", id)
    .order("week_start", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(4);

  const [current, ...older] = plans ?? [];
  type Idea = {
    id: string; title: string; format: string; hooks: string[]; script: { beat: string; line: string }[];
    shot_list: string[]; cta: string; caption: string; hashtags: string[]; score: number; reasoning: string;
    publish_date: string; status: string; position: number;
  };
  const ideas = ((current?.content_ideas ?? []) as Idea[]).sort((a, b) => (a.publish_date ?? "").localeCompare(b.publish_date ?? "") || a.position - b.position);

  return (
    <>
      <PageTitle kicker="03 · Plan semanal" title={current ? `Semana del ${current.week_start}` : "Plan semanal"} />

      <div className="grid gap-8 xl:grid-cols-[1fr_300px]">
        <section className="space-y-4">
          {current?.summary ? <p className="card p-5 text-muted">{current.summary}</p> : null}
          {!ideas.length ? (
            <Empty title="Sin plan todavía">
              {isAgency ? "Genera el primero. Funciona mejor después de escanear la competencia." : "Tu equipo de Purple Roots está preparando tu plan."}
            </Empty>
          ) : (
            ideas.map((i) => (
              <article key={i.id} className="card p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="display text-lavender">{dayName(i.publish_date)}</span>
                  <span className="chip">{i.format}</span>
                  <span className={`chip ${STATUS[i.status]?.c}`}>{STATUS[i.status]?.l ?? i.status}</span>
                  {i.score ? <span className="ml-auto font-mono text-ok">{i.score}</span> : null}
                </div>
                <h3 className="mt-3 text-xl font-semibold">{i.title}</h3>

                <div className="mt-4 grid gap-5 lg:grid-cols-2">
                  <div>
                    <div className="label">Hooks (escoge uno)</div>
                    <ol className="mt-2 space-y-2">
                      {i.hooks.map((h, k) => (
                        <li key={k} className="rounded-lg border border-line px-3 py-2 text-sm">“{h}”</li>
                      ))}
                    </ol>
                    <div className="label mt-4">Guion</div>
                    <ul className="mt-2 space-y-2 text-sm">
                      {i.script.map((s, k) => (
                        <li key={k}>
                          <span className="text-xs text-purple">{s.beat}</span>
                          <div>{s.line}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="label">Qué grabar</div>
                    <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-sm">
                      {i.shot_list.map((s, k) => <li key={k}>{s}</li>)}
                    </ol>
                    <div className="label mt-4">CTA</div>
                    <p className="mt-1 text-sm">{i.cta}</p>
                    <div className="label mt-4">Copy</div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{i.caption}</p>
                    <p className="mt-1 text-xs text-lavender">{i.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}</p>
                  </div>
                </div>

                {isAgency && i.reasoning ? <p className="mt-4 text-xs text-muted">Por qué: {i.reasoning}</p> : null}

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href={`/c/${id}/videos?idea=${i.id}`} className="btn btn-primary">Subir grabación</Link>
                  {i.status === "idea" ? (
                    <form action={setIdeaStatusAction.bind(null, id, i.id, "approved")}><button className="btn btn-ghost">Aprobar</button></form>
                  ) : null}
                  {["edited", "recorded"].includes(i.status) ? (
                    <form action={setIdeaStatusAction.bind(null, id, i.id, "posted")}><button className="btn btn-ghost">Ya se publicó</button></form>
                  ) : null}
                  {i.status !== "skipped" ? (
                    <form action={setIdeaStatusAction.bind(null, id, i.id, "skipped")}><button className="btn btn-ghost">Saltar</button></form>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </section>

        <aside className="space-y-4">
          {isAgency ? <PlanGenerator clientId={id} defaultCount={client.plan_tier === "plan" ? 4 : 5} /> : null}
          {older.length ? (
            <div className="card p-5">
              <div className="mb-2 font-semibold">Semanas anteriores</div>
              <ul className="space-y-1 text-sm text-muted">
                {older.map((p) => (
                  <li key={p.id}>Semana del {p.week_start} · {(p.content_ideas ?? []).length} ideas</li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}
