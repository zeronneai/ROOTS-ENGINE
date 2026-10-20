import { clientRoute } from "@/server/api";
import { cleanRebrandBrief, createRebrand } from "@/server/rebrands";

export const maxDuration = 300;

/** Crea un análisis de rebranding: diagnóstico, segmento, nombres y 3 direcciones. */
export const POST = clientRoute(
  ({ db, clientId, viewer, body }) =>
    createRebrand(
      db,
      clientId,
      viewer.id,
      cleanRebrandBrief(body),
      (Array.isArray(body.uploads) ? body.uploads : []).filter((p): p is string => typeof p === "string").slice(0, 6),
    ),
  { agencyOnly: true },
);
