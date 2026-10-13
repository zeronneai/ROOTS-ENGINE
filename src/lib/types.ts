import { z } from "zod";

/**
 * Brand Brain: todo lo que el motor necesita saber de un cliente.
 * Lo llena Claude a partir de lo que suben la agencia y el cliente (brand_inputs)
 * + lo que ya publica en redes. La agencia lo revisa; el cliente puede seguir agregando.
 */
export const BrandBrainSchema = z.object({
  businessName: z.string(),
  oneLiner: z.string().describe("Qué hace el negocio en una frase"),
  niche: z.string(),
  city: z.string(),
  language: z.enum(["es", "en", "bilingual"]),
  languageNotes: z.string().describe("Ej: español norteño con palabras en inglés, o inglés con frases en español"),
  offer: z.object({
    mainProducts: z.array(z.string()),
    priceRange: z.string(),
    differentiators: z.array(z.string()),
  }),
  audience: z.object({
    who: z.string(),
    pains: z.array(z.string()),
    desires: z.array(z.string()),
    objections: z.array(z.string()),
  }),
  voice: z.object({
    tone: z.array(z.string()).describe("Adjetivos: ej. directo, chistoso, cálido"),
    dos: z.array(z.string()),
    donts: z.array(z.string()),
    sampleLines: z.array(z.string()).describe("Frases que suenan exactamente como la marca"),
  }),
  content: z.object({
    pillars: z.array(z.string()),
    formatsThatFit: z.array(z.string()),
    canRecord: z.array(z.string()).describe("Lugares, personas, productos y recursos con los que SÍ pueden grabar"),
    faceOnCamera: z.enum(["yes", "no", "sometimes"]),
    constraints: z.string(),
  }),
  visual: z.object({
    primaryColor: z.string().describe("Hex"),
    accentColor: z.string().describe("Hex, se usa para resaltar palabras en los subtítulos"),
    mood: z.string(),
    recommendedPresetId: z.string(),
    presetReason: z.string(),
  }),
  cta: z.object({ primary: z.string(), secondary: z.string() }),
  references: z.object({ creatorsTheyLike: z.array(z.string()), notes: z.string() }),
  avoid: z.array(z.string()),
  openQuestions: z.array(z.string()).describe("Datos que faltan y conviene preguntarle al cliente"),
});
export type BrandBrain = z.infer<typeof BrandBrainSchema>;

export const PostAnalysisSchema = z.object({
  hook: z.string().describe("Las palabras/acción de los primeros 3 segundos"),
  hookType: z.string().describe("Ej: contrarian, pregunta, resultado primero, curiosidad, dolor"),
  pattern: z.array(z.string()).describe("Beats de la estructura en orden, ej: Hook, Problema, Prueba, CTA"),
  format: z.string().describe("Ej: talking head, POV, antes/después, tutorial, sketch"),
  whyItWorked: z.array(z.string()),
  emotion: z.string(),
  adaptationForClient: z.string().describe("Cómo el cliente puede hacer SU versión sin copiar"),
});
export type PostAnalysis = z.infer<typeof PostAnalysisSchema>;

export const ContentIdeaSchema = z.object({
  title: z.string(),
  format: z.string(),
  hooks: z.array(z.string()).describe("3 variantes de hook"),
  script: z.array(z.object({ beat: z.string(), line: z.string() })),
  shotList: z.array(z.string()).describe("Qué grabar, plano por plano, en lenguaje sencillo"),
  cta: z.string(),
  caption: z.string(),
  hashtags: z.array(z.string()),
  score: z.number().describe("0-100, qué tan probado está el patrón"),
  reasoning: z.string(),
  basedOnPostIds: z.array(z.string()),
  dayOffset: z.number().describe("0 = lunes de la semana del plan, 6 = domingo"),
});
export type ContentIdea = z.infer<typeof ContentIdeaSchema>;

export const PlanSchema = z.object({
  summary: z.string(),
  ideas: z.array(ContentIdeaSchema),
});

export type MemberRole = "agency" | "client";

export type ClientRow = {
  id: string;
  name: string;
  slug: string | null;
  niche: string | null;
  city: string | null;
  language: string;
  instagram: string | null;
  tiktok: string | null;
  website: string | null;
  plan_tier: "plan" | "edit" | "auto" | "full";
  edit_style_id: string | null;
  status: string;
  intake_token?: string;
  created_at: string;
};

export const PLAN_TIERS = {
  plan: { label: "Roots Plan", desc: "Investigación, plan semanal, hooks y guiones. El cliente graba y publica." },
  auto: { label: "Roots Auto", desc: "Todo lo anterior + el motor edita automático con el estilo del cliente." },
  edit: { label: "Roots Edit", desc: "Todo lo anterior + el equipo de PRA edita a mano." },
  full: { label: "Full PRA", desc: "Producción completa de la agencia." },
} as const;
