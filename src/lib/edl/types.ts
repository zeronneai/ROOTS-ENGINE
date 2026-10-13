import { z } from "zod";

/** Palabra transcrita, en segundos del video ORIGINAL. */
export const WordSchema = z.object({
  text: z.string(),
  start: z.number(),
  end: z.number(),
});
export type Word = z.infer<typeof WordSchema>;

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
  segments: z.array(z.object({ start: z.number(), end: z.number() })),
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
});
export type Edl = z.infer<typeof EdlSchema>;
