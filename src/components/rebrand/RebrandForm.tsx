"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "../ApiButton";
import { uploadBrandImage } from "@/lib/upload-image";

type Draft = { newName: string; suggestNames: boolean; why: string; keep: string; avoid: string; likes: string; competitors: string; tones: string[]; notes: string };
const empty = (): Draft => ({ newName: "", suggestNames: false, why: "", keep: "", avoid: "", likes: "", competitors: "", tones: ["premium"], notes: "" });

const TONES: [string, string][] = [
  ["premium", "✨ Premium"],
  ["calido", "🤍 Cálido"],
  ["atrevido", "🔥 Atrevido"],
  ["minimal", "◻️ Minimalista"],
  ["divertido", "😄 Divertido"],
  ["clasico", "🏛️ Clásico"],
];

/** Formulario del análisis de rebranding. Guarda borrador para no perder lo escrito. */
export function RebrandForm({ clientId, clientName }: { clientId: string; clientName: string }) {
  const key = `rebrand-draft-${clientId}`;
  const router = useRouter();
  const [d, setD] = useState<Draft>(empty);
  const [uploads, setUploads] = useState<{ path: string; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
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

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setErr(null);
    try {
      const added: { path: string; preview: string }[] = [];
      for (const f of Array.from(files).slice(0, 6 - uploads.length)) {
        const path = await uploadBrandImage(clientId, f, "rebrand-input");
        added.push({ path, preview: URL.createObjectURL(f) });
      }
      setUploads((u) => [...u, ...added]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/rebrands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...d, uploads: uploads.map((u) => u.path) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Error");
      try {
        localStorage.removeItem(key);
      } catch {
        // nada
      }
      router.push(`/c/${clientId}/rebranding/${j.result}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  const field = (k: keyof Draft, label: string, placeholder: string, rows = 2) => (
    <label className="block space-y-1">
      <span className="label">{label}</span>
      <textarea rows={rows} className="input" value={d[k] as string} onChange={(e) => set({ [k]: e.target.value } as Partial<Draft>)} placeholder={placeholder} />
    </label>
  );

  return (
    <div className="card space-y-5 p-5">
      <div>
        <div className="font-semibold">Nuevo análisis de rebranding</div>
        <p className="text-xs text-muted">
          La IA revisa la marca actual, la compara con marcas del mismo segmento y propone 3 direcciones completas: concepto, paleta, tipografía, logo y
          mockups. Usa el logo y las referencias de estilo que ya están en Flyers, más lo que subas aquí.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="label">Nombre nuevo (si ya está decidido)</span>
          <input className="input" value={d.newName} onChange={(e) => set({ newName: e.target.value })} placeholder={clientName} />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" checked={d.suggestNames} onChange={(e) => set({ suggestNames: e.target.checked })} />
          Que también proponga nombres
        </label>
      </div>
      {field("why", "¿Por qué el cambio?", "Ej: quieren verse más premium, el nombre los encasilla en un solo servicio, abrieron otra sucursal")}
      <div className="grid gap-3 sm:grid-cols-2">
        {field("keep", "Qué conservar (opcional)", "Ej: el color naranja, la silueta del logo, el apellido")}
        {field("avoid", "Qué evitar (opcional)", "Ej: flores, letras script, que parezca salón")}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("likes", "Marcas que les gustan (opcional)", "Ej: Aesop, Glossier, Soho House")}
        {field("competitors", "Competidores a comparar (opcional)", "Además de los que ya están en Competencia")}
      </div>

      <div className="space-y-2">
        <div className="label">Hacia dónde</div>
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

      <div className="space-y-2">
        <div className="label">Imágenes (opcional): logo actual, capturas de su página o redes, referencias</div>
        <div className="flex flex-wrap gap-2">
          {uploads.map((u) => (
            <div key={u.path} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.preview} alt="" className="h-20 w-20 rounded-lg object-cover" />
              <button type="button" className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-ink text-[10px] text-paper" onClick={() => setUploads(uploads.filter((x) => x.path !== u.path))} aria-label="Quitar">✕</button>
            </div>
          ))}
          {uploads.length < 6 ? (
            <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-lg border border-dashed border-line text-xs text-muted">
              {uploading ? <Spinner /> : "+ Subir"}
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
            </label>
          ) : null}
        </div>
      </div>

      {field("notes", "Algo más (opcional)", "Ej: la dueña quiere algo elegante pero que no espante a las clientas de siempre", 3)}

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={busy || uploading} onClick={submit}>
          {busy ? <><Spinner /> Analizando la marca (≈2 a 3 min)...</> : "Crear análisis"}
        </button>
        <button type="button" className="text-xs text-muted underline" onClick={() => set(empty())} disabled={busy}>Limpiar</button>
        {err ? <span className="text-xs text-bad">{err}</span> : null}
      </div>
    </div>
  );
}
