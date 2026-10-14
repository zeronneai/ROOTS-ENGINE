import { z } from "zod";

/** Palabra transcrita, en segundos del video ORIGINAL. */
export const WordSchema = z.object({
  text: z.string(),
  start: z.number(),
  end: z.number(),
});
export type Word = z.infer<typeof WordSchema>;

export const GradeSchema = z.object({ r: z.number(), g: z.number(), b: z.number(), brightness: z.number(), contrast: z.number(), saturate: z.number() });

export const SfxKind = z.enum(["whoosh", "pop", "boom", "ding", "click"]);
export type SfxKind = z.infer<typeof SfxKind>;

/**
 * EDL (Edit Decision List): todas las decisiones de edición.
 * Todos los tiempos están en segundos del video ORIGINAL; el render
 * los mapea a la línea de tiempo final usando `segments`.
 */
export const EdlSchema = z.object({
  version: z.literal(1),
  fps: z.number(),
  width: z.number(),
  height: z.number(),
  sourceDuration: z.number(),
  /** partes del original que se quedan, en orden */
  segments: z.array(
    z.object({
      start: z.number(),
      end: z.number(),
      broll: z.boolean().optional(),
      /** velocidad de reproducción (0.7 = cámara lenta); la duración en el video final es (end - start) / rate */
      rate: z.number().optional(),
      /** corrección automática de color de este tramo */
      grade: GradeSchema.optional(),
    }),
  ),
  words: z.array(WordSchema.extend({ emphasis: z.boolean().optional() })),
  zooms: z.array(
    z.object({
      at: z.number(),
      duration: z.number(),
      scale: z.number().optional(),
      kind: z.enum(["punch", "smooth", "shake"]).optional(),
    }),
  ),
  emojis: z.array(
    z.object({
      at: z.number(),
      duration: z.number(),
      emoji: z.string(),
      x: z.number(), // 0..1
      y: z.number(), // 0..1
    }),
  ),
  sfx: z.array(z.object({ at: z.number(), kind: SfxKind })),
  hookTitle: z.object({ text: z.string(), duration: z.number() }).nullable(),
  /** textos animados (motion graphics) en momentos clave */
  callouts: z
    .array(z.object({ at: z.number(), duration: z.number(), text: z.string(), kind: z.enum(["keyword", "number"]) }))
    .optional(),
  /** imágenes del cliente que aparecen en el video (path = ruta en Storage) */
  images: z.array(z.object({ at: z.number(), duration: z.number(), path: z.string() })).optional(),
  /** llamado a la acción del cierre */
  cta: z.string().nullable().optional(),
  /** video híbrido: textos sobre las tomas sin voz (nombre de la toma, datos, frases) */
  overlays: z
    .array(z.object({ at: z.number(), duration: z.number(), kind: z.enum(["label", "spec", "highlight"]), text: z.string(), icon: z.string().optional(), value: z.string().optional() }))
    .optional(),
  /** datos extra para el cierre: precio, asesor, teléfono */
  endInfo: z.object({ price: z.string().nullable().optional(), agentName: z.string().nullable().optional(), agentPhone: z.string().nullable().optional() }).nullable().optional(),
  /** música de fondo (path = ruta en Storage, bucket brand) */
  music: z.object({ path: z.string(), title: z.string(), volume: z.number(), duck: z.number() }).nullable().optional(),
});
export type Edl = z.infer<typeof EdlSchema>;
