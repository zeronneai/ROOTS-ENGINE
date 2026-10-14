import { clientRoute } from "@/server/api";
import { createMoodFromText } from "@/server/engine";

export const maxDuration = 60;

/** El cliente (o la agencia) describe un mood con sus palabras y Claude lo vuelve ajustes de edición. */
export const POST = clientRoute(async ({ db, clientId, body, viewer }) => {
  const frames = Array.isArray(body.frames)
    ? body.frames.filter((f: unknown): f is string => typeof f === "string" && f.length < 400_000).slice(0, 8)
    : [];
  const description = String(body.description ?? "").trim() || (frames.length ? "Que mis videos se editen como este video de referencia" : "");
  if (!description) throw new Error("Describe el mood");
  const references = Array.isArray(body.references) ? body.references.map(String) : [];
  const stats = typeof body.stats === "object" && body.stats ? (body.stats as Record<string, unknown>) : {};
  const mood = await createMoodFromText(
    db,
    clientId,
    description,
    viewer.role,
    references,
    frames.length ? { frames, stats, name: typeof body.name === "string" ? body.name : null } : undefined,
  );
  if (body.activate) {
    await db.from("brand_profiles").upsert({ client_id: clientId, active_mood_id: mood.id }, { onConflict: "client_id" });
  }
  return mood;
});
