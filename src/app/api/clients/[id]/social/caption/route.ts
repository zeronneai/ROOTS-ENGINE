import { clientRoute } from "@/server/api";
import { generateCaption } from "@/server/captions";

export const maxDuration = 120;

/** Escribe el copy viendo el video: fotos que saca el navegador + transcripción si es un video del motor. */
export const POST = clientRoute(async ({ db, clientId, body }) => {
  const frames = (Array.isArray(body.frames) ? body.frames : [])
    .filter((f): f is string => typeof f === "string" && f.length < 1_500_000)
    .slice(0, 8)
    .map((data) => ({ data: data.replace(/^data:image\/\w+;base64,/, ""), mediaType: "image/jpeg" as const }));

  let transcript: string | null = null;
  const editId = typeof body.editId === "string" ? body.editId : null;
  if (editId) {
    const { data } = await db.from("edits").select("transcript").eq("id", editId).eq("client_id", clientId).maybeSingle();
    const t = data?.transcript as { text?: string } | null;
    transcript = typeof t?.text === "string" ? t.text : null;
  }
  if (!frames.length && !transcript) throw new Error("No pude ver el video. Escoge o sube uno primero.");

  const out = await generateCaption(db, clientId, {
    frames,
    transcript,
    hint: typeof body.hint === "string" ? body.hint.slice(0, 500) : null,
    platforms: Array.isArray(body.platforms) ? body.platforms.map(String) : undefined,
  });
  return { caption: out.caption };
});
