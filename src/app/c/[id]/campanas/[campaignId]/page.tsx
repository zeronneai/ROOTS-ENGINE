import Link from "next/link";
import { notFound } from "next/navigation";
import { loadClient } from "@/server/load";
import { PageTitle } from "@/components/Shell";
import { IdeaCard, type Idea } from "@/components/IdeaCard";
import { PrintButton } from "@/components/PrintButton";
import { SubmitButton } from "@/components/SubmitButton";
import { deleteCampaignAction } from "@/app/actions";

const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "long" });

type Strategy = { bigIdea: string; audienceAngle: string; whatWorks: string[]; avoid: string[]; recurringBit: string | null; rhythm: string };
type Brief = { goal: string | null; events: { date: string; name: string; details: string | null }[] };

export default async function CampaignPage({ params }: { params: Promise<{ id: string; campaignId: string }> }) {
  const { id, campaignId } = await params;
  const { db, isAgency } = await loadClient(id);
  const { data: c } = await db.from("content_plans").select("*, content_ideas(*)").eq("id", campaignId).eq("client_id", id).eq("kind", "campaign").maybeSingle();
  if (!c) notFound();
  const s = (c.strategy ?? null) as Strategy | null;
  const brief = (c.brief ?? { goal: null, events: [] }) as Brief;
  const ideas = ((c.content_ideas ?? []) as Idea[]).sort((a, b) => (a.publish_date ?? "").localeCompare(b.publish_date ?? "") || a.position - b.position);

  return (
    <>
      <PageTitle kicker={`Campaña · ${fmt(c.week_start)}${c.date_to && c.date_to !== c.week_start ? ` al ${fmt(c.date_to)}` : ""}`} title={c.title ?? "Campaña"}>
        <PrintButton />
      </PageTitle>
      <Link href={`/c/${id}/campanas`} className="-mt-3 mb-5 inline-block text-sm text-muted hover:text-ink print:hidden">← Todas las campañas</Link>

      <div className="space-y-6">
        <section className="card space-y-5 p-5">
          {c.summary ? <p className="text-lg">{c.summary}</p> : null}
          {brief.events?.length ? (
            <div className="flex flex-wrap gap-2">
              {brief.events.map((e) => (
                <span key={e.date + e.name} className="chip !bg-sun/60">{fmt(e.date)} · {e.name}</span>
              ))}
            </div>
          ) : null}
          {s ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <div className="label">La gran idea</div>
                  <p className="mt-1">{s.bigIdea}</p>
                </div>
                <div>
                  <div className="label">Qué siente la audiencia en estas fechas</div>
                  <p className="mt-1 text-sm text-muted">{s.audienceAngle}</p>
                </div>
                {s.recurringBit ? (
                  <div>
                    <div className="label">Personaje o serie recurrente</div>
                    <p className="mt-1 text-sm">{s.recurringBit}</p>
                  </div>
                ) : null}
                <div>
                  <div className="label">Ritmo de publicación</div>
                  <p className="mt-1 text-sm text-muted">{s.rhythm}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="label">Lo que funciona</div>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">{s.whatWorks.map((w, k) => <li key={k}>{w}</li>)}</ul>
                </div>
                <div>
                  <div className="label">Lo que hay que evitar</div>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted">{s.avoid.map((w, k) => <li key={k}>{w}</li>)}</ul>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-4">
          {ideas.map((i) => (
            <IdeaCard key={i.id} clientId={id} idea={i} isAgency={isAgency} campaign />
          ))}
        </section>

        {isAgency ? (
          <form action={deleteCampaignAction.bind(null, id, campaignId)} className="print:hidden">
            <SubmitButton className="btn btn-ghost text-bad">Borrar campaña</SubmitButton>
          </form>
        ) : null}
      </div>
    </>
  );
}
