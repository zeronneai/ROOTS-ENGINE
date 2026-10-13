import { AGENCY_CONTEXT, json, structured } from "./claude";
import { BrandBrainSchema, type BrandBrain, type ClientRow } from "../types";
import { PRESETS } from "../styles/presets";

export type BrandInput = {
  kind: string;
  title: string | null;
  content: string | null;
  url: string | null;
  added_by_role: "agency" | "client";
  created_at: string;
  mood_name?: string | null;
};

/**
 * Sintetiza el Brand Brain. Mezcla:
 *  - lo que la agencia ya sabe (prioridad en datos duros)
 *  - lo que el cliente fue subiendo (prioridad en gustos y mood más reciente)
 *  - lo que ya publica en redes (cómo habla de verdad)
 */
export async function synthesizeBrand(opts: {
  client: ClientRow;
  current: Partial<BrandBrain> | null;
  inputs: BrandInput[];
  ownPosts?: { caption: string | null; views: number | null; transcript?: string | null }[];
}): Promise<BrandBrain> {
  const presets = PRESETS.map((p) => ({ id: p.id, name: p.name, niches: p.niches, description: p.description }));

  return structured({
    schema: BrandBrainSchema,
    maxTokens: 6000,
    system: `${AGENCY_CONTEXT}

Your job: build the client's BRAND BRAIN, the single source of truth every other step uses (competitor analysis, weekly plans, scripts, auto-editing).

Rules:
- Merge everything. Agency inputs win on hard facts (offer, prices, location). Client inputs win on taste, references and mood, and NEWER inputs win over older ones.
- If the current brain has something and nothing new contradicts it, keep it.
- Write in Spanish unless the business is clearly English-only; sampleLines must be in the language and slang the brand really uses.
- Do not invent facts. If something important is unknown, write your best neutral placeholder and add a short question to openQuestions.
- recommendedPresetId must be one of the edit style presets listed. Pick by niche AND by the brand's mood (a luxury barbershop could fit "editorial-minimal" better than "street-fade").
- Colors: use the brand's real colors if mentioned, else propose two hex colors that fit.`,
    user: `CLIENT
${json({ name: opts.client.name, niche: opts.client.niche, city: opts.client.city, language: opts.client.language, instagram: opts.client.instagram, tiktok: opts.client.tiktok, website: opts.client.website })}

CURRENT BRAND BRAIN (may be empty)
${json(opts.current ?? {})}

INPUTS (oldest first)
${json(opts.inputs)}

THEIR OWN RECENT POSTS
${json((opts.ownPosts ?? []).slice(0, 15))}

EDIT STYLE PRESETS
${json(presets)}`,
  });
}
