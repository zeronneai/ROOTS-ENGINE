import { z } from "zod";

/**
 * EditStyle = la "receta" visual del auto-editor.
 * Cada nicho tiene un preset (presets.ts); el cliente encima puede tener overrides
 * (colores, fuente, energía) y un mood activo. resolveStyle() los combina.
 */

export const CaptionAnimation = z.enum(["pop", "bounce", "fade", "slide", "typewriter", "none"]);
export const HighlightMode = z.enum(["color", "box", "scale", "underline", "none"]);
export const CaptionPosition = z.enum(["upper", "center", "lower"]);
export const ZoomStyle = z.enum(["punch", "smooth", "shake"]);
export const EmojiAnimation = z.enum(["pop", "float", "spin", "drop"]);
export const Transition = z.enum(["none", "flash", "whip", "glitch", "fade"]);
export const Density = z.enum(["none", "low", "medium", "high"]);
export const CalloutStyle = z.enum(["sticker", "bar", "glow", "minimal", "3d"]);

export const EditStyleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  niches: z.array(z.string()),

  captions: z.object({
    enabled: z.boolean(),
    font: z.string(), // nombre de Google Font
    weight: z.number(),
    sizePx: z.number(), // a 1080 de ancho
    uppercase: z.boolean(),
    color: z.string(),
    highlightColor: z.string(),
    highlightMode: HighlightMode,
    strokeColor: z.string(),
    strokeWidth: z.number(),
    shadow: z.boolean(),
    background: z.enum(["none", "pill", "bar"]),
    backgroundColor: z.string(),
    position: CaptionPosition,
    maxWordsPerPage: z.number(),
    animation: CaptionAnimation,
    letterSpacing: z.number(),
  }),

  zoom: z.object({
    enabled: z.boolean(),
    style: ZoomStyle,
    intensity: z.number(), // 1.05 sutil, 1.35 agresivo
    everySeconds: z.number(), // frecuencia promedio de punch-ins
    onEmphasis: z.boolean(), // zoom en palabras clave
    jumpCutAlternate: z.boolean(), // alternar encuadre en cada corte
  }),

  emojis: z.object({
    density: Density,
    sizePx: z.number(),
    animation: EmojiAnimation,
    palette: z.array(z.string()), // emojis preferidos del nicho
  }),

  sfx: z.object({
    enabled: z.boolean(),
    volume: z.number(),
    onZoom: z.enum(["none", "whoosh", "pop", "boom"]),
    onEmoji: z.enum(["none", "pop", "ding", "click"]),
    onCut: z.enum(["none", "whoosh", "click"]),
  }),

  grade: z.object({
    filter: z.string(), // CSS filter
    vignette: z.number(), // 0..1
    grain: z.number(), // 0..1
    tint: z.string(), // rgba overlay
  }),

  pacing: z.object({
    cutSilencesOverMs: z.number(),
    keepPaddingMs: z.number(),
    removeFillers: z.boolean(),
  }),

  overlays: z.object({
    progressBar: z.boolean(),
    progressColor: z.string(),
    hookTitle: z.boolean(), // título grande en los primeros segundos
    hookTitleFont: z.string(),
    hookTitleColor: z.string(),
    hookTitleBg: z.string(),
    handle: z.boolean(), // @usuario en esquina
  }),

  /** Motion graphics: textos animados, destellos, lower third y cierre con llamado a la acción. */
  motion: z.object({
    level: Density, // cuántos textos animados (callouts) por video
    calloutStyle: CalloutStyle, // sticker = urbano, bar = corporativo, glow = lujo/noche, minimal = editorial, 3d = letras con volumen
    bursts: z.boolean(), // destellos detrás de emojis y líneas de impacto en zooms fuertes
    lowerThird: z.boolean(), // nombre del negocio entrando abajo al inicio
    endCard: z.boolean(), // cierre con llamado a la acción y @usuario
  }),

  /** Música de fondo: volumen base y cuánto baja cuando la persona habla (0.3 = baja al 30%) */
  music: z.object({
    enabled: z.boolean(),
    volume: z.number(), // 0..1
    duck: z.number(), // 0..1
  }),

  transition: Transition,
});

export type EditStyle = z.infer<typeof EditStyleSchema>;

/** Overrides parciales profundos (lo que guarda el cliente o un mood). */
export type StyleOverrides = {
  [K in keyof EditStyle]?: EditStyle[K] extends object
    ? EditStyle[K] extends unknown[]
      ? EditStyle[K]
      : Partial<EditStyle[K]>
    : EditStyle[K];
} & {
  /** -2 muy calmado ... +2 muy intenso. Escala zooms, emojis y ritmo. */
  energy?: number;
  /** cambia el preset base (ej. un mood "Navidad" que usa otro estilo) */
  presetId?: string;
};
