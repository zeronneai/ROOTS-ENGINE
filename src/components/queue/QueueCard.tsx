"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "../ApiButton";
import { DEFAULT_OVERLAY, ViralText } from "../publish/ViralText";
import { CaptionPicker, type CaptionOpt } from "../publish/CaptionPicker";
import { burnText, burnTextImage, type OverlayOpts } from "@/lib/overlay-text";
import { grabFrames } from "@/lib/video-frames";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { approveItemAction, rejectItemAction, saveItemCaptionAction } from "@/app/queue-actions";

export type QueueItemView = {
  id: string;
  file_name: string;
  kind: "video" | "image";
  caption: string;
  hooks: { text: string; angle: string }[];
  captions: CaptionOpt[];
  version: number;
  url: string | null;
};

/** Un video por aprobar: vista previa, copy editable, texto viral opcional, Aprobar o Descartar. */
export function QueueCard({ clientId, item }: { clientId: string; item: QueueItemView }) {
  const router = useRouter();
  const [caption, setCaption] = useState(item.caption);
  const [options, setOptions] = useState<CaptionOpt[]>(item.captions ?? []);
  const [overlay, setOverlay] = useState<OverlayOpts>(DEFAULT_OVERLAY);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  /** Otros 3 copys, distintos a los que ya salieron. */
  async function moreCaptions() {
    const frames = item.url ? await grabFrames(item.url, item.kind).catch(() => []) : [];
    const res = await fetch(`/api/clients/${clientId}/social/caption`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frames, itemId: item.id, avoid: options.map((o) => o.text), hint: overlay.text.trim() ? `On-screen text of the video: ${overlay.text}` : "" }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? "No se pudieron escribir los copys");
    setOptions(j.result.options);
  }

  async function suggest() {
    const frames = item.url ? await grabFrames(item.url, item.kind).catch(() => []) : [];
    const res = await fetch(`/api/clients/${clientId}/social/caption`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "hooks", frames }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? "No se pudieron sugerir textos");
    return j.result as { hooks: { text: string; angle: string }[]; brandColor: string | null };
  }

  async function approve() {
    setErr(null);
    try {
      let newMediaPath: string | null = null;
      if (overlay.text.trim() && item.url) {
        setBusy("Bajando el video...");
        const blob = await (await fetch(item.url)).blob();
        const f = new File([blob], item.file_name, { type: blob.type || (item.kind === "image" ? "image/jpeg" : "video/mp4") });
        setBusy("Poniendo el texto: 0%");
        const out = item.kind === "image" ? await burnTextImage(f, overlay) : await burnText(f, overlay, (p) => setBusy(`Poniendo el texto: ${Math.round(p * 100)}%`));
        setBusy("Guardando...");
        newMediaPath = `${clientId}/queue/${item.id}-${crypto.randomUUID().slice(0, 8)}.${item.kind === "image" ? "jpg" : "mp4"}`;
        const { error } = await supabaseBrowser().storage.from("recordings").upload(newMediaPath, out, { contentType: out.type });
        if (error) throw new Error(error.message);
      }
      setBusy("Aprobando...");
      await approveItemAction(clientId, item.id, { caption, overlayText: overlay.text.trim() || null, newMediaPath });
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="card grid gap-4 p-4 md:grid-cols-[minmax(0,240px)_1fr]">
      <div className="mx-auto w-full max-w-[240px] overflow-hidden rounded-xl bg-ink">
        {item.url ? (
          item.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.url} alt="" className="block w-full" />
          ) : (
            <video src={item.url} className="block w-full" controls playsInline preload="metadata" />
          )
        ) : (
          <div className="grid aspect-[9/16] place-items-center text-xs text-paper/60">Sin vista previa</div>
        )}
      </div>
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-xs text-muted" title={item.file_name}>{item.file_name}</span>
          {item.version > 1 ? <span className="chip text-xs text-warn">Versión {item.version}: el editor corrigió el video</span> : null}
        </div>
        <div className="space-y-1">
          <span className="label">Escoge un copy</span>
          <CaptionPicker options={options} selected={caption} onPick={(t) => { setCaption(t); setSaved(false); }} onMore={moreCaptions} />
        </div>
        <label className="block space-y-1">
          <span className="label">Copy final (edítalo si quieres)</span>
          <textarea rows={6} className="input text-sm" value={caption} onChange={(e) => { setCaption(e.target.value); setSaved(false); }} />
        </label>
        {caption !== item.caption ? (
          <button type="button" className="text-xs underline" disabled={pending} onClick={() => start(async () => { await saveItemCaptionAction(clientId, item.id, caption); setSaved(true); })}>
            {pending ? "Guardando..." : "Guardar cambios sin aprobar"}
          </button>
        ) : saved ? <span className="text-xs text-ok">Guardado</span> : null}

        <ViralText src={item.url} kind={item.kind} value={overlay} onChange={setOverlay} suggest={suggest} initialHooks={item.hooks} />

        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" disabled={!!busy} onClick={approve}>
            {busy ? <><Spinner /> {busy}</> : "✓ Aprobar"}
          </button>
          <button className="btn btn-ghost text-bad" disabled={!!busy || pending} onClick={() => start(async () => { await rejectItemAction(clientId, item.id); router.refresh(); })}>
            Descartar
          </button>
          {err ? <span className="text-xs text-bad">{err}</span> : null}
        </div>
      </div>
    </article>
  );
}
