import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getClientContext } from "./engine";
import { loadResearch } from "./research";
import { loadImage } from "./flyers";
import { planRebrand, REBRAND_TONES, type RebrandBrief, type RebrandData, type RebrandTone } from "@/lib/ai/rebrand";
import { renderFlyer } from "@/lib/ai/flyer";

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export type RebrandImage = { direction: "A" | "B" | "C"; kind: "logo" | "monogram" | "mockup"; label: string; path: string; createdAt: string };

export function cleanRebrandBrief(body: Record<string, unknown>): RebrandBrief {
  const tones = (Array.isArray(body.tones) ? body.tones : []).filter((t): t is RebrandTone => typeof t === "string" && t in REBRAND_TONES);
  return {
    newName: str(body.newName, 60),
    suggestNames: body.suggestNames === true,
    why: str(body.why, 1000),
    keep: str(body.keep, 600),
    avoid: str(body.avoid, 600),
    likes: str(body.likes, 600),
    competitors: str(body.competitors, 600),
    tones,
    notes: str(body.notes, 1500),
  };
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Limpia lo que regresa la IA: colores válidos, exactamente 3 direcciones. */
function tidy(d: RebrandData): RebrandData {
  return {
    ...d,
    segment: d.segment.map((s) => ({ ...s, colors: s.colors.filter((c) => HEX.test(c)).slice(0, 4) })),
    directions: d.directions.slice(0, 3).map((dir) => ({ ...dir, palette: dir.palette.filter((c) => HEX.test(c.hex)).slice(0, 6) })),
  };
}

export async function createRebrand(db: SupabaseClient, clientId: string, userId: string | null, brief: RebrandBrief, uploads: string[]) {
  for (const p of uploads) if (!p.startsWith(`${clientId}/`) || p.includes("..")) throw new Error("Ruta inválida");
  const ctx = await getClientContext(db, clientId);
  const title = brief.newName ? `Rebranding ${brief.newName}` : `Rebranding ${ctx.client.name}`;
  const { data: row, error } = await db
    .from("rebrands")
    .insert({ client_id: clientId, title, brief: { ...brief, uploads }, created_by: userId })
    .select("id")
    .single();
  if (error) throw error;

  try {
    const [{ data: assets }, { data: comps }, research] = await Promise.all([
      db.from("brand_assets").select("path, kind, category").eq("client_id", clientId).order("created_at", { ascending: false }),
      db.from("competitors").select("handle, platform, followers, median_views, is_own_account").eq("client_id", clientId),
      loadResearch(db, clientId, ctx.brand.data),
    ]);
    // imágenes para que la IA vea: logo actual, lo que subieron para este análisis y las referencias de estilo
    const logos = (assets ?? []).filter((a) => a.kind === "library" && a.category === "logo").slice(0, 2).map((a) => a.path);
    const styles = (assets ?? []).filter((a) => a.kind === "style").slice(0, 3).map((a) => a.path);
    const paths = [...new Set([...logos, ...uploads, ...styles])].slice(0, 10);
    const urls: string[] = [];
    for (const p of paths) {
      const { data } = await db.storage.from("brand").createSignedUrl(p, 60 * 60);
      if (data?.signedUrl) urls.push(data.signedUrl);
    }

    const out = await planRebrand({
      brand: ctx.brand.data,
      client: { name: ctx.client.name, niche: ctx.client.niche, city: ctx.client.city, instagram: ctx.client.instagram, website: ctx.client.website },
      research,
      competitors: (comps ?? [])
        .filter((c) => !c.is_own_account)
        .map((c) => ({ handle: c.handle, platform: c.platform, followers: c.followers, medianViews: c.median_views })),
      brief,
      images: urls,
    });
    await db.from("rebrands").update({ data: tidy(out), status: "done" }).eq("id", row.id);
  } catch (e) {
    await db.from("rebrands").update({ status: "failed", error: (e as Error).message?.slice(0, 500) ?? String(e) }).eq("id", row.id);
    throw e;
  }
  return row.id as string;
}

/** Genera con Nano Banana el logo, el monograma o un mockup de una dirección. */
export async function generateRebrandImage(
  db: SupabaseClient,
  clientId: string,
  rebrandId: string,
  input: { direction: "A" | "B" | "C"; kind: "logo" | "monogram" | "mockup"; index?: number },
) {
  const { data: rb } = await db.from("rebrands").select("*").eq("id", rebrandId).eq("client_id", clientId).single();
  if (!rb?.data) throw new Error("Este rebranding todavía no está listo");
  const data = rb.data as RebrandData;
  const dir = data.directions.find((d) => d.key === input.direction);
  if (!dir) throw new Error("No encontré esa dirección");
  const images = (rb.images ?? []) as RebrandImage[];
  const name = (rb.brief?.newName as string | null) || (await db.from("clients").select("name").eq("id", clientId).single()).data?.name || "";

  let prompt: string;
  let label: string;
  const refs: Awaited<ReturnType<typeof loadImage>>[] = [];
  if (input.kind === "mockup") {
    const m = dir.mockups[input.index ?? 0];
    if (!m) throw new Error("No encontré ese mockup");
    // el mockup usa el último logo generado de esta dirección
    const logo = [...images].reverse().find((im) => im.direction === dir.key && im.kind === "logo");
    if (!logo) throw new Error("Primero genera el logo de esta dirección");
    refs.push(await loadImage(db, "brand", logo.path, "logo"));
    prompt = m.prompt;
    label = m.label;
  } else {
    prompt = input.kind === "logo" ? dir.logoPrompt : dir.monogramPrompt;
    label = input.kind === "logo" ? "Logo" : "Monograma";
  }

  const { buffer, mimeType } = await renderFlyer({
    prompt: `${prompt}\nBrand name: "${name}". Spell it exactly.`,
    texts: [],
    format: "square",
    images: refs,
    label: `Rebranding: ${label.toLowerCase()}`,
  });
  const ext = mimeType.includes("jpeg") ? "jpg" : "png";
  const path = `${clientId}/rebrand/${rebrandId}/${dir.key}-${input.kind}-${Date.now()}.${ext}`;
  const { error } = await db.storage.from("brand").upload(path, buffer, { contentType: mimeType });
  if (error) throw new Error(`No se pudo guardar la imagen (${error.message})`);

  // releemos para no pisar imágenes que se hayan generado al mismo tiempo
  const { data: fresh } = await db.from("rebrands").select("images").eq("id", rebrandId).single();
  const next = [...((fresh?.images ?? []) as RebrandImage[]), { direction: dir.key, kind: input.kind, label, path, createdAt: new Date().toISOString() }];
  await db.from("rebrands").update({ images: next }).eq("id", rebrandId);
  return path;
}
