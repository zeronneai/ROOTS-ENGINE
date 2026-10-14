"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { StyleLab, type LabState } from "./StyleLab";
import { Spinner } from "./ApiButton";
import type { Direction } from "@/lib/edl/build";
import type { Word } from "@/lib/edl/types";
import type { StyleOverrides } from "@/lib/styles/types";
import { MusicPicker, type MusicChoice } from "./music/MusicPicker";

export function EditReview(props: {
  editId: string;
  src: string;
  words: Word[];
  duration: number;
  direction: Direction | null;
  niche: string | null;
  brandAccent: string | null;
  clientOverrides: StyleOverrides;
  moods: { id: string; name: string; style_overrides: StyleOverrides }[];
  initial: LabState;
  handle: string | null;
  notes?: string | null;
  assetUrls?: Record<string, string>;
  isAgency?: boolean;
  clientId?: string;
  tracks?: { id: string; title: string; url: string | null; path: string; own: boolean }[];
  music?: MusicChoice;
  brandName?: string | null;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<LabState>(props.initial);
  const [direction, setDirection] = useState<Direction | null>(props.direction);
  const [notes, setNotes] = useState(props.notes ?? "");
  const [version, setVersion] = useState(0);
  const [assetUrls, setAssetUrls] = useState(props.assetUrls ?? {});
  const [summary, setSummary] = useState<string | null>(null);
  const [tracks, setTracks] = useState(props.tracks ?? []);
  const [music, setMusic] = useState<MusicChoice>(props.music ?? { mode: "auto", id: null });
  const [musicVolume, setMusicVolume] = useState<number>((props.initial.overrides.music?.volume as number | undefined) ?? 0.32);
  // la vista previa usa la canción elegida (o la que escogió la IA)
  const chosen = music.mode === "track" ? tracks.find((t) => t.id === music.id) : null;
  const previewMusic =
    music.mode === "none" ? null : chosen ? { path: chosen.path, title: chosen.title } : (direction?.music ?? null);
  const previewDirection = direction ? { ...direction, music: previewMusic } : direction;
  const musicUrl = previewMusic ? tracks.find((t) => t.path === previewMusic.path)?.url ?? null : null;
  const [busy, setBusy] = useState<"redirect" | "approve" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const onChange = useCallback((s: LabState) => setState(s), []);

  async function call(kind: "redirect" | "approve") {
    setBusy(kind);
    setErr(null);
    setSummary(null);
    try {
      const res = await fetch(`/api/edits/${props.editId}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId: state.presetId,
          moodId: state.moodId,
          overrides: { ...state.overrides, music: { ...(state.overrides.music ?? {}), volume: musicVolume } },
          notes,
          musicMode: music.mode,
          musicId: music.id,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      if (kind === "redirect") {
        setDirection(j.result.direction);
        if (j.result.assetUrls) setAssetUrls(j.result.assetUrls);
        const e = j.result.edl;
        setSummary(
          `Listo: ${Math.max(0, e.segments.length - 1)} cortes, ${e.zooms.length} zooms, ${e.emojis.length} emojis, ` +
            `${e.callouts?.length ?? 0} textos animados${e.images?.length ? `, ${e.images.length} imágenes` : ""}. ` +
            `Ya se ve en la vista previa. Para que el MP4 final cambie, aprieta "Aprobar y exportar".`,
        );
        if (j.result.overrides) {
          // las instrucciones pueden cambiar el estilo: reiniciamos el laboratorio con el estilo nuevo
          setState((s) => ({ ...s, overrides: j.result.overrides }));
          setVersion((v) => v + 1);
        }
      }
      if (kind === "approve")
        setSummary(
          props.isAgency
            ? "Mandado a exportar. La compu con el worker lo renderiza (en PowerShell ves el avance) y aquí aparece el MP4 al terminar."
            : "¡Listo! Tu video se está exportando. En unos minutos aparece aquí para descargarlo.",
        );
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <StyleLab
      key={version}
      src={props.src}
      words={props.words}
      duration={props.duration}
      direction={previewDirection}
      musicUrl={musicUrl}
      musicVolume={musicVolume}
      handle={props.handle}
      brandName={props.brandName}
      assetUrls={assetUrls}
      niche={props.niche}
      brandAccent={props.brandAccent}
      clientOverrides={props.clientOverrides}
      moods={props.moods}
      initial={state}
      onChange={onChange}
    >
      <div className="card flex flex-wrap items-center gap-3 p-4">
        {props.clientId ? (
          <div className="w-full">
            <div className="label mb-1">Música</div>
            <MusicPicker
              clientId={props.clientId}
              tracks={tracks}
              value={music}
              onChange={(v, added) => {
                if (added) setTracks((t) => [{ ...added, url: added.url ?? null, path: added.path ?? "", own: true }, ...t]);
                setMusic(v);
              }}
            />
            {music.mode === "auto" && direction?.music ? <p className="mt-1 text-xs text-muted">La IA escogió: {direction.music.title}</p> : null}
            {previewMusic ? (
              <label className="mt-2 flex items-center gap-3 text-xs text-muted">
                Volumen
                <input
                  type="range"
                  min={0.05}
                  max={0.8}
                  step={0.05}
                  value={musicVolume}
                  onChange={(e) => setMusicVolume(Number(e.target.value))}
                  className="flex-1 accent-[#4f4789]"
                />
              </label>
            ) : null}
          </div>
        ) : null}
        <div className="w-full">
          <div className="label mb-1">Instrucciones extra para la IA (opcional)</div>
          <textarea
            className="input"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: más motion graphics, textos en 3D, pon el precio en grande, quita la parte donde me trabé"
          />
        </div>
        <button className="btn btn-ghost" disabled={!!busy} onClick={() => call("redirect")}>
          {busy === "redirect" ? <><Spinner /> Dirigiendo, tarda de 30 a 60 segundos...</> : "✦ Que la IA vuelva a dirigir con este estilo"}
        </button>
        {props.canApprove ? (
          <button className="btn btn-primary" disabled={!!busy} onClick={() => call("approve")}>
            {busy === "approve" ? <Spinner /> : null} Aprobar y exportar
          </button>
        ) : null}
        {err ? <span className="text-xs text-bad">{err}</span> : null}
        {summary ? <p className="w-full rounded-xl bg-sun/40 px-3 py-2 text-sm">{summary}</p> : null}
        <p className="w-full text-xs text-muted">
          Los cambios de estilo se ven al instante. “Volver a dirigir” le pide a la IA que decida de nuevo cortes, zooms,
          emojis y textos animados con el estilo y las instrucciones que pusiste.
        </p>
      </div>
    </StyleLab>
  );
}
