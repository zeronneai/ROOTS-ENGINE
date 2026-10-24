"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AUDIT_STEPS, type AuditStepId } from "@/lib/audit-steps";
import { Spinner } from "@/components/ApiButton";

type State = "pending" | "running" | "done" | "error";

/** Corre la auditoría paso por paso, con una lista que se va palomeando. */
export function AuditRunner({ auditId, hasReport, autoStart = false, hasResearch = false }: { auditId: string; hasReport: boolean; autoStart?: boolean; hasResearch?: boolean }) {
  const router = useRouter();
  const [states, setStates] = useState<Record<string, State>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const started = useRef(false);

  async function run(from: AuditStepId = AUDIT_STEPS[0].id, only = false) {
    setRunning(true);
    const start = AUDIT_STEPS.findIndex((s) => s.id === from);
    const steps = only ? [AUDIT_STEPS[start]] : AUDIT_STEPS.slice(start);
    for (const s of steps) {
      setStates((p) => ({ ...p, [s.id]: "running" }));
      try {
        const res = await fetch(`/api/audits/${auditId}/${s.id}`, { method: "POST" });
        const j = await res.json().catch(() => ({ error: `Error ${res.status}` }));
        if (!res.ok) throw new Error(j.error ?? `Error ${res.status}`);
        setStates((p) => ({ ...p, [s.id]: "done" }));
        if (j.note) setNotes((p) => ({ ...p, [s.id]: j.note }));
      } catch (e) {
        setStates((p) => ({ ...p, [s.id]: "error" }));
        setNotes((p) => ({ ...p, [s.id]: (e as Error).message }));
        setRunning(false);
        router.refresh();
        return;
      }
    }
    setRunning(false);
    router.refresh();
  }

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      // quita ?correr=1 para que un refresh no la vuelva a correr
      window.history.replaceState(null, "", window.location.pathname);
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const failed = AUDIT_STEPS.find((s) => states[s.id] === "error");

  return (
    <section className="card overflow-hidden p-5" style={{ background: "linear-gradient(110deg, #fffded 0%, #ffffff 55%)", borderColor: "#fce762" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="display text-xs text-lavender">Auditoría</div>
          <div className="mt-1 text-lg font-semibold">{hasReport ? "Volver a correr la auditoría" : "Correr la auditoría"}</div>
          <p className="text-sm text-muted">Revisa Google y reseñas, su sitio, sus redes y su competencia, y escribe el reporte. Tarda de 4 a 8 minutos; no cierres esta pestaña.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {failed && !running ? (
            <button className="btn btn-ghost" onClick={() => run(failed.id)}>Reintentar desde aquí</button>
          ) : null}
          {hasResearch && !running ? (
            <button className="btn btn-ghost" onClick={() => run("write", true)} title="Usa lo que ya se investigó">Solo reescribir</button>
          ) : null}
          <button className="btn btn-primary" disabled={running} onClick={() => run()}>
            {running ? <Spinner /> : "✦"} {running ? "Trabajando..." : hasReport ? "Volver a correr" : "Correr auditoría"}
          </button>
        </div>
      </div>

      {Object.keys(states).length ? (
        <ol className="mt-5 space-y-1">
          {AUDIT_STEPS.map((s, i) => {
            const st = states[s.id] ?? "pending";
            return (
              <li key={s.id} className="flex items-start gap-3 rounded-xl px-2 py-1.5">
                <span
                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] ${
                    st === "done" ? "bg-ok/15 text-ok" : st === "error" ? "bg-bad/15 text-bad" : st === "running" ? "bg-purple/20 text-lavender" : "bg-line text-muted"
                  }`}
                >
                  {st === "done" ? "✓" : st === "error" ? "!" : st === "running" ? <Spinner /> : String(i + 1).padStart(2, "0")}
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
    </section>
  );
}
