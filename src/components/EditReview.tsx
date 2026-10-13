"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { StyleLab, type LabState } from "./StyleLab";
import { Spinner } from "./ApiButton";
import type { Direction } from "@/lib/edl/build";
import type { Word } from "@/lib/edl/types";
import type { StyleOverrides } from "@/lib/styles/types";

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
        body: JSON.stringify({ styleId: state.presetId, moodId: state.moodId, overrides: state.overrides, notes }),
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
        setSummary("Mandado a exportar. Tu compu con el worker lo renderiza: en PowerShell vas a ver el avance y aquí aparece el MP4 al terminar.");
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
      direction={direction}
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
