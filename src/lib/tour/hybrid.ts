import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getClientContext } from "../../server/engine";
import { tourCopy } from "../ai/tour";
import type { BrollCopy } from "../edl/build";
import { cleanProperty, isRealEstateNiche } from "./types";
import { specList } from "./specs";

/**
 * Video híbrido: la IA ve un cuadro de cada clip de tomas sin voz y escribe
 * el nombre de cada toma y frases cortas. Los datos de la propiedad (si es inmobiliaria)
 * salen solo de lo que llenó el usuario.
 */
export async function hybridCopy(
  db: SupabaseClient,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  edit: any,
  file: string,
  brollClips: { start: number; end: number }[],
  dir: string,
): Promise<BrollCopy> {
  const frames: { data: string; mediaType: "image/jpeg" }[] = [];
  for (const [i, c] of brollClips.slice(0, 12).entries()) {
    const out = path.join(dir, `broll-${i}.jpg`);
    try {
      execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", ((c.start + c.end) / 2).toFixed(2), "-i", file, "-frames:v", "1", "-vf", "scale=512:-2", "-q:v", "5", out]);
      frames.push({ data: readFileSync(out).toString("base64"), mediaType: "image/jpeg" });
    } catch {
      // seguimos sin ese cuadro
    }
  }
  const ctx = await getClientContext(db, edit.client_id);
  const realEstate = isRealEstateNiche(ctx.client.niche);
  const given = cleanProperty(edit.property);
  const property = { ...given, rooms: null, variant: realEstate ? ("realestate" as const) : ("cinematic" as const) };
  const copy = await tourCopy({
    brand: ctx.brand.data,
    client: { name: ctx.client.name, city: ctx.client.city },
    property,
    notes: edit.notes,
    frames: frames.length === brollClips.length ? frames : [],
    tracks: [],
  });
  const specs = realEstate ? specList(property) : [];
  const highlights = [...copy.highlights, ...(given.amenities ?? [])].filter((x, i, a) => a.indexOf(x) === i);
  const endInfo = given.price || given.agentName || given.agentPhone ? { price: given.price, agentName: given.agentName, agentPhone: given.agentPhone } : null;
  return { labels: copy.rooms.slice(0, brollClips.length), specs, highlights, cta: given.cta ?? null, fallbackCta: copy.cta, endInfo };
}
