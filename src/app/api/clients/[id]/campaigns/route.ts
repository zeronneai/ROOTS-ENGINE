import { clientRoute } from "@/server/api";
import { cleanBrief, generateCampaign } from "@/server/campaigns";

export const maxDuration = 300;

/** Crea una campaña: fechas y eventos → análisis e ideas de contenido. */
export const POST = clientRoute(({ db, clientId, body }) => generateCampaign(db, clientId, cleanBrief(body)), { agencyOnly: true });
