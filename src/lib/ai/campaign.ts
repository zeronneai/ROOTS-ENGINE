import { z } from "zod";
import { AGENCY_CONTEXT, json, structured } from "./claude";
import type { BrandBrain } from "../types";
import type { Research } from "../../server/research";
import type { WinningPost } from "./planner";

export const TONES = {
  comedia: "Comedia: sketches, situaciones de la vida real, exageración, personajes, remates",
  viral: "Viral / trend: formatos y audios en tendencia adaptados a la marca, POV, memes",
  creativo: "Creativo / cinemático: tomas bonitas, transiciones, estética, storytelling visual",
  venta: "Venta / promo: ofertas, urgencia, producto al frente, CTA directo",
  detras: "Detrás de cámaras: preparación del evento, equipo, proceso, día a día",
  educativo: "Educativo / tips: cómo elegir, cómo usar, errores comunes",
} as const;
export type Tone = keyof typeof TONES;

export type CampaignBrief = {
  name: string;
  goal: string | null;
  dateFrom: string;
  dateTo: string;
  events: { date: string; name: string; details: string | null }[];
  tones: Tone[];
  count: number;
  notes: string | null;
  canRecord: string | null;
  /** la lista tal cual la pegaron (de WhatsApp, correo, notas) */
  rawList: string | null;
};

const IdeaSchema = z.object({
  date: z.string().describe("YYYY-MM-DD, día en que se publica, dentro del rango de la campaña"),
  event: z.string().nullable().describe("Nombre del evento o fecha a la que pertenece, o null si es contenido de calentamiento general"),
  tone: z.string().describe("Uno de los tonos pedidos: comedia, viral, creativo, venta, detras, educativo"),
  title: z.string(),
  format: z.string().describe("Reel sketch, POV, trend con audio, carrusel, transición, entrevista en la calle..."),
  concept: z.string().describe("La idea completa en 2 o 3 frases: qué pasa, cuál es el chiste o el giro, por qué la gente lo comparte"),
  hooks: z.array(z.string()).describe("3 variantes de hook"),
  script: z.array(z.object({ beat: z.string(), line: z.string() })).describe("Escenas o beats con lo que se dice o pasa en cada uno"),
  shotList: z.array(z.string()).describe("Qué grabar, plano por plano, en lenguaje sencillo"),
  props: z.array(z.string()).describe("Qué se necesita: vestuario, props, personas, lugar"),
  cta: z.string(),
  caption: z.string(),
  hashtags: z.array(z.string()),
  viralScore: z.number().describe("0-100, qué tan probable es que se comparta"),
  reasoning: z.string().describe("Por qué funciona para esta audiencia y este evento"),
});

export const CampaignSchema = z.object({
  summary: z.string().describe("Resumen de la campaña en 2 o 3 frases"),
  analysis: z.object({
    bigIdea: z.string().describe("El concepto central que une toda la campaña"),
    audienceAngle: z.string().describe("Qué siente o busca la audiencia en estas fechas y cómo lo aprovechamos"),
    whatWorks: z.array(z.string()).describe("3 a 5 patrones que funcionan para este tipo de evento en redes"),
    avoid: z.array(z.string()).describe("2 a 4 cosas que ya están muy vistas o que no conviene hacer"),
    recurringBit: z.string().nullable().describe("Un personaje, frase o serie recurrente para darle continuidad, o null"),
    rhythm: z.string().describe("Cómo repartir las publicaciones: calentamiento, día del evento, después"),
  }),
  ideas: z.array(IdeaSchema),
});
export type Campaign = z.infer<typeof CampaignSchema>;

/** Ideas de contenido para una campaña con fechas y eventos concretos. */
export async function planCampaign(opts: {
  brand: Partial<BrandBrain>;
  client: { name: string; city: string | null; niche: string | null };
  brief: CampaignBrief;
  research: Research;
  winners: WinningPost[];
  specialDates: { date: string; name: string }[];
  recentTitles: string[];
  today: string;
}): Promise<Campaign> {
  const b = opts.brief;
  return structured({
    label: "Campaña",
    schema: CampaignSchema,
    maxTokens: 16000,
    system: `${AGENCY_CONTEXT}

You are the head creative of a social media agency known for short-form content that gets shared: sketches, POVs, trends and cinematic reels for local businesses on the US/Mexico border.
The client asked for a CAMPAIGN around specific dates and events, not a generic weekly plan.

Rules:
- Exactly ${b.count} ideas, all dated between ${b.dateFrom} and ${b.dateTo} (YYYY-MM-DD). Put warm-up content before each event, the strongest piece on or right before the event day, and a recap or follow-up after when it makes sense.
- Each idea belongs to one of the requested tones: ${b.tones.join(", ")}. Spread them; comedy and viral ideas must have a real joke, twist or relatable situation, not just "fun video".
- Think of the campaign AS A WHOLE first (one concept, one look, recurring jokes or characters across all events), then the pieces. Include some umbrella ideas that promote the whole season or all the events together (event: null), not only one idea per event.
- If the brief has a pasted list (rawList), read every event, date and detail in it; it is the main source.
- Ideas must be specific to THIS business and THESE events. Use the brand's real products, place, people, slang and city. No generic "show your product" ideas.
- Comedy: think situations the audience lives (the customer who can't decide, the friend who always arrives late, mom's reaction, the boyfriend waiting outside). Use characters and exaggeration. The punchline must land in under 15 seconds.
- Viral/trend: describe the format so it can be adapted to whatever audio is trending; don't name a specific song.
- hooks: 3 variants, each speakable or readable in under 3 seconds, in the brand's language and slang.
- shotList and props: plain, doable instructions with a phone and the people the business has. Respect what they can record.
- Never invent prices, promos, dates or addresses that are not in the brief or brand data.
- Avoid repeating these recent ideas: ${json(opts.recentTitles)}
- Write everything in the brand's language (Spanish, English or both as the brand speaks). No em dashes or long dashes.`,
    user: `TODAY: ${opts.today}

CLIENT: ${json(opts.client)}

CAMPAIGN BRIEF
${json(b)}

TONES REQUESTED
${b.tones.map((t) => `- ${t}: ${TONES[t]}`).join("\n")}

OTHER SPECIAL DATES IN THE RANGE (use only if they fit)
${json(opts.specialDates)}

BRAND BRAIN
${json(opts.brand)}

RESEARCH (offer, positioning, market gaps, audience)
${json(opts.research)}

WINNING POSTS FROM COMPETITORS
${json(opts.winners)}`,
  });
}

const ParsedSchema = z.object({
  name: z.string().describe("Nombre corto para la campaña, ej: Temporada de rodeos y Halloween"),
  dateFrom: z.string().nullable().describe("YYYY-MM-DD del primer evento"),
  dateTo: z.string().nullable().describe("YYYY-MM-DD del último evento"),
  events: z.array(
    z.object({
      date: z.string().nullable().describe("YYYY-MM-DD; si no dicen el año, el próximo que viene desde hoy; null si no hay fecha"),
      name: z.string().describe("Nombre corto del evento"),
      details: z.string().nullable().describe("Lugar, horario y todo lo demás que dice la lista sobre ese evento, sin inventar"),
    }),
  ),
});

/** Convierte una lista pegada (WhatsApp, correo, notas) en eventos con fecha. */
export async function parseEventList(text: string, today: string) {
  return structured({
    label: "Campaña: leer lista",
    schema: ParsedSchema,
    maxTokens: 4000,
    system: `You turn a pasted list of upcoming events (from WhatsApp, email or notes, in Spanish or English, any format) into structured events.
Today is ${today}. Dates like "sáb 25", "Nov 2", "2/11" or "este viernes" must become YYYY-MM-DD in the next occurrence from today (Mexican format is day/month unless clearly US).
One item per event. If an event spans several days, use the first day and put the range in details. Keep every detail the list gives (place, time, what to bring, promos) in details, without inventing anything.
Write names and details in the same language as the list. No em dashes or long dashes.`,
    user: text.slice(0, 8000),
  });
}
