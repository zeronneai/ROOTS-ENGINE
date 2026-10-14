"use client";

/**
 * Analiza un video de referencia en el navegador (sin subirlo completo):
 * qué tan rápido corta (cortes por minuto) y 8 cuadros para que la IA vea subtítulos, textos, colores y encuadre.
 */
export type ReferenceAnalysis = {
  frames: string[]; // JPEG en base64 (sin el prefijo data:)
  stats: { duration: number; cuts: number; cutsPerMinute: number; avgShotSeconds: number; vertical: boolean };
};

async function toJpeg(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<string> {
  const blob =
    "convertToBlob" in canvas
      ? await canvas.convertToBlob({ type: "image/jpeg", quality: 0.72 })
      : await new Promise<Blob>((ok, bad) => (canvas as HTMLCanvasElement).toBlob((b) => (b ? ok(b) : bad(new Error("cuadro"))), "image/jpeg", 0.72));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

function gray(canvas: HTMLCanvasElement | OffscreenCanvas) {
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const out = new Float32Array(data.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  return out;
}

export async function analyzeReference(file: File, onProgress?: (p: number) => void): Promise<ReferenceAnalysis> {
  const mb = await import("mediabunny");
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new Error("No encontré video en ese archivo");
  if (!(await track.canDecode())) throw new Error("Este navegador no puede leer ese video. Prueba desde Chrome.");
  const duration = await input.computeDuration();
  const span = Math.min(duration, 60);

  // 1. cortes: comparamos cuadros chiquitos 6 veces por segundo
  const small = new mb.CanvasSink(track, { width: 64, height: 112, fit: "fill" });
  const times = Array.from({ length: Math.max(2, Math.floor(span * 6)) }, (_, i) => i / 6);
  let prev: Float32Array | null = null;
  const diffs: number[] = [];
  let k = 0;
  for await (const w of small.canvasesAtTimestamps(times)) {
    k++;
    if (k % 20 === 0) onProgress?.((k / times.length) * 0.7);
    if (!w) continue;
    const g = gray(w.canvas);
    if (prev) {
      let s = 0;
      for (let i = 0; i < g.length; i++) s += Math.abs(g[i] - prev[i]);
      diffs.push(s / g.length);
    }
    prev = g;
  }
  const sorted = [...diffs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const threshold = Math.max(22, median * 3);
  let cuts = 0;
  for (let i = 0; i < diffs.length; i++) if (diffs[i] > threshold && (i === 0 || diffs[i - 1] <= threshold)) cuts++;

  // 2. 8 cuadros repartidos para que la IA vea el estilo
  const big = new mb.CanvasSink(track, { width: 432 });
  const at = Array.from({ length: 8 }, (_, i) => +(span * (0.06 + (i * 0.88) / 7)).toFixed(2));
  const frames: string[] = [];
  for await (const w of big.canvasesAtTimestamps(at)) {
    if (w) frames.push(await toJpeg(w.canvas));
    onProgress?.(0.7 + (frames.length / 8) * 0.3);
  }
  return {
    frames,
    stats: {
      duration: +duration.toFixed(1),
      cuts,
      cutsPerMinute: +((cuts / span) * 60).toFixed(1),
      avgShotSeconds: +(span / (cuts + 1)).toFixed(2),
      vertical: track.displayHeight >= track.displayWidth,
    },
  };
}
