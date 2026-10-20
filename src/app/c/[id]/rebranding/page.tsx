import Link from "next/link";
import { loadClient } from "@/server/load";
import { Empty, PageTitle } from "@/components/Shell";
import { RebrandForm } from "@/components/rebrand/RebrandForm";
import { fmtDate } from "@/lib/time";

const STATUS: Record<string, string> = { generating: "Generando...", done: "Listo", failed: "Falló" };

export default async function RebrandingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, isAgency, client } = await loadClient(id);
  const { data: rows } = await db
    .from("rebrands")
    .select("id, title, status, created_at, data")
    .eq("client_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <>
      <PageTitle kicker={`✦ Rebranding · ${client.name}`} title="Rebranding" />
      <p className="-mt-3 mb-6 max-w-2xl text-sm text-muted">
        Análisis de la marca actual, comparación con marcas del mismo segmento y 3 direcciones completas con nombre, paleta, tipografía, logo y mockups
        generados con IA.
      </p>
      <div className="grid gap-8 xl:grid-cols-[1fr_520px]">
        <section className="space-y-3">
          {!rows?.length ? (
            <Empty title="Sin análisis todavía">{isAgency ? "Crea el primero con el formulario." : "Tu equipo de Purple Roots está preparando la propuesta."}</Empty>
          ) : (
            rows.map((r) => (
              <Link key={r.id} href={`/c/${id}/rebranding/${r.id}`} className="card block p-5 transition hover:border-purple">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="display text-lavender">{fmtDate(r.created_at)}</span>
                  <span className={`chip ${r.status === "failed" ? "text-bad" : r.status === "done" ? "text-ok" : ""}`}>{STATUS[r.status] ?? r.status}</span>
                </div>
                <div className="mt-2 text-lg font-semibold">{r.title}</div>
                {r.data?.summary ? <p className="mt-1 line-clamp-2 text-sm text-muted">{r.data.summary}</p> : null}
              </Link>
            ))
          )}
        </section>
        <aside>{isAgency ? <RebrandForm clientId={id} clientName={client.name} /> : null}</aside>
      </div>
    </>
  );
}
