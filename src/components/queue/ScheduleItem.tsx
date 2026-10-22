"use client";
import { useState, useTransition } from "react";
import { scheduleItemAction } from "@/app/queue-actions";

/** La agencia saca un video de la fila y le pone fecha a mano. */
export function ScheduleItem({ clientId, itemId }: { clientId: string; itemId: string }) {
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open) return <button type="button" className="text-xs underline" onClick={() => setOpen(true)}>Ponerle fecha</button>;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <input type="datetime-local" className="input !w-auto !py-1 text-xs" value={when} onChange={(e) => setWhen(e.target.value)} />
      <button
        type="button"
        className="btn btn-primary !py-1 text-xs"
        disabled={!when || pending}
        onClick={() =>
          start(async () => {
            setErr(null);
            try {
              await scheduleItemAction(clientId, itemId, { when: new Date(when).toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
              setOpen(false);
            } catch (e) {
              setErr((e as Error).message);
            }
          })
        }
      >
        {pending ? "Programando..." : "Programar en todas las redes"}
      </button>
      {err ? <span className="text-xs text-bad">{err}</span> : null}
    </span>
  );
}
