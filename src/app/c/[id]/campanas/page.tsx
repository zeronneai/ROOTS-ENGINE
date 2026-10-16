import Link from "next/link";
import { loadClient } from "@/server/load";
import { Empty, PageTitle } from "@/components/Shell";
import { CampaignForm } from "@/components/campaigns/CampaignForm";
import { upcomingDates } from "@/lib/special-dates";

const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" });

export default async function CampaignsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, isAgency, client } = await loadClient(id);
  const { data: campaigns } = await db
    .from("content_plans")
    .select("id, title, week_start, date_to, summary, created_at, content_ideas(id, status)")
    .eq("client_id", id)
    .eq("kind", "campaign")
    .order("created_at", { ascending: false })
    .limit(30);
  const suggestions = upcomingDates(new Date(), 75).map((d) => ({ date: d.date, name: d.name }));

  return (
    <>
      <PageTitle kicker={`03 · Campañas · ${client.name}`} title="Campañas" />
      <p className="-mt-3 mb-6 max-w-2xl text-sm text-muted">
        Para fechas y eventos en particular: un pop up, un lanzamiento, Halloween, una feria. Le das las fechas y la IA arma el análisis y las ideas
        (comedia, trends, cinemático) listas para grabar.
      </p>
      <div className="grid gap-8 xl:grid-cols-[1fr_460px]">
        <section className="space-y-3">
          {!campaigns?.length ? (
            <Empty title="Sin campañas todavía">{isAgency ? "Crea la primera con el formulario." : "Tu equipo de Purple Roots está preparando tus campañas."}</Empty>
          ) : (
            campaigns.map((c) => {
              const ideas = (c.content_ideas ?? []) as { status: string }[];
              const done = ideas.filter((i) => ["edited", "posted"].includes(i.status)).length;
              return (
                <Link key={c.id} href={`/c/${id}/campanas/${c.id}`} className="card block p-5 transition hover:border-purple">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="display text-lavender">{fmt(c.week_start)}{c.date_to && c.date_to !== c.week_start ? ` al ${fmt(c.date_to)}` : ""}</span>
                    <span className="chip">{ideas.length} ideas</span>
                    {done ? <span className="chip text-ok">{done} listas</span> : null}
                  </div>
                  <div className="mt-2 text-lg font-semibold">{c.title}</div>
                  {c.summary ? <p className="mt-1 line-clamp-2 text-sm text-muted">{c.summary}</p> : null}
                </Link>
              );
            })
          )}
        </section>
        <aside>{isAgency ? <CampaignForm clientId={id} suggestions={suggestions} /> : null}</aside>
      </div>
    </>
  );
}
