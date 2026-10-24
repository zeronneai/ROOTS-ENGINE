import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { TIME_ZONE } from "@/lib/time";
import { AuditReport } from "@/components/audit/AuditReport";
import { PrintButton } from "@/components/PrintButton";
import { AutoPrint } from "@/components/AutoPrint";
import type { AuditReport as Report } from "@/lib/ai/audit";

export const dynamic = "force-dynamic";

type Row = { business_name: string; city: string; language: "en" | "es"; report: Report | null; report_at: string | null; created_at: string };

async function load(token: string) {
  if (!/^[a-f0-9]{24,64}$/.test(token)) return null;
  const { data } = await supabaseAdmin()
    .from("audits")
    .select("business_name, city, language, report, report_at, created_at")
    .eq("share_token", token)
    .maybeSingle();
  return (data as Row | null) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const a = await load((await params).token);
  return {
    title: a ? `${a.business_name} · ${a.language === "es" ? "Auditoría" : "Business Audit"} | Purple Roots` : "Purple Roots",
    robots: { index: false, follow: false },
  };
}

/** La auditoría que le mandamos al prospecto: pública con el link, sin iniciar sesión. */
export default async function PublicAudit({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ pdf?: string }> }) {
  const a = await load((await params).token);
  const { pdf } = await searchParams;
  if (!a?.report) notFound();
  const lang = a.language;
  const date = new Date(a.report_at ?? a.created_at).toLocaleDateString(lang === "es" ? "es-MX" : "en-US", { timeZone: TIME_ZONE, day: "numeric", month: "long", year: "numeric" });
  return (
    <main className="doc mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10" lang={lang}>
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton label={lang === "es" ? "Descargar PDF" : "Download PDF"} />
      </div>
      {pdf === "1" ? <AutoPrint /> : null}
      <AuditReport r={a.report} business={a.business_name} city={a.city} date={date} lang={lang} />
    </main>
  );
}
