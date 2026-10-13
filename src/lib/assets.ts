import type { SupabaseClient } from "@supabase/supabase-js";
import type { EditAsset } from "./ai/direct-edit";
import type { Edl } from "./edl/types";

/** Lee las imágenes de una edición y les pone URL firmada (para que Claude las vea). */
export async function signedAssets(db: SupabaseClient, raw: unknown, hours = 2): Promise<EditAsset[]> {
  const list = (Array.isArray(raw) ? raw : []).filter((a): a is EditAsset => typeof a?.path === "string");
  return Promise.all(
    list.map(async (a) => {
      const { data } = await db.storage.from("recordings").createSignedUrl(a.path, 60 * 60 * hours);
      return { ...a, url: data?.signedUrl };
    }),
  );
}

/** URLs firmadas de las imágenes que salen en el video (para la vista previa y el render). */
export async function assetUrlsForEdl(db: SupabaseClient, edl: Pick<Edl, "images"> | null | undefined, hours = 6) {
  const out: Record<string, string> = {};
  for (const im of edl?.images ?? []) {
    if (out[im.path]) continue;
    const { data } = await db.storage.from("recordings").createSignedUrl(im.path, 60 * 60 * hours);
    if (data?.signedUrl) out[im.path] = data.signedUrl;
  }
  return out;
}
