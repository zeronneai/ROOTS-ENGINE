import { z } from "zod";
import { AGENCY_CONTEXT, json, structured } from "./claude";
import type { BrandBrain } from "../types";
import type { WebSummary } from "../web-stats";

export const WebAnalysisSchema = z.object({
  headline: z.string().describe("Lo más importante en una frase"),
  whereTheyLeave: z.string().describe("Dónde y por qué se va la gente, con números"),
  whatWorks: z.array(z.string()).describe("Lo que sí está funcionando, con números"),
  problems: z.array(z.object({ page: z.string(), issue: z.string(), fix: z.string(), priority: z.enum(["alta", "media", "baja"]) })),
  experiments: z.array(z.string()).describe("3 cambios concretos para probar este mes"),
  contentLinks: z.string().describe("Cómo conectar el contenido de redes con el sitio (de dónde llega la gente y a qué página mandarla)"),
});
export type WebAnalysis = z.infer<typeof WebAnalysisSchema>;

/** Lectura de la analítica del sitio: dónde se queda la gente, dónde se va y qué arreglar. */
export async function analyzeWeb(opts: { brand: Partial<BrandBrain>; client: { name: string; niche: string | null }; domain: string; days: number; stats: WebSummary }) {
  return structured({
    label: "Analítica web",
    schema: WebAnalysisSchema,
    maxTokens: 3000,
    system: `${AGENCY_CONTEXT}

You read first-party website analytics for a client site and explain them to a business owner. Be concrete and use the numbers.
Times are in seconds, scroll is the average % of the page seen, exitRate is % of views where the visit ended on that page, bounceRate is sessions with one page and under 10 seconds.
If the data is too small to conclude something (few visits), say so instead of inventing patterns. Spanish (Mexican, clear). No em dashes.`,
    user: `CLIENT: ${json(opts.client)}
SITE: ${opts.domain} · last ${opts.days} days
BRAND: ${json({ offer: opts.brand.offer, audience: opts.brand.audience })}
STATS: ${json(opts.stats)}`,
  });
}
