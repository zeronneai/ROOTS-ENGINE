import { AGENCY_CONTEXT, json, structured } from "./claude";
import { PostAnalysisSchema, type BrandBrain, type PostAnalysis } from "../types";

export type PostForAnalysis = {
  id: string;
  handle: string;
  platform: string;
  caption: string | null;
  transcript: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  duration: number | null;
  outlier_score: number | null;
};

/** Desarma un video ganador de la competencia: hook, patrón, por qué funcionó y cómo adaptarlo. */
export async function analyzePost(post: PostForAnalysis, brand: Partial<BrandBrain>): Promise<PostAnalysis> {
  return structured({
    label: "Analizar videos ganadores",
    schema: PostAnalysisSchema,
    maxTokens: 2500,
    system: `${AGENCY_CONTEXT}

You break down short-form videos that over-performed (outliers) so a local business can make its own version.
Be concrete: quote the hook as said, name the structure beats, and explain why it worked using the numbers (outlier_score = views / that account's median views).
adaptationForClient must fit the client's brand, offer and what they can actually record. Never suggest copying; suggest the pattern.
Write in Spanish.`,
    user: `CLIENT BRAND BRAIN
${json(brand)}

OUTLIER POST
${json(post)}`,
  });
}
