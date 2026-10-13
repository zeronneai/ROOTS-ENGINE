import type { StyleOverrides } from "./types";
import { AVAILABLE_FONTS } from "./fonts";
import { PRESETS } from "./presets";

/**
 * Los overrides vienen del navegador, de la base o de Claude y terminan en CSS del render.
 * Solo dejamos pasar campos conocidos con valores seguros.
 */
const HEX = /^#[0-9a-fA-F]{3,8}$/;
const FILTER = /^(\s*((contrast|saturate|brightness|sepia|grayscale)\(\d(\.\d{1,3})?\)|hue-rotate\(-?\d{1,3}deg\)))+\s*$/;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const oneOf = <T extends string>(v: unknown, list: readonly T[]) => (typeof v === "string" && list.includes(v as T) ? (v as T) : undefined);
const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);
const hex = (v: unknown) => (typeof v === "string" && HEX.test(v) ? v : undefined);
const num = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined;

function clean<T extends Record<string, unknown>>(o: T): T | undefined {
  const out = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
  return Object.keys(out).length ? out : undefined;
}

export function sanitizeOverrides(input: unknown): StyleOverrides {
  if (!isObj(input)) return {};
  const c = isObj(input.captions) ? input.captions : {};
  const e = isObj(input.emojis) ? input.emojis : {};
  const s = isObj(input.sfx) ? input.sfx : {};
  const g = isObj(input.grade) ? input.grade : {};
  const z = isObj(input.zoom) ? input.zoom : {};
  const o = isObj(input.overlays) ? input.overlays : {};

  const out: StyleOverrides = {
    energy: num(input.energy, -2, 2),
    presetId: oneOf(input.presetId, PRESETS.map((p) => p.id)),
    transition: oneOf(input.transition, ["none", "flash", "whip", "glitch", "fade"] as const),
    captions: clean({
      font: oneOf(c.font, AVAILABLE_FONTS),
      uppercase: bool(c.uppercase),
      color: hex(c.color),
      highlightColor: hex(c.highlightColor),
      position: oneOf(c.position, ["upper", "center", "lower"] as const),
      animation: oneOf(c.animation, ["pop", "bounce", "fade", "slide", "typewriter", "none"] as const),
      maxWordsPerPage: num(c.maxWordsPerPage, 1, 8),
    }),
    emojis: clean({
      density: oneOf(e.density, ["none", "low", "medium", "high"] as const),
      palette: Array.isArray(e.palette)
        ? e.palette.filter((x): x is string => typeof x === "string" && x.length <= 12).slice(0, 10)
        : undefined,
    }),
    sfx: clean({ enabled: bool(s.enabled), volume: num(s.volume, 0, 1) }),
    grade: clean({ filter: typeof g.filter === "string" && FILTER.test(g.filter) ? g.filter : undefined }),
    zoom: clean({ enabled: bool(z.enabled), intensity: num(z.intensity, 1, 1.4), everySeconds: num(z.everySeconds, 1, 15) }),
    overlays: clean({
      progressColor: hex(o.progressColor),
      progressBar: bool(o.progressBar),
      hookTitle: bool(o.hookTitle),
      handle: bool(o.handle),
    }),
  };
  return clean(out as Record<string, unknown>) ?? {};
}
