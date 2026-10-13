import { z } from "zod";
import { AGENCY_CONTEXT, json, structured } from "./claude";
import { PRESETS } from "../styles/presets";
import { AVAILABLE_FONTS } from "../styles/fonts";
import { sanitizeOverrides } from "../styles/sanitize";
import type { EditStyle, StyleOverrides } from "../styles/types";

const MoodSchema = z.object({
  name: z.string(),
  presetId: z.string().nullable().describe("Cambiar de preset base solo si el cambio es radical; si no, null"),
  energy: z.number().describe("-2 muy calmado ... 2 muy intenso"),
  captionFont: z.string().nullable(),
  captionUppercase: z.boolean().nullable(),
  highlightColor: z.string().nullable(),
  captionAnimation: z.enum(["pop", "bounce", "fade", "slide", "typewriter", "none"]).nullable(),
  emojiDensity: z.enum(["none", "low", "medium", "high"]).nullable(),
  emojiPalette: z.array(z.string()).nullable(),
  sfxEnabled: z.boolean().nullable(),
  colorGradeFilter: z.string().nullable().describe("CSS filter, ej: contrast(1.1) saturate(0.9)"),
  transition: z.enum(["none", "flash", "whip", "glitch", "fade"]).nullable(),
  motionLevel: z.enum(["none", "low", "medium", "high"]).nullable().describe("Cuántos textos animados y efectos (motion graphics)"),
  calloutStyle: z
    .enum(["sticker", "bar", "glow", "minimal", "3d"])
    .nullable()
    .describe("Look de los textos animados: sticker urbano, bar corporativo, glow brillante, minimal editorial, 3d letras con volumen que giran"),
  toneNotes: z.string().describe("Cómo cambia el tono de los guiones con este mood"),
});

/**
 * El cliente describe con sus palabras cómo se quiere ver ("más elegante", "como el de @x", "promo de navidad")
 * y Claude lo traduce a ajustes del editor. Cero formularios técnicos para el cliente.
 */
export async function moodFromDescription(opts: {
  description: string;
  currentStyle: EditStyle;
  references?: string[];
}): Promise<{ name: string; presetId: string | null; overrides: StyleOverrides; toneNotes: string }> {
  const m = await structured({
    schema: MoodSchema,
    maxTokens: 1500,
    system: `${AGENCY_CONTEXT}

Translate a client's plain-language description of how they want their videos to feel into concrete auto-editor settings.
Only set the fields that should change (null = keep current). Fonts available: ${AVAILABLE_FONTS.join(", ")}.
Presets: ${json(PRESETS.map((p) => ({ id: p.id, name: p.name, description: p.description })))}`,
    user: `CURRENT STYLE: ${json({ id: opts.currentStyle.id, name: opts.currentStyle.name, captions: opts.currentStyle.captions, emojis: opts.currentStyle.emojis, motion: opts.currentStyle.motion, transition: opts.currentStyle.transition })}
CLIENT SAYS: "${opts.description}"
REFERENCES: ${json(opts.references ?? [])}`,
  });

  const overrides: StyleOverrides = { energy: m.energy };
  const captions: Partial<EditStyle["captions"]> = {};
  if (m.captionFont && AVAILABLE_FONTS.includes(m.captionFont)) captions.font = m.captionFont;
  if (m.captionUppercase !== null) captions.uppercase = m.captionUppercase;
  if (m.highlightColor) captions.highlightColor = m.highlightColor;
  if (m.captionAnimation) captions.animation = m.captionAnimation;
  if (Object.keys(captions).length) overrides.captions = captions;
  if (m.emojiDensity || m.emojiPalette)
    overrides.emojis = {
      ...(m.emojiDensity ? { density: m.emojiDensity } : {}),
      ...(m.emojiPalette ? { palette: m.emojiPalette } : {}),
    };
  if (m.sfxEnabled !== null) overrides.sfx = { enabled: m.sfxEnabled };
  if (m.colorGradeFilter) overrides.grade = { filter: m.colorGradeFilter };
  if (m.transition) overrides.transition = m.transition;
  if (m.motionLevel || m.calloutStyle)
    overrides.motion = {
      ...(m.motionLevel ? { level: m.motionLevel } : {}),
      ...(m.calloutStyle ? { calloutStyle: m.calloutStyle } : {}),
    };
  if (m.highlightColor) overrides.overlays = { progressColor: m.highlightColor };

  const presetId = m.presetId && PRESETS.some((p) => p.id === m.presetId) ? m.presetId : null;
  if (presetId) overrides.presetId = presetId;
  return { name: m.name, presetId, overrides: sanitizeOverrides(overrides), toneNotes: m.toneNotes };
}
