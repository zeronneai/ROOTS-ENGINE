"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Botón que llama a una API del motor y refresca la página. */
export function ApiButton(props: {
  url: string;
  body?: Record<string, unknown>;
  label: string;
  busyLabel?: string;
  confirm?: string;
  variant?: "primary" | "ghost";
  onDone?: (result: unknown) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (props.confirm && !window.confirm(props.confirm)) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(props.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(props.body ?? {}),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Error");
      props.onDone?.(j.result);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <button onClick={run} disabled={busy} className={`btn ${props.variant === "ghost" ? "btn-ghost" : "btn-primary"}`}>
        {busy ? <Spinner /> : null}
        {busy ? (props.busyLabel ?? "Trabajando...") : props.label}
      </button>
      {err ? <span className="text-xs text-bad max-w-xs">{err}</span> : null}
    </div>
  );
}

export function Spinner() {
  return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/25 border-t-current" />;
}
