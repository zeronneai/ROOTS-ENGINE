import { clientRoute } from "@/server/api";
import { schedulePost } from "@/server/publishing";

export const maxDuration = 300;

/** Programa un post (el video se sube a Zernio y Zernio lo publica a la hora). */
export const POST = clientRoute(({ db, clientId, viewer, body }) => schedulePost(db, clientId, viewer.id, body));
