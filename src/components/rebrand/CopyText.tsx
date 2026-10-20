"use client";
import { useState } from "react";

/** Botón para copiar un prompt. */
export function CopyText({ text, label = "Copiar prompt" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost !px-3 !py-1.5 text-xs"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
    >
      {ok ? "Copiado" : label}
    </button>
  );
}
