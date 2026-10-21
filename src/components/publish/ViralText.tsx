"use client";
import { useEffect, useRef, useState } from "react";
import { Spinner } from "../ApiButton";
import { drawOverlay, ensureFont, OVERLAY_FONTS, OVERLAY_STYLES, type OverlayOpts } from "@/lib/overlay-text";

export const DEFAULT_OVERLAY: OverlayOpts = { text: "", font: "Montserrat", style: "tiktok", position: "top", size: "m", seconds: null };

/** Texto viral: 3 sugerencias de la IA, fuente, estilo, posición y vista previa en vivo sobre el video. */
export function ViralText({
  src,
  kind,
  value,
  onChange,
  suggest,
}: {
  src: string | null;
  kind: "video" | "image";
  value: OverlayOpts;
  onChange: (v: OverlayOpts) => void;
  suggest: () => Promise<{ hooks: { text: string; angle: string }[]; brandColor: string | null }>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hooks, setHooks] = useState<{ text: string; angle: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fontReady, setFontReady] = useState(0);
  const set = (p: Partial<OverlayOpts>) => onChange({ ...value, ...p });

  useEffect(() => {
    let alive = true;
    ensureFont(value.font).then(() => alive && setFontReady((n) => n + 1));
    return () => {
      alive = false;
    };
  }, [value.font]);

  // dibuja el texto encima del video en cada cuadro, igual que en el video final
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const c = canvasRef.current;
      const v = videoRef.current;
      const im = imgRef.current;
      const w = kind === "image" ? im?.naturalWidth : v?.videoWidth;
      const h = kind === "image" ? im?.naturalHeight : v?.videoHeight;
      if (c && w && h) {
        if (c.width !== w || c.height !== h) {
          c.width = w;
          c.height = h;
        }
        const ctx = c.getContext("2d")!;
        ctx.clearRect(0, 0, w, h);
        drawOverlay(ctx, w, h, value, kind === "image" ? 1 : v!.currentTime);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, kind, fontReady]);

  async function ask() {
    setErr(null);
    setBusy(true);
    try {
      const out = await suggest();
      setHooks(out.hooks);
      if (out.hooks[0] && !value.text.trim()) set({ text: out.hooks[0].text, brandColor: out.brandColor });
      else if (out.brandColor) set({ brandColor: out.brandColor });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs ${on ? "border-purple glow font-semibold" : "border-line text-muted"}`;

  return (
    <div className="space-y-3 rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label">Texto viral encima del video</span>
        <button type="button" className="btn btn-ghost text-sm" disabled={busy || !src} onClick={ask}>
          {busy ? <><Spinner /> Viendo el video...</> : hooks.length ? "↻ Otras 3" : "✨ Sugerir 3 textos"}
        </button>
      </div>
      {err ? <p className="text-xs text-bad">{err}</p> : null}
      {hooks.length ? (
        <div className="grid gap-2">
          {hooks.map((h, i) => (
            <button key={i} type="button" onClick={() => set({ text: value.text === h.text ? "" : h.text })} className={`rounded-xl border px-3 py-2 text-left text-sm ${value.text === h.text ? "border-purple glow" : "border-line"}`}>
              <span className="font-semibold">{h.text}</span> <span className="text-xs text-muted">· {h.angle}</span>
            </button>
          ))}
        </div>
      ) : null}
      {value.text.trim() ? (
        <div className="flex justify-end">
          <button type="button" className="text-xs text-muted underline" onClick={() => set({ text: "" })}>✕ Quitar texto (publicar el video tal cual)</button>
        </div>
      ) : null}
      <textarea rows={2} className="input" value={value.text} onChange={(e) => set({ text: e.target.value })} placeholder="Opcional. Escribe tu texto o pide sugerencias. Si lo dejas vacío, el video va sin texto." />

      {value.text.trim() ? (
        <>
          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <div className="relative mx-auto w-full max-w-[220px] overflow-hidden rounded-xl bg-ink">
              {src ? (
                kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img ref={imgRef} src={src} alt="" className="block w-full" />
                ) : (
                  <video ref={videoRef} src={src} className="block w-full" muted loop autoPlay playsInline controls />
                )
              ) : (
                <div className="aspect-[9/16]" />
              )}
              <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
            </div>
            <div className="space-y-3 text-sm">
              <label className="block space-y-1">
                <span className="label">Fuente</span>
                <select className="input" value={value.font} onChange={(e) => set({ font: e.target.value })}>
                  {OVERLAY_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <div className="space-y-1">
                <span className="label">Estilo</span>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(OVERLAY_STYLES) as OverlayOpts["style"][]).map((k) => (
                    <button key={k} type="button" className={chip(value.style === k)} onClick={() => set({ style: k })}>{OVERLAY_STYLES[k].label}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <span className="label">Posición</span>
                <div className="flex flex-wrap gap-1.5">
                  {([["top", "Arriba"], ["center", "Centro"], ["bottom", "Abajo"]] as const).map(([k, l]) => (
                    <button key={k} type="button" className={chip(value.position === k)} onClick={() => set({ position: k })}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <span className="label">Tamaño</span>
                <div className="flex flex-wrap gap-1.5">
                  {([["s", "Chico"], ["m", "Mediano"], ["l", "Grande"]] as const).map(([k, l]) => (
                    <button key={k} type="button" className={chip(value.size === k)} onClick={() => set({ size: k })}>{l}</button>
                  ))}
                </div>
              </div>
              {kind === "video" ? (
                <div className="space-y-1">
                  <span className="label">Cuánto dura</span>
                  <div className="flex flex-wrap gap-1.5">
                    {([[null, "Todo el video"], [3, "3 segundos"], [5, "5 segundos"]] as const).map(([k, l]) => (
                      <button key={l} type="button" className={chip(value.seconds === k)} onClick={() => set({ seconds: k })}>{l}</button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <p className="text-xs text-muted">Así exactamente se va a publicar. El texto se pega al video en tu navegador cuando le das Programar.</p>
        </>
      ) : null}
    </div>
  );
}
