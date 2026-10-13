import { editRoute } from "@/server/edit-api";
import { getClientContext, styleForClient } from "@/server/engine";
import { buildEdl, type Direction } from "@/lib/edl/build";
import { sanitizeOverrides } from "@/lib/styles/sanitize";

/** Guarda el estilo elegido en la revisión y manda a render. */
export const POST = editRoute(async ({ edit, body, db }) => {
  if (!edit.transcript?.words) throw new Error("Este video todavía no está listo");
  if (!["review", "done", "failed"].includes(edit.status)) throw new Error("Este video se está procesando, espera a que termine");
  const ctx = await getClientContext(db, edit.client_id);
  const styleId = (body.styleId as string) ?? edit.style_id;
  const moodId = body.moodId === undefined ? edit.mood_id : (body.moodId as string | null);
  const overrides = sanitizeOverrides(body.overrides ?? edit.style_overrides ?? {});
  if (styleId && typeof styleId !== "string") throw new Error("Estilo inválido");
  const style = styleForClient(ctx, { presetId: styleId, moodId, edit: overrides });
  const direction = (edit.transcript.direction as Direction) ?? null;
  const edl = direction
    ? buildEdl({ words: edit.transcript.words, sourceDuration: edit.transcript.duration, style, direction })
    : edit.edl;
  await db
    .from("edits")
    .update({ style_id: styleId, mood_id: moodId, style_overrides: overrides, edl, status: "render_queued" })
    .eq("id", edit.id)
    .in("status", ["review", "done", "failed"]);
  return { status: "render_queued" };
});
