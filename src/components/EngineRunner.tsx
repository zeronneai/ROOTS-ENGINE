"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ENGINE_STEPS, type EngineStepId } from "@/lib/engine-steps";
import { Spinner } from "./ApiButton";

type State = "pending" | "running" | "done" | "skipped" | "error";

/** "Arrancar motor": corre todos los pasos en cadena con una lista que se va palomeando. */
export function EngineRunner({ clientId, hasReport }: { clientId: string; hasReport: boolean }) {
  const router = useRouter();
  const [states, setStates] = useState<Record<string, State>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  async function run(from: EngineStepId = ENGINE_STEPS[0].id) {
    setRunning(true);
    setFinished(false);
    const start = ENGINE_STEPS.findIndex((s) => s.id === from);
    for (const s of ENGINE_STEPS.slice(start)) {
      setStates((p) => ({ ...p, [s.id]: "running" }));
      try {
        const res = await fetch(`/api/clients/${clientId}/engine/${s.id}`, { method: "POST" });
        const j = await res.json().catch(() => ({ error: `Error ${res.status}` }));
        if (!res.ok) throw new Error(j.error ?? `Error ${res.status}`);
        setStates((p) => ({ ...p, [s.id]: j.skipped ? "skipped" : "done" }));
        if (j.skipped) setNotes((p) => ({ ...p, [s.id]: j.skipped }));
      } catch (e) {
        setStates((p) => ({ ...p, [s.id]: "error" }));
        setNotes((p) => ({ ...p, [s.id]: (e as Error).message }));
        setRunning(false);
        router.refresh();
        return;
      }
    }
    setRunning(false);
    setFinished(true);
    router.refresh();
  }

  const failed = ENGINE_STEPS.find((s) => states[s.id] === "error");

  return (
    <section className="card glow mb-8 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="display text-xs text-lavender">Content Engine</div>
          <div className="mt-1 text-lg font-semibold">Arrancar motor</div>
          <p className="text-sm text-muted">Investiga, analiza y arma reporte y plan en un solo paso. Tarda de 5 a 10 minutos; no cierres esta pestaña.</p>
        </div>
        <div className="flex gap-2">
          {failed && !running ? (
            <button className="btn btn-ghost" onClick={() => run(failed.id)}>Reintentar desde aquí</button>
          ) : null}
          <button className="btn btn-primary" disabled={running} onClick={() => run()}>
            {running ? <Spinner /> : "✦"} {running ? "Trabajando..." : hasReport ? "Volver a correr" : "Arrancar motor"}
          </button>
        </div>
      </div>

      {Object.keys(states).length ? (
        <ol className="mt-5 space-y-1">
          {ENGINE_STEPS.map((s, i) => {
            const st = states[s.id] ?? "pending";
            return (
              <li key={s.id} className="flex items-start gap-3 rounded-xl px-2 py-1.5">
                <span
                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] ${
                    st === "done" ? "bg-ok/15 text-ok" : st === "error" ? "bg-bad/15 text-bad" : st === "running" ? "bg-purple/20 text-lavender" : "bg-line text-muted"
                  }`}
                >
                  {st === "done" ? "✓" : st === "error" ? "!" : st === "running" ? <Spinner /> : st === "skipped" ? "·" : String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <div className={`text-sm ${st === "pending" ? "text-muted" : ""}`}>{st === "running" ? s.busy : s.label}</div>
                  {notes[s.id] ? <div className={`text-xs ${st === "error" ? "text-bad" : "text-muted"}`}>{notes[s.id]}</div> : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}

      {finished ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/c/${clientId}/reporte`} className="btn btn-primary">Ver reporte</Link>
          <Link href={`/c/${clientId}/plan`} className="btn btn-ghost">Ver plan de la semana</Link>
        </div>
      ) : null}
    </section>
  );
}
