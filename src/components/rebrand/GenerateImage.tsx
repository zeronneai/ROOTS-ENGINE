"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "../ApiButton";

/** Genera con IA el logo, monograma o un mockup de una dirección. */
export function GenerateImage(props: { clientId: string; rebrandId: string; direction: string; kind: "logo" | "monogram" | "mockup"; index?: number; label: string; disabled?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/clients/${props.clientId}/rebrands/${props.rebrandId}/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction: props.direction, kind: props.kind, index: props.index ?? 0 }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Error");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" className="btn btn-primary !px-3 !py-1.5 text-xs" onClick={run} disabled={busy || !!props.disabled} title={props.disabled ?? undefined}>
        {busy ? <><Spinner /> Generando...</> : props.label}
      </button>
      {err ? <span className="max-w-xs text-xs text-bad">{err}</span> : null}
    </span>
  );
}
