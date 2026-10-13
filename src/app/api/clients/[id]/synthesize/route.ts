import { clientRoute } from "@/server/api";
import { synthesizeBrandFor } from "@/server/engine";

export const maxDuration = 120;

/** Re-sintetiza el Brand Brain con todo lo que han subido agencia y cliente. */
export const POST = clientRoute(({ db, clientId }) => synthesizeBrandFor(db, clientId));
