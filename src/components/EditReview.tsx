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
  brandName?: string | null;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<LabState>(props.initial);
  const [direction, setDirection] = useState<Direction | null>(props.direction);
  const [busy, setBusy] = useState<"redirect" | "approve" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const onChange = useCallback((s: LabState) => setState(s), []);

  async function call(kind: "redirect" | "approve") {
    setBusy(kind);
    setErr(null);
    try {
      const res = await fetch(`/api/edits/${props.editId}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleId: state.presetId, moodId: state.moodId, overrides: state.overrides }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      if (kind === "redirect") setDirection(j.result.direction);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <StyleLab
      src={props.src}
      words={props.words}
      duration={props.duration}
      direction={direction}
      handle={props.handle}
      brandName={props.brandName}
      niche={props.niche}
      brandAccent={props.brandAccent}
      clientOverrides={props.clientOverrides}
      moods={props.moods}
      initial={props.initial}
      onChange={onChange}
    >
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <button className="btn btn-ghost" disabled={!!busy} onClick={() => call("redirect")}>
          {busy === "redirect" ? <Spinner /> : "✦"} Que la IA vuelva a dirigir con este estilo
        </button>
        {props.canApprove ? (
          <button className="btn btn-primary" disabled={!!busy} onClick={() => call("approve")}>
            {busy === "approve" ? <Spinner /> : null} Aprobar y exportar
          </button>
        ) : null}
        {err ? <span className="text-xs text-bad">{err}</span> : null}
        <p className="w-full text-xs text-muted">
          Los cambios de estilo se ven al instante. “Volver a dirigir” le pide a Claude que decida de nuevo cortes, zooms y
          emojis pensando en el estilo nuevo.
        </p>
      </div>
    </StyleLab>
  );
}
