export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireAgency } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fmtDate } from "@/lib/time";
import { Empty, PageTitle, TopBar } from "@/components/Shell";
import { AuditForm } from "@/components/audit/AuditForm";
import { createAuditAction } from "@/app/audit-actions";

const STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: "Sin correr", cls: "" },
  running: { label: "Corriendo", cls: "!bg-purple/15 !text-purple" },
  done: { label: "Lista", cls: "!bg-ok/15 !text-ok" },
  error: { label: "Con error", cls: "!bg-bad/10 !text-bad" },
};

export default async function AuditsPage() {
  await requireAgency();
  const { data } = await supabaseAdmin()
    .from("audits")
    .select("id, created_at, business_name, city, status, language, report")
    .order("created_at", { ascending: false })
    .limit(100);
  const audits = (data ?? []) as { id: string; created_at: string; business_name: string; city: string; status: string; language: string; report: { score?: number } | null }[];

  return (
    <>
      <TopBar right={<Link href="/agency" className="text-muted hover:text-ink">← Clientes</Link>} />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <PageTitle kicker="Prospectos" title="Auditorías gratis" />
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="card p-6">
            <h2 className="text-lg font-semibold">Nueva auditoría</h2>
            <p className="mb-6 mt-1 text-sm text-muted">
              Mete el nombre y lo que te hayan dado. El motor busca su Google, reseñas, sitio, redes y su competencia, y escribe la auditoría que prometemos en purpleroots.agency/audit.
            </p>
            <AuditForm action={createAuditAction} submitLabel="Crear y correr auditoría" />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Recientes</h2>
            {!audits.length ? (
              <Empty title="Todavía no hay auditorías">La primera tarda de 4 a 8 minutos.</Empty>
            ) : (
              <ul className="space-y-2">
                {audits.map((a) => (
                  <li key={a.id}>
                    <Link href={`/agency/auditorias/${a.id}`} className="card flex items-center justify-between gap-3 p-4 transition hover:border-purple/70">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{a.business_name}</div>
                        <div className="text-xs text-muted">
                          {a.city} · {fmtDate(a.created_at, { day: "numeric", month: "short" })} · {a.language === "es" ? "Español" : "Inglés"}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {a.report?.score != null ? <span className="text-lg font-bold">{a.report.score}</span> : null}
                        <span className={`chip ${STATUS[a.status]?.cls ?? ""}`}>{STATUS[a.status]?.label ?? a.status}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
