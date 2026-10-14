import { z } from "zod";
import { AGENCY_CONTEXT, json, structured } from "./claude";
import type { BrandBrain } from "../types";
import type { Property } from "../tour/types";

const TourCopySchema = z.object({
  rooms: z.array(z.string()).describe("Nombre corto de lo que se ve en cada clip, en orden: Fachada, Sala, Cocina, Recámara principal, Baño, Jardín, Alberca, Terraza, Vista..."),
  headline: z.string().describe("Título del video, máx 6 palabras, ej: Casa con alberca en Campestre"),
  highlights: z.array(z.string()).describe("2 a 4 frases muy cortas (máx 4 palabras) con lo más atractivo"),
  cta: z.string().describe("Llamado a la acción corto, ej: Agenda tu visita"),
  musicTrack: z.number().nullable().describe("Número de la canción que mejor va con la propiedad, o null"),
});

/**
 * La IA ve un cuadro de cada clip para nombrar los cuartos y escribe los textos del recorrido.
 * Nunca inventa precio, medidas ni datos: eso solo sale de lo que llenó el usuario.
 */
export async function tourCopy(opts: {
  brand: Partial<BrandBrain>;
  client: { name: string; city: string | null };
  property: Property;
  notes?: string | null;
  frames: { data: string; mediaType: "image/jpeg" }[];
  tracks: { title: string; moods: string[]; energy: number; own: boolean }[];
}) {
  const given = (opts.property.rooms ?? []).map((r) => r || null);
  const ask = (withFrames: boolean) =>
    structured({
      label: "Recorrido: cuartos y textos",
      schema: TourCopySchema,
      maxTokens: 1500,
      images: withFrames ? opts.frames : undefined,
      system: `${AGENCY_CONTEXT}

You direct a real estate property tour video for Instagram and TikTok (vertical, music, beat-synced cuts, animated property data).
You get one frame per clip, in order (if attached). Name what each clip shows in Spanish, 1 to 3 words (Fachada, Sala, Cocina, Recámara principal, Baño, Jardín, Alberca, Terraza, Cochera, Vista, Estudio...). If a name was given by the user for a clip, keep it.
Write a short headline and 2 to 4 highlights in Spanish (Mexican, real estate tone, premium but clear), based ONLY on the property data, the user notes and what you can see. Never invent prices, sizes, numbers, distances or addresses.
${opts.tracks.length ? "Pick the song that best fits (luxury: calm and elegant; family or modern: upbeat; rentals for young people: energetic)." : "musicTrack: null."}
No em dashes or long dashes.`,
      user: `AGENCY: ${json({ name: opts.client.name, city: opts.client.city, tone: opts.brand.voice?.tone })}
PROPERTY DATA: ${json(opts.property)}
USER NOTES: ${json(opts.notes ?? null)}
CLIPS: ${opts.frames.length} (names given by the user, null = you decide): ${json(given)}
${opts.tracks.length ? `SONGS (numbered from 0, energy -2 calm to 2 intense): ${json(opts.tracks.map((t, i) => ({ number: i, ...t })))}` : ""}`,
    });
  const out = await ask(opts.frames.length > 0).catch((e) => {
    if (!opts.frames.length) throw e;
    console.error("tourCopy: sin cuadros", e);
    return ask(false);
  });
  const n = Math.max(opts.frames.length, given.length);
  return {
    rooms: Array.from({ length: n }, (_, i) => given[i] || out.rooms[i] || ""),
    headline: opts.property.title || out.headline,
    highlights: out.highlights.slice(0, 4),
    cta: opts.property.cta || out.cta,
    musicTrack: out.musicTrack != null && opts.tracks[out.musicTrack] ? out.musicTrack : null,
  };
}
