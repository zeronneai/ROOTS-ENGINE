import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Report } from "@/lib/ai/report";

export type PlanIdea = {
  title: string;
  format: string;
  hooks: string[];
  script: { beat: string; line: string }[];
  shot_list: string[];
  cta: string;
  caption: string;
  publish_date: string;
  position: number;
};

/** Último reporte + plan de la semana del cliente. */
export async function loadReportData(db: SupabaseClient, clientId: string) {
  const [{ data: row }, { data: plan }] = await Promise.all([
    db.from("reports").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db
      .from("content_plans")
      .select("week_start, content_ideas(title, format, hooks, script, shot_list, cta, caption, publish_date, position)")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const ideas = ((plan?.content_ideas ?? []) as PlanIdea[]).sort(
    (a, b) => (a.publish_date ?? "").localeCompare(b.publish_date ?? "") || a.position - b.position,
  );
  return {
    report: (row?.data as Report | undefined) ?? null,
    date: row ? new Date(row.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) : null,
    weekStart: (plan?.week_start as string | undefined) ?? null,
    ideas,
  };
}

export const dayName = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short" });
