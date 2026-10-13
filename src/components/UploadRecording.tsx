"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { registerRecordingAction } from "@/app/actions";
import { Spinner } from "./ApiButton";

type IdeaOpt = { id: string; title: string };

export function UploadRecording(props: {
  clientId: string;
  ideas: IdeaOpt[];
  defaultIdea?: string | null;
  modes: ("auto" | "agency")[];
}) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState("");
  const [images, setImages] = useState<{ file: File; url: string; note: string; use: "show" | "reference" }[]>([]);
  const [idea, setIdea] = useState(props.defaultIdea ?? "");
  const [mode, setMode] = useState<"auto" | "agency">(props.modes[0] ?? "auto");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function move(i: number, d: number) {
    const next = [...files];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setFiles(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length) return;
    setBusy(true);
    setErr(null);
    try {
      const paths: string[] = [];
      for (const [i, file] of files.entries()) {
        setProgress(files.length > 1 ? `Subiendo clip ${i + 1} de ${files.length}...` : "Subiendo...");
        const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
        const path = `${props.clientId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabaseBrowser().storage.from("recordings").upload(path, file, { contentType: file.type || "video/mp4" });
        if (error) throw new Error(`${file.name}: ${error.message}`);
        paths.push(path);
      }
      const assets: { path: string; note: string; use: "show" | "reference" }[] = [];
      for (const [i, im] of images.entries()) {
        setProgress(`Subiendo imagen ${i + 1} de ${images.length}...`);
        const ext = im.file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${props.clientId}/img-${crypto.randomUUID()}.${ext}`;
        const { error } = await supabaseBrowser().storage.from("recordings").upload(path, im.file, { contentType: im.file.type || "image/jpeg" });
        if (error) throw new Error(`${im.file.name}: ${error.message}`);
        assets.push({ path, note: im.note, use: im.use });
      }
      const name = files.length > 1 ? `${files[0].name} + ${files.length - 1} clip${files.length > 2 ? "s" : ""}` : files[0].name;
      await registerRecordingAction(props.clientId, {
        storagePath: paths[0],
        extraPaths: paths.slice(1),
        originalName: name,
        ideaId: idea || null,
        mode,
        notes,
        assets,
      });
      setFiles([]);
      setImages([]);
      setNotes("");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-5">
      <div className="font-semibold">Subir grabación</div>
      {files.length ? (
        <ol className="space-y-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-xl border border-line bg-cream px-3 py-2 text-sm">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sun text-[11px] font-bold">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-xs text-muted">{(f.size / 1e6).toFixed(0)} MB</span>
              <button type="button" className="px-1 text-muted disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir">↑</button>
              <button type="button" className="px-1 text-muted disabled:opacity-30" disabled={i === files.length - 1} onClick={() => move(i, 1)} aria-label="Bajar">↓</button>
              <button type="button" className="px-1 text-bad" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Quitar">✕</button>
            </li>
          ))}
        </ol>
      ) : null}
      <label className="grid cursor-pointer place-items-center rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted hover:border-purple">
        <input
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
            setFiles((cur) => [...cur, ...picked].slice(0, 20));
            e.target.value = "";
          }}
        />
        {files.length ? "+ Agregar otro clip" : "Toca para escoger el video (puedes elegir varios clips)"}
      </label>
      {files.length > 1 ? (
        <p className="text-xs text-muted">Se unen en este orden y se editan como un solo video. Las tomas repetidas o con error se quitan solas.</p>
      ) : null}
      <select className="input" value={idea} onChange={(e) => setIdea(e.target.value)}>
        <option value="">¿De qué idea del plan es? (opcional)</option>
        {props.ideas.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
      </select>
      {props.modes.length > 1 ? (
        <div className="grid grid-cols-2 gap-2">
          {props.modes.map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-xl border px-3 py-2 text-left text-xs ${mode === m ? "border-purple glow" : "border-line"}`}
            >
              <div className="font-semibold text-sm">{m === "auto" ? "Auto-edición" : "Equipo PRA"}</div>
              <div className="text-muted">{m === "auto" ? "Listo en minutos con tu estilo" : "Lo edita una persona"}</div>
            </button>
          ))}
        </div>
      ) : null}
      <div className="space-y-2">
        <div className="label">Imágenes (opcional)</div>
        {images.map((im, i) => (
          <div key={`${im.file.name}-${i}`} className="flex gap-3 rounded-xl border border-line bg-cream p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={im.url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <input
                className="input !py-1.5 text-sm"
                value={im.note}
                placeholder="¿Qué es? Ej: el producto, el antes y después"
                onChange={(e) => setImages(images.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))}
              />
              <div className="flex gap-1.5 text-xs">
                {(["show", "reference"] as const).map((u) => (
                  <button
                    type="button"
                    key={u}
                    onClick={() => setImages(images.map((x, j) => (j === i ? { ...x, use: u } : x)))}
                    className={`rounded-full border px-2.5 py-1 ${im.use === u ? "border-purple bg-purple text-white" : "border-line bg-white"}`}
                  >
                    {u === "show" ? "Que salga en el video" : "Solo referencia"}
                  </button>
                ))}
                <button type="button" className="ml-auto px-1 text-bad" onClick={() => setImages(images.filter((_, j) => j !== i))} aria-label="Quitar">
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
        <label className="block cursor-pointer rounded-xl border border-dashed border-line px-4 py-3 text-center text-sm text-muted hover:border-purple">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []).map((file) => ({ file, url: URL.createObjectURL(file), note: "", use: "show" as const }));
              setImages((cur) => [...cur, ...picked].slice(0, 8));
              e.target.value = "";
            }}
          />
          + Agregar imágenes (foto del producto, del local, antes y después, una referencia de estilo...)
        </label>
      </div>
      <div>
        <div className="label mb-1">¿Algo extra para la edición? (opcional)</div>
        <textarea
          className="input"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ej: más motion graphics, textos en 3D, pon el precio en grande, que se sienta más elegante"
        />
      </div>
      <button className="btn btn-primary w-full" disabled={!files.length || busy}>
        {busy ? <><Spinner /> {progress}</> : files.length > 1 ? `Subir ${files.length} clips como un solo video` : "Subir"}
      </button>
      {err ? <p className="text-xs text-bad">{err}</p> : null}
    </form>
  );
}
