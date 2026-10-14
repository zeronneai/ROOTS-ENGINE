"use client";
import { Player } from "@remotion/player";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TourEdit } from "@/remotion/TourEdit";
import type { Property, TourEdl } from "@/lib/tour/types";
import type { EditStyle } from "@/lib/styles/types";
import { PropertyFields } from "./PropertyFields";
import { MusicPicker, type MusicChoice } from "../music/MusicPicker";
import { Spinner } from "../ApiButton";

/** Revisión del recorrido: vista previa en vivo y todo editable antes de exportar. */
export function TourReview(props: {
  editId: string;
  clientId: string;
  src: string;
  edl: TourEdl;
  style: EditStyle;
  brand: { name?: string; handle?: string; logoUrl?: string | null };
  tracks: { id: string; title: string; url: string | null; path: string; own: boolean }[];
  music: MusicChoice;
  notes: string | null;
  canApprove: boolean;
  isAgency: boolean;
}) {
  const router = useRouter();
  const [edl, setEdl] = useState<TourEdl>(props.edl);
  const [tracks, setTracks] = useState(props.tracks);
  const [music, setMusic] = useState<MusicChoice>(props.music);
  const [notes, setNotes] = useState(props.notes ?? "");
  const [busy, setBusy] = useState<"approve" | "rebuild" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const property = (edl.property ?? {}) as Property;
  const setProperty = (p: Property) => setEdl((e) => ({ ...e, property: p }));
  const musicUrl = edl.music ? tracks.find((t) => t.path === edl.music!.path)?.url ?? null : null;
  const musicChanged = music.mode === "track" && tracks.find((t) => t.id === music.id)?.path !== edl.music?.path;
  const frames = Math.max(1, Math.ceil(edl.duration * edl.fps));
  const inputProps = useMemo(() => ({ src: props.src, edl, style: props.style, brand: props.brand, musicUrl }), [props.src, edl, props.style, props.brand, musicUrl]);

  async function call(kind: "approve" | "rebuild") {
    setBusy(kind);
    setErr(null);
    setMsg(null);
    try {
      const url = kind === "approve" ? `/api/edits/${props.editId}/approve` : `/api/edits/${props.editId}/tour`;
      const body =
        kind === "approve"
          ? { tourEdl: edl }
          : { property: { ...property, rooms: edl.rooms }, notes, musicMode: music.mode === "none" ? "auto" : music.mode, musicId: music.id };
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setMsg(
        kind === "approve"
          ? props.isAgency
            ? "Mandado a exportar. La compu con el worker lo renderiza y aquí aparece el MP4 al terminar."
            : "¡Listo! Tu video se está exportando. En unos minutos aparece aquí para descargarlo."
          : "Rehaciendo el recorrido con la canción y los datos nuevos. En unos minutos se actualiza esta página.",
      );
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div>
        <div className="sticky top-4" style={{ aspectRatio: "9 / 16" }}>
          <Player
            component={TourEdit}
            inputProps={inputProps}
            durationInFrames={frames}
            fps={edl.fps}
            compositionWidth={edl.width}
            compositionHeight={edl.height}
            style={{ width: "100%", height: "100%", borderRadius: 18, overflow: "hidden" }}
            controls
            loop
            clickToPlay
            acknowledgeRemotionLicense
          />
          <p className="mt-2 text-center text-xs text-muted">
            {edl.shots.length} tomas · {edl.duration.toFixed(0)} s · {edl.music ? `${edl.music.title} (${Math.round(edl.bpm)} BPM)` : "sin música"}
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="card space-y-3 p-5">
          <div className="font-semibold">Textos del video</div>
          <input className="input" value={edl.copy.headline} onChange={(e) => setEdl({ ...edl, copy: { ...edl.copy, headline: e.target.value } })} placeholder="Título" />
          <input
            className="input"
            value={edl.copy.highlights.join(", ")}
            onChange={(e) => setEdl({ ...edl, copy: { ...edl.copy, highlights: e.target.value.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 4) } })}
            placeholder="Lo más atractivo, separado por comas"
          />
          <input className="input" value={edl.copy.cta} onChange={(e) => setEdl({ ...edl, copy: { ...edl.copy, cta: e.target.value } })} placeholder="Cierre (ej: Agenda tu visita)" />
          <div>
            <div className="label mb-1.5">Nombre de cada clip</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {edl.rooms.map((r, i) => (
                <input
                  key={i}
                  className="input !py-2 text-sm"
                  value={r}
                  onChange={(e) => setEdl({ ...edl, rooms: edl.rooms.map((x, j) => (j === i ? e.target.value : x)) })}
                  placeholder={`Clip ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="card space-y-3 p-5">
          <div className="font-semibold">Datos de la propiedad</div>
          <PropertyFields value={property} onChange={setProperty} />
        </div>

        <div className="card space-y-3 p-5">
          <div className="font-semibold">Música</div>
          <MusicPicker
            clientId={props.clientId}
            tracks={tracks}
            value={music}
            allowNone={false}
            onChange={(v, added) => {
              if (added) setTracks((t) => [{ id: added.id, title: added.title, url: added.url ?? null, path: added.path ?? "", own: true }, ...t]);
              setMusic(v);
            }}
          />
          {musicChanged ? <p className="text-xs text-warn">Para cambiar la canción hay que rehacer el recorrido, así los cortes caen en el ritmo nuevo.</p> : null}
          <div>
            <div className="label mb-1">Instrucciones extra (opcional)</div>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: que se sienta de lujo, empieza con la alberca" />
          </div>
        </div>

        <div className="card flex flex-wrap items-center gap-3 p-4">
          <button className="btn btn-ghost" disabled={!!busy} onClick={() => call("rebuild")}>
            {busy === "rebuild" ? <Spinner /> : "↻"} Rehacer recorrido
          </button>
          {props.canApprove ? (
            <button className="btn btn-primary" disabled={!!busy || musicChanged} onClick={() => call("approve")}>
              {busy === "approve" ? <Spinner /> : null} Aprobar y exportar
            </button>
          ) : null}
          {err ? <span className="text-xs text-bad">{err}</span> : null}
          {msg ? <p className="w-full rounded-xl bg-sun/40 px-3 py-2 text-sm">{msg}</p> : null}
          <p className="w-full text-xs text-muted">
            Los textos, datos y nombres se ven al instante en la vista previa. “Rehacer” vuelve a armar las tomas (para otra canción o
            instrucciones nuevas).
          </p>
        </div>
      </div>
    </div>
  );
}
