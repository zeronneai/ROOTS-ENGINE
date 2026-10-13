"use client";
import { supabaseBrowser } from "./supabase/browser";

/** Reduce la foto a máx 2048 px antes de subirla (las del celular pesan mucho). PNG se queda PNG por la transparencia del logo. */
async function shrink(file: File, max = 2048): Promise<{ blob: Blob; ext: string; type: string }> {
  const isPng = file.type === "image/png";
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 3_000_000) return { blob: file, ext: isPng ? "png" : "jpg", type: file.type || "image/jpeg" };
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const type = isPng ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob>((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error("No se pudo procesar la imagen"))), type, 0.9));
    return { blob, ext: isPng ? "png" : "jpg", type };
  } catch {
    return { blob: file, ext: isPng ? "png" : "jpg", type: file.type || "image/jpeg" };
  }
}

/** Sube una imagen al bucket de marca del cliente y regresa su ruta. */
export async function uploadBrandImage(clientId: string, file: File, folder: string) {
  const { blob, ext, type } = await shrink(file);
  const path = `${clientId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabaseBrowser().storage.from("brand").upload(path, blob, { contentType: type });
  if (error) throw new Error(`${file.name}: ${error.message}`);
  return path;
}
