import { clientRoute } from "@/server/api";
import { createFlyer } from "@/server/flyers";
import type { FlyerFormat } from "@/lib/ai/flyer";

export const maxDuration = 300;

const strArr = (v: unknown, max: number) =>
  (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string").slice(0, max);

/** Genera un flyer nuevo, otra versión, o un ajuste de uno existente. */
export const POST = clientRoute(async ({ clientId, viewer, body, db }) =>
  createFlyer(db, clientId, viewer.id, {
    brief: String(body.brief ?? ""),
    format: (body.format as FlyerFormat) ?? "post",
    assetIds: strArr(body.assetIds, 12),
    extraPaths: strArr(body.extraPaths, 6),
    parentId: typeof body.parentId === "string" ? body.parentId : null,
    adjust: typeof body.adjust === "string" ? body.adjust.slice(0, 800) : null,
  }),
);
