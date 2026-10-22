import { loadClient } from "@/server/load";
import { Empty, PageTitle } from "@/components/Shell";
import { SubmitButton } from "@/components/SubmitButton";
import { ConnectSocial } from "@/components/publish/ConnectSocial";
import { PostScheduler } from "@/components/publish/PostScheduler";
import { cancelPostAction, deleteSlotAction, saveCaptionRulesAction, toggleSlotAction } from "@/app/publish-actions";
import { SlotForm } from "@/components/publish/SlotForm";
import { listAccounts, type SocialAccount } from "@/lib/zernio";
import { syncPosts } from "@/server/publishing";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fmtDateTime } from "@/lib/time";

const STATUS: Record<string, { l: string; c: string }> = {
  waiting_media: { l: "Esperando video", c: "text-warn" },
  scheduled: { l: "Programado", c: "text-lavender" },
  published: { l: "Publicado", c: "text-ok" },
  partial: { l: "Publicado en parte", c: "text-warn" },
  failed: { l: "Falló", c: "text-bad" },
  canceled: { l: "Cancelado", c: "text-muted" },
};
const SOURCE: Record<string, string> = { edit: "Video del motor", upload: "Archivo subido", dropbox_file: "Dropbox", dropbox_folder: "Carpeta de Dropbox", queue: "Fila de aprobados", none: "Solo texto" };
const NET: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", youtube: "YouTube" };

type PostView = {
  id: string; caption: string; accounts: { platform: string; label?: string }[]; scheduled_for: string; status: string; media_source: string;
  media_name: string | null; results: { platform: string; status: string; url: string | null; error: string | null }[]; error: string | null;
};

/** Próximos (en orden) y anteriores. */
function splitPosts(list: PostView[]) {
  const cutoff = Date.now() - 60_000;
  const upcoming = list.filter((p) => Date.parse(p.scheduled_for) >= cutoff && p.status !== "canceled").reverse();
  return { upcoming, past: list.filter((p) => !upcoming.includes(p)) };
}

export default async function PublishPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string; conectada?: string }> }) {
  const { id } = await params;
  const { edit, conectada } = await searchParams;
  const { db, client, isAgency } = await loadClient(id);
  const ready = !!process.env.ZERNIO_API_KEY;

  let accounts: SocialAccount[] = [];
  let accountsError: string | null = null;
  const { data: row } = await supabaseAdmin().from("clients").select("zernio_profile_id, caption_rules, caption_footer").eq("id", id).single();
  if (ready && row?.zernio_profile_id) {
    try {
      accounts = await listAccounts(row.zernio_profile_id);
    } catch (e) {
      accountsError = (e as Error).message;
    }
    await syncPosts(supabaseAdmin(), id);
  }

  const [{ data: posts }, { data: edits }, { data: slots }] = await Promise.all([
    db.from("scheduled_posts").select("*").eq("client_id", id).order("scheduled_for", { ascending: false }).limit(40),
    db
      .from("edits")
      .select("id, created_at, idea_id, output_path, recordings(original_name), content_ideas(title, caption, hashtags)")
      .eq("client_id", id)
      .eq("status", "done")
      .not("output_path", "is", null)
      .order("created_at", { ascending: false })
      .limit(30),
    db.from("posting_slots").select("*").eq("client_id", id).order("created_at"),
  ]);
  type EditRow = { id: string; created_at: string; idea_id: string | null; output_path: string | null; recordings: { original_name: string } | null; content_ideas: { title: string; caption: string | null; hashtags: string[] | null } | null };
  const editOptions = ((edits ?? []) as unknown as EditRow[]).map((e) => ({
    id: e.id,
    ideaId: e.idea_id,
    outputPath: e.output_path,
    title: `${e.content_ideas?.title ?? e.recordings?.original_name ?? "Video"} · ${fmtDateTime(e.created_at)}`,
    caption: e.content_ideas?.caption
      ? `${e.content_ideas.caption}${e.content_ideas.hashtags?.length ? `\n\n${e.content_ideas.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}` : ""}`
      : null,
  }));
  const { upcoming, past } = splitPosts((posts ?? []) as PostView[]);

  const Row = ({ p }: { p: PostView }) => {
    const s = STATUS[p.status] ?? { l: p.status, c: "" };
    return (
      <article className="card space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="display text-lavender">{fmtDateTime(p.scheduled_for)}</span>
          <span className={`chip ${s.c}`}>{s.l}</span>
          {p.accounts.map((a, k) => <span key={k} className="chip">{NET[a.platform] ?? a.platform}{a.label ? ` · ${a.label}` : ""}</span>)}
          <span className="text-muted">{SOURCE[p.media_source]}{p.media_name ? `: ${p.media_name}` : ""}</span>
        </div>
        <p className="line-clamp-3 whitespace-pre-wrap text-sm">{p.caption || <span className="text-muted">Sin copy</span>}</p>
        {p.results?.some((r) => r.url || r.error) ? (
          <div className="flex flex-wrap gap-2 text-xs">
            {p.results.map((r, k) =>
              r.url ? <a key={k} href={r.url} target="_blank" className="chip text-ok underline">Ver en {NET[r.platform] ?? r.platform}</a> : r.error ? <span key={k} className="chip text-bad">{NET[r.platform] ?? r.platform}: {r.error}</span> : null,
            )}
          </div>
        ) : null}
        {p.error ? <p className="text-xs text-bad">{p.error}</p> : null}
        {["waiting_media", "scheduled"].includes(p.status) ? (
          <form action={cancelPostAction.bind(null, id, p.id)}>
            <SubmitButton className="text-xs text-muted underline">Cancelar</SubmitButton>
          </form>
        ) : null}
      </article>
    );
  };

  return (
    <>
      <PageTitle kicker={`✦ Publicar · ${client.name}`} title="Publicación programada" />
      {!ready ? (
        <Empty title="Falta conectar Zernio">Agrega ZERNIO_API_KEY en las variables de Vercel y en el .env.local del worker.</Empty>
      ) : (
        <div className="grid gap-8 xl:grid-cols-[1fr_520px]">
          <section className="space-y-6">
            <div className="card space-y-3 p-5">
              <div className="font-semibold">Redes conectadas</div>
              {conectada ? <p className="text-sm text-ok">Listo, se conectó {NET[conectada] ?? conectada}.</p> : null}
              {accountsError ? <p className="text-sm text-bad">{accountsError}</p> : null}
              {accounts.length ? (
                <div className="flex flex-wrap gap-2">
                  {accounts.map((a) => (
                    <span key={a.id} className={`chip ${a.healthy ? "" : "text-bad"}`}>
                      {NET[a.platform] ?? a.platform} · {a.name}{a.healthy ? "" : " · reconectar"}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">Todavía no hay redes conectadas. El dueño de la cuenta tiene que entrar con su usuario y dar permiso.</p>
              )}
              <ConnectSocial clientId={id} />
            </div>

            {isAgency ? (
              <details className="card p-5" open={!row?.caption_rules && !row?.caption_footer}>
                <summary className="cursor-pointer font-semibold">Cómo escribe el copy la IA</summary>
                <form action={saveCaptionRulesAction.bind(null, id)} className="mt-3 space-y-3">
                  <label className="block space-y-1">
                    <span className="label">Reglas fijas</span>
                    <textarea name="caption_rules" rows={4} className="input text-sm" defaultValue={row?.caption_rules ?? ""} placeholder="Ej: cierra con el teléfono y consulta gratis, hashtags de cajón #elpaso..., nunca digas..." />
                  </label>
                  <label className="block space-y-1">
                    <span className="label">Cierre que siempre va al final</span>
                    <input name="caption_footer" className="input text-sm" defaultValue={row?.caption_footer ?? ""} placeholder="Ej: 📱 915-400-1099 FREE consultation." />
                  </label>
                  <p className="text-xs text-muted">El cierre se agrega a todos los posts de este cliente, aunque el copy lo escribas tú. Si el copy ya trae el teléfono, no lo repite. Además, la IA copia el estilo de los últimos posts del cliente.</p>
                  <SubmitButton className="btn btn-ghost text-sm">Guardar</SubmitButton>
                </form>
              </details>
            ) : null}

            {slots?.length ? (
              <div className="card space-y-3 p-5">
                <div className="font-semibold">Calendario fijo</div>
                {slots.map((sl) => (
                  <div key={sl.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                    <span className="font-semibold">{sl.name}</span>
                    <span className="chip">{(sl.weekdays as number[]).sort().map((d) => ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][d]).join(", ")} · {sl.time}</span>
                    <span className="chip">{sl.source === "queue" ? "fila de aprobados" : "carpeta de Dropbox"} · listo {sl.deadline_hours} h antes</span>
                    {(sl.accounts as { platform: string }[]).map((a, k) => <span key={k} className="chip">{NET[a.platform] ?? a.platform}</span>)}
                    {!sl.active ? <span className="chip text-muted">pausado</span> : null}
                    <span className="ml-auto flex gap-3">
                      <form action={toggleSlotAction.bind(null, id, sl.id, !sl.active)}><SubmitButton className="text-xs underline">{sl.active ? "Pausar" : "Reactivar"}</SubmitButton></form>
                      <form action={deleteSlotAction.bind(null, id, sl.id)}><SubmitButton className="text-xs text-bad underline">Borrar</SubmitButton></form>
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="space-y-3">
              <h2 className="font-semibold">Próximos</h2>
              {upcoming.length ? upcoming.map((p) => <Row key={p.id} p={p} />) : <p className="text-sm text-muted">No hay nada programado.</p>}
            </div>
            {past.length ? (
              <div className="space-y-3">
                <h2 className="font-semibold">Anteriores</h2>
                {past.map((p) => <Row key={p.id} p={p} />)}
              </div>
            ) : null}
          </section>
          <aside>
            {accounts.length ? (
              <div className="space-y-6">
                <PostScheduler clientId={id} accounts={accounts.map((a) => ({ id: a.id, platform: a.platform, name: a.name }))} edits={editOptions} defaultEdit={edit ?? null} />
                <SlotForm clientId={id} accounts={accounts.map((a) => ({ id: a.id, platform: a.platform, name: a.name }))} />
              </div>
            ) : (
              <div className="card p-5 text-sm text-muted">Conecta al menos una red para programar.</div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
