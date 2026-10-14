import { editRoute } from "@/server/edit-api";
import { cleanProperty } from "@/lib/tour/types";

/** Rehace un recorrido (otra canción, otros datos o instrucciones): regresa a la fila del worker. */
export const POST = editRoute(async ({ edit, body, db }) => {
  if (edit.kind !== "tour") throw new Error("Este video no es un recorrido");
  if (!["review", "done", "failed"].includes(edit.status)) throw new Error("Este video se está procesando, espera a que termine");
  const musicMode = body.musicMode === "track" || body.musicMode === "auto" ? body.musicMode : edit.music_mode;
  await db
    .from("edits")
    .update({
      property: body.property !== undefined ? cleanProperty(body.property) : edit.property,
      notes: typeof body.notes === "string" ? body.notes.slice(0, 1000) || null : edit.notes,
      music_mode: musicMode,
      music_id: musicMode === "track" && typeof body.musicId === "string" ? body.musicId : null,
      status: "queued",
      error: null,
    })
    .eq("id", edit.id)
    .in("status", ["review", "done", "failed"]);
  return { status: "queued" };
});
