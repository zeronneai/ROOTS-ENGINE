import { z } from "zod";
import { AGENCY_CONTEXT, json, structured } from "./claude";
import { PlanSchema, type BrandBrain, type PostAnalysis } from "../types";

export type WinningPost = {
  id: string;
  handle: string;
  views: number | null;
  outlier_score: number | null;
  caption: string | null;
  analysis: PostAnalysis | null;
};

/** Plan semanal: qué grabar, con hooks, guion y lista de tomas. */
export async function planWeek(opts: {
  brand: Partial<BrandBrain>;
  winners: WinningPost[];
  recentTitles: string[];
  count: number;
  weekStart: string; // YYYY-MM-DD (lunes)
  moodNotes?: string | null;
  extraInstructions?: string | null;
}): Promise<z.infer<typeof PlanSchema>> {
  return structured({
    schema: PlanSchema,
    maxTokens: 12000,
    system: `${AGENCY_CONTEXT}

You are the client's content strategist. Produce the weekly content plan.

Rules:
- Exactly ${opts.count} ideas, spread across the week (dayOffset 0..6), no two on the same day unless count > 7.
- Each idea must be based on a PROVEN pattern from the winning posts (fill basedOnPostIds with their ids) adapted to the client's offer, audience and voice. If there are no winners yet, use proven short-form patterns for the niche and leave basedOnPostIds empty.
- hooks: 3 variants, each speakable in under 3 seconds, in the brand's real language and slang.
- script: short beats (Hook, Problem, Proof, CTA or the pattern's beats). Lines must sound like the brand, not like an ad agency.
- shotList: plain instructions the owner can follow alone with a phone ("Graba de frente, a la altura de los ojos, con la barbería de fondo").
- Respect content.canRecord and content.constraints. Don't ask for things they can't do.
- Avoid repeating these recent ideas: ${json(opts.recentTitles)}
- score 0-100 = how proven the pattern is for this niche and audience.
- Mix pillars across the week (education, proof/results, behind the scenes, offer, trend).
- Write in the brand's language.`,
    user: `WEEK STARTING ${opts.weekStart}

BRAND BRAIN
${json(opts.brand)}

ACTIVE MOOD
${opts.moodNotes ?? "default"}

WINNING POSTS FROM COMPETITORS (best first)
${json(opts.winners)}

EXTRA INSTRUCTIONS FROM THE AGENCY
${opts.extraInstructions ?? "none"}`,
  });
}
