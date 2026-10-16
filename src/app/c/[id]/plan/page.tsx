import { loadClient } from "@/server/load";
import { Empty, PageTitle } from "@/components/Shell";
import { PlanGenerator } from "@/components/PlanGenerator";
import { PrintButton } from "@/components/PrintButton";
import { IdeaCard, type Idea } from "@/components/IdeaCard";

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, isAgency, client } = await loadClient(id);
  const { data: plans } = await db
    .from("content_plans")
    .select("*, content_ideas(*)")
    .eq("client_id", id)
    .eq("kind", "week")
    .order("week_start", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(4);

  const [current, ...older] = plans ?? [];
  const ideas = ((current?.content_ideas ?? []) as Idea[]).sort((a, b) => (a.publish_date ?? "").localeCompare(b.publish_date ?? "") || a.position - b.position);

  return (
    <>
      <PageTitle kicker={`03 · Plan semanal · ${client.name}`} title={current ? `Semana del ${current.week_start}` : "Plan semanal"}>
        {ideas.length ? <PrintButton /> : null}
      </PageTitle>

      <div className="grid gap-8 xl:grid-cols-[1fr_300px]">
        <section className="space-y-4">
          {current?.summary ? <p className="card p-5 text-muted">{current.summary}</p> : null}
          {!ideas.length ? (
            <Empty title="Sin plan todavía">
              {isAgency ? "Genera el primero. Funciona mejor después de escanear la competencia." : "Tu equipo de Purple Roots está preparando tu plan."}
            </Empty>
          ) : (
            ideas.map((i) => (
              <IdeaCard key={i.id} clientId={id} idea={i} isAgency={isAgency} />
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
