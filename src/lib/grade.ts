import { execFileSync } from "node:child_process";

/**
 * Corrección automática de color por clip (para grabaciones de celular "mal" iluminadas):
 * - exposición: lleva el brillo promedio a un punto sano
 * - balance de blancos: quita tintes (amarillo de foco, azul de sombra) con "mundo gris"
 * - contraste y saturación: levanta imágenes lavadas
 * Todo suave y con límites, para que nunca se vea "procesado".
 */
import type { ClipGrade } from "./grade-types";
export type { ClipGrade };

export const NEUTRAL: ClipGrade = { r: 1, g: 1, b: 1, brightness: 1, contrast: 1, saturate: 1 };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Mide unos cuadros del tramo [start, end] del video y calcula la corrección. */
export function measureGrade(file: string, start: number, end: number): ClipGrade {
  const W = 48;
  const H = 85;
  const samples = 4;
  let sr = 0, sg = 0, sb = 0, n = 0;
  const lumas: number[] = [];
  let satSum = 0;
  for (let k = 0; k < samples; k++) {
    const t = start + ((end - start) * (k + 0.5)) / samples;
    let buf: Buffer;
    try {
      buf = execFileSync(
        "ffmpeg",
        ["-v", "error", "-ss", t.toFixed(2), "-i", file, "-frames:v", "1", "-vf", `scale=${W}:${H}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        { maxBuffer: 1024 * 1024 },
      );
    } catch {
      continue;
    }
    for (let i = 0; i + 2 < buf.length; i += 3) {
      const r = buf[i] / 255, g = buf[i + 1] / 255, b = buf[i + 2] / 255;
      sr += r; sg += g; sb += b; n++;
      lumas.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
      satSum += Math.max(r, g, b) - Math.min(r, g, b);
    }
  }
  if (!n) return NEUTRAL;
  const mr = sr / n, mg = sg / n, mb = sb / n;
  const gray = (mr + mg + mb) / 3;
  lumas.sort((a, b) => a - b);
  const p5 = lumas[Math.floor(lumas.length * 0.05)];
  const p95 = lumas[Math.floor(lumas.length * 0.95)];
  const mean = lumas.reduce((a, v) => a + v, 0) / lumas.length;
  const spread = p95 - p5;
  const sat = satSum / n;

  // balance de blancos: solo corregimos la mitad del tinte (la escena puede ser cálida a propósito)
  const wb = (m: number) => clamp(1 + ((gray / Math.max(m, 0.02)) - 1) * 0.5, 0.88, 1.14);
  // exposición: objetivo de brillo medio 0.46; corregimos el 60% de la diferencia
  const brightness = clamp(1 + (0.46 / Math.max(mean, 0.05) - 1) * 0.6, 0.85, 1.45);
  // contraste: si la imagen está lavada (poco rango), un poco más
  const contrast = clamp(spread < 0.45 ? 1 + (0.45 - spread) * 0.6 : 1, 1, 1.18);
  // saturación: levanta colores apagados, sin pasarse
  const saturate = clamp(sat < 0.18 ? 1 + (0.18 - sat) * 1.5 : 1, 1, 1.22);
  return { r: +wb(mr).toFixed(3), g: +wb(mg).toFixed(3), b: +wb(mb).toFixed(3), brightness: +brightness.toFixed(3), contrast: +contrast.toFixed(3), saturate: +saturate.toFixed(3) };
}

/** Corrección para cada clip (o una sola para todo el video). */
export function measureClipGrades(file: string, clips: { start: number; end: number }[]): ClipGrade[] {
  return clips.map((c) => measureGrade(file, c.start, c.end));
}

/** ¿La corrección cambia algo que se note? */
export const isNeutral = (g: ClipGrade) =>
  Math.abs(g.r - 1) < 0.02 && Math.abs(g.g - 1) < 0.02 && Math.abs(g.b - 1) < 0.02 && Math.abs(g.brightness - 1) < 0.03 && g.contrast < 1.02 && g.saturate < 1.02;
