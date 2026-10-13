import type { Word } from "../lib/edl/types";

/** Transcripción de ejemplo (para el Studio de Remotion y la demo del portal). */
const SCRIPT =
  "Nadie te dice esto pero eh el 90% de los negocios en El Paso publican sin estrategia. " +
  "Hoy te enseño el secreto para conseguir más clientes con un solo video. " +
  "Mira, primero investigas qué le funciona a tu competencia. " +
  "Luego grabas tu versión, y nosotros lo editamos. Así de fácil.";

export function demoWords(): Word[] {
  const tokens = SCRIPT.split(/\s+/);
  const out: Word[] = [];
  let t = 0.3;
  for (const tok of tokens) {
    const len = 0.16 + Math.min(0.45, tok.length * 0.045);
    out.push({ text: tok, start: +t.toFixed(3), end: +(t + len).toFixed(3) });
    t += len + 0.06;
    if (/[.]$/.test(tok)) t += 0.9; // silencio entre frases (se corta)
  }
  return out;
}

export const DEMO_DURATION = 22;
