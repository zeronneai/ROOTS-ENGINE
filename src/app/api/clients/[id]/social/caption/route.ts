import { clientRoute } from "@/server/api";
import { generateCaptions, generateHooks } from "@/server/captions";

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
  // un video de "Aprobar videos": lo que se dice ya lo transcribió el worker
  const itemId = typeof body.itemId === "string" ? body.itemId : null;
  if (itemId) {
    const { data } = await db.from("queue_items").select("transcript").eq("id", itemId).eq("client_id", clientId).maybeSingle();
    transcript = (data?.transcript as string | null) ?? transcript;
  }
  if (!frames.length && !transcript) throw new Error("No pude ver el video. Escoge o sube uno primero.");

  // kind: "hooks" = 3 textos para encima del video; si no, el copy del post
  if (body.kind === "hooks") return generateHooks(db, clientId, { frames, transcript, hint: typeof body.hint === "string" ? body.hint.slice(0, 500) : null });

  const out = await generateCaptions(db, clientId, {
    frames,
    transcript,
    hint: typeof body.hint === "string" ? body.hint.slice(0, 500) : null,
    platforms: Array.isArray(body.platforms) ? body.platforms.map(String) : undefined,
    avoid: Array.isArray(body.avoid) ? body.avoid.map(String).map((t) => t.slice(0, 600)) : undefined,
  });
  return { caption: out.options[0].text, options: out.options };
});
