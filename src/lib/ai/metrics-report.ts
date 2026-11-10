import { z } from "zod";
import { AGENCY_CONTEXT, json, structured } from "./claude";

/**
 * Reporte completo de métricas de un cliente: redes, anuncios, sitio y negocio en un periodo.
 * Lo escribe la IA a partir de los números que ya junta el panel (/metrics/<id>), sin inventar nada.
 */

const Tone = z.enum(["good", "bad", "neutral"]);

const Section = z.object({
  key: z.enum(["ads", "instagram", "tiktok", "facebook", "social", "web", "business"]).describe("Which channel this section covers"),
  title: z.string().describe("Short title, e.g. 'Meta Ads', 'Instagram', 'Sitio web'"),
  verdict: z.string().describe("One sentence: how this channel did in the period"),
  tone: Tone,
  keyNumbers: z
    .array(z.object({ label: z.string(), value: z.string().describe("Exactly as in the data, formatted (e.g. '$1,240', '3.2%', '18,400')"), note: z.string().nullable().describe("Short context: change vs previous period, benchmark, etc. Null if none") }))
    .describe("3 to 6 numbers that matter most for this channel"),
  working: z.array(z.string()).describe("What is working, 0 to 4 items, each backed by a number from the data"),
  problems: z
    .array(z.object({ problem: z.string(), evidence: z.string().describe("The number or fact from the data that shows it"), fix: z.string().describe("Concrete change to make") }))
    .describe("0 to 4 problems, most costly first"),
});

const Campaign = z.object({
  name: z.string().describe("Campaign name exactly as in the data"),
  platform: z.string().describe("Meta or Google"),
  decision: z.enum(["escalar", "mantener", "ajustar", "pausar"]),
  why: z.string().describe("One or two sentences with the numbers that justify it"),
});

const Schema = z.object({
  headline: z.string().describe("The period in one punchy sentence"),
  summary: z.string().describe("3 or 4 sentences for the client: what happened, what it cost, what it brought, what comes next"),
  score: z.number().describe("0 to 100: overall health of their marketing in this period"),
  sections: z.array(Section).describe("One per channel that has data, in this order when present: ads, instagram, tiktok, facebook, social, web, business. Skip channels with no data"),
  campaigns: z.array(Campaign).describe("Every paid campaign with spend in the period, biggest spend first. Empty if no ads data"),
  content: z.object({
    repeat: z.array(z.string()).describe("Formats, topics or hooks to repeat, with the post or number that proves it. 0 to 4"),
    stop: z.array(z.string()).describe("What to stop or change, with evidence. 0 to 3"),
    cadence: z.string().describe("Posting frequency read from the data, and what it should be"),
  }),
  funnel: z.string().describe("2 or 3 sentences connecting ads, social, website and business results: where people come from and where they drop. Only what the data supports"),
  nextSteps: z
    .array(z.object({ title: z.string().describe("Short imperative"), how: z.string().describe("Exactly what to do, one short paragraph"), when: z.string().describe("e.g. 'Esta semana', 'Próximos 30 días'") }))
    .describe("3 to 5 moves in priority order"),
  notMeasured: z.array(z.string()).describe("What we could not see with this data (e.g. calls answered, signed cases, DM response time) and how to start measuring it"),
});

export type MetricsReport = z.infer<typeof Schema>;

const SYSTEM = `${AGENCY_CONTEXT}

You are the head of performance at PRA writing the full marketing report for one client for a given period: paid ads, social media, website and (if available) business results. The agency will send it to the client as a PDF, so write for the business owner.

Rules:
- Use ONLY the numbers in the data. Never invent numbers, posts, campaigns or results. If a channel has no data, leave it out of sections and mention it in notMeasured.
- Quote numbers formatted for humans (commas, $, %). Compare with the previous period when the data has it.
- For ads: judge each campaign by cost per result, results and CTR against the account average. "pausar" only when it spent meaningfully with no or very expensive results.
- Results in ads are leads, messages and purchases as Meta/Google report them, not signed clients. Say so when relevant.
- Regulated industries (lawyers, medical, med spas): do not recommend claims they cannot legally make (no guaranteed results).
- Plain, direct, warm and respectful. No jargon (no "leverage", "synergy", "omnichannel"). Short sentences.
- Write everything in Spanish (Mexican, casual but professional, use "tú").
- Never use em dashes or long dashes. Use commas, periods or colons.`;

export async function writeMetricsReport(facts: unknown) {
  const r = await structured({
    label: "Reporte de métricas",
    schema: Schema,
    maxTokens: 12000,
    system: SYSTEM,
    user: `DATA FOR THE PERIOD (everything the agency dashboard measured):\n${json(facts)}`,
  });
  return { ...r, score: Math.max(0, Math.min(100, Math.round(r.score))) };
}
