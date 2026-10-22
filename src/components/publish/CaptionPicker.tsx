"use client";
import { useState } from "react";
import { Spinner } from "../ApiButton";

export type CaptionOpt = { kind: string; text: string };
// mismo texto que CAPTION_LABELS de lib/ai/caption (no se importa para no meter el SDK de Claude al navegador)
const LABELS: Record<string, string> = { largo: "Largo", corto: "Corto", directo: "Sin pedir comentarios", editor: "Del editor (.txt)" };

/** Las opciones de copy: tocas una y pasa al cuadro para editarla. "Otros 3" pide nuevas. */
export function CaptionPicker({
  options,
  selected,
  onPick,
  onMore,
  moreLabel = "↻ Otros 3 copys",
}: {
  options: CaptionOpt[];
  selected: string;
  onPick: (text: string) => void;
  onMore: () => Promise<void>;
  moreLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function more() {
    setErr(null);
    setBusy(true);
    try {
      await onMore();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      {options.length ? (
        <div className="grid gap-2 lg:grid-cols-3">
          {options.map((o, i) => {
            const on = o.text.trim() === selected.trim();
            return (
              <button key={`${o.kind}-${i}`} type="button" onClick={() => onPick(o.text)} className={`rounded-xl border p-3 text-left text-xs ${on ? "border-purple glow" : "border-line"}`}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink">{LABELS[o.kind] ?? o.kind}</span>
                  {on ? <span className="text-purple">✓ escogido</span> : null}
                </div>
                <div className="line-clamp-5 whitespace-pre-wrap text-muted">{o.text}</div>
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-ghost text-sm" disabled={busy} onClick={more}>
          {busy ? <><Spinner /> Escribiendo...</> : options.length ? moreLabel : "✨ Escribir 3 copys con IA"}
        </button>
        {err ? <span className="text-xs text-bad">{err}</span> : null}
      </div>
    </div>
  );
}
