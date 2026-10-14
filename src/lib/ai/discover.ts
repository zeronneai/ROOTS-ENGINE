import { z } from "zod";
import { AGENCY_CONTEXT, json, structured } from "./claude";
import type { BrandBrain, ClientRow } from "../types";

const QueriesSchema = z.object({
  instagramHashtags: z.array(z.string()).describe("6 a 8 hashtags sin #, mezcla de locales (ciudad + giro) y del nicho en general, en español e inglés"),
  tiktokHashtags: z.array(z.string()).describe("4 a 6 hashtags sin #"),
});

/** Claude decide dónde buscar a la competencia según el giro, ciudad e idioma. */
export async function discoveryQueries(client: ClientRow, brand: Partial<BrandBrain>) {
  return structured({
    label: "Buscar competencia: hashtags",
    schema: QueriesSchema,
    maxTokens: 800,
    system: `${AGENCY_CONTEXT}

You pick hashtags to find who is winning short-form video in a client's space.
Mix: (a) local hashtags combining the city/region and the niche (e.g. elpasolawyer, abogadoelpaso, lascrucesbarber), and (b) broader niche hashtags where the best creators of that niche post (e.g. personalinjurylawyer, abogadodeaccidentes). Include Spanish and English if the brand is bilingual.
Prefer hashtags that real businesses and creators actually use. No spaces, no #.`,
    user: json({
      name: client.name,
      niche: client.niche,
      city: client.city,
      language: client.language,
      oneLiner: brand.oneLiner,
      offer: brand.offer?.mainProducts,
      audience: brand.audience?.who,
    }),
  });
}

export type Candidate = {
  platform: "instagram" | "tiktok";
  handle: string;
  displayName: string | null;
  posts: number;
  maxViews: number;
  totalViews: number;
  captions: string[];
};

const PickSchema = z.object({
  picks: z.array(
    z.object({
      platform: z.enum(["instagram", "tiktok"]),
      handle: z.string(),
      kind: z
        .enum(["competitor", "reference"])
        .describe("competitor = ofrece EL MISMO servicio específico en la misma zona; reference = todo lo demás que vale la pena estudiar"),
      reason: z.string().describe("Una frase en español de por qué vale la pena vigilarla"),
    }),
  ),
});

/** De las cuentas encontradas por hashtags, Claude escoge las que sí vale la pena vigilar. */
export async function pickCompetitors(opts: {
  client: ClientRow;
  brand: Partial<BrandBrain>;
  candidates: Candidate[];
  max: number;
}) {
  if (!opts.candidates.length) return [];
  const out = await structured({
    label: "Buscar competencia: elegir cuentas",
    schema: PickSchema,
    maxTokens: 2500,
    system: `${AGENCY_CONTEXT}

From accounts found posting under the client's niche hashtags, pick up to ${opts.max} worth monitoring.
"competitor" only if they sell the SAME specific service to the same area (a family or immigration lawyer is NOT a competitor of a personal injury lawyer, a tattoo shop is not a competitor of a barbershop). Everything else useful is a "reference".
Keep: direct competitors in the same niche and region, and strong niche creators whose videos clearly perform (high views) and whose formats the client could adapt.
Discard: spam, meme pages, reposters, accounts in unrelated niches, giant brands the client can't learn from, and the client itself.
Aim for roughly half competitors and half references when possible. Use handles exactly as given.`,
    user: `CLIENT: ${json({ name: opts.client.name, niche: opts.client.niche, city: opts.client.city, oneLiner: opts.brand.oneLiner })}
CANDIDATES: ${json(opts.candidates)}`,
  });
  const valid = new Set(opts.candidates.map((c) => `${c.platform}:${c.handle}`));
  return out.picks.filter((p) => valid.has(`${p.platform}:${p.handle.toLowerCase()}`)).slice(0, opts.max);
}
