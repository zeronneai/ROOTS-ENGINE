"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadBrandImage } from "@/lib/upload-image";
import { deleteFlyerAction } from "@/app/flyer-actions";
import { Spinner } from "../ApiButton";
import { CATEGORY_LABEL, type AssetView } from "./BrandLibrary";

type Format = "post" | "story" | "square";
const FORMATS: { id: Format; label: string; ratio: string }[] = [
  { id: "post", label: "Post 4:5", ratio: "4 / 5" },
  { id: "story", label: "Historia 9:16", ratio: "9 / 16" },
  { id: "square", label: "Cuadrado 1:1", ratio: "1 / 1" },
];

export type FlyerView = {
  id: string;
  brief: string;
  format: Format;
  status: "generating" | "done" | "failed";
  error: string | null;
  url: string | null;
  downloadUrl: string | null;
  asset_ids: string[];
  extra_paths: string[];
  adjust: string | null;
};

type Payload = { brief: string; format: Format; assetIds: string[]; extraPaths: string[]; parentId?: string; adjust?: string };

/** Llama a la API y lleva el tiempo, la generación tarda de 20 a 60 segundos. */
function useGenerate(clientId: string) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);
  async function generate(key: string, payload: Payload) {
    setBusy(key);
    setSecs(0);
    setErr(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/flyers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({ error: "Se tardó demasiado. Intenta otra vez." }));
      if (!res.ok) throw new Error(j.error);
      router.refresh();
      return true;
    } catch (e) {
      setErr((e as Error).message);
      router.refresh();
      return false;
    } finally {
      setBusy(null);
    }
  }
  return { busy, secs, err, generate };
}

const stage = (s: number) => (s < 8 ? "La IA está pensando el diseño..." : s < 20 ? "Generando la imagen..." : "Dando los últimos detalles...");

export function FlyerStudio({ clientId, library, flyers }: { clientId: string; library: AssetView[]; flyers: FlyerView[] }) {
  const { busy, secs, err, generate } = useGenerate(clientId);
  // el borrador se guarda en el navegador: si la página se recarga (al subir fotos de estilo, por ejemplo) no se pierde
  const draftKey = `roots-flyer-draft-${clientId}`;
  const [brief, setBrief] = useState("");
  const [format, setFormat] = useState<Format>("post");
  const [picked, setPicked] = useState<string[]>([]);
  const [restored, setRestored] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect -- recuperar el borrador solo en el navegador, después de hidratar */
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (d) {
        if (typeof d.brief === "string") setBrief(d.brief);
        if (d.format === "post" || d.format === "story" || d.format === "square") setFormat(d.format);
        if (Array.isArray(d.picked)) setPicked(d.picked.filter((x: unknown) => typeof x === "string"));
      }
    } catch {
      // sin almacenamiento del navegador: seguimos sin borrador
    }
    setRestored(true);
  }, [draftKey]);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ brief, format, picked }));
    } catch {
      // ignorar
    }
  }, [draftKey, restored, brief, format, picked]);
  const [extras, setExtras] = useState<{ file: File; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [adjustText, setAdjustText] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  async function submit() {
    if (!brief.trim()) return;
    setUploading(true);
    let extraPaths: string[] = [];
    try {
      extraPaths = await Promise.all(extras.map((x) => uploadBrandImage(clientId, x.file, "flyer-fotos")));
    } finally {
      setUploading(false);
    }
    const ok = await generate("new", { brief, format, assetIds: picked, extraPaths });
    if (ok) {
      setExtras([]);
    }
  }

  return (
    <div className="space-y-8">
      <div className="card space-y-5 p-5">
        <div>
          <div className="label mb-1">¿Para qué es el flyer?</div>
          <textarea
            className="input"
            rows={3}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Ej: Noche de karaoke este viernes 9 PM con DJ Toño. 2x1 en cervezas hasta las 11. Entrada libre."
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormat(f.id)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${format === f.id ? "border-purple bg-purple text-white" : "border-line bg-white"}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {library.length ? (
          <div>
            <div className="label mb-2">De tu biblioteca</div>
            <div className="flex flex-wrap gap-2">
              {library.map((a) => {
                const on = a.pinned || picked.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    disabled={a.pinned}
                    onClick={() => setPicked(on ? picked.filter((x) => x !== a.id) : [...picked, a.id])}
                    className={`relative h-20 w-20 overflow-hidden rounded-xl border-2 bg-cream ${on ? "border-purple" : "border-transparent opacity-60"}`}
                    title={a.pinned ? "Siempre incluido" : a.label || CATEGORY_LABEL[a.category]}
                  >
                    {a.url ? <img src={a.url} alt="" className={`h-full w-full ${a.category === "logo" ? "object-contain p-1.5" : "object-cover"}`} /> : null}
                    {on ? <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-purple text-[11px] text-white">{a.pinned ? "📌" : "✓"}</span> : null}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-muted">Las que tienen 📌 van siempre. Toca las demás para incluirlas en este flyer.</p>
          </div>
        ) : null}

        <div>
          <div className="label mb-2">Imágenes solo para este flyer (opcional)</div>
          <div className="flex flex-wrap gap-2">
            {extras.map((x, i) => (
              <div key={x.url} className="relative h-20 w-20 overflow-hidden rounded-xl border border-line">
                <img src={x.url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setExtras(extras.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-white text-[11px] text-bad"
                  aria-label="Quitar"
                >
                  ✕
                </button>
              </div>
            ))}
            <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border border-dashed border-line text-center text-[11px] text-muted hover:border-purple">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []).map((file) => ({ file, url: URL.createObjectURL(file) }));
                  setExtras((cur) => [...cur, ...files].slice(0, 6));
                  e.target.value = "";
                }}
              />
              + Foto
            </label>
          </div>
          <p className="mt-1.5 text-xs text-muted">Ej: la foto del cantante de esa noche o del platillo de la promo.</p>
        </div>

        <button className="btn btn-primary w-full sm:w-auto" disabled={!brief.trim() || !!busy || uploading} onClick={submit}>
          {uploading ? <><Spinner /> Subiendo fotos...</> : busy === "new" ? <><Spinner /> {stage(secs)} {secs}s</> : "✦ Crear flyer"}
        </button>
        {err && busy === null ? <p className="text-sm text-bad">{err}</p> : null}
      </div>

      {flyers.length ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {flyers.map((f) => {
            const ratio = FORMATS.find((x) => x.id === f.format)?.ratio ?? "4 / 5";
            const mine = busy === f.id;
            return (
              <div key={f.id} className="card overflow-hidden">
                <div className="relative bg-cream" style={{ aspectRatio: ratio }}>
                  {f.url ? <img src={f.url} alt={f.brief} className="h-full w-full object-cover" /> : null}
                  {f.status === "generating" ? (
                    <div className="absolute inset-0 grid place-items-center text-sm text-muted"><span className="flex items-center gap-2"><Spinner /> Generando...</span></div>
                  ) : null}
                  {f.status === "failed" ? <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-bad">{f.error}</div> : null}
                  {mine ? (
                    <div className="absolute inset-0 grid place-items-center bg-white/80 text-sm"><span className="flex items-center gap-2"><Spinner /> {stage(secs)} {secs}s</span></div>
                  ) : null}
                </div>
                <div className="space-y-3 p-4">
                  <p className="line-clamp-2 text-sm">{f.adjust ? `Ajuste: ${f.adjust}` : f.brief}</p>
                  {adjusting === f.id ? (
                    <div className="space-y-2">
                      <textarea
                        className="input text-sm"
                        rows={2}
                        value={adjustText}
                        onChange={(e) => setAdjustText(e.target.value)}
                        placeholder="Ej: el título más grande, cambia el fondo a negro, quita el precio"
                      />
                      <div className="flex gap-2">
                        <button
                          className="btn btn-primary flex-1"
                          disabled={!adjustText.trim() || !!busy}
                          onClick={async () => {
                            const ok = await generate(f.id, {
                              brief: f.brief,
                              format: f.format,
                              assetIds: f.asset_ids,
                              extraPaths: f.extra_paths,
                              parentId: f.id,
                              adjust: adjustText,
                            });
                            if (ok) {
                              setAdjusting(null);
                              setAdjustText("");
                            }
                          }}
                        >
                          Aplicar cambios
                        </button>
                        <button className="btn btn-ghost" onClick={() => setAdjusting(null)}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {f.downloadUrl ? <a href={f.downloadUrl} className="btn btn-primary !px-3 !py-2 text-xs">Descargar</a> : null}
                      {f.status === "done" ? (
                        <button className="btn btn-ghost !px-3 !py-2 text-xs" disabled={!!busy} onClick={() => { setAdjusting(f.id); setAdjustText(""); }}>
                          Ajustar
                        </button>
                      ) : null}
                      <button
                        className="btn btn-ghost !px-3 !py-2 text-xs"
                        disabled={!!busy}
                        onClick={() => generate(f.id, { brief: f.brief, format: f.format, assetIds: f.asset_ids, extraPaths: f.extra_paths })}
                      >
                        Otra versión
                      </button>
                      <button
                        className="btn btn-ghost !px-3 !py-2 text-xs text-bad"
                        disabled={pending || !!busy}
                        onClick={() => start(async () => { await deleteFlyerAction(clientId, f.id); router.refresh(); })}
                      >
                        Borrar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
