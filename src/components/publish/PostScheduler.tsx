"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "../ApiButton";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { compressIfNeeded } from "@/lib/compress-video";
import { grabFrames } from "@/lib/video-frames";
import { burnText, burnTextImage, type OverlayOpts } from "@/lib/overlay-text";
import { DEFAULT_OVERLAY, ViralText } from "./ViralText";

type Account = { id: string; platform: string; name: string };
type EditOption = { id: string; title: string; caption: string | null; ideaId: string | null; outputPath: string | null };

const NET: Record<string, string> = { instagram: "📸 Instagram", tiktok: "🎵 TikTok", facebook: "👍 Facebook", youtube: "▶️ YouTube" };

/** Mañana a las 10:00, en formato de <input type="datetime-local">. */
function defaultWhen() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Formulario para programar un post. */
export function PostScheduler({ clientId, accounts, edits, defaultEdit }: { clientId: string; accounts: Account[]; edits: EditOption[]; defaultEdit?: string | null }) {
  const router = useRouter();
  const first = edits.find((e) => e.id === defaultEdit) ?? null;
  const [source, setSource] = useState<"edit" | "upload" | "dropbox_file" | "dropbox_folder">(edits.length ? "edit" : "upload");
  const [editId, setEditId] = useState(first?.id ?? edits[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [dropboxUrl, setDropboxUrl] = useState("");
  const [caption, setCaption] = useState(first?.caption ?? "");
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<string[]>(accounts.map((a) => a.id));
  const [when, setWhen] = useState(defaultWhen);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [hint, setHint] = useState("");
  const [writing, setWriting] = useState(false);
  const [overlay, setOverlay] = useState<OverlayOpts>(DEFAULT_OVERLAY);
  // el video que se está viendo (para la IA y la vista previa del texto)
  const editPath = source === "edit" ? (edits.find((e) => e.id === editId)?.outputPath ?? null) : null;
  const uploadMedia = useMemo(() => (file ? { src: URL.createObjectURL(file), kind: (file.type.startsWith("image/") ? "image" : "video") as "video" | "image" } : null), [file]);
  useEffect(() => () => { if (uploadMedia) URL.revokeObjectURL(uploadMedia.src); }, [uploadMedia]);
  const [editMedia, setEditMedia] = useState<{ path: string; src: string } | null>(null);
  useEffect(() => {
    if (!editPath) return;
    let alive = true;
    supabaseBrowser()
      .storage.from("renders")
      .createSignedUrl(editPath, 3600)
      .then(({ data }) => alive && data?.signedUrl && setEditMedia({ path: editPath, src: data.signedUrl }));
    return () => {
      alive = false;
    };
  }, [editPath]);
  const media =
    source === "upload" ? uploadMedia : source === "edit" && editMedia && editMedia.path === editPath ? { src: editMedia.src, kind: "video" as const } : null;

  async function framesOfMedia() {
    if (!media) return [];
    try {
      return await grabFrames(media.src, media.kind);
    } catch {
      return [];
    }
  }

  async function suggestHooks() {
    const res = await fetch(`/api/clients/${clientId}/social/caption`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "hooks", frames: await framesOfMedia(), editId: source === "edit" ? editId : null, hint }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? "No se pudieron sugerir textos");
    return j.result as { hooks: { text: string; angle: string }[]; brandColor: string | null };
  }

  /** El archivo final: el original o, si hay texto viral, con el texto pegado. */
  async function finalFile(): Promise<File | null> {
    const withText = overlay.text.trim().length > 0 && (source === "upload" || source === "edit");
    let f: File | null = source === "upload" ? file : null;
    if (withText && source === "edit" && media) {
      setBusy("Bajando el video...");
      const blob = await (await fetch(media.src)).blob();
      f = new File([blob], "video.mp4", { type: "video/mp4" });
    }
    if (!f || !withText) return f;
    if (f.type.startsWith("image/")) return burnTextImage(f, overlay);
    setBusy("Poniendo el texto: 0%");
    return burnText(f, overlay, (p) => setBusy(`Poniendo el texto: ${Math.round(p * 100)}%`));
  }

  async function downloadPreview() {
    setErr(null);
    try {
      const f = await finalFile();
      if (!f) throw new Error("Escoge el video primero");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(f);
      a.download = f.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  const youtube = useMemo(() => accounts.some((a) => a.platform === "youtube" && picked.includes(a.id)), [accounts, picked]);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function chooseEdit(id: string) {
    setEditId(id);
    const e = edits.find((x) => x.id === id);
    if (e?.caption && !caption.trim()) setCaption(e.caption);
  }

  /** La IA ve el video (fotos + lo que se dice) y escribe el copy con el tono del cliente. */
  async function writeWithAi() {
    setErr(null);
    setWriting(true);
    try {
      if (source === "upload" && !file) throw new Error("Primero escoge el archivo");
      const res = await fetch(`/api/clients/${clientId}/social/caption`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frames: await framesOfMedia(),
          editId: source === "edit" ? editId : null,
          hint: [hint, overlay.text.trim() ? `On-screen text of the video: ${overlay.text}` : ""].filter(Boolean).join(". "),
          platforms: accounts.filter((a) => picked.includes(a.id)).map((a) => a.platform),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "No se pudo escribir el copy");
      setCaption(j.result.caption);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setWriting(false);
    }
  }

  async function submit() {
    setErr(null);
    setDone(false);
    try {
      let mediaPath: string | null = null;
      // con texto viral, el video del motor se sube como archivo nuevo ya con el texto
      const withText = overlay.text.trim().length > 0 && (source === "upload" || source === "edit");
      const sendAs = withText ? "upload" : source;
      if (sendAs === "upload") {
        if (source === "upload" && !file) throw new Error("Escoge el archivo");
        setBusy("Preparando el archivo...");
        const base = await finalFile();
        if (!base) throw new Error("Escoge el archivo");
        const f = base.type.startsWith("video/") ? await compressIfNeeded(base, (p) => setBusy(`Comprimiendo: ${Math.round(p * 100)}%`)) : base;
        const ext = (f.name.split(".").pop() || "mp4").toLowerCase();
        mediaPath = `${clientId}/social/${crypto.randomUUID()}.${ext}`;
        setBusy("Subiendo...");
        const { error } = await supabaseBrowser().storage.from("recordings").upload(mediaPath, f, { contentType: f.type || "video/mp4" });
        if (error) throw new Error(error.message);
      }
      setBusy("Programando...");
      const res = await fetch(`/api/clients/${clientId}/social/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: sendAs,
          editId: sendAs === "edit" ? editId : null,
          mediaPath,
          dropboxUrl: sendAs.startsWith("dropbox") ? dropboxUrl : null,
          caption,
          title: youtube ? title : null,
          accountIds: picked,
          scheduledFor: new Date(when).toISOString(),
          timezone: tz,
          ideaId: source === "edit" ? (edits.find((e) => e.id === editId)?.ideaId ?? null) : null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Error");
      setDone(true);
      setFile(null);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const opt = (id: typeof source, label: string, hint: string) => (
    <button type="button" onClick={() => setSource(id)} className={`rounded-xl border px-3 py-2 text-left text-xs ${source === id ? "border-purple glow" : "border-line"}`}>
      <div className="text-sm font-semibold">{label}</div>
      <div className="text-muted">{hint}</div>
    </button>
  );

  return (
    <div className="card space-y-5 p-5">
      <div className="font-semibold">Programar un post</div>

      <div className="space-y-2">
        <div className="label">¿De dónde sale el video?</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {opt("edit", "Video del motor", "Uno que ya editó Roots Engine")}
          {opt("upload", "Subir archivo", "Video o imagen de tu compu o celular")}
          {opt("dropbox_file", "Link de Dropbox", "Un archivo específico")}
          {opt("dropbox_folder", "Carpeta de Dropbox", "El más nuevo, aunque todavía no exista")}
        </div>
      </div>

      {source === "edit" ? (
        edits.length ? (
          <select className="input" value={editId} onChange={(e) => chooseEdit(e.target.value)}>
            {edits.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        ) : (
          <p className="text-sm text-muted">Todavía no hay videos exportados.</p>
        )
      ) : null}
      {source === "upload" ? <input type="file" accept="video/*,image/*" className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /> : null}
      {source.startsWith("dropbox") ? (
        <div className="space-y-1">
          <input className="input" value={dropboxUrl} onChange={(e) => setDropboxUrl(e.target.value)} placeholder="https://www.dropbox.com/scl/fo/..." />
          <p className="text-xs text-muted">
            {source === "dropbox_folder"
              ? "15 minutos antes de la hora, el sistema toma el video más nuevo de la carpeta que no se haya publicado. Puedes subirlo a la carpeta después de programar. Necesita el worker prendido."
              : "Comparte el archivo como \"cualquiera con el link\". Se baja 15 minutos antes de la hora (necesita el worker prendido)."}
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="label">Dónde se publica</div>
        <div className="flex flex-wrap gap-2">
          {accounts.map((a) => {
            const on = picked.includes(a.id);
            return (
              <button key={a.id} type="button" onClick={() => setPicked(on ? picked.filter((x) => x !== a.id) : [...picked, a.id])} className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-purple glow font-semibold" : "border-line text-muted"}`}>
                {NET[a.platform] ?? a.platform} · {a.name}
              </button>
            );
          })}
        </div>
      </div>

      {source === "edit" || source === "upload" ? (
        <ViralText src={media?.src ?? null} kind={media?.kind ?? "video"} value={overlay} onChange={setOverlay} suggest={suggestHooks} />
      ) : null}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="label">Copy</span>
          {source === "edit" || source === "upload" ? (
            <button type="button" className="btn btn-ghost text-sm" disabled={writing || (source === "upload" && !file)} onClick={writeWithAi}>
              {writing ? <><Spinner /> Viendo el video...</> : "✨ Escribir copy con IA"}
            </button>
          ) : null}
        </div>
        {source === "edit" || source === "upload" ? (
          <input className="input text-sm" value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Contexto para la IA (opcional): promo, evento, a quién va dirigido..." />
        ) : null}
        <textarea rows={6} className="input" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="El texto del post, con hashtags" />
        {source.startsWith("dropbox") ? (
          <p className="text-xs text-muted">Si lo dejas vacío y no hay .txt junto al video, la IA lo escribe sola viendo el video antes de publicarlo.</p>
        ) : null}
      </div>
      {youtube ? (
        <label className="block space-y-1">
          <span className="label">Título para YouTube</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="Si lo dejas vacío, se usa la primera línea del copy" />
        </label>
      ) : null}
      <label className="block space-y-1">
        <span className="label">Fecha y hora ({tz})</span>
        <input type="datetime-local" className="input" value={when} onChange={(e) => setWhen(e.target.value)} />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={!!busy || !picked.length} onClick={submit}>
          {busy ? <><Spinner /> {busy}</> : "Programar"}
        </button>
        {overlay.text.trim() && media?.kind === "video" ? (
          <button type="button" className="btn btn-ghost text-sm" disabled={!!busy} onClick={downloadPreview}>Descargar con texto</button>
        ) : null}
        {done ? <span className="text-xs text-ok">Listo, quedó programado.</span> : null}
        {err ? <span className="text-xs text-bad">{err}</span> : null}
      </div>
    </div>
  );
}
