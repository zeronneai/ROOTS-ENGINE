import { editRoute } from "@/server/edit-api";
import { getClientContext, styleForClient } from "@/server/engine";
import { directEdit } from "@/lib/ai/direct-edit";
import { buildEdl } from "@/lib/edl/build";
import { sanitizeOverrides } from "@/lib/styles/sanitize";

export const maxDuration = 120;

/** Vuelve a pedirle a Claude la dirección con el estilo nuevo (cortes, zooms, emojis). */
export const POST = editRoute(async ({ edit, body, db }) => {
  if (!edit.transcript?.words) throw new Error("Este video todavía no está transcrito");
  if (!["review", "done", "failed"].includes(edit.status)) throw new Error("Este video se está procesando, espera a que termine");
  const ctx = await getClientContext(db, edit.client_id);
  const styleId = (body.styleId as string) ?? edit.style_id;
  const moodId = body.moodId === undefined ? edit.mood_id : (body.moodId as string | null);
  const overrides = sanitizeOverrides(body.overrides ?? edit.style_overrides ?? {});
  const style = styleForClient(ctx, { presetId: styleId, moodId, edit: overrides });
  const idea = edit.content_ideas ? { title: edit.content_ideas.title, hooks: edit.content_ideas.hooks } : null;
  const direction = await directEdit({ words: edit.transcript.words, style, brand: ctx.brand.data, idea });
  const edl = buildEdl({ words: edit.transcript.words, sourceDuration: edit.transcript.duration, style, direction });
  await db
    .from("edits")
    .update({ transcript: { ...edit.transcript, direction }, edl, style_id: styleId, mood_id: moodId, style_overrides: overrides })
    .eq("id", edit.id);
  return { edl, direction };
});
