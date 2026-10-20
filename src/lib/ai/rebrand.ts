import { z } from "zod";
import { AGENCY_CONTEXT, json, structured } from "./claude";
import type { BrandBrain } from "../types";

export const REBRAND_TONES = {
  premium: "Premium / lujo silencioso",
  calido: "Cálido y cercano",
  atrevido: "Atrevido y social",
  minimal: "Minimalista y clínico",
  divertido: "Divertido y joven",
  clasico: "Clásico y de herencia",
} as const;
export type RebrandTone = keyof typeof REBRAND_TONES;

export type RebrandBrief = {
  newName: string | null;
  suggestNames: boolean;
  why: string | null;
  keep: string | null;
  avoid: string | null;
  likes: string | null;
  competitors: string | null;
  tones: RebrandTone[];
  notes: string | null;
};

const Color = z.object({ name: z.string().describe("Nombre evocador del color, en español"), hex: z.string().describe("#RRGGBB"), role: z.string().describe("Para qué se usa: fondo, texto, logo, acento...") });

const Direction = z.object({
  key: z.enum(["A", "B", "C"]),
  name: z.string().describe("Nombre corto y evocador de la dirección, 2 o 3 palabras"),
  concept: z.string().describe("La idea central en 2 o 3 frases: qué significa y por qué conecta con el nombre de la marca"),
  personality: z.array(z.string()).describe("4 adjetivos"),
  audience: z.string().describe("Para quién es, en una frase"),
  taglineEs: z.string(),
  taglineEn: z.string(),
  palette: z.array(Color).describe("5 o 6 colores con contraste suficiente entre fondo y texto"),
  typography: z.object({
    display: z.string().describe("Familia EXACTA de Google Fonts para títulos y logo, ej: Cormorant Garamond"),
    text: z.string().describe("Familia EXACTA de Google Fonts para textos, ej: Montserrat"),
    premiumAlt: z.string().nullable().describe("Alternativa de pago si aplica, ej: Canela"),
    why: z.string(),
  }),
  logoConcept: z.string().describe("Cómo es el logo: wordmark, símbolo, monograma, el detalle único que lo distingue"),
  logoPrompt: z.string().describe("Prompt en inglés, muy detallado, para generar el logo en un modelo de imagen: tipo de letra, detalle único, colores hex, fondo, estilo vector, qué evitar. Referencias de marcas de lujo si aplica"),
  monogramPrompt: z.string().describe("Prompt en inglés para el monograma o ícono de perfil"),
  mockups: z.array(z.object({ label: z.string().describe("Nombre corto en español: Tarjetas, Fachada, Empaque..."), prompt: z.string().describe("Prompt en inglés que pide usar el logo adjunto exactamente, con escena, materiales, luz y paleta") })).describe("6 mockups: papelería, fachada o espacio, empaque o producto, redes sociales en celular, uniforme o textil, y uno propio del giro"),
  contentStyle: z.string().describe("Cómo se ve y suena en redes y video"),
  risks: z.string().describe("Qué podría salir mal con esta dirección"),
});

export const RebrandSchema = z.object({
  summary: z.string().describe("Resumen ejecutivo en 2 o 3 frases"),
  diagnosis: z.object({
    visual: z.string().describe("Cómo se ve la marca hoy: logo, colores, tipografía, fotos, consistencia"),
    verbal: z.string().describe("Cómo suena: nombre, tono, mensajes"),
    keep: z.array(z.string()).describe("Lo que vale la pena conservar"),
    problems: z.array(z.string()).describe("Lo que la frena"),
  }),
  segment: z
    .array(
      z.object({
        name: z.string(),
        positioning: z.string().describe("Cómo se posiciona, en una frase"),
        visualStyle: z.string().describe("Su estilo visual en pocas palabras"),
        colors: z.array(z.string()).describe("2 a 4 hex aproximados de su marca, o vacío si no se sabe"),
        owns: z.string().describe("Qué idea o atributo ya es suyo en la mente del cliente"),
      }),
    )
    .describe("4 a 6 marcas del mismo segmento: competidores del cliente y referentes del giro"),
  whiteSpace: z.array(z.string()).describe("3 a 5 espacios que nadie ocupa en el segmento y que la marca puede tomar"),
  names: z.array(z.object({ name: z.string(), why: z.string(), check: z.string().describe("Qué revisar: @, dominio, registro") })).describe("6 nombres si se pidieron, si no, vacío"),
  directions: z.array(Direction).describe("Exactamente 3 direcciones claramente distintas entre sí"),
  recommendation: z.object({ key: z.enum(["A", "B", "C"]), why: z.string(), ifPriority: z.array(z.string()).describe("Frases tipo: Si lo más importante es X, entonces B") }),
  launch: z.array(z.object({ stage: z.string(), timing: z.string(), actions: z.string() })).describe("4 etapas para lanzar el cambio sin perder clientes"),
});
export type RebrandData = z.infer<typeof RebrandSchema>;

/** Análisis de marca para rebranding: diagnóstico, comparación del segmento, nombres y 3 direcciones completas. */
export async function planRebrand(opts: {
  brand: Partial<BrandBrain>;
  client: { name: string; niche: string | null; city: string | null; instagram: string | null; website: string | null };
  research: unknown;
  competitors: { handle: string; platform: string; followers: number | null; medianViews: number | null }[];
  brief: RebrandBrief;
  images: string[];
}): Promise<RebrandData> {
  const b = opts.brief;
  const name = b.newName || opts.client.name;
  return structured({
    label: "Rebranding",
    schema: RebrandSchema,
    maxTokens: 20000,
    images: opts.images.length ? opts.images : undefined,
    system: `${AGENCY_CONTEXT}

You are the creative director of a premium branding studio. The agency asked for a REBRANDING analysis of a client brand.
${opts.images.length ? "Attached images: the current logo, current visuals and reference images the client likes (in that order, when present). Look at them closely for the diagnosis." : "No images attached: base the visual diagnosis only on the data, and say so."}

Rules:
- The brand name to design for is "${name}"${b.newName ? " (already decided, do not change it)" : ""}.${b.suggestNames ? " Also propose 6 strong name options, bilingual friendly for the US/Mexico border, easy to say in English and Spanish." : " names must be an empty array."}
- Compare against brands of the same segment: the client's competitors listed and well known reference brands of the niche. Only state facts you are confident about; for colors of other brands, give approximate hex only if you know them, otherwise leave colors empty.
- 3 directions that are truly different from each other (for example: quiet luxury, warm heritage evolution, bold social). Not three variations of the same idea.
- Each direction must have a UNIQUE logo idea tied to the meaning of the name (a detail in the letters, a ligature, a negative space, an emblem), not a generic icon. Logos must work small (profile picture) and big (storefront).
- Typography: real Google Fonts family names only, spelled exactly, so they can be previewed. Optionally a premium paid alternative.
- Palettes: real hex colors, toned (no pure #000000 or #FFFFFF), with enough contrast for text.
- Prompts are in English, detailed and ready to paste in an image model (Nano Banana / Google Flow). Mockup prompts say "Use the attached logo exactly, do not redraw it". Never put em dashes in prompts.
- Never invent prices, addresses, awards or claims. No medical promises.
- Respect what the client wants to keep and avoid.
- Everything except the prompts is written in Spanish (Mexican, professional, warm). No em dashes or long dashes anywhere.`,
    user: `CLIENT: ${json(opts.client)}

REBRANDING BRIEF
${json(b)}

DESIRED TONES: ${b.tones.map((t) => REBRAND_TONES[t]).join(", ") || "open"}

BRAND BRAIN (current)
${json(opts.brand)}

RESEARCH (market, competitors, audience)
${json(opts.research)}

TRACKED COMPETITORS
${json(opts.competitors)}`,
  });
}
