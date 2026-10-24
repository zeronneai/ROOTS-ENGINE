export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAgency } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadAudit } from "@/server/audits";
import { TIME_ZONE } from "@/lib/time";
import { PageTitle, TopBar } from "@/components/Shell";
import { AuditRunner } from "@/components/audit/AuditRunner";
import { AuditReport } from "@/components/audit/AuditReport";
import { AuditForm } from "@/components/audit/AuditForm";
import { CopyLink } from "@/components/CopyLink";
import { updateAuditAction, deleteAuditAction } from "@/app/audit-actions";

export default async function AuditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ correr?: string }> }) {
  await requireAgency();
  const { id } = await params;
  const { correr } = await searchParams;
  const a = await loadAudit(supabaseAdmin(), id);
  if (!a) notFound();
  const hasResearch = !!(a.research?.google || a.research?.web || a.research?.social);
  const date = new Date(a.report_at ?? a.created_at).toLocaleDateString(a.language === "es" ? "es-MX" : "en-US", { timeZone: TIME_ZONE, day: "numeric", month: "long", year: "numeric" });
  const g = a.research?.google?.place;
  const own = a.research?.social?.own ?? [];

  return (
    <>
      <TopBar right={<Link href="/agency/auditorias" className="text-muted hover:text-ink">← Auditorías</Link>} />
      <main className="mx-auto max-w-5xl px-5 py-10">
        <PageTitle kicker="Auditoría gratis" title={a.business_name}>
          {a.report ? (
            <a href={`/auditoria/${a.share_token}`} target="_blank" rel="noreferrer" className="btn btn-primary">
              Abrir como la ve el cliente
            </a>
          ) : null}
        </PageTitle>

        <AuditRunner auditId={a.id} hasReport={!!a.report} autoStart={correr === "1" && !a.report} hasResearch={hasResearch} />
        {a.status === "error" && a.error ? <p className="mt-3 text-sm text-bad">Último error: {a.error}</p> : null}

        {a.report ? (
          <section className="card mt-6 p-5">
            <div className="font-semibold">Link para mandarle al prospecto</div>
            <p className="text-sm text-muted">Cualquiera con el link la puede ver. Desde ahí también se descarga en PDF.</p>
            <CopyLink path={`/auditoria/${a.share_token}`} />
          </section>
        ) : null}

        {hasResearch ? (
          <section className="mt-6 grid gap-3 sm:grid-cols-3">
            <Fact title="Google" value={g ? `${g.rating ?? "?"} ★ · ${g.reviewsCount ?? 0} reseñas` : a.research?.google ? "No lo encontré" : "Sin revisar"} sub={g?.category ?? a.research?.google?.category ?? undefined} />
            <Fact
              title="Sitio web"
              value={a.research?.web?.own ? (a.research.web.own.ok ? `Carga en ${((a.research.web.own.responseMs ?? 0) / 1000).toFixed(1)} s` : a.research.web.own.error ?? "No cargó") : a.research?.web ? "No tiene" : "Sin revisar"}
              sub={a.research?.web?.own?.finalUrl ?? undefined}
            />
            <Fact
              title="Redes"
              value={own.length ? own.map((p) => ("notFound" in p ? `${p.platform}: no encontrado` : `${p.platform}: ${p.followers ?? "?"} seg.`)).join(" · ") : a.research?.social ? "No encontré redes" : "Sin revisar"}
              sub={a.research?.social ? `${a.research.social.competitors.length} redes de la competencia` : undefined}
            />
          </section>
        ) : null}

        {a.report ? (
          <div className="mt-10">
            <AuditReport r={a.report} business={a.business_name} city={a.city} date={date} lang={a.language} />
          </div>
        ) : null}

        <details className="card mt-10 p-5">
          <summary className="cursor-pointer font-semibold">Corregir los datos del prospecto</summary>
          <div className="mt-5">
            <AuditForm action={updateAuditAction.bind(null, a.id)} values={a} submitLabel="Guardar cambios" />
          </div>
          <form action={deleteAuditAction.bind(null, a.id)} className="mt-6 border-t border-line pt-4">
            <button className="text-sm text-bad hover:underline">Borrar esta auditoría</button>
          </form>
        </details>
      </main>
    </>
  );
}

function Fact({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="label">{title}</div>
      <div className="mt-1 font-semibold">{value}</div>
      {sub ? <div className="mt-0.5 truncate text-xs text-muted">{sub}</div> : null}
    </div>
  );
}
