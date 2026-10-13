import { notFound } from "next/navigation";
import { requireClientAccess } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadReportData } from "@/server/report-data";
import { AnalysisPart, ContentPart } from "@/components/report/ReportSections";
import { PrintButton } from "@/components/PrintButton";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

const PARTS = {
  analisis: "Análisis de marca y mercado",
  contenido: "Estrategia y plan de contenido",
  completo: "Reporte completo",
} as const;

/** Documento limpio para leer completo o guardar como PDF. */
export default async function DocPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ parte?: string }> }) {
  const { id } = await params;
  const { parte: raw } = await searchParams;
  const parte = (raw && raw in PARTS ? raw : "completo") as keyof typeof PARTS;
  await requireClientAccess(id);
  const db = supabaseAdmin();
  const { data: client } = await db.from("clients").select("name, city").eq("id", id).maybeSingle();
  const { report: r, date, ideas, weekStart } = await loadReportData(db, id);
  if (!client || !r) notFound();

  return (
    <main className="doc mx-auto max-w-4xl px-6 py-8">
      <div className="mb-8 flex items-center justify-between print:hidden">
        <a href={`/c/${id}/reporte`} className="text-sm text-muted hover:text-ink">← Volver</a>
        <PrintButton />
      </div>

      <header className="mb-10 border-b border-line pb-8">
        <Logo />
        <p className="display mt-10 text-xs text-purple">{PARTS[parte]}</p>
        <h1 className="mt-2 text-4xl font-bold">{client.name}</h1>
        <p className="mt-1 text-muted">{client.city} · {date}</p>
      </header>

      {parte !== "contenido" ? (
        <>
          {parte === "completo" ? <PartTitle n="Parte 1" t="Análisis" /> : null}
          <AnalysisPart r={r} />
        </>
      ) : null}

      {parte !== "analisis" ? (
        <div className={parte === "completo" ? "page-break mt-12" : ""}>
          {parte === "completo" ? <PartTitle n="Parte 2" t="Contenido" /> : null}
          <ContentPart r={r} ideas={ideas} weekStart={weekStart} />
        </div>
      ) : null}

      <footer className="mt-12 border-t border-line pt-6 text-center text-xs text-muted">Hecho por Purple Roots Agency · Roots Engine</footer>
    </main>
  );
}

function PartTitle({ n, t }: { n: string; t: string }) {
  return (
    <div className="mb-6">
      <div className="display text-xs text-purple">{n}</div>
      <h2 className="mt-1 text-3xl font-bold"><span className="mark">{t}</span></h2>
    </div>
  );
}
