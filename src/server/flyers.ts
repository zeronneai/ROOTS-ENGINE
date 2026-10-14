import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getClientContext } from "./engine";
import { FORMATS, renderFlyer, writeFlyerPrompt, type FlyerFormat, type RefImage } from "@/lib/ai/flyer";
import { loadResearch } from "./research";
import { upcomingDates } from "@/lib/special-dates";

type AssetRow = { id: string; kind: "style" | "library"; category: RefImage["role"]; label: string | null; path: string; pinned: boolean };

const MAX_STYLE = 3;
const MAX_PEOPLE = 4;
const MAX_TOTAL = 14;

async function loadImage(db: SupabaseClient, bucket: string, path: string, role: RefImage["role"], label?: string | null): Promise<RefImage> {
  const { data, error } = await db.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`No se pudo leer la imagen ${path}`);
  const { data: signed } = await db.storage.from(bucket).createSignedUrl(path, 60 * 60);
  const mimeType = data.type && data.type.startsWith("image/") ? data.type : path.endsWith(".png") ? "image/png" : "image/jpeg";
  return { role, label, mimeType, data: Buffer.from(await data.arrayBuffer()).toString("base64"), url: signed?.signedUrl };
}

/**
 * Crea un flyer: junta estilo + imágenes fijas (las "siempre incluir" y las elegidas) + imágenes de este flyer,
 * Claude escribe la dirección de arte y Nano Banana lo genera. Si `parentId` + `adjust`, edita un flyer anterior.
 */
export async function createFlyer(
  db: SupabaseClient,
  clientId: string,
  userId: string | null,
  input: { brief: string; format: FlyerFormat; assetIds: string[]; extraPaths: string[]; parentId?: string | null; adjust?: string | null },
) {
  const brief = input.brief.trim().slice(0, 1500);
  if (!brief) throw new Error("Escribe para qué es el flyer");
  if (!FORMATS[input.format]) throw new Error("Formato inválido");
  for (const p of input.extraPaths) if (!p.startsWith(`${clientId}/`) || p.includes("..")) throw new Error("Ruta inválida");

  const { data: row, error } = await db
    .from("flyers")
    .insert({
      client_id: clientId,
      brief,
      format: input.format,
      asset_ids: input.assetIds,
      extra_paths: input.extraPaths,
      parent_id: input.parentId ?? null,
      adjust: input.adjust?.trim() || null,
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw error;

  try {
    const ctx = await getClientContext(db, clientId);
    const { data: assets } = await db.from("brand_assets").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
    const all = (assets ?? []) as AssetRow[];
    const style = all.filter((a) => a.kind === "style").slice(0, MAX_STYLE);
    const chosen = new Set(input.assetIds);
    let library = all.filter((a) => a.kind === "library" && (a.pinned || chosen.has(a.id)));
    // el modelo acepta pocas personas por imagen
    const people = library.filter((a) => a.category === "persona").slice(0, MAX_PEOPLE);
    library = [...library.filter((a) => a.category !== "persona"), ...people];

    const images: RefImage[] = [];
    if (input.parentId && input.adjust) {
      const { data: parent } = await db.from("flyers").select("output_path").eq("id", input.parentId).eq("client_id", clientId).single();
      if (!parent?.output_path) throw new Error("No encontré el flyer que quieres ajustar");
      images.push(await loadImage(db, "brand", parent.output_path, "current"));
    }
    // primero lo que debe salir sí o sí (logo, fotos, imágenes del flyer), luego el estilo
    for (const a of library.sort((x, y) => Number(y.category === "logo") - Number(x.category === "logo")))
      images.push(await loadImage(db, "brand", a.path, a.category === "logo" ? "logo" : a.category, a.label));
    for (const p of input.extraPaths) images.push(await loadImage(db, "brand", p, "extra"));
    for (const a of style) images.push(await loadImage(db, "brand", a.path, "style", a.label));
    const refs = images.slice(0, MAX_TOTAL);

    const art = await writeFlyerPrompt({
      brand: ctx.brand.data,
      client: { name: ctx.client.name, niche: ctx.client.niche, city: ctx.client.city, instagram: ctx.client.instagram },
      brief,
      format: input.format,
      images: refs,
      adjust: input.adjust,
      research: await loadResearch(db, clientId, ctx.brand.data),
      dates: upcomingDates(new Date(), 30).map(({ date, name, inDays }) => ({ date, name, inDays })),
    });
    const img = await renderFlyer({ prompt: art.prompt, texts: [art.headline, ...art.lines], format: input.format, images: refs });

    const ext = img.mimeType.includes("jpeg") ? "jpg" : "png";
    const outputPath = `${clientId}/flyers/${row.id}.${ext}`;
    const { error: upErr } = await db.storage.from("brand").upload(outputPath, img.buffer, { contentType: img.mimeType, upsert: true });
    if (upErr) throw upErr;
    await db.from("flyers").update({ status: "done", output_path: outputPath, prompt: art.prompt }).eq("id", row.id);
    // el copy va aparte: si falta la migración 0012 no rompe el flyer
    await db.from("flyers").update({ caption: art.caption }).eq("id", row.id);
    return { id: row.id };
  } catch (e) {
    await db.from("flyers").update({ status: "failed", error: String((e as Error)?.message ?? e) }).eq("id", row.id);
    throw e;
  }
}
