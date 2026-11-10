"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Spinner } from "@/components/ApiButton";

/** "Reporte completo": la IA lee todo lo del panel y abre el reporte listo para PDF. */
export function ReportButton({ clientId, days }: { clientId: string; days: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/metrics/${clientId}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days }) });
      const j = await res.json().catch(() => ({ error: "El servidor tardó demasiado. Inténtalo otra vez." }));
      if (!res.ok) throw new Error(j.error ?? "Error");
      router.push(`/metrics/${clientId}/reporte/${j.result.id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <button onClick={run} disabled={busy} className="btn btn-primary !py-1.5 text-xs">
        {busy ? <Spinner /> : null}
        {busy ? "Armando reporte (1-2 min)..." : "Reporte completo (PDF)"}
      </button>
      {err ? <span className="max-w-xs text-xs text-bad">{err}</span> : null}
    </div>
  );
}
