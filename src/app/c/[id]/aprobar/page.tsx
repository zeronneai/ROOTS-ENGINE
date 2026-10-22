import Link from "next/link";
import { loadClient } from "@/server/load";
import { PageTitle } from "@/components/Shell";
import { SubmitButton } from "@/components/SubmitButton";
import { LiveRefresh } from "@/components/rebrand/LiveRefresh";
import { QueueCard, type QueueItemView } from "@/components/queue/QueueCard";
import { ScheduleItem } from "@/components/queue/ScheduleItem";
import { fmtDateTime } from "@/lib/time";
import {
  addFolderAction,
  backToPendingAction,
  deleteFolderAction,
  refreshFolderAction,
  retryItemAction,
  toggleFolderAutoAction,
} from "@/app/queue-actions";

type Item = {
  id: string;
  file_name: string;
  kind: "video" | "image";
  status: string;
  caption: string;
  hooks: { text: string; angle: string }[];
  captions: { kind: string; text: string }[] | null;
  media_path: string | null;
  overlay_text: string | null;
  approved_at: string | null;
  approved_by: string | null;
  error: string | null;
  created_at: string;
  scheduled_posts: { status: string; scheduled_for: string; results: { platform: string; url: string | null }[] | null } | null;
};

const POST_STATUS: Record<string, string> = { waiting_media: "Esperando", scheduled: "Programado", published: "Publicado", partial: "Publicado en parte", failed: "Falló", canceled: "Cancelado" };
const NET: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", youtube: "YouTube" };

export default async function ApprovePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, client, isAgency } = await loadClient(id);
  const [{ data: folders }, { data: rows }, { data: upcoming }] = await Promise.all([
    db.from("content_folders").select("*").eq("client_id", id).order("created_at"),
    db
      .from("queue_items")
      .select("id, file_name, kind, status, caption, hooks, captions, media_path, overlay_text, approved_at, approved_by, error, created_at, scheduled_posts!queue_items_scheduled_post_id_fkey(status, scheduled_for, results)")
      .eq("client_id", id)
      .order("created_at", { ascending: true })
      .limit(200),
    db.from("scheduled_posts").select("scheduled_for").eq("client_id", id).eq("media_source", "queue").eq("status", "waiting_media").order("scheduled_for").limit(30),
  ]);
  const items = (rows ?? []) as unknown as Item[];
  const by = (s: string) => items.filter((i) => i.status === s);
  const pendingItems = by("pending");
  const approved = by("approved").sort((a, b) => Date.parse(a.approved_at ?? a.created_at) - Date.parse(b.approved_at ?? b.created_at));
  const processing = by("processing");
  const failed = by("failed");
  const scheduled = by("scheduled").reverse().slice(0, 20);
  const rejected = by("rejected").reverse().slice(0, 20);

  const sign = async (list: Item[]) =>
    Promise.all(
      list.map(async (i) => ({
        ...i,
        url: i.media_path ? ((await db.storage.from("recordings").createSignedUrl(i.media_path, 60 * 60 * 3)).data?.signedUrl ?? null) : null,
      })),
    );
  const [pendingViews, approvedViews] = await Promise.all([sign(pendingItems), sign(approved)]);
  const busy = processing.length > 0 || (folders ?? []).some((f) => f.refresh_requested_at);
  const slotDates = (upcoming ?? []).map((u) => u.scheduled_for as string);

  return (
    <>
      {busy ? <LiveRefresh every={15000} /> : null}
      <PageTitle kicker={`✦ Aprobar · ${client.name}`} title="Aprobar videos" />
      <p className="-mt-4 mb-6 max-w-2xl text-sm text-muted">
        Aquí llegan los videos que sube el editor, cada uno con su copy listo. Cambia lo que quieras y dale Aprobar. Los aprobados quedan en fila y se publican
        solos en los días y horas del calendario, en el orden en que se aprobaron.
      </p>

      {isAgency ? (
        <section className="card mb-8 space-y-4 p-5">
          <div className="font-semibold">Carpetas del editor</div>
          {(folders ?? []).map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
              <span className="font-semibold">{f.name}</span>
              <a href={f.dropbox_url} target="_blank" className="max-w-[220px] truncate text-xs text-muted underline">{f.dropbox_url}</a>
              <span className="chip text-xs">{f.last_result ?? "Sin revisar"}{f.last_checked_at ? ` · ${fmtDateTime(f.last_checked_at)}` : ""}</span>
              {!f.auto_check ? <span className="chip text-xs text-muted">revisión automática apagada</span> : null}
              <span className="ml-auto flex flex-wrap gap-3">
                <form action={refreshFolderAction.bind(null, id, f.id)}><SubmitButton className="btn btn-primary !py-1 text-xs">↻ Buscar videos nuevos</SubmitButton></form>
                <form action={toggleFolderAutoAction.bind(null, id, f.id, !f.auto_check)}><SubmitButton className="text-xs underline">{f.auto_check ? "Apagar revisión cada hora" : "Revisar cada hora"}</SubmitButton></form>
                <form action={deleteFolderAction.bind(null, id, f.id)}><SubmitButton className="text-xs text-bad underline">Quitar</SubmitButton></form>
              </span>
            </div>
          ))}
          <form action={addFolderAction.bind(null, id)} className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
            <input name="name" className="input" placeholder="Nombre (ej. Reels octubre)" />
            <input name="url" className="input" placeholder="Link de la carpeta de Dropbox (compartida con cualquiera que tenga el link)" required />
            <SubmitButton className="btn btn-primary">Conectar carpeta</SubmitButton>
          </form>
          <p className="text-xs text-muted">
            El worker de tu compu baja los videos, se salta los que ya estaban (aunque les cambien el nombre), escribe el copy y 3 textos virales, y le avisa
            por correo al cliente. Se revisa sola cada hora, o al instante con &quot;Buscar videos nuevos&quot;. Si el editor deja un .txt con el mismo nombre del
            video, ese es el copy.
          </p>
        </section>
      ) : null}

      {processing.length ? (
        <div className="card mb-6 flex items-center gap-3 p-4 text-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-purple" />
          Preparando {processing.length} video{processing.length > 1 ? "s" : ""}: viendo el video y escribiendo el copy...
        </div>
      ) : null}

      <section className="mb-10 space-y-4">
        <h2 className="text-lg font-semibold">Por aprobar {pendingViews.length ? <span className="chip ml-1">{pendingViews.length}</span> : null}</h2>
        {pendingViews.length ? (
          pendingViews.map((i) => <QueueCard key={i.id} clientId={id} item={{ id: i.id, file_name: i.file_name, kind: i.kind, caption: i.caption, hooks: i.hooks ?? [], captions: i.captions ?? [], url: i.url } satisfies QueueItemView} />)
        ) : (
          <p className="text-sm text-muted">No hay videos esperando. Cuando el editor suba nuevos, aparecen aquí{isAgency ? "" : " y te llega un correo"}.</p>
        )}
      </section>

      <section className="mb-10 space-y-3">
        <h2 className="text-lg font-semibold">En fila para publicar {approved.length ? <span className="chip ml-1">{approved.length}</span> : null}</h2>
        {approvedViews.length ? (
          <div className="space-y-2">
            {approvedViews.map((i, k) => (
              <div key={i.id} className="card flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="display w-8 text-center text-lg text-lavender">{k + 1}</span>
                {i.url && i.kind === "video" ? <video src={i.url} className="h-20 w-12 rounded-lg bg-ink object-cover" muted preload="metadata" /> : null}
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 whitespace-pre-wrap">{i.caption || <span className="text-muted">Sin copy</span>}</div>
                  <div className="mt-1 text-xs text-muted">
                    {slotDates[k] ? `Sale ${fmtDateTime(slotDates[k])}` : "Sin fecha todavía (falta un día libre en el calendario fijo)"}
                    {i.overlay_text ? ` · texto: "${i.overlay_text}"` : ""}
                    {i.approved_by ? ` · aprobó ${i.approved_by}` : ""}
                  </div>
                </div>
                <span className="flex flex-wrap items-center gap-3">
                  {isAgency ? <ScheduleItem clientId={id} itemId={i.id} /> : null}
                  <form action={backToPendingAction.bind(null, id, i.id)}><SubmitButton className="text-xs underline">Regresar a por aprobar</SubmitButton></form>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Todavía no hay aprobados.</p>
        )}
        {isAgency && approved.length && !slotDates.length ? (
          <p className="text-xs text-muted">
            Para que salgan solos, crea un calendario fijo con &quot;Fila de aprobados&quot; en <Link href={`/c/${id}/publicar`} className="underline">Publicar</Link>, o ponle fecha a cada uno.
          </p>
        ) : null}
      </section>

      {scheduled.length ? (
        <section className="mb-10 space-y-2">
          <h2 className="text-lg font-semibold">Programados y publicados</h2>
          {scheduled.map((i) => (
            <div key={i.id} className="card flex flex-wrap items-center gap-2 p-3 text-sm">
              <span className="chip">{POST_STATUS[i.scheduled_posts?.status ?? ""] ?? "Programado"}</span>
              {i.scheduled_posts?.scheduled_for ? <span className="text-xs text-muted">{fmtDateTime(i.scheduled_posts.scheduled_for)}</span> : null}
              <span className="min-w-0 flex-1 truncate">{i.caption.split("\n")[0]}</span>
              {(i.scheduled_posts?.results ?? []).filter((r) => r.url).map((r, k) => (
                <a key={k} href={r.url!} target="_blank" className="chip text-ok underline">Ver en {NET[r.platform] ?? r.platform}</a>
              ))}
            </div>
          ))}
        </section>
      ) : null}

      {failed.length && isAgency ? (
        <section className="mb-10 space-y-2">
          <h2 className="text-lg font-semibold">No se pudieron preparar</h2>
          {failed.map((i) => (
            <div key={i.id} className="card flex flex-wrap items-center gap-2 p-3 text-sm">
              <span className="font-semibold">{i.file_name}</span>
              <span className="text-xs text-bad">{i.error}</span>
              <form action={retryItemAction.bind(null, id, i.id)} className="ml-auto"><SubmitButton className="text-xs underline">Reintentar</SubmitButton></form>
            </div>
          ))}
        </section>
      ) : null}

      {rejected.length ? (
        <details className="mb-10">
          <summary className="cursor-pointer text-sm font-semibold">Descartados ({rejected.length})</summary>
          <div className="mt-2 space-y-2">
            {rejected.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="truncate text-muted">{i.file_name}</span>
                <form action={backToPendingAction.bind(null, id, i.id)}><SubmitButton className="text-xs underline">Recuperar</SubmitButton></form>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </>
  );
}
