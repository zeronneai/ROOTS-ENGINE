import { z } from "zod";
import { AGENCY_CONTEXT, json, structured } from "./claude";
import type { Direction } from "../edl/build";
import { heuristicDirection, HOOK_SECONDS, pickCallouts, pickEmojis, targetCounts } from "../edl/build";
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
  callouts: z
    .array(z.object({ word: z.number(), text: z.string().describe("1 a 3 palabras, máx 18 letras") }))
    .describe("Textos animados grandes que refuerzan una idea clave"),
  cta: z.string().nullable().describe("Llamado a la acción corto para el cierre (máx 5 palabras), o null"),
  images: z
    .array(z.object({ asset: z.number().describe("número de la imagen"), word: z.number() }))
    .describe("En qué palabra aparece cada imagen marcada para mostrarse"),
});

export type EditAsset = { path: string; note?: string; use: "show" | "reference"; url?: string };

/** Imágenes que no quedaron colocadas: repartidas después del título, separadas. */
function placeMissing(words: Word[], removed: Set<number>, show: EditAsset[], placed: { path: string; word: number }[]) {
  const missing = show.filter((a) => !placed.some((p) => p.path === a.path));
  if (!missing.length) return placed;
  const start = words.find((_, i) => !removed.has(i))?.start ?? 0;
  const end = words[words.length - 1].end;
  const out = [...placed];
  missing.forEach((a, k) => {
    const t = start + HOOK_SECONDS + ((end - start - HOOK_SECONDS - 2.8) * (k + 0.5)) / missing.length;
    let best = -1;
    words.forEach((w, i) => {
      if (removed.has(i)) return;
      if (best < 0 || Math.abs(w.start - t) < Math.abs(words[best].start - t)) best = i;
    });
    if (best >= 0) out.push({ path: a.path, word: best });
  });
  return out;
}

/**
 * Claude actúa como editor: decide qué cortar, qué resaltar, dónde hacer zoom y qué emojis poner,
 * respetando el estilo del cliente. Si falla, cae a la heurística.
 */
export async function directEdit(opts: {
  words: Word[];
  style: EditStyle;
  brand: Partial<BrandBrain>;
  idea?: { title: string; hooks: string[] } | null;
  /** instrucciones extra de quien subió el video ("pon el precio en grande", "más motion graphics") */
  notes?: string | null;
  /** imágenes del cliente (con url firmada para que Claude las vea) */
  assets?: EditAsset[];
}): Promise<Direction> {
  const { words, style } = opts;
  if (!words.length) return heuristicDirection(words, style);
  const assets = (opts.assets ?? []).slice(0, 8);
  const show = assets.filter((a) => a.use === "show");
  const duration = words[words.length - 1].end;
  const target = targetCounts(style, duration);
  const targetZooms = target.zooms;
  const targetEmojis = target.emojis;

  const numbered = words.map((w, i) => `${i}:${w.text}@${w.start.toFixed(2)}`).join(" ");

  try {
    const ask = (withImages: boolean) => structured({
    label: "Dirección de edición de video",
      images: withImages ? assets.map((a) => a.url!).filter(Boolean) : undefined,
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
6) callouts: ${target.callouts ? `exactly ${target.callouts} big animated text graphics placed on key moments after the first ${HOOK_SECONDS} seconds and at least 2.5 seconds apart. Text of 1 to 3 words that sums up the idea (a number, result, benefit or twist), in the video's language. Not a copy of the full sentence.` : "return []"}.
7) cta: ${style.motion.endCard ? "a short call to action for the closing card that fits what was said (ex: Agenda tu cita hoy, Visítanos este fin), in the video's language" : "null"}.
8) images: ${show.length ? `place every image marked "show" (by its number) on the word where the speaker talks about it or where it best illustrates what is said. They appear for about 3 seconds, at least 3 seconds apart, not in the first ${HOOK_SECONDS} seconds.` : "return []"}
Recorded mistakes are common: when the speaker restarts a sentence, cut the failed attempt(s) completely and keep the last complete one.
Use only indexes that exist.`,
      user: `BRAND: ${json({ name: opts.brand.businessName, tone: opts.brand.voice?.tone, avoid: opts.brand.avoid })}
IDEA: ${json(opts.idea ?? null)}
${opts.notes ? `EXTRA INSTRUCTIONS FROM THE CLIENT (follow them with the tools you have: cuts, emphasis, zooms, emojis, callouts, hook title, cta; you may go over the suggested amounts if they ask for more): ${json(opts.notes)}` : ""}
${assets.length ? `CLIENT IMAGES (attached in this order, numbered from 0): ${json(assets.map((a, i) => ({ number: i, use: a.use === "show" ? "show in the video" : "reference only, to understand what they want", note: a.note || null })))}` : ""}
TRANSCRIPT (${duration.toFixed(1)}s): ${numbered}`,
    });
    // si Claude no puede abrir las imágenes, lo intentamos sin verlas
    const out = await ask(assets.some((a) => a.url)).catch((e) => {
      if (!assets.some((a) => a.url)) throw e;
      console.error("directEdit: sin imágenes", e);
      return ask(false);
    });

    const n = words.length;
    const valid = (i: number) => Number.isInteger(i) && i >= 0 && i < n;
    const removeWords = new Set<number>();
    for (const r of out.badTakes) {
      const a = Math.max(0, Math.min(r.fromWord, r.toWord));
      const b = Math.min(n - 1, Math.max(r.fromWord, r.toWord));
      for (let i = a; i <= b; i++) removeWords.add(i);
    }
    // seguro: nunca borrar más del 65%. Si se pasa, se quedan los cortes más chicos (muletillas, tropiezos).
    if (removeWords.size > n * 0.65) {
      removeWords.clear();
      const ranges = out.badTakes
        .map((r) => [Math.max(0, Math.min(r.fromWord, r.toWord)), Math.min(n - 1, Math.max(r.fromWord, r.toWord))] as const)
        .sort((a, b) => a[1] - a[0] - (b[1] - b[0]));
      for (const [a, b] of ranges) {
        if (removeWords.size + (b - a + 1) > n * 0.65) break;
        for (let i = a; i <= b; i++) removeWords.add(i);
      }
    }

    const emphasis = out.emphasis.filter(valid).filter((i) => !removeWords.has(i));
    let emojis = style.emojis.density === "none" ? [] : out.emojis.filter((e) => valid(e.word) && !removeWords.has(e.word));
    // si Claude se quedó corto de emojis, completamos con la heurística
    if (emojis.length < targetEmojis) {
      const extra = pickEmojis(words, removeWords, new Set(emphasis), style, targetEmojis - emojis.length, emojis.map((e) => e.word));
      emojis = [...emojis, ...extra].sort((a, b) => a.word - b.word);
    }
    let callouts = target.callouts ? out.callouts.filter((c) => valid(c.word) && !removeWords.has(c.word) && c.text.trim()) : [];
    if (callouts.length < target.callouts) {
      const extra = pickCallouts(words, removeWords, emphasis, target.callouts).filter(
        (x) => !callouts.some((c) => Math.abs(words[c.word].start - words[x.word].start) < 2.5),
      );
      callouts = [...callouts, ...extra].slice(0, target.callouts);
    }
    let zooms: Direction["zooms"] = out.zooms.filter((z) => valid(z.word) && !removeWords.has(z.word)).map((z) => ({ word: z.word, strength: z.strength }));
    if (style.zoom.enabled && zooms.length < Math.ceil(targetZooms / 2)) {
      zooms = heuristicDirection(words, style).zooms.filter((z) => !removeWords.has(z.word));
    }

    return {
      removeWords: [...removeWords],
      emphasis,
      zooms: style.zoom.enabled ? zooms : [],
      emojis,
      hookTitle: style.overlays.hookTitle ? out.hookTitle : null,
      callouts,
      cta: style.motion.endCard ? out.cta : null,
      images: placeMissing(
        words,
        removeWords,
        show,
        out.images
          .filter((im) => valid(im.word) && !removeWords.has(im.word) && assets[im.asset]?.use === "show")
          .map((im) => ({ path: assets[im.asset].path, word: im.word })),
      ),
    };
  } catch (err) {
    console.error("directEdit: usando heurística", err);
    const h = heuristicDirection(words, style, opts.idea?.hooks?.[0] ?? null);
    return { ...h, images: placeMissing(words, new Set(h.removeWords), show, []) };
  }
}
