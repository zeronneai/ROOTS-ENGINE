"use client";
import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StyleLab, type LabState } from "./StyleLab";
import { Spinner } from "./ApiButton";
import { ReferenceVideo } from "./ReferenceVideo";
import type { ReferenceAnalysis } from "@/lib/analyze-reference";
import { saveStyleAction, setActiveMoodAction, deleteMoodAction } from "@/app/actions";
import type { Direction } from "@/lib/edl/build";
import type { Word } from "@/lib/edl/types";
import type { StyleOverrides } from "@/lib/styles/types";

type Mood = { id: string; name: string; description: string | null; style_overrides: StyleOverrides; created_by_role: string };

export function ClientStyle(props: {
  clientId: string;
  src: string;
  words: Word[];
  duration: number;
  direction: Direction | null;
  hookTitle: string | null;
  niche: string | null;
  brandAccent: string | null;
  handle: string | null;
  brandName?: string | null;
  moods: Mood[];
  activeMoodId: string | null;
  initial: LabState;
  usingRealClip: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<LabState>(props.initial);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const onChange = useCallback((s: LabState) => {
    setState(s);
    setSaved(false);
  }, []);

  // El lab muestra los overrides guardados del cliente como estado inicial, así que no se pasan como capa.
  return (
    <div className="space-y-10">
      <StyleLab
        src={props.src}
        words={props.words}
        duration={props.duration}
        direction={props.direction}
        hookTitle={props.hookTitle}
        handle={props.handle}
        brandName={props.brandName}
        niche={props.niche}
        brandAccent={props.brandAccent}
        moods={props.moods}
        initial={props.initial}
        onChange={onChange}
      >
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <button
            className="btn btn-primary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await saveStyleAction(props.clientId, state);
                setSaved(true);
                router.refresh();
              })
            }
          >
            {pending ? <Spinner /> : null} Guardar como mi estilo
          </button>
          {saved ? <span className="text-sm text-ok">Guardado. Tus próximos videos salen así.</span> : null}
          <p className="w-full text-xs text-muted">
            {props.usingRealClip ? "Vista previa con tu último video." : "Vista previa con un clip de ejemplo. Cuando subas tu primer video, se verá aquí."}
          </p>
        </div>
      </StyleLab>

      <MoodCreator clientId={props.clientId} />

      {props.moods.length ? (
        <section>
          <div className="label mb-3">Tus moods</div>
          <div className="grid gap-3 md:grid-cols-2">
            {props.moods.map((m) => (
              <div key={m.id} className={`card p-4 ${props.activeMoodId === m.id ? "glow" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{m.name}</span>
                  <span className="chip">{m.created_by_role === "client" ? "tuyo" : "agencia"}</span>
                  {props.activeMoodId === m.id ? <span className="chip text-ok">activo</span> : null}
                </div>
                {m.description ? <p className="mt-1 text-sm text-muted">“{m.description}”</p> : null}
                <div className="mt-3 flex gap-2">
                  {props.activeMoodId === m.id ? (
                    <button className="btn btn-ghost" onClick={() => start(() => setActiveMoodAction(props.clientId, null))}>Desactivar</button>
                  ) : (
                    <button className="btn btn-ghost" onClick={() => start(() => setActiveMoodAction(props.clientId, m.id))}>Activar</button>
                  )}
                  <button className="btn btn-ghost" onClick={() => start(() => deleteMoodAction(props.clientId, m.id))}>Borrar</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function MoodCreator({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [refs, setRefs] = useState("");
  const [video, setVideo] = useState<(ReferenceAnalysis & { name: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/moods`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: text,
          references: refs.split(/\s+/).filter(Boolean),
          activate: true,
          ...(video ? { frames: video.frames, stats: video.stats, name: video.name } : {}),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setText("");
      setRefs("");
      setVideo(null);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-3 p-5">
      <div className="font-semibold">¿Quieres cambiar de mood?</div>
      <p className="text-sm text-muted">
        Dilo con tus palabras. Ej: “Para diciembre quiero algo más elegante y navideño” o “Que se vea como los videos de
        @cuenta, más rápido y con más emojis”.
      </p>
      <textarea rows={3} className="input" value={text} onChange={(e) => setText(e.target.value)} />
      <input className="input" value={refs} onChange={(e) => setRefs(e.target.value)} placeholder="Links o @cuentas de referencia (opcional)" />
      <ReferenceVideo value={video} onChange={setVideo} />
      <p className="text-xs text-muted">Con un video de referencia la IA copia su estilo de edición: ritmo, subtítulos, textos, colores. Puedes dejar el texto vacío.</p>
      <button className="btn btn-primary" disabled={busy || (!text.trim() && !video)} onClick={create}>
        {busy ? <Spinner /> : "✦"} Crear mood con IA
      </button>
      {err ? <p className="text-xs text-bad">{err}</p> : null}
    </section>
  );
}
