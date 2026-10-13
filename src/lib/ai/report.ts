import { z } from "zod";
import { AGENCY_CONTEXT, json, structured } from "./claude";
import type { BrandBrain, PostAnalysis } from "../types";

export const ReportSchema = z.object({
  headline: z.string().describe("Diagnóstico en una frase, directo"),
  market: z.object({
    summary: z.string(),
    whatWorks: z.array(z.string()).describe("Formatos, hooks y temas que están pegando en el nicho, con evidencia"),
    saturated: z.array(z.string()).describe("Lo que ya todos hacen y cansa"),
    gaps: z.array(z.string()).describe("Huecos que nadie está cubriendo bien"),
  }),
  competitors: z.array(
    z.object({
      handle: z.string(),
      platform: z.string(),
      whatTheyDoWell: z.string(),
      weakness: z.string(),
    }),
  ),
  brandAudit: z.object({
    currentState: z.string().describe("Cómo está hoy su contenido, con números si hay"),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    bestOwnContent: z.string().describe("Qué de lo que ya publicaron funcionó mejor y por qué, o 'sin datos'"),
  }),
  opportunities: z.array(
    z.object({
      title: z.string(),
      why: z.string(),
      how: z.string(),
      impact: z.enum(["alto", "medio", "bajo"]),
    }),
  ),
  strategy: z.object({
    positioning: z.string().describe("Cómo se debe posicionar en una o dos frases"),
    pillars: z.array(z.object({ name: z.string(), share: z.number().describe("porcentaje del contenido, suman 100"), description: z.string() })),
    cadence: z.string().describe("Cuántos videos por semana y en qué plataformas"),
    toneGuide: z.string(),
    hooksToTest: z.array(z.string()).describe("8 hooks listos para grabar, en el idioma de la marca"),
  }),
  recordingGuide: z.object({
    setup: z.array(z.string()).describe("Luz, audio, encuadre, celular vs cámara"),
    locations: z.array(z.string()),
    onCamera: z.string().describe("Quién sale a cuadro y cómo"),
    shotTypes: z.array(z.string()).describe("Tomas que hay que conseguir en cada visita, incluyendo b-roll"),
    dos: z.array(z.string()),
    donts: z.array(z.string()),
  }),
  kpis: z.array(z.object({ metric: z.string(), target: z.string(), why: z.string() })),
  next30Days: z.array(z.object({ week: z.number(), focus: z.string() })),
});
export type Report = z.infer<typeof ReportSchema>;

export async function buildReport(opts: {
  client: { name: string; niche: string | null; city: string | null; plan_tier: string };
  brand: Partial<BrandBrain>;
  ownStats: { handle: string; platform: string; posts: number; medianViews: number; followers: number | null } | null;
  ownTopPosts: { caption: string | null; views: number | null; likes: number | null; comments: number | null }[];
  competitors: { handle: string; platform: string; kind: string; note: string | null; medianViews: number | null }[];
  winners: { handle: string; views: number | null; outlier_score: number | null; analysis: PostAnalysis | null }[];
}) {
  return structured({
    schema: ReportSchema,
    maxTokens: 12000,
    system: `${AGENCY_CONTEXT}

You are PRA's head strategist writing the content strategy report for a client. The PRA team will film the client themselves (the client may not even know this engine exists), so the recording guide is for PRA's crew and for the owner on camera.
Be specific and evidence based: cite competitors, numbers and the analyzed winning videos. No generic marketing advice. If data is missing, say so and give the best recommendation anyway.
Everything in Spanish (Mexican, casual but professional). hooksToTest in the language the brand should post in.`,
    user: `CLIENT: ${json(opts.client)}

BRAND BRAIN: ${json(opts.brand)}

THEIR OWN ACCOUNT: ${json(opts.ownStats)}
THEIR TOP POSTS: ${json(opts.ownTopPosts)}

ACCOUNTS WE WATCH: ${json(opts.competitors)}

WINNING VIDEOS (analyzed): ${json(opts.winners)}`,
  });
}
