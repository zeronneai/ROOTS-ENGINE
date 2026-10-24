import { z } from "zod";
import { json, structured } from "./claude";

/**
 * La "Purple Roots Business Audit" que prometemos en purpleroots.agency/audit:
 * redes (primera impresión, contenido y hooks, consistencia), sitio web, Google y reseñas,
 * la oferta (dónde duda un cliente listo para comprar) y el seguimiento a quien escribe.
 * Entrega: lo que funciona y no hay que tocar, dónde se pierden clientes, y los primeros
 * movimientos en orden. Con calificación de 0 a 100.
 */

const Priority = z.enum(["high", "medium", "low"]);

const Problem = z.object({
  problem: z.string().describe("What is wrong, in plain words a business owner understands"),
  evidence: z.string().describe("What we saw that proves it: a number, a quote, a missing element. Never invent"),
  fix: z.string().describe("The concrete change, doable this month"),
  priority: Priority,
});

const AREA_KEYS = ["social", "website", "google", "offer", "followUp"] as const;
export type AuditAreaKey = (typeof AREA_KEYS)[number];

const Area = z.object({
  key: z.enum(AREA_KEYS),
  score: z.number().describe("0 to 100 for this area. If there was nothing to check, score what that absence costs (usually low)"),
  verdict: z.string().describe("One sentence verdict for this area"),
  working: z.array(z.string()).describe("What already works here, 0 to 3 items"),
  problems: z.array(Problem).describe("1 to 4 problems, most costly first"),
});

const Part1 = z.object({
  score: z.number().describe("Overall audit score 0 to 100, a weighted read of the five areas"),
  headline: z.string().describe("The diagnosis in one punchy sentence"),
  summary: z.string().describe("2 or 3 sentences: what is going on with this business online and what it is costing them"),
  areas: z.array(Area).describe("Exactly five, in this order: social, website, google, offer, followUp"),
  leaveAlone: z.array(z.string()).describe("What is working and should NOT be touched, 2 to 4 items"),
  notChecked: z.array(z.string()).describe("What we could not verify with the data we had (e.g. Facebook, DM response time)"),
});

const Part2 = z.object({
  social: z.object({
    firstImpression: z.object({
      verdict: z.string().describe("Would a new visitor follow in 3 seconds? Why or why not"),
      bio: z.string().describe("Read of the bio: is it clear what they do, for whom, where, and what to do next"),
      photo: z.string().describe("Profile photo and name: recognizable, consistent with the brand"),
      highlights: z.string().describe("Story highlights: are there any, do they answer buyer questions (prices, results, location, reviews)"),
      link: z.string().describe("Link in bio: is there one, where does it go, is it the right next step"),
    }),
    contentAndHooks: z.object({
      stopTheScroll: z.array(z.string()).describe("Which posts or formats stop the scroll, with numbers if available"),
      losePeople: z.array(z.string()).describe("Which posts or patterns lose people and why"),
      cadence: z.string().describe("How often they post and how recently, from the data"),
    }),
    brandConsistency: z.string().describe("Does the feed look and sound like one brand or like five"),
  }),
  google: z.object({
    standing: z.string().describe("Their rating and review count against the local competitors, in plain words. If not on Google, say it"),
    loves: z.array(z.object({ theme: z.string(), quote: z.string().describe("Short literal quote from a review") })).describe("0 to 4"),
    complaints: z.array(z.object({ theme: z.string(), quote: z.string(), fix: z.string().describe("Operational fix, not just marketing") })).describe("0 to 4, most serious first"),
    profileGaps: z.array(z.string()).describe("Missing or weak parts of the Google profile: hours, website, photos, category, replies to reviews"),
  }),
  competitors: z
    .array(
      z.object({
        name: z.string(),
        rating: z.number().nullable(),
        reviews: z.number().nullable(),
        instagram: z.string().nullable().describe("handle without @, only if it is in the data"),
        followers: z.number().nullable(),
        doingBetter: z.string().describe("What they do better than this business, specific"),
        whereYouWin: z.string().describe("Where this business can beat them"),
      }),
    )
    .describe("2 to 4 local competitors from the data, the most relevant first. Never invent numbers"),
});

const Part3 = z.object({
  customersLost: z
    .array(
      z.object({
        moment: z.string().describe("The moment in the customer journey, e.g. 'Finding you on Google', 'Landing on your Instagram', 'Trying to book', 'After sending a message'"),
        whatHappens: z.string().describe("What the customer experiences there and why they leave"),
        cost: z.string().describe("What it is costing, in plain words (lost calls, lost bookings, lower prices). Estimate only if the data supports it"),
      }),
    )
    .describe("3 to 5 leaks, in the order a customer meets them"),
  firstMoves: z
    .array(
      z.object({
        title: z.string().describe("Short imperative title"),
        why: z.string().describe("Why this first: the impact"),
        how: z.string().describe("Exactly what to do, step by step in one short paragraph"),
        timeframe: z.string().describe("e.g. 'This week', 'Next 30 days'"),
      }),
    )
    .describe("Exactly 3 priority moves, in the order we would make them"),
  quickWins: z.array(z.string()).describe("3 to 5 small fixes they can do today in under an hour each"),
  closingNote: z.string().describe("2 sentences from the Purple Roots team: honest, warm, no hard sell. Offer to help put the moves into action"),
});

export type AuditReport = z.infer<typeof Part1> & z.infer<typeof Part2> & z.infer<typeof Part3>;

export type AuditInput = {
  business: {
    name: string;
    intro: string | null;
    category: string | null;
    city: string;
    website: string | null;
    instagram: string | null;
    tiktok: string | null;
    facebook: string | null;
  };
  teamNotes: string | null;
  research: Record<string, unknown>;
};

const SYSTEM = (lang: "en" | "es", focus: string) => `You are the head strategist at Purple Roots Agency (PRA), a bilingual video marketing agency in El Paso, TX serving the El Paso / Ciudad Juarez borderplex. PRA has generated $21M+ for clients and 700M+ organic views for 100+ brands.

You are writing the FREE "Purple Roots Business Audit" for a local business owner who asked for it on our website. We promised them a real review by real people, not a bot, that goes through the whole business the way a customer does:
1. Social media and the first impression it makes (bio, profile photo, highlights, link; content and hooks, which posts stop the scroll and which lose people; brand consistency).
2. Their website, and whether it turns visitors into calls and bookings or just sits there.
3. Their Google listing and their reviews.
4. Their offer, and the exact spot where a ready customer would hesitate.
5. What happens after someone reaches out (lead follow-up), because that is where a lot of businesses lose people without ever knowing it.
And a plain written breakdown: what is working and what to leave alone, where customers are being lost (plain words, no jargon), and the first moves we would make, in the order we would make them.

Rules:
- Be specific and evidence based. Every problem must point to something in the data (a number, a quote, a missing element). Never invent numbers, reviews, followers or competitors. If data is missing, say so plainly and still give your best recommendation.
- For follow-up: judge only what you can see (contact options on the website, Google and bio, booking tools, WhatsApp, forms, hours, review replies, and the team notes if any). Put what you could not test in notChecked.
- Write for the owner: plain, direct, warm and respectful. No marketing jargon (no "leverage", "synergy", "omnichannel"). Short sentences.
- The business may be in a regulated industry (lawyers, medical, med spas): do not recommend claims they cannot legally make.
- Never use em dashes or long dashes. Use commas, periods or colons.
- Write everything in ${lang === "es" ? "Spanish (Mexican, casual but professional, use 'tú')" : "English (plain American English)"}.
- In this call write ONLY: ${focus}.`;

const USER = (i: AuditInput, extra = "") => `BUSINESS: ${json(i.business)}

NOTES FROM THE PRA TEAM (what they told us, what we saw when we contacted them): ${i.teamNotes || "none"}

RESEARCH WE GATHERED (Google profile and reviews, local market on Google Maps, competitor reviews, their website check, their social profiles and recent posts, competitors' social profiles): ${json(i.research)}
${extra}`;

export type AuditDraft = z.infer<typeof Part1> & z.infer<typeof Part2>;

/** Paso 1 de la escritura: el diagnóstico (calificación, áreas, redes, Google y competencia). */
export async function writeDiagnosis(input: AuditInput, lang: "en" | "es"): Promise<AuditDraft> {
  const [p1, p2] = await Promise.all([
    structured({ label: "Auditoría: diagnóstico", schema: Part1, maxTokens: 12000, system: SYSTEM(lang, "score, headline, summary, areas, leaveAlone, notChecked"), user: USER(input) }),
    structured({ label: "Auditoría: redes, Google y competencia", schema: Part2, maxTokens: 12000, system: SYSTEM(lang, "social, google, competitors"), user: USER(input) }),
  ]);
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const areas = AREA_KEYS.map((k) => p1.areas.find((a) => a.key === k)).filter((a): a is NonNullable<typeof a> => !!a);
  return { ...p1, score: clamp(p1.score), areas: areas.map((a) => ({ ...a, score: clamp(a.score) })), ...p2 };
}

/** Paso 2: dónde se pierden clientes, los 3 movimientos, arreglos rápidos y el cierre, a partir del diagnóstico. */
export async function writeClosing(input: AuditInput, lang: "en" | "es", draft: AuditDraft): Promise<AuditReport> {
  const p3 = await structured({
    label: "Auditoría: dónde se pierden clientes y primeros pasos",
    schema: Part3,
    maxTokens: 10000,
    system: SYSTEM(lang, "customersLost, firstMoves, quickWins, closingNote. Base them on the diagnosis below so the audit reads as one piece"),
    user: USER(input, `\nDIAGNOSIS ALREADY WRITTEN: ${json({ score: draft.score, headline: draft.headline, summary: draft.summary, areas: draft.areas, leaveAlone: draft.leaveAlone, social: draft.social, google: draft.google, competitors: draft.competitors })}`),
  });
  return { ...draft, ...p3 };
}
