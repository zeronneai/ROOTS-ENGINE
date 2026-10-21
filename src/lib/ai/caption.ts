/**
 * Copy para redes escrito viendo el video: fotos del video + lo que se dice + Brand Brain + mood
 * + cómo ha escrito el cliente antes + sus reglas fijas (ej. cerrar con el teléfono).
 */
import { z } from "zod";
import { AGENCY_CONTEXT, json, structured } from "./claude";
import type { BrandBrain } from "../types";

const CaptionSchema = z.object({
  caption: z.string().describe("El copy completo listo para pegar, con emojis si la marca los usa y los hashtags al final"),
  language: z.enum(["es", "en"]).describe("Idioma en el que quedó el copy"),
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

export async function writeCaption(input: CaptionInput) {
  const b = input.brand;
  const out = await structured({
    schema: CaptionSchema,
    label: "Copy con IA",
    maxTokens: 2000,
    images: input.frames.slice(0, 8),
    system: `${AGENCY_CONTEXT}
You are the social media copywriter for this client. Write the caption for the video shown in the frames (in order, from start to end) and described by its transcript.
- Sound exactly like the client's PAST CAPTIONS: same length, language mix, emojis, line breaks, hashtags and closing. They are the strongest reference.
- Follow the CLIENT RULES literally. They come from the agency and always win.
- First line is a hook that makes people stop and read, tied to what actually happens in the video. Do not describe the video literally ("in this video...").
- Write in the language spoken in the video. If nobody talks, use the language the client posts in most.
- Never invent prices, discounts, promos, dates, addresses or phone numbers that are not in the brand, rules or video.
- Keep it short for reels: usually 2 to 5 short lines plus the closing and hashtags.
- If the client has a fixed closing line, end with it (adapted to the caption's language if the rules say so).
- No em dashes or long dashes.`,
    user: `CLIENT: ${json(input.client)}
BRAND: ${json({ name: b.businessName, oneLiner: b.oneLiner, languageNotes: b.languageNotes, offer: b.offer, voice: b.voice, cta: b.cta, avoid: b.avoid })}
ACTIVE MOOD: ${input.mood ? json(input.mood) : "none"}
CLIENT RULES: ${input.rules?.trim() || "none"}
FIXED CLOSING LINE: ${input.footer?.trim() || "none"}
PLATFORMS: ${input.platforms?.join(", ") || "instagram, tiktok, facebook"}
PAST CAPTIONS: ${json(input.examples.slice(0, 10))}
TRANSCRIPT OF THE VIDEO: ${input.transcript?.trim() ? json(input.transcript.slice(0, 4000)) : "(no speech or not available)"}
${input.hint?.trim() ? `NOTES FROM THE TEAM ABOUT THIS POST: ${json(input.hint)}` : ""}`,
  });
  return { ...out, caption: withFooter(out.caption, input.footer) };
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
  hooks: z
    .array(z.object({ text: z.string().describe("Máximo 9 palabras, se lee en 2 segundos"), angle: z.string().describe("El ángulo en 2 o 3 palabras: POV, pregunta, contraste, secreto, reto...") }))
    .describe("Exactamente 3, cada una con un ángulo distinto"),
});

/** 3 textos virales para poner encima del video. */
export async function writeHooks(input: Omit<CaptionInput, "footer" | "platforms">) {
  const b = input.brand;
  const out = await structured({
    schema: HooksSchema,
    label: "Texto viral",
    maxTokens: 800,
    images: input.frames.slice(0, 8),
    system: `${AGENCY_CONTEXT}
You write the on-screen text hook that goes on top of a short vertical video (Reels, TikTok). The frames are in order from start to end.
- It must make a scroller stop in the first second: curiosity, tension, a relatable POV, a bold claim, a question, a contrast. Tied to what really happens in the video.
- Max 9 words. Natural, the way people from El Paso / Juárez talk online. One emoji at most, only if it adds.
- Write in the language spoken in the video; if nobody talks, the language the client posts in most.
- 3 options with clearly different angles. Never invent prices, promos or facts. Follow CLIENT RULES.
- No em dashes or long dashes. No hashtags.`,
    user: `CLIENT: ${json(input.client)}
BRAND: ${json({ name: b.businessName, oneLiner: b.oneLiner, languageNotes: b.languageNotes, voice: b.voice, audience: b.audience, avoid: b.avoid })}
ACTIVE MOOD: ${input.mood ? json(input.mood) : "none"}
CLIENT RULES: ${input.rules?.trim() || "none"}
PAST CAPTIONS (for voice): ${json(input.examples.slice(0, 6))}
TRANSCRIPT OF THE VIDEO: ${input.transcript?.trim() ? json(input.transcript.slice(0, 3000)) : "(no speech or not available)"}
${input.hint?.trim() ? `NOTES FROM THE TEAM: ${json(input.hint)}` : ""}`,
  });
  return out.hooks.slice(0, 3).map((h) => ({ ...h, text: h.text.replace(/\s*[—–]\s*/g, ", ").trim() }));
}
