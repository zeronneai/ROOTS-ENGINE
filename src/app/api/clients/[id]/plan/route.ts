import { clientRoute } from "@/server/api";
import { generatePlan } from "@/server/engine";

export const maxDuration = 300;

/** Genera el plan de la semana (ideas, hooks, guiones, tomas). */
export const POST = clientRoute(
  ({ db, clientId, body }) =>
    generatePlan(db, clientId, {
      count: body.count ? Number(body.count) : undefined,
      weekStart: typeof body.weekStart === "string" ? body.weekStart : undefined,
      extra: typeof body.extra === "string" ? body.extra : null,
    }),
  { agencyOnly: true },
);
