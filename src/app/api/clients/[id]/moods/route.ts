import { clientRoute } from "@/server/api";
import { createMoodFromText } from "@/server/engine";

export const maxDuration = 60;

/** El cliente (o la agencia) describe un mood con sus palabras y Claude lo vuelve ajustes de edición. */
export const POST = clientRoute(async ({ db, clientId, body, viewer }) => {
  const description = String(body.description ?? "").trim();
  if (!description) throw new Error("Describe el mood");
  const references = Array.isArray(body.references) ? body.references.map(String) : [];
  const mood = await createMoodFromText(db, clientId, description, viewer.role, references);
  if (body.activate) {
    await db.from("brand_profiles").upsert({ client_id: clientId, active_mood_id: mood.id }, { onConflict: "client_id" });
  }
  return mood;
});
