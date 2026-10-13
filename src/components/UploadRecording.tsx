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
  const [file, setFile] = useState<File | null>(null);
  const [idea, setIdea] = useState(props.defaultIdea ?? "");
  const [mode, setMode] = useState<"auto" | "agency">(props.modes[0] ?? "auto");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const path = `${props.clientId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabaseBrowser().storage.from("recordings").upload(path, file, { contentType: file.type || "video/mp4" });
      if (error) throw error;
      await registerRecordingAction(props.clientId, { storagePath: path, originalName: file.name, ideaId: idea || null, mode, notes });
      setFile(null);
      setNotes("");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-5">
      <div className="font-semibold">Subir grabación</div>
      <label className="grid cursor-pointer place-items-center rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted hover:border-purple">
        <input type="file" accept="video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {file ? <span className="text-ink">{file.name} · {(file.size / 1e6).toFixed(0)} MB</span> : "Toca para escoger el video"}
      </label>
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
      <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas para la edición (opcional)" />
      <button className="btn btn-primary w-full" disabled={!file || busy}>
        {busy ? <><Spinner /> Subiendo...</> : "Subir"}
      </button>
      {err ? <p className="text-xs text-bad">{err}</p> : null}
    </form>
  );
}
