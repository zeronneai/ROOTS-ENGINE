"use client";
import { useState } from "react";
import { analyzeReference, type ReferenceAnalysis } from "@/lib/analyze-reference";
import { Spinner } from "./ApiButton";

/** Escoger un video de referencia: se analiza aquí mismo (cortes y cuadros) y no se sube completo. */
export function ReferenceVideo({
  value,
  onChange,
}: {
  value: (ReferenceAnalysis & { name: string }) | null;
  onChange: (v: (ReferenceAnalysis & { name: string }) | null) => void;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-purple/40 bg-cream p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/jpeg;base64,${value.frames[2] ?? value.frames[0]}`} alt="" className="h-16 w-10 shrink-0 rounded-md object-cover" />
        <div className="min-w-0 flex-1 text-sm">
          <div className="truncate font-semibold">{value.name}</div>
          <div className="text-xs text-muted">
            {value.stats.cutsPerMinute} cortes por minuto · toma promedio de {value.stats.avgShotSeconds} s
          </div>
        </div>
        <button type="button" className="px-2 text-bad" onClick={() => onChange(null)} aria-label="Quitar">
          ✕
        </button>
      </div>
    );
  }
  return (
    <div>
      <label className="block cursor-pointer rounded-xl border border-dashed border-line px-4 py-3 text-center text-sm text-muted hover:border-purple">
        <input
          type="file"
          accept="video/*"
          className="hidden"
          disabled={busy !== null}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setErr(null);
            setBusy(0);
            try {
              const a = await analyzeReference(f, (p) => setBusy(p));
              onChange({ ...a, name: f.name.replace(/\.[^.]+$/, "") });
            } catch (er) {
              setErr((er as Error).message);
            } finally {
              setBusy(null);
            }
          }}
        />
        {busy !== null ? (
          <span className="inline-flex items-center gap-2">
            <Spinner /> Analizando el video: {Math.round(busy * 100)}%
          </span>
        ) : (
          "🎞️ Subir un video de referencia (un reel que te guste)"
        )}
      </label>
      {err ? <p className="mt-1 text-xs text-bad">{err}</p> : null}
    </div>
  );
}
