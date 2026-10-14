import { editRoute } from "@/server/edit-api";
import { getClientContext, styleForClient } from "@/server/engine";
import { buildEdl, type Direction } from "@/lib/edl/build";
import { sanitizeOverrides } from "@/lib/styles/sanitize";
import { chooseMusic, loadTracks } from "@/lib/music";
import { cleanProperty, TourEdlSchema } from "@/lib/tour/types";

/** Guarda el estilo elegido en la revisión y manda a render. */
export const POST = editRoute(async ({ edit, body, db }) => {
  if (!edit.transcript?.words) throw new Error("Este video todavía no está listo");
  if (!["review", "done", "failed"].includes(edit.status)) throw new Error("Este video se está procesando, espera a que termine");
  if (edit.kind === "tour") {
    // recorrido: se guarda el EDL con los datos y textos que editaron en la revisión
    const parsed = TourEdlSchema.safeParse(body.tourEdl ?? edit.edl);
    if (!parsed.success) throw new Error("El recorrido no es válido");
    const tour = { ...parsed.data, property: cleanProperty(parsed.data.property) };
    await db
      .from("edits")
      .update({ edl: tour, property: tour.property, status: "render_queued" })
      .eq("id", edit.id)
      .in("status", ["review", "done", "failed"]);
    return { status: "render_queued" };
  }
  const ctx = await getClientContext(db, edit.client_id);
  const styleId = (body.styleId as string) ?? edit.style_id;
  const moodId = body.moodId === undefined ? edit.mood_id : (body.moodId as string | null);
  const overrides = sanitizeOverrides(body.overrides ?? edit.style_overrides ?? {});
  if (styleId && typeof styleId !== "string") throw new Error("Estilo inválido");
  const style = styleForClient(ctx, { presetId: styleId, moodId, edit: overrides });
  const direction = (edit.transcript.direction as Direction) ?? null;
  const musicMode = typeof body.musicMode === "string" ? body.musicMode : edit.music_mode;
  const musicId = typeof body.musicId === "string" ? body.musicId : edit.music_id;
  if (direction && (body.musicMode !== undefined || body.musicId !== undefined)) {
    const tracks = await loadTracks(db, edit.client_id);
    const current = tracks.findIndex((t) => t.path === direction.music?.path);
    direction.music = chooseMusic({ mode: musicMode, musicId, tracks, aiPick: current >= 0 ? current : null, style });
    await db.from("edits").update({ transcript: { ...edit.transcript, direction } }).eq("id", edit.id);
  }
  const edl = direction
    ? buildEdl({ words: edit.transcript.words, sourceDuration: edit.transcript.duration, style, direction })
    : edit.edl;
  await db
    .from("edits")
    .update({ style_id: styleId, mood_id: moodId, style_overrides: overrides, edl, music_mode: musicMode ?? "auto", music_id: musicMode === "track" ? musicId : null, status: "render_queued" })
    .eq("id", edit.id)
    .in("status", ["review", "done", "failed"]);
  return { status: "render_queued" };
});
