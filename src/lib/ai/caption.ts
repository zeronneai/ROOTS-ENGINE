/**
 * Copy para redes escrito viendo el video: fotos del video + lo que se dice + Brand Brain + mood
 * + cómo ha escrito el cliente antes + sus reglas fijas (ej. cerrar con el teléfono).
 */
import { z } from "zod";
import { AGENCY_CONTEXT, json, structured } from "./claude";
import type { BrandBrain } from "../types";

export const CAPTION_KINDS = {
  largo: "Largo",
  corto: "Corto",
  directo: "Sin pedir comentarios",
} as const;
export type CaptionKind = keyof typeof CAPTION_KINDS;
export type CaptionOption = { kind: CaptionKind | "editor"; text: string };
export const CAPTION_LABELS: Record<string, string> = { ...CAPTION_KINDS, editor: "Del editor (.txt)" };

const CaptionSchema = z.object({
  largo: z.string().describe("Copy largo: hook + 4 a 8 líneas que cuentan o explican, con emojis si la marca los usa, CTA (puede pedir que comenten una palabra) y hashtags"),
  corto: z.string().describe("Copy corto: hook + 1 o 2 líneas + CTA y hashtags. Se lee en 3 segundos"),
  directo: z.string().describe("Copy sin pedir comentarios: NUNCA dice comenta, escribe abajo, deja tu emoji ni nada parecido; el CTA es llamar, escribir por DM o WhatsApp, agendar o visitar. Largo medio"),
  language: z.enum(["es", "en"]).describe("Idioma en el que quedaron los copys"),
  whatISaw: z.string().describe("Una frase: de qué trata el video según lo que viste y escuchaste"),
});

export type CaptionInput = {
  client: { name: string; niche: string | null; city: string | null; language: string };
  brand: Partial<BrandBrain>;
  mood: { name: string; description: string | null; tone_notes: string | null } | null;
  rules: string | null;
  footer: string | null;
  /** copys que ya ha publicado el cliente, del más nuevo al más viejo */
  examples: string[];
  transcript: string | null;
  frames: { data: string; mediaType: "image/jpeg" | "image/png" }[];
  hint?: string | null;
  platforms?: string[];
};

/** 3 copys distintos para el mismo video: largo, corto y uno que no pide comentarios. */
export async function writeCaptions(input: CaptionInput & { avoid?: string[] }) {
  const b = input.brand;
  const out = await structured({
    schema: CaptionSchema,
    label: "Copy con IA",
    maxTokens: 3000,
    images: input.frames.slice(0, 8),
    system: `${AGENCY_CONTEXT}
You are the social media copywriter for this client. Write 3 caption options for the video shown in the frames (in order, from start to end) and described by its transcript.
- Sound like the client's PAST CAPTIONS: language mix, emojis, line breaks, hashtags and closing. They are the strongest reference for voice.
- Follow the CLIENT RULES literally. They come from the agency and always win.
- Each option opens with a different hook that makes people stop and read, tied to what actually happens in the video. Do not describe the video literally ("in this video...").
- largo: tells or explains more (4 to 8 short lines). It may ask people to comment a word.
- corto: 1 or 2 short lines after the hook.
- directo: must NEVER ask people to comment, reply, drop an emoji, tag someone or "write below". Its call to action is to call, DM, WhatsApp, book or visit.
- LANGUAGE: the 3 options are fully in the language spoken in the video (see the transcript), without mixing languages, even if the brand is bilingual. If nobody talks, use the language the client posts in most. A fixed closing line from the rules may stay as it is.
- Never invent prices, discounts, promos, dates, addresses or phone numbers that are not in the brand, rules or video.
- If the client has a fixed closing line, end every option with it (adapted to the caption's language if the rules say so).
- No em dashes or long dashes.`,
    user: `CLIENT: ${json(input.client)}
BRAND: ${json({ name: b.businessName, oneLiner: b.oneLiner, languageNotes: b.languageNotes, offer: b.offer, voice: b.voice, cta: b.cta, avoid: b.avoid })}
ACTIVE MOOD: ${input.mood ? json(input.mood) : "none"}
CLIENT RULES: ${input.rules?.trim() || "none"}
FIXED CLOSING LINE: ${input.footer?.trim() || "none"}
PLATFORMS: ${input.platforms?.join(", ") || "instagram, tiktok, facebook"}
PAST CAPTIONS: ${json(input.examples.slice(0, 10))}
TRANSCRIPT OF THE VIDEO: ${input.transcript?.trim() ? json(input.transcript.slice(0, 4000)) : "(no speech or not available)"}
${input.avoid?.length ? `ALREADY PROPOSED (write 3 NEW ones with different hooks and angles): ${json(input.avoid.slice(0, 6))}` : ""}
${input.hint?.trim() ? `NOTES FROM THE TEAM ABOUT THIS POST: ${json(input.hint)}` : ""}`,
  });
  const options: CaptionOption[] = (Object.keys(CAPTION_KINDS) as CaptionKind[]).map((kind) => ({ kind, text: withFooter(out[kind], input.footer) }));
  return { options, whatISaw: out.whatISaw, language: out.language };
}

/** Un solo copy (para lo automático): el largo. */
export async function writeCaption(input: CaptionInput) {
  const out = await writeCaptions(input);
  return { caption: out.options[0].text, options: out.options, whatISaw: out.whatISaw };
}

/** Garantiza el cierre fijo: si el copy ya trae el teléfono (o el texto), no lo repite. */
export function withFooter(caption: string, footer: string | null | undefined) {
  const f = footer?.trim();
  const c = caption.replace(/\s*[—–]\s*/g, ", ").trim();
  if (!f) return c;
  const digits = f.replace(/\D/g, "");
  const has = digits.length >= 7 ? c.replace(/\D/g, "").includes(digits) : c.toLowerCase().includes(f.toLowerCase());
  return has ? c : c ? `${c}\n\n${f}` : f;
}

const HooksSchema = z.object({
  language: z.enum(["es", "en"]).describe("Decide first: the ONE language spoken in the video. All 3 hooks are written only in this language"),
  hooks: z
    .array(z.object({ text: z.string().describe("Máximo 9 palabras, se lee en 2 segundos"), angle: z.string().describe("El ángulo en 2 o 3 palabras: POV, pregunta, contraste, secreto, reto...") }))
    .describe("Exactamente 3, cada una con un ángulo distinto"),
});

/** 3 textos virales para poner encima del video. */
export async function writeHooks(input: Omit<CaptionInput, "footer" | "platforms"> & { language?: "es" | "en" | null }) {
  const b = input.brand;
  const out = await structured({
    schema: HooksSchema,
    label: "Texto viral",
    maxTokens: 800,
    images: input.frames.slice(0, 8),
    system: `${AGENCY_CONTEXT}
You write the on-screen text hook that goes on top of a short vertical video (Reels, TikTok). The frames are in order from start to end.
- It must make a scroller stop in the first second: curiosity, tension, a relatable POV, a bold claim, a question, a contrast. Tied to what really happens in the video.
- Max 9 words. Natural, the way people talk online. One emoji at most, only if it adds.
- LANGUAGE: every hook is 100% in the language spoken in the video (see the transcript). If the video is in English, all 3 are fully in English; if it is in Spanish, all 3 are fully in Spanish. Never mix languages inside a hook and never across the 3, even if the brand is bilingual. If nobody talks, use the language the client posts in most.
- 3 options with clearly different angles. Never invent prices, promos or facts. Follow CLIENT RULES.
- No em dashes or long dashes. No hashtags.`,
    user: `CLIENT: ${json(input.client)}
BRAND: ${json({ name: b.businessName, oneLiner: b.oneLiner, languageNotes: b.languageNotes, voice: b.voice, audience: b.audience, avoid: b.avoid })}
ACTIVE MOOD: ${input.mood ? json(input.mood) : "none"}
CLIENT RULES: ${input.rules?.trim() || "none"}
PAST CAPTIONS (for voice): ${json(input.examples.slice(0, 6))}
TRANSCRIPT OF THE VIDEO: ${input.transcript?.trim() ? json(input.transcript.slice(0, 3000)) : "(no speech or not available)"}
${input.language ? `THE VIDEO IS IN ${input.language === "en" ? "ENGLISH: write all 3 hooks only in English" : "SPANISH: write all 3 hooks only in Spanish"}.` : ""}
${input.hint?.trim() ? `NOTES FROM THE TEAM: ${json(input.hint)}` : ""}`,
  });
  return out.hooks.slice(0, 3).map((h) => ({ ...h, text: h.text.replace(/\s*[—–]\s*/g, ", ").trim() }));
}
