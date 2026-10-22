import yauzl from "yauzl";

/**
 * Dropbox sin API: los links compartidos se descargan directo con ?dl=1.
 * - Link a un archivo: se baja el archivo.
 * - Link a una carpeta: Dropbox la entrega como .zip; de ahí sacamos el video más nuevo que no se haya usado.
 */

const VIDEO = /\.(mp4|mov|m4v|webm)$/i;
const IMAGE = /\.(jpe?g|png|webp)$/i;

export function directDropboxUrl(url: string) {
  const u = new URL(url.trim());
  if (!/(^|\.)dropbox\.com$/i.test(u.hostname) && !/dropboxusercontent\.com$/i.test(u.hostname)) throw new Error("El link no es de Dropbox");
  u.searchParams.delete("dl");
  u.searchParams.delete("raw");
  u.searchParams.set("dl", "1");
  return u.toString();
}

export const isDropboxFolder = (url: string) => /dropbox\.com\/(scl\/fo|sh)\//i.test(url);

async function download(url: string, maxMb = 1500) {
  const res = await fetch(directDropboxUrl(url), { redirect: "follow" });
  if (!res.ok) throw new Error(`Dropbox respondió ${res.status}. Revisa que el link sea público ("cualquiera con el link").`);
  const len = Number(res.headers.get("content-length") || 0);
  if (len > maxMb * 1024 * 1024) throw new Error(`El archivo de Dropbox pesa más de ${maxMb} MB`);
  const buf = Buffer.from(await res.arrayBuffer());
  const disposition = res.headers.get("content-disposition") ?? "";
  const name = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1];
  return { buf, name: name ? decodeURIComponent(name) : null, type: res.headers.get("content-type") ?? "" };
}

function readZip(buf: Buffer): Promise<{ name: string; modified: Date; size: number; read: () => Promise<Buffer> }[]> {
  return new Promise((ok, bad) => {
    // Dropbox mete una entrada "/" en el zip de la carpeta y yauzl la rechaza ("absolute path").
    // Por eso leemos los nombres sin validar y nosotros descartamos los raros.
    yauzl.fromBuffer(buf, { lazyEntries: true, decodeStrings: false }, (err, zip) => {
      if (err || !zip) return bad(err ?? new Error("zip inválido"));
      const out: { name: string; modified: Date; size: number; read: () => Promise<Buffer> }[] = [];
      zip.on("entry", (e: yauzl.Entry) => {
        const raw = e.fileName as unknown as Buffer | string;
        const fileName = (typeof raw === "string" ? raw : raw.toString("utf8")).replace(/\\/g, "/").replace(/^\/+/, "");
        const safe = fileName && !fileName.endsWith("/") && !fileName.split("/").includes("..");
        if (safe) {
          out.push({
            name: fileName,
            modified: e.getLastModDate(),
            size: e.uncompressedSize,
            read: () =>
              new Promise((res, rej) =>
                zip.openReadStream(e, (er, stream) => {
                  if (er || !stream) return rej(er ?? new Error("no se pudo leer"));
                  const chunks: Buffer[] = [];
                  stream.on("data", (c: Buffer) => chunks.push(c));
                  stream.on("end", () => res(Buffer.concat(chunks)));
                  stream.on("error", rej);
                }),
              ),
          });
        }
        zip.readEntry();
      });
      zip.on("end", () => ok(out));
      zip.on("error", bad);
      zip.readEntry();
    });
  });
}

/** Baja el video (o imagen) del link de Dropbox. En carpetas, el más nuevo que no esté en `used`. */
export async function fetchDropboxMedia(url: string, used: string[] = []) {
  const { buf, name, type } = await download(url);
  const isZip = isDropboxFolder(url) || /zip/i.test(type) || (name ?? "").toLowerCase().endsWith(".zip");
  if (!isZip) {
    const fname = name ?? "video.mp4";
    if (/text\/html/i.test(type)) throw new Error("Dropbox regresó una página en vez del archivo. Revisa que el link sea público.");
    return { buffer: buf, name: fname, kind: IMAGE.test(fname) ? ("image" as const) : ("video" as const), caption: null as string | null };
  }
  const entries = (await readZip(buf))
    .filter((e) => VIDEO.test(e.name) || IMAGE.test(e.name))
    .filter((e) => !used.includes(e.name))
    .sort((a, b) => b.modified.getTime() - a.modified.getTime());
  const pick = entries[0];
  if (!pick) throw new Error("No hay videos nuevos en la carpeta de Dropbox (los que hay ya se publicaron).");
  // si junto al video hay un .txt con el mismo nombre, ese es el copy
  const base = pick.name.replace(/\.[^.]+$/, "");
  const all = await readZip(buf);
  const txt = all.find((e) => e.name.toLowerCase() === `${base.toLowerCase()}.txt`);
  const caption = txt ? (await txt.read()).toString("utf8").trim() : null;
  return { buffer: await pick.read(), name: pick.name, kind: IMAGE.test(pick.name) ? ("image" as const) : ("video" as const), caption };
}

export const mimeFor = (name: string) =>
  /\.mov$/i.test(name) ? "video/quicktime" : /\.webm$/i.test(name) ? "video/webm" : /\.png$/i.test(name) ? "image/png" : /\.webp$/i.test(name) ? "image/webp" : /\.jpe?g$/i.test(name) ? "image/jpeg" : "video/mp4";

/** ¿Hay un video nuevo (no usado) en la carpeta? Para avisar si el editor no ha subido nada. */
export async function folderHasNew(url: string, used: string[]) {
  try {
    await fetchDropboxMedia(url, used);
    return true;
  } catch {
    return false;
  }
}

export type FolderFile = { name: string; modified: Date; size: number; kind: "video" | "image"; read: () => Promise<Buffer>; caption: string | null };

/** Todos los videos e imágenes de una carpeta compartida (con su .txt de copy si lo hay), del más viejo al más nuevo. */
export async function listDropboxFolder(url: string): Promise<FolderFile[]> {
  const { buf, name, type } = await download(url, 4000);
  const isZip = isDropboxFolder(url) || /zip/i.test(type) || (name ?? "").toLowerCase().endsWith(".zip");
  if (!isZip) {
    if (/text\/html/i.test(type)) throw new Error("Dropbox regresó una página en vez del archivo. Revisa que el link sea público.");
    const fname = name ?? "video.mp4";
    return [{ name: fname, modified: new Date(), size: buf.length, kind: IMAGE.test(fname) ? "image" : "video", read: async () => buf, caption: null }];
  }
  const all = await readZip(buf);
  const txts = new Map<string, () => Promise<Buffer>>();
  for (const e of all) if (/\.txt$/i.test(e.name)) txts.set(e.name.replace(/\.txt$/i, "").toLowerCase(), e.read);
  const media = all.filter((e) => (VIDEO.test(e.name) || IMAGE.test(e.name)) && !/(^|\/)(\.|__MACOSX)/.test(e.name));
  const out: FolderFile[] = [];
  for (const e of media.sort((a, b) => a.modified.getTime() - b.modified.getTime())) {
    const t = txts.get(e.name.replace(/\.[^.]+$/, "").toLowerCase());
    out.push({ name: e.name, modified: e.modified, size: e.size, kind: IMAGE.test(e.name) ? "image" : "video", read: e.read, caption: t ? (await t()).toString("utf8").trim() || null : null });
  }
  return out;
}
