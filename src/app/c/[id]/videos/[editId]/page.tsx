import Link from "next/link";
import { notFound } from "next/navigation";
import { loadClient } from "@/server/load";
import { PageTitle } from "@/components/Shell";
import { EditReview } from "@/components/EditReview";
import type { StyleOverrides } from "@/lib/styles/types";

export default async function EditPage({ params }: { params: Promise<{ id: string; editId: string }> }) {
  const { id, editId } = await params;
  const { db, client, brand, moods } = await loadClient(id);
  const { data: edit } = await db
    .from("edits")
    .select("*, recordings(storage_path, original_name), content_ideas(title)")
    .eq("id", editId)
    .eq("client_id", id)
    .maybeSingle();
  if (!edit) notFound();

  const [{ data: src }, rendered] = await Promise.all([
    db.storage.from("recordings").createSignedUrl(edit.recordings.storage_path, 60 * 60 * 3),
    edit.output_path ? db.storage.from("renders").createSignedUrl(edit.output_path, 60 * 60) : Promise.resolve({ data: null }),
  ]);

  const tr = edit.transcript as { words: never[]; duration: number; direction?: never } | null;

  return (
    <>
      <PageTitle kicker="Revisión" title={edit.content_ideas?.title ?? edit.recordings.original_name}>
        <Link href={`/c/${id}/videos`} className="btn btn-ghost">← Videos</Link>
        {rendered.data?.signedUrl ? <a href={rendered.data.signedUrl} className="btn btn-primary">Descargar MP4</a> : null}
      </PageTitle>

      {edit.status === "done" && rendered.data?.signedUrl ? (
        <div className="mb-10 grid gap-6 md:grid-cols-[320px_1fr]">
          <video src={rendered.data.signedUrl} controls className="w-full rounded-2xl" />
          <div className="card p-5 text-sm text-muted">
            Este es el video final exportado. Si quieres otra versión, cambia el estilo abajo y vuelve a aprobar.
          </div>
        </div>
      ) : null}

      {tr?.words && src?.signedUrl ? (
        <EditReview
          editId={edit.id}
          src={src.signedUrl}
          words={tr.words}
          duration={tr.duration}
          direction={tr.direction ?? null}
          niche={client.niche}
          brandAccent={brand.data.visual?.accentColor ?? null}
          clientOverrides={brand.style_overrides}
          moods={moods}
          handle={client.instagram}
          brandName={client.name}
          initial={{ presetId: edit.style_id ?? client.edit_style_id, moodId: edit.mood_id ?? brand.active_mood_id, overrides: (edit.style_overrides ?? {}) as StyleOverrides }}
          canApprove={["review", "done", "failed"].includes(edit.status)}
        />
      ) : (
        <div className="card p-6 text-muted">Este video todavía se está procesando ({edit.status}).</div>
      )}
    </>
  );
}
