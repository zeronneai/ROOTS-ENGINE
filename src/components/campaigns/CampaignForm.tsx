"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "../ApiButton";

type Ev = { date: string; name: string; details: string };
type Draft = { name: string; goal: string; dateFrom: string; dateTo: string; events: Ev[]; tones: string[]; count: number; notes: string; canRecord: string };

const TONES: [string, string][] = [
  ["comedia", "😂 Comedia"],
  ["viral", "🔥 Viral / trend"],
  ["creativo", "🎬 Creativo"],
  ["venta", "💸 Venta / promo"],
  ["detras", "🎥 Detrás de cámaras"],
  ["educativo", "💡 Tips"],
];

const today = () => new Date().toISOString().slice(0, 10);
const empty = (): Draft => ({ name: "", goal: "", dateFrom: today(), dateTo: "", events: [{ date: "", name: "", details: "" }], tones: ["comedia", "viral", "creativo"], count: 6, notes: "", canRecord: "" });

/** Formulario de campaña: fechas, eventos y tono. Guarda borrador para no perder lo escrito. */
export function CampaignForm({ clientId, suggestions }: { clientId: string; suggestions: { date: string; name: string }[] }) {
  const key = `campaign-draft-${clientId}`;
  const router = useRouter();
  const [d, setD] = useState<Draft>(empty);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) setD({ ...empty(), ...JSON.parse(saved) });
    } catch {
      // sin borrador
    }
  }, [key]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const set = (patch: Partial<Draft>) =>
    setD((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // sin almacenamiento
      }
      return next;
    });
  const setEv = (i: number, patch: Partial<Ev>) => set({ events: d.events.map((e, k) => (k === i ? { ...e, ...patch } : e)) });
  const addSuggestion = (s: { date: string; name: string }) => {
    const events = d.events.filter((e) => e.name || e.date);
    if (events.some((e) => e.date === s.date && e.name === s.name)) return;
    set({ events: [...events, { date: s.date, name: s.name, details: "" }].sort((a, b) => a.date.localeCompare(b.date)) });
  };

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...d, events: d.events.filter((e) => e.name.trim()) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Error");
      try {
        localStorage.removeItem(key);
      } catch {
        // nada
      }
      router.push(`/c/${clientId}/campanas/${j.result}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-5 p-5">
      <div>
        <div className="font-semibold">Nueva campaña</div>
        <p className="text-xs text-muted">Dinos qué viene (eventos, fechas, lanzamientos) y la IA arma el análisis y las ideas de contenido para esas fechas.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 sm:col-span-2">
          <span className="label">Nombre</span>
          <input className="input" value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ej: Halloween y Feria de noviembre" />
        </label>
        <label className="block space-y-1">
          <span className="label">Desde</span>
          <input type="date" className="input" value={d.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} />
        </label>
        <label className="block space-y-1">
          <span className="label">Hasta</span>
          <input type="date" className="input" value={d.dateTo} onChange={(e) => set({ dateTo: e.target.value })} />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className="label">Objetivo (opcional)</span>
          <input className="input" value={d.goal} onChange={(e) => set({ goal: e.target.value })} placeholder="Ej: que vengan al pop up, vender sombreros personalizados, crecer seguidores" />
        </label>
      </div>

      <div className="space-y-2">
        <div className="label">Eventos y fechas</div>
        {d.events.map((e, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[150px_1fr_auto]">
            <input type="date" className="input" value={e.date} onChange={(x) => setEv(i, { date: x.target.value })} />
            <input className="input" value={e.name} onChange={(x) => setEv(i, { name: x.target.value })} placeholder="Ej: Pop up en el rodeo" />
            <button type="button" className="btn btn-ghost !px-3" aria-label="Quitar" onClick={() => set({ events: d.events.filter((_, k) => k !== i) })}>✕</button>
            <textarea rows={2} className="input sm:col-span-3" value={e.details} onChange={(x) => setEv(i, { details: x.target.value })} placeholder="Detalles: dónde es, qué van a llevar, promos, quién va, qué lo hace especial" />
          </div>
        ))}
        <button type="button" className="btn btn-ghost" onClick={() => set({ events: [...d.events, { date: "", name: "", details: "" }] })}>+ Agregar evento</button>
        {suggestions.length ? (
          <div className="pt-1">
            <div className="text-xs text-muted">Fechas especiales que vienen (toca para agregar):</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button key={s.date + s.name} type="button" className="chip hover:bg-sun/60" onClick={() => addSuggestion(s)}>
                  {new Date(`${s.date}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" })} · {s.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="label">Tono del contenido</div>
        <div className="flex flex-wrap gap-2">
          {TONES.map(([id, label]) => {
            const on = d.tones.includes(id);
            return (
              <button key={id} type="button" onClick={() => set({ tones: on ? d.tones.filter((t) => t !== id) : [...d.tones, id] })} className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-purple glow font-semibold" : "border-line text-muted"}`}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <label className="block space-y-1">
          <span className="label">Cuántas ideas</span>
          <input type="number" min={2} max={20} className="input" value={d.count} onChange={(e) => set({ count: Number(e.target.value) })} />
        </label>
        <label className="block space-y-1">
          <span className="label">Con qué contamos para grabar (opcional)</span>
          <input className="input" value={d.canRecord} onChange={(e) => set({ canRecord: e.target.value })} placeholder="Ej: 2 personas del equipo, la tienda, un caballo, clientas que se animan a salir" />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="label">Algo más (opcional)</span>
        <textarea rows={3} className="input" value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Ej: queremos algo tipo sketch con la clienta indecisa, nada de bailes, que salga el nuevo sombrero de temporada" />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={busy || !d.name.trim()} onClick={submit}>
          {busy ? <><Spinner /> Pensando ideas (≈1 a 2 min)...</> : "Crear campaña"}
        </button>
        <button type="button" className="text-xs text-muted underline" onClick={() => set(empty())} disabled={busy}>Limpiar</button>
        {err ? <span className="text-xs text-bad">{err}</span> : null}
      </div>
    </div>
  );
}
