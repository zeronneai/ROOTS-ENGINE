import type { EditStyle, StyleOverrides } from "./types";
import { deepMerge } from "./merge";
import { getPreset, presetForNiche } from "./presets";
import { sanitizeOverrides } from "./sanitize";

const DENSITIES = ["none", "low", "medium", "high"] as const;

export type ResolveInput = {
  /** preset elegido explícitamente (si no, se toma el del nicho) */
  presetId?: string | null;
  niche?: string | null;
  /** color de marca del cliente: pinta palabra clave y barra de progreso */
  brandAccent?: string | null;
  /** capas en orden: cliente → mood → edición puntual */
  layers?: Array<StyleOverrides | null | undefined>;
};

/**
 * Preset del nicho → color de marca → overrides del cliente → mood activo → ajuste puntual.
 * Así cada cliente parte de lo que funciona en su giro pero se ve como SU marca.
 */
export function resolveStyle({ presetId, niche, brandAccent: rawAccent, layers: rawLayers = [] }: ResolveInput): EditStyle {
  const layers = rawLayers.map((l) => (l ? sanitizeOverrides(l) : null));
  const brandAccent = rawAccent && /^#[0-9a-fA-F]{3,8}$/.test(rawAccent) ? rawAccent : null;
  // la última capa que pida otro preset gana
  const layerPreset = [...layers].reverse().find((l) => l?.presetId)?.presetId;
  const chosen = layerPreset ?? presetId;
  const base = chosen ? getPreset(chosen) : presetForNiche(niche);
  let style = base;

  if (brandAccent && base.captions.highlightMode !== "none") {
    style = deepMerge(style, {
      captions: { highlightColor: brandAccent },
      overlays: { progressColor: brandAccent },
    });
  }

  let energy = 0;
  for (const layer of layers) {
    if (!layer) continue;
    const { energy: e, presetId: _p, ...rest } = layer;
    void _p;
    if (typeof e === "number") energy = e;
    style = deepMerge(style, rest);
  }

  return applyEnergy(style, energy);
}

/** -2 (muy calmado) … +2 (muy intenso) */
export function applyEnergy(style: EditStyle, energy: number): EditStyle {
  if (!energy) return style;
  const e = Math.max(-2, Math.min(2, energy));
  const f = 1 + 0.22 * e;
  const di = DENSITIES.indexOf(style.emojis.density);
  const nextDensity =
    di === 0 ? "none" : DENSITIES[Math.max(1, Math.min(3, di + Math.round(e / 1.5)))];

  return deepMerge(style, {
    zoom: {
      everySeconds: +(style.zoom.everySeconds / f).toFixed(2),
      intensity: +(1 + (style.zoom.intensity - 1) * f).toFixed(3),
    },
    emojis: { density: nextDensity },
    pacing: { cutSilencesOverMs: Math.round(style.pacing.cutSilencesOverMs / f) },
  });
}

export const ENERGY_LABELS: Record<string, string> = {
  "-2": "Muy calmado",
  "-1": "Calmado",
  "0": "Normal",
  "1": "Intenso",
  "2": "Muy intenso",
};
