"use client";
import { useState, useTransition } from "react";
import { Spinner } from "../ApiButton";
import { createSlotAction } from "@/app/publish-actions";

type Account = { id: string; platform: string; name: string };
const DAYS = ["D", "L", "M", "M", "J", "V", "S"];
const NET: Record<string, string> = { instagram: "📸 Instagram", tiktok: "🎵 TikTok", facebook: "👍 Facebook", youtube: "▶️ YouTube" };

/** Regla fija: ciertos días y hora, publica lo más nuevo de una carpeta de Dropbox. */
export function SlotForm({ clientId, accounts }: { clientId: string; accounts: Account[] }) {
  const [name, setName] = useState("Reels de la semana");
  const [days, setDays] = useState<number[]>([2, 4]);
  const [time, setTime] = useState("10:00");
  const [picked, setPicked] = useState<string[]>(accounts.map((a) => a.id));
  const [source, setSource] = useState<"queue" | "dropbox">("queue");
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [deadline, setDeadline] = useState(3);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function submit() {
    setErr(null);
    setOk(false);
    start(async () => {
      try {
        await createSlotAction(clientId, { name, weekdays: days, time, timezone: tz, accountIds: picked, source, dropboxUrl: url, caption, deadlineHours: deadline });
        setOk(true);
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  }

  return (
    <div className="card space-y-4 p-5">
      <div>
        <div className="font-semibold">Calendario fijo</div>
        <p className="text-xs text-muted">
          Ej: martes y jueves a las 10:00. Cada vez sale el siguiente video aprobado de la fila (o lo más nuevo de una carpeta de Dropbox), sin que nadie le pique.
        </p>
      </div>
      <label className="block space-y-1">
        <span className="label">Nombre</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="space-y-1">
        <span className="label">Días</span>
        <div className="flex gap-1.5">
          {DAYS.map((d, i) => {
            const on = days.includes(i);
            return (
              <button key={i} type="button" onClick={() => setDays(on ? days.filter((x) => x !== i) : [...days, i])} className={`h-10 w-10 rounded-full border text-sm font-semibold ${on ? "border-purple bg-purple text-white" : "border-line text-muted"}`}>
                {d}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="label">Hora ({tz})</span>
          <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="label">{source === "queue" ? "Debe haber uno aprobado" : "El video debe estar listo"}</span>
          <select className="input" value={deadline} onChange={(e) => setDeadline(Number(e.target.value))}>
            {[1, 3, 6, 12, 24, 48].map((h) => <option key={h} value={h}>{h} h antes</option>)}
          </select>
        </label>
      </div>
      <div className="space-y-1">
        <span className="label">Cuentas</span>
        <div className="flex flex-wrap gap-2">
          {accounts.map((a) => {
            const on = picked.includes(a.id);
            return (
              <button key={a.id} type="button" onClick={() => setPicked(on ? picked.filter((x) => x !== a.id) : [...picked, a.id])} className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-purple glow font-semibold" : "border-line text-muted"}`}>
                {NET[a.platform] ?? a.platform} · {a.name}
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-1">
        <span className="label">De dónde sale cada video</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {([["queue", "Fila de aprobados", "El siguiente que aprobó el cliente en Aprobar videos"], ["dropbox", "Carpeta de Dropbox", "Lo más nuevo de la carpeta, sin aprobación"]] as const).map(([k, l, h]) => (
            <button key={k} type="button" onClick={() => setSource(k)} className={`rounded-xl border px-3 py-2 text-left text-xs ${source === k ? "border-purple glow" : "border-line"}`}>
              <div className="text-sm font-semibold">{l}</div>
              <div className="text-muted">{h}</div>
            </button>
          ))}
        </div>
      </div>
      {source === "dropbox" ? (
        <>
          <label className="block space-y-1">
            <span className="label">Carpeta de Dropbox</span>
            <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.dropbox.com/scl/fo/..." />
          </label>
          <label className="block space-y-1">
            <span className="label">Copy por defecto (si no hay .txt)</span>
            <textarea rows={3} className="input" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Déjalo vacío y la IA escribe el copy de cada video viéndolo" />
          </label>
        </>
      ) : (
        <p className="text-xs text-muted">El copy es el que quedó aprobado en cada video. Si a la hora límite no hay ninguno aprobado, te sale el aviso.</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={pending} onClick={submit}>{pending ? <><Spinner /> Guardando...</> : "Crear calendario"}</button>
        {ok ? <span className="text-xs text-ok">Listo, ya quedaron programados los próximos 7 días.</span> : null}
        {err ? <span className="text-xs text-bad">{err}</span> : null}
      </div>
    </div>
  );
}
