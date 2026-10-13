import { clientRoute } from "@/server/api";
import { discoverCompetitors } from "@/server/engine";

export const maxDuration = 300;

/** Busca competidores y referencias automáticamente (hashtags del giro + Claude). */
export const POST = clientRoute(({ db, clientId }) => discoverCompetitors(db, clientId), { agencyOnly: true });
