import { clientRoute } from "@/server/api";
import { analyzeTopPosts, scanCompetitors } from "@/server/engine";

export const maxDuration = 300;

/** Escanea competidores (Apify), calcula outliers y analiza los mejores con Claude. */
export const POST = clientRoute(
  async ({ db, clientId, body }) => {
    const scan = body.skipScan ? { scanned: 0, posts: 0 } : await scanCompetitors(db, clientId, Number(body.perAccount) || 30);
    const analysis = await analyzeTopPosts(db, clientId, Number(body.analyze) || 8);
    return { ...scan, ...analysis };
  },
  { agencyOnly: true },
);
