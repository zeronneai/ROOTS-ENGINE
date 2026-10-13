import { z } from "zod";
import { AGENCY_CONTEXT, json, structured } from "./claude";
import type { Direction } from "../edl/build";
import { heuristicDirection } from "../edl/build";
import type { Word } from "../edl/types";
import type { EditStyle } from "../styles/types";
import type { BrandBrain } from "../types";

const DirectionSchema = z.object({
  badTakes: z
    .array(z.object({ fromWord: z.number(), toWord: z.number(), reason: z.string() }))
    .describe("Rangos a borrar: arranques en falso, frases repetidas (se queda la ÚLTIMA toma buena), muletillas"),
  emphasis: z.array(z.number()).describe("Índices de palabras clave a resaltar"),
  zooms: z.array(z.object({ word: z.number(), strength: z.enum(["soft", "hard"]) })),
  emojis: z.array(z.object({ word: z.number(), emoji: z.string() })),
  hookTitle: z.string().nullable().describe("Texto corto (máx 7 palabras) para el título de los primeros segundos, o null"),
});

const EMOJIS_PER_MIN = { none: 0, low: 4, medium: 8, high: 14 };

/**
 * Claude actúa como editor: decide qué cortar, qué resaltar, dónde hacer zoom y qué emojis poner,
 * respetando el estilo del cliente. Si falla, cae a la heurística.
 */
export async function directEdit(opts: {
  words: Word[];
  style: EditStyle;
  brand: Partial<BrandBrain>;
  idea?: { title: string; hooks: string[] } | null;
}): Promise<Direction> {
  const { words, style } = opts;
  if (!words.length) return heuristicDirection(words, style);
  const duration = words[words.length - 1].end;
  const targetZooms = style.zoom.enabled ? Math.round(duration / style.zoom.everySeconds) : 0;
  const targetEmojis = Math.round((duration / 60) * EMOJIS_PER_MIN[style.emojis.density]);

  const numbered = words.map((w, i) => `${i}:${w.text}@${w.start.toFixed(2)}`).join(" ");

  try {
    const out = await structured({
      schema: DirectionSchema,
      maxTokens: 4000,
      system: `${AGENCY_CONTEXT}

You are a short-form video editor directing an automatic edit. You get the transcript as index:word@seconds.
Decide:
1) badTakes: false starts, stutters, repeated sentences (keep the LAST clean take), filler sounds (eh, em, um). Never cut meaningful content.
2) emphasis: the key words that carry the message (numbers, results, the promise, the twist). About 1 every 2 to 3 seconds.
3) zooms: about ${targetZooms} punch-ins on moments of emphasis or new ideas. ${style.zoom.enabled ? "" : "Zooms are disabled: return []."}
4) emojis: about ${targetEmojis} total${targetEmojis === 0 ? " (return [])" : ""}, only where an emoji adds meaning. Prefer this palette when it fits: ${style.emojis.palette.join(" ")}. Fit the brand: ${style.name} style, "${style.description}".
5) hookTitle: ${style.overlays.hookTitle ? "a punchy on-screen title for the first seconds that reinforces the hook, in the video's language" : "null"}.
Use only indexes that exist.`,
      user: `BRAND: ${json({ name: opts.brand.businessName, tone: opts.brand.voice?.tone, avoid: opts.brand.avoid })}
IDEA: ${json(opts.idea ?? null)}
TRANSCRIPT (${duration.toFixed(1)}s): ${numbered}`,
    });

    const n = words.length;
    const valid = (i: number) => Number.isInteger(i) && i >= 0 && i < n;
    const removeWords = new Set<number>();
    for (const r of out.badTakes) {
      const a = Math.max(0, Math.min(r.fromWord, r.toWord));
      const b = Math.min(n - 1, Math.max(r.fromWord, r.toWord));
      for (let i = a; i <= b; i++) removeWords.add(i);
    }
    // seguro: nunca borrar más del 40%
    if (removeWords.size > n * 0.4) removeWords.clear();

    return {
      removeWords: [...removeWords],
      emphasis: out.emphasis.filter(valid),
      zooms: out.zooms
        .filter((z) => valid(z.word))
        .map((z) => ({ word: z.word, strength: z.strength })),
      emojis: style.emojis.density === "none" ? [] : out.emojis.filter((e) => valid(e.word)),
      hookTitle: style.overlays.hookTitle ? out.hookTitle : null,
    };
  } catch (err) {
    console.error("directEdit: usando heurística", err);
    return heuristicDirection(words, style, opts.idea?.hooks?.[0] ?? null);
  }
}
