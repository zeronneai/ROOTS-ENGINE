import Link from "next/link";
import { loadClient } from "@/server/load";
import { Empty, PageTitle } from "@/components/Shell";
import { UploadRecording } from "@/components/UploadRecording";
import { retryEditAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";

const EDIT_STATUS: Record<string, { l: string; c: string }> = {
  queued: { l: "En fila", c: "text-muted" },
  transcribing: { l: "Transcribiendo", c: "text-warn" },
  directing: { l: "La IA está editando", c: "text-warn" },
  directing_claimed: { l: "La IA está editando", c: "text-warn" },
  review: { l: "Listo para revisar", c: "text-lavender" },
  render_queued: { l: "En fila para exportar", c: "text-warn" },
  rendering: { l: "Exportando", c: "text-warn" },
  done: { l: "Listo", c: "text-ok" },
  failed: { l: "Falló", c: "text-bad" },
  agency_editing: { l: "Con el equipo PRA", c: "text-lavender" },
};

export default async function VideosPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ idea?: string }> }) {
  const { id } = await params;
  const { idea } = await searchParams;
  const { db, client, isAgency } = await loadClient(id);
  const [{ data: edits }, { data: ideas }] = await Promise.all([
    db.from("edits").select("*, recordings(original_name, created_at), content_ideas(title)").eq("client_id", id).order("created_at", { ascending: false }).limit(50),
    db.from("content_ideas").select("id, title").eq("client_id", id).in("status", ["idea", "approved", "recorded"]).order("publish_date"),
  ]);

  const modes: ("auto" | "agency")[] = isAgency
    ? ["auto", "agency"]
    : client.plan_tier === "auto"
      ? ["auto"]
      : client.plan_tier === "edit" || client.plan_tier === "full"
        ? ["agency", "auto"]
        : [];

  const outputs = await Promise.all(
    (edits ?? []).map(async (e) =>
      e.status === "done" && e.output_path
        ? (await db.storage.from("renders").createSignedUrl(e.output_path, 3600, { download: true })).data?.signedUrl ?? null
        : null,
    ),
  );

  return (
    <>
      <PageTitle kicker="04 · Videos" title="Grabaciones y ediciones" />
      <div className="grid gap-8 xl:grid-cols-[1fr_340px]">
        <section className="space-y-3">
          {!edits?.length ? (
            <Empty title="Todavía no hay videos">Graba con tu celular siguiendo el plan y súbelo aquí.</Empty>
          ) : (
            edits.map((e, k) => {
              const s = EDIT_STATUS[e.status] ?? { l: e.status, c: "" };
              return (
                <div key={e.id} className="card flex flex-wrap items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{e.content_ideas?.title ?? e.recordings?.original_name}</div>
                    <div className="text-xs text-muted">
                      {new Date(e.created_at).toLocaleString("es-MX")} · {e.mode === "auto" ? "Auto-edición" : "Equipo PRA"}
                    </div>
                    {e.error ? <div className="mt-1 text-xs text-bad">{e.error}</div> : null}
                  </div>
                  <span className={`chip ${s.c}`}>{s.l}</span>
                  {["review", "done", "render_queued"].includes(e.status) ? (
                    <Link href={`/c/${id}/videos/${e.id}`} className="btn btn-ghost">{e.status === "review" ? "Revisar" : "Ver"}</Link>
                  ) : null}
                  {outputs[k] ? <a href={outputs[k]!} className="btn btn-primary">Descargar</a> : null}
                  {e.status === "failed" ? (
                    <form action={retryEditAction.bind(null, id, e.id)}><SubmitButton className="btn btn-ghost">Reintentar</SubmitButton></form>
                  ) : null}
                </div>
              );
            })
          )}
        </section>
        <aside>
          {modes.length ? (
            <UploadRecording clientId={id} ideas={ideas ?? []} defaultIdea={idea} modes={modes} />
          ) : (
            <div className="card p-5 text-sm text-muted">
              Tu plan incluye investigación, ideas y guiones. Para que editemos tus videos, pásate a <b className="text-ink">Roots Auto</b> o <b className="text-ink">Roots Edit</b>.
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
