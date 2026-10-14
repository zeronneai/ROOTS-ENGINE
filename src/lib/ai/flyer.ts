import { z } from "zod";
import { AGENCY_CONTEXT, json, structured } from "./claude";
import type { BrandBrain } from "../types";
import { PRICES, recordUsage } from "../usage";

/**
 * Flyers con IA, como Google Flow pero con la marca del cliente ya cargada:
 * 1) Claude actúa como director de arte y escribe el prompt (con los textos exactos del flyer).
 * 2) Nano Banana (modelo de imagen de Google) genera la imagen usando las referencias:
 *    estilo, logo y fotos fijas de la marca, y las imágenes de ese flyer.
 */

export const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-nano-banana-2.1";

export type FlyerFormat = "post" | "story" | "square";
export const FORMATS: Record<FlyerFormat, { label: string; ratio: string; fallback: string }> = {
  post: { label: "Post 4:5", ratio: "4:5", fallback: "3:4" },
  story: { label: "Historia 9:16", ratio: "9:16", fallback: "9:16" },
  square: { label: "Cuadrado 1:1", ratio: "1:1", fallback: "1:1" },
};

export type RefImage = {
  role: "style" | "logo" | "lugar" | "persona" | "producto" | "otro" | "extra" | "current";
  label?: string | null;
  mimeType: string;
  data: string; // base64
  url?: string; // para que Claude la vea
};

const ROLE_TEXT: Record<RefImage["role"], string> = {
  style: "STYLE REFERENCE. Use it only as inspiration for palette, typography feel, composition and lighting. Do not copy its content, text or logos.",
  logo: "BRAND LOGO. Reproduce it exactly as it is (same shape, letters and colors), clearly visible, never redraw or change it.",
  lugar: "PHOTO OF THE BUSINESS PLACE. Keep it recognizable.",
  persona: "PERSON. Keep their face and appearance faithful, do not change their identity.",
  producto: "PRODUCT OR DISH. Keep it faithful and appetizing, do not invent a different product.",
  otro: "BRAND IMAGE. Use it as provided.",
  extra: "IMAGE FOR THIS SPECIFIC FLYER. It must appear in the design.",
  current: "CURRENT FLYER TO EDIT. Keep everything the same except the requested changes.",
};

const PromptSchema = z.object({
  headline: z.string().describe("Título principal del flyer, corto"),
  lines: z.array(z.string()).describe("Los demás textos exactos que van en el flyer (fecha, hora, precio, dirección, llamado a la acción)"),
  prompt: z.string().describe("Prompt de dirección de arte en inglés para el modelo de imagen"),
});

export async function writeFlyerPrompt(opts: {
  brand: Partial<BrandBrain>;
  client: { name: string; niche: string | null; city: string | null; instagram: string | null };
  brief: string;
  format: FlyerFormat;
  images: RefImage[];
  adjust?: string | null;
}) {
  const manifest = opts.images.map((im, i) => ({ image: i + 1, role: im.role, label: im.label || null }));
  const urls = opts.images.map((im) => im.url).filter((u): u is string => !!u);
  const ask = (withImages: boolean) => structured({
    label: "Flyer: dirección de arte",
    schema: PromptSchema,
    maxTokens: 2500,
    images: withImages ? urls : undefined,
    system: `${AGENCY_CONTEXT}

You are PRA's art director. You write the prompt for an AI image model (Google Nano Banana) that will design a social media flyer.
The model receives the same reference images listed in IMAGES, in that order (attached here too so you can see them).
Write a precise art direction prompt in English:
- Format: ${FORMATS[opts.format].label} for Instagram.
- Layout and hierarchy: where the headline, the photo, the details and the logo go. Leave safe margins.
- Visual style: follow the STYLE REFERENCE images and the brand (colors, mood). If there are none, design something premium and fitting for the niche.
- Use the brand photos as they are (logo exact, people faithful, real dishes or products). Say for each numbered image how to use it.
- Typography: modern, bold, highly legible. All flyer text must be spelled exactly as given, in quotes, with correct accents.
- The flyer text is in the brand's language (Spanish by default, Mexican, casual). Keep text short: a flyer is read in 2 seconds.
- Never invent prices, dates, addresses or phone numbers that are not in the brief.
- No em dashes or long dashes in any text.
${opts.adjust ? "This is an EDIT of the CURRENT FLYER image: the prompt must ask to keep the design and apply only the requested changes." : ""}`,
    user: `CLIENT: ${json(opts.client)}
BRAND: ${json({ name: opts.brand.businessName, oneLiner: opts.brand.oneLiner, tone: opts.brand.voice?.tone, visual: opts.brand.visual, cta: opts.brand.cta, avoid: opts.brand.avoid, language: opts.brand.language })}
WHAT THE FLYER IS FOR: ${json(opts.brief)}
${opts.adjust ? `CHANGES REQUESTED: ${json(opts.adjust)}` : ""}
IMAGES: ${json(manifest)}`,
  });
  // si Claude no puede abrir las imágenes, escribe el prompt solo con la lista
  return ask(urls.length > 0).catch((e) => {
    if (!urls.length) throw e;
    console.error("writeFlyerPrompt: sin imágenes", e);
    return ask(false);
  });
}

/** Genera la imagen con Nano Banana. Regresa PNG/JPEG en Buffer. */
export async function renderFlyer(opts: { prompt: string; texts: string[]; format: FlyerFormat; images: RefImage[] }) {
  if (!process.env.GEMINI_API_KEY) throw new Error("Falta GEMINI_API_KEY (Google AI Studio) en las variables de Vercel");
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [
    {
      text: `${opts.prompt}

Exact text to place on the flyer (spell it exactly, keep the accents): ${opts.texts.map((t) => `"${t}"`).join(", ")}.
The reference images follow, each one introduced by its role.`,
    },
  ];
  opts.images.forEach((im, i) => {
    parts.push({ text: `Image ${i + 1}: ${ROLE_TEXT[im.role]}${im.label ? ` (${im.label})` : ""}` });
    parts.push({ inlineData: { mimeType: im.mimeType, data: im.data } });
  });

  const call = (aspectRatio: string) =>
    ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: "user", parts }],
      config: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio, imageSize: "2K" } },
    });

  const f = FORMATS[opts.format];
  let res;
  try {
    res = await call(f.ratio);
  } catch (e) {
    if (f.fallback === f.ratio) throw e;
    res = await call(f.fallback); // por si el modelo no acepta 4:5
  }
  void recordUsage({ kind: "gemini", detail: `Flyer: imagen ${opts.format}`, costUsd: PRICES.geminiImage["2K"], units: { model: IMAGE_MODEL, size: "2K" } });
  const out = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!out?.inlineData?.data) {
    const why = res.candidates?.[0]?.finishReason ?? res.promptFeedback?.blockReason ?? "sin imagen";
    throw new Error(`El modelo de imagen no regresó un flyer (${why}). Intenta describirlo de otra forma.`);
  }
  return { buffer: Buffer.from(out.inlineData.data, "base64"), mimeType: out.inlineData.mimeType || "image/png" };
}
