import { editRoute } from "@/server/edit-api";
import { getClientContext, styleForClient } from "@/server/engine";
import { directEdit } from "@/lib/ai/direct-edit";
import { buildEdl } from "@/lib/edl/build";
import { sanitizeOverrides } from "@/lib/styles/sanitize";
import { moodFromDescription } from "@/lib/ai/mood";
import { deepMerge } from "@/lib/styles/merge";
import { assetUrlsForEdl, signedAssets } from "@/lib/assets";
import { chooseMusic, loadTracks } from "@/lib/music";

export const maxDuration = 120;

/** Vuelve a pedirle a Claude la dirección con el estilo nuevo (cortes, zooms, emojis). */
export const POST = editRoute(async ({ edit, body, db }) => {
  if (!edit.transcript?.words) throw new Error("Este video todavía no está transcrito");
  if (!["review", "done", "failed"].includes(edit.status)) throw new Error("Este video se está procesando, espera a que termine");
  const ctx = await getClientContext(db, edit.client_id);
  const styleId = (body.styleId as string) ?? edit.style_id;
  const moodId = body.moodId === undefined ? edit.mood_id : (body.moodId as string | null);
  let overrides = sanitizeOverrides(body.overrides ?? edit.style_overrides ?? {});
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) || null : (edit.notes as string | null);
  let changedStyle = false;
  if (notes && notes !== edit.notes) {
    // instrucciones nuevas: lo que pidan de look (más motion, 3D, elegante) se vuelve ajuste de este video
    const base = styleForClient(ctx, { presetId: styleId, moodId, edit: overrides });
    const asked = await moodFromDescription({ description: notes, currentStyle: base });
    overrides = sanitizeOverrides(deepMerge(overrides as Record<string, unknown>, asked.overrides as Record<string, unknown>));
    changedStyle = true;
  }
  const style = styleForClient(ctx, { presetId: styleId, moodId, edit: overrides });
  const idea = edit.content_ideas ? { title: edit.content_ideas.title, hooks: edit.content_ideas.hooks } : null;
  if (edit.kind === "tour") throw new Error("Para este tipo de video usa “Rehacer video”");
  const tracks = await loadTracks(db, edit.client_id);
  const direction = await directEdit({
    words: edit.transcript.words,
    style,
    brand: ctx.brand.data,
    idea,
    notes,
    assets: await signedAssets(db, edit.assets),
    tracks: tracks.map((t) => ({ title: t.title, moods: t.moods, energy: t.energy, own: !!t.client_id })),
  });
  const musicMode = typeof body.musicMode === "string" ? body.musicMode : edit.music_mode;
  const musicId = typeof body.musicId === "string" ? body.musicId : edit.music_id;
  direction.music = chooseMusic({ mode: musicMode, musicId, tracks, aiPick: direction.musicTrack, style });
  const edl = buildEdl({ words: edit.transcript.words, sourceDuration: edit.transcript.duration, style, direction });
  await db
    .from("edits")
    .update({ transcript: { ...edit.transcript, direction }, edl, style_id: styleId, mood_id: moodId, style_overrides: overrides, notes, music_mode: musicMode ?? "auto", music_id: musicMode === "track" ? musicId : null })
    .eq("id", edit.id);
  return { edl, direction, overrides: changedStyle ? overrides : null, assetUrls: await assetUrlsForEdl(db, edl) };
});
