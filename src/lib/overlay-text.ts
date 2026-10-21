"use client";

/**
 * Texto viral encima del video. La misma función dibuja la vista previa y el video final,
 * así lo que ves es exactamente lo que se publica. Todo corre en el navegador (sin worker).
 */
import { FONT_FILES } from "./styles/fonts";
import { MAX_UPLOAD_MB } from "./compress-video";

export const OVERLAY_FONTS = ["Montserrat", "Anton", "Bebas Neue", "Luckiest Guy", "Bungee", "Inter", "Nunito", "Playfair Display", "Cormorant Garamond", "Rye", "Josefin Sans"] as const;

export const OVERLAY_STYLES = {
  tiktok: { label: "Caja blanca" },
  sombra: { label: "Blanco con sombra" },
  contorno: { label: "Contorno negro" },
  amarillo: { label: "Caja amarilla" },
  negro: { label: "Caja negra" },
  marca: { label: "Color de la marca" },
} as const;

export type OverlayOpts = {
  text: string;
  font: string;
  style: keyof typeof OVERLAY_STYLES;
  position: "top" | "center" | "bottom";
  size: "s" | "m" | "l";
  /** null = todo el video; número = solo los primeros segundos */
  seconds: number | null;
  brandColor?: string | null;
};

const loaded = new Map<string, Promise<void>>();

/** Carga la fuente (las mismas que usa el motor para editar). */
export function ensureFont(family: string) {
  const def = FONT_FILES[family];
  if (!def) return Promise.resolve();
  if (!loaded.has(family)) {
    const w = Math.max(...def.weights);
    const p = Promise.all(
      ["latin", "latin-ext"].map(async (subset) => {
        const face = new FontFace(family, `url(/fonts/${def.slug}-${subset}-${w}.woff2) format("woff2")`, { weight: String(w) });
        try {
          await face.load();
          document.fonts.add(face);
        } catch {
          // si falta un subset no pasa nada
        }
      }),
    ).then(() => undefined);
    loaded.set(family, p);
  }
  return loaded.get(family)!;
}

const weightOf = (family: string) => Math.max(...(FONT_FILES[family]?.weights ?? [700]));
const UPPER = new Set(["Anton", "Bebas Neue", "Bungee", "Luckiest Guy"]);

function wrap(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, text: string, max: number) {
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > max && line) {
        out.push(line);
        line = word;
      } else line = test;
    }
    if (line) out.push(line);
  }
  return out;
}

function roundRect(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Dibuja el texto en un canvas del tamaño del video. t = segundo actual del video. */
export function drawOverlay(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, w: number, h: number, o: OverlayOpts, t: number) {
  const text = (UPPER.has(o.font) ? o.text.toUpperCase() : o.text).trim();
  if (!text) return;
  if (o.seconds != null && t > o.seconds) return;
  // aparece suave en los primeros 0.25 s y se va suave al final si es temporal
  let alpha = Math.min(1, Math.max(0, t / 0.25));
  if (o.seconds != null) alpha = Math.min(alpha, Math.max(0, (o.seconds - t) / 0.25));
  if (alpha <= 0) return;

  const base = Math.min(w, h * 0.5625); // se ve igual en 9:16, 4:5 o 16:9
  const fs = Math.round(base * { s: 0.058, m: 0.074, l: 0.094 }[o.size]);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${weightOf(o.font)} ${fs}px "${o.font}", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = wrap(ctx, text, w * 0.82);
  const lh = fs * 1.22;
  const block = lh * lines.length;
  const cy = o.position === "top" ? h * 0.17 + block / 2 : o.position === "center" ? h * 0.45 : h * 0.72 - block / 2;
  const box = o.style === "tiktok" || o.style === "amarillo" || o.style === "negro" || o.style === "marca";
  const bg = { tiktok: "#ffffff", amarillo: "#FFD60A", negro: "rgba(0,0,0,0.82)", marca: o.brandColor || "#6D28D9" } as Record<string, string>;
  const fg = o.style === "negro" || o.style === "marca" ? "#ffffff" : box ? "#111111" : "#ffffff";

  lines.forEach((line, i) => {
    const y = cy - block / 2 + lh * (i + 0.5);
    if (box) {
      const tw = ctx.measureText(line).width;
      const px = fs * 0.42;
      ctx.fillStyle = bg[o.style];
      roundRect(ctx, w / 2 - tw / 2 - px, y - lh / 2 - fs * 0.02, tw + px * 2, lh + fs * 0.04, fs * 0.22);
      ctx.fill();
    }
    if (o.style === "sombra") {
      ctx.shadowColor = "rgba(0,0,0,0.75)";
      ctx.shadowBlur = fs * 0.35;
      ctx.shadowOffsetY = fs * 0.06;
    }
    if (o.style === "contorno") {
      ctx.lineJoin = "round";
      ctx.lineWidth = fs * 0.16;
      ctx.strokeStyle = "#000000";
      ctx.strokeText(line, w / 2, y);
    }
    ctx.fillStyle = fg;
    ctx.fillText(line, w / 2, y);
    ctx.shadowColor = "transparent";
  });
  ctx.restore();
}

/** Quema el texto en el video (y lo deja de 1080 del lado corto, con el peso justo para subirlo). */
export async function burnText(file: File, o: OverlayOpts, onProgress?: (p: number) => void): Promise<File> {
  await ensureFont(o.font);
  const mb = await import("mediabunny");
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  const duration = await input.computeDuration();
  const track = await input.getPrimaryVideoTrack();
  if (!track || !(duration > 0)) throw new Error("No se pudo leer el video");

  const short = Math.min(track.displayWidth, track.displayHeight);
  const k = short > 1080 ? 1080 / short : 1;
  const W = Math.round((track.displayWidth * k) / 2) * 2;
  const H = Math.round((track.displayHeight * k) / 2) * 2;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const limit = MAX_UPLOAD_MB * 1e6 * 0.85;
  const videoBps = Math.max(1_500_000, Math.min(10_000_000, (limit * 8) / duration - 160_000));
  const avc = await mb.canEncodeVideo("avc", { width: W, height: H }).catch(() => false);
  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }), target: new mb.BufferTarget() });
  const conversion = await mb.Conversion.init({
    input,
    output,
    video: {
      width: W,
      height: H,
      fit: "fill",
      allowTransformationMetadata: false,
      forceTranscode: true,
      quality: new mb.Quality({ bitrate: Math.round(videoBps) }),
      ...(avc ? { codec: "avc" as const } : {}),
      process: (sample) => {
        ctx.clearRect(0, 0, W, H);
        sample.draw(ctx, 0, 0, W, H);
        drawOverlay(ctx, W, H, o, sample.timestamp);
        return canvas;
      },
      processedWidth: W,
      processedHeight: H,
    },
    showWarnings: false,
  });
  if (!conversion.isValid) throw new Error("Este navegador no puede ponerle texto al video. Prueba desde Chrome en la compu.");
  conversion.onProgress = (p) => onProgress?.(p);
  await conversion.execute();
  const buf = (output.target as InstanceType<typeof mb.BufferTarget>).buffer;
  if (!buf) throw new Error("No se pudo crear el video con texto");
  return new File([buf], file.name.replace(/\.[^.]+$/, "") + "-texto.mp4", { type: "video/mp4" });
}

/** Lo mismo para una foto. */
export async function burnTextImage(file: File, o: OverlayOpts): Promise<File> {
  await ensureFont(o.font);
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    drawOverlay(ctx, c.width, c.height, o, 1);
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.92));
    if (!blob) throw new Error("No se pudo crear la imagen con texto");
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + "-texto.jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}
